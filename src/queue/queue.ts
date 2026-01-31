import {ChannelType, Client, DMChannel, Message as DiscordMessage, TextChannel, ThreadChannel} from "discord.js";
import {FileMemory} from "../memory/fileMemory";
import {analyzeMessageType, shouldStoreAssistantMessage, shouldStoreUserMessage} from "../memory/memoryFilter";
import {DISCORD_TYPING_UPDATE_INTERVAL, FILTER_PATTERNS, MEMORY_FILE_PATH, MEMORY_MAX_TURNS} from "../utils/constants";
import {ImageAnalysisResult, processImages, processImagesWithMetadata} from "../services/imageService";
import {getWebContext} from "../services/searchService";
import {OllamaService} from "../services/ollamaService";
import {DiscordMessageManager, ImageAnalysisAnimation} from "./discordMessageManager";
import {EmojiReactionHandler} from "./emojiReactionHandler";
import {buildCurrentUserBlock, buildHistoryBlock, buildThreadStarterBlock, buildWebContextBlock} from "./promptBuilder";
import {UserProfileService} from "../services/userProfileService";
import {logBotImageAnalysis, logBotResponse, logBotWebSearch, logError} from "../utils/discordLogger";
import {BotStatus, clearStatus, setStatus} from "../services/statusService";
import {getDMRecentTurns} from "../services/dmMemoryService";

const wait = require("node:timers/promises").setTimeout;

interface DirectLLMRequest {
    prompt: string;
    userId: string;
    userName: string;
    channel: TextChannel | ThreadChannel | DMChannel;
    client: Client;
    replyToMessage?: DiscordMessage;
    referencedMessage?: DiscordMessage;
    imageUrls?: string[];
    sendMessage?: boolean;
    threadStarterContext?: {
        content: string;
        author: string;
        imageUrls: string[];
    };
    skipImageAnalysis?: boolean; // Flag pour indiquer que les images sont déjà analysées
    preAnalyzedImages?: ImageAnalysisResult[]; // Résultats d'analyse pré-calculés
    originalUserMessage?: string; // Message original de l'utilisateur (pour les logs, sans les instructions système)
    preStartedAnimation?: ImageAnalysisAnimation; // Animation déjà démarrée à réutiliser
    skipMemory?: boolean; // Flag pour ne pas enregistrer dans la mémoire (ex: messages de bienvenue)
    returnResponse?: boolean; // Flag pour retourner le contenu final généré
}

// Configuration mémoire persistante
const memory = new FileMemory(MEMORY_FILE_PATH);
const ollamaService = new OllamaService();

// ===== QUEUE GLOBALE UNIQUE =====
// Avec un seul LLM, toutes les requêtes (DM + Serveur) doivent être traitées séquentiellement
type AsyncJob<T> = () => Promise<T>;
let globalQueue: Promise<unknown> = Promise.resolve();
const activeStreams = new Map<string, { abortFlag: boolean; channelId: string }>();
const activeImageAnalysis = new Map<string, ImageAnalysisAnimation>(); // Animations d'analyse d'image actives
const pendingResponses = new Map<string, { resolve: (value: string) => void; reject: (error: any) => void }>(); // Pour stocker les promesses de réponse

// NOUVEAU : Cache des dernières questions par canal pour le contexte conversationnel
// Permet de garder les "Oui"/"Non" qui répondent à des questions importantes
interface RecentQuestion {
    timestamp: number;
    userId: string;
    userName: string;
    question: string;
}

const recentQuestionsByChannel = new Map<string, RecentQuestion>();
const QUESTION_CONTEXT_TIMEOUT = 30000; // 30 secondes

/**
 * Mettre une tâche en queue globale unique
 * Garantit que toutes les requêtes LLM (DM + Serveur) sont traitées séquentiellement
 */
function enqueueGlobally<T>(job: AsyncJob<T>): Promise<T> {
    const prev = globalQueue;

    const next = prev
        .catch(() => {
            // Avaler les erreurs du job précédent pour ne pas bloquer la file
        })
        .then(job);

    globalQueue = next.catch(() => {
        // Capturer les erreurs pour ne pas casser la chaîne
    });

    return next;
}

// Fonction pour enregistrer un message utilisateur passivement (Mode Hybride)
// L'IA voit le message et le garde en mémoire, mais ne répond pas
// Retourne true si le message a été sauvegardé, false sinon
export async function recordPassiveMessage(
    userId: string,
    userName: string,
    messageContent: string,
    channelId: string,
    channelName: string,
    imageUrls?: string[],
    botReaction?: string, // Pour enregistrer les réactions du bot (ex: "🤗")
    isReply?: boolean // Pour indiquer si c'est une réponse à un autre message
): Promise<boolean> {
    const trimmed = messageContent.trim();

    // NOUVEAU : Détecter si c'est une question importante
    const isImportantQuestion = trimmed.includes('?') &&
        !(/^(ça va|ca va|cv|quoi de neuf)\s*\??$/i.test(trimmed)); // Exclure les questions sociales basiques

    // Si c'est une question importante, l'enregistrer dans le cache
    if (isImportantQuestion) {
        recentQuestionsByChannel.set(channelId, {
            timestamp: Date.now(),
            userId: userId,
            userName: userName,
            question: messageContent
        });
    }

    // NOUVEAU : Vérifier si c'est une réponse courte Oui/Non dans le contexte d'une question récente
    const isShortResponse = FILTER_PATTERNS.SHORT_RESPONSE.test(trimmed) && trimmed.length < 20;

    // NOUVEAU : Détecter les activités courantes (réponses à "Tu fais quoi?", etc.)
    const isActivity = FILTER_PATTERNS.ACTIVITY.test(trimmed);

    // NOUVEAU : Détecter "rien" comme réponse valide
    const isNothingResponse = FILTER_PATTERNS.NOTHING_RESPONSE.test(trimmed);

    // NOUVEAU : Détecter les nombres seuls (réponses à des questions quantitatives)
    const isNumericAnswer = FILTER_PATTERNS.NUMERIC_ANSWER.test(trimmed);

    let forceStore = false;

    if (isShortResponse) {
        const recentQuestion = recentQuestionsByChannel.get(channelId);
        if (recentQuestion) {
            const timeSinceQuestion = Date.now() - recentQuestion.timestamp;

            // Si la question a été posée dans les 30 dernières secondes par quelqu'un d'autre
            if (timeSinceQuestion < QUESTION_CONTEXT_TIMEOUT && recentQuestion.userId !== userId) {
                forceStore = true;
                console.log(`[Memory Passive]: 💡 Short response "${trimmed}" kept (answer to recent question: "${recentQuestion.question.substring(0, 50)}...")`);
            }
        }
    }

    // NOUVEAU : Forcer le stockage des activités même si courtes (réponse à "Tu fais quoi?")
    if (isActivity) {
        const recentQuestion = recentQuestionsByChannel.get(channelId);
        if (recentQuestion) {
            const timeSinceQuestion = Date.now() - recentQuestion.timestamp;

            // Si une question a été posée récemment (probablement "Tu fais quoi?")
            if (timeSinceQuestion < QUESTION_CONTEXT_TIMEOUT && recentQuestion.userId !== userId) {
                forceStore = true;
                console.log(`[Memory Passive]: 💡 Activity "${trimmed}" kept (answer to recent question: "${recentQuestion.question.substring(0, 50)}...")`);
            }
        }
    }

    // NOUVEAU : Forcer le stockage des réponses numériques (rank, niveau, âge, etc.)
    if (isNumericAnswer) {
        const recentQuestion = recentQuestionsByChannel.get(channelId);
        if (recentQuestion) {
            const timeSinceQuestion = Date.now() - recentQuestion.timestamp;

            // Si une question a été posée récemment (probablement quantitative)
            if (timeSinceQuestion < QUESTION_CONTEXT_TIMEOUT && recentQuestion.userId !== userId) {
                forceStore = true;
                console.log(`[Memory Passive]: 💡 Numeric answer "${trimmed}" kept (answer to recent question: "${recentQuestion.question.substring(0, 50)}...")`);
            }
        }
    }

    // NOUVEAU : Forcer le stockage de "rien" comme réponse valide
    if (isNothingResponse) {
        const recentQuestion = recentQuestionsByChannel.get(channelId);
        if (recentQuestion) {
            const timeSinceQuestion = Date.now() - recentQuestion.timestamp;

            // Si une question a été posée récemment (probablement "Tu fais quoi?")
            if (timeSinceQuestion < QUESTION_CONTEXT_TIMEOUT && recentQuestion.userId !== userId) {
                forceStore = true;
                console.log(`[Memory Passive]: 💡 Nothing response "${trimmed}" kept (answer to recent question: "${recentQuestion.question.substring(0, 50)}...")`);
            }
        }
    }

    // Vérifier contenu inapproprié AVANT tout (même si forceStore)
    const isInappropriateContent = /\b(sexe|sex|cul|baiser|porn|nudes?)\b/i.test(messageContent);

    if (isInappropriateContent) {
        console.log(`[Memory Passive]: 🚫 Inappropriate content skipped from ${userName} in #${channelName}`);
        return false;
    }

    // Filtrer le message avant de l'enregistrer (sauf si forceStore)
    const shouldStore = forceStore || shouldStoreUserMessage(messageContent);

    if (!shouldStore) {
        console.log(`[Memory Passive]: ⏭️ Message skipped from ${userName} in #${channelName}`);
        return false;
    }

    const messageType = analyzeMessageType(messageContent);

    // Traiter les images si présentes
    let imageDescriptions: string[] = [];
    if (imageUrls && imageUrls.length > 0) {
        try {
            imageDescriptions = await processImages(imageUrls);
        } catch (error) {
            console.error("[Memory Passive] Error processing images:", error);
        }
    }

    // Enregistrer le message comme un tour passif (sans réponse du bot)
    await memory.appendTurn(
        {
            ts: Date.now(),
            discordUid: userId,
            displayName: userName,
            channelId: channelId,
            channelName: channelName,
            userText: messageContent,
            assistantText: botReaction ? `[Réaction emoji: ${botReaction}]` : undefined, // Si réaction, on la add-note
            isPassive: true, // Marqué comme passif
            isReply: isReply, // NOUVEAU : indique si c'est un reply
            ...(imageDescriptions.length > 0 ? {imageDescriptions: imageDescriptions.slice(0, 5)} : {}),
            ...(botReaction ? {assistantReactions: [botReaction]} : {}), // Enregistrer la réaction
        },
        MEMORY_MAX_TURNS
    );

    const reactionNote = botReaction ? ` [reaction: ${botReaction}]` : "";
    const replyNote = isReply ? " [reply]" : "";
    const contextNote = forceStore ? " [contextual-response]" : "";
    console.log(`[Memory Passive]: 👁️ Recorded from ${userName} in #${channelName} [${messageType.type}]${imageDescriptions.length > 0 ? ` [${imageDescriptions.length} images]` : ""}${reactionNote}${replyNote}${contextNote}`);
    return true;
}

// Fonction pour effacer TOUTE la mémoire globale
export async function clearAllMemory(): Promise<void> {
    await memory.clearAll();
    console.log(`[Memory] Global memory cleared (all channels)`);
}

// Fonction pour arrêter un stream en cours
export function abortStream(channelKey: string): boolean {
    const streamInfo = activeStreams.get(channelKey);
    if (streamInfo) {
        streamInfo.abortFlag = true;
        activeStreams.delete(channelKey);
        console.log(`[AbortStream] Stream aborted for channel ${channelKey}`);
        return true;
    }
    return false;
}

// Fonction pour enregistrer une animation d'analyse d'image
export function registerImageAnalysis(channelKey: string, animation: ImageAnalysisAnimation): void {
    activeImageAnalysis.set(channelKey, animation);
}

// Fonction pour arrêter une analyse d'image en cours
export async function abortImageAnalysis(channelKey: string): Promise<boolean> {
    const animation = activeImageAnalysis.get(channelKey);
    if (animation) {
        await animation.stop();
        activeImageAnalysis.delete(channelKey);
        console.log(`[AbortImageAnalysis] Image analysis aborted for channel ${channelKey}`);
        return true;
    }
    return false;
}

// Fonction pour nettoyer une animation d'analyse terminée
export function cleanupImageAnalysis(channelKey: string): void {
    activeImageAnalysis.delete(channelKey);
}

// Fonction pour traiter une requête LLM directement (sans thread, pour le watch de channel)
export async function processLLMRequest(request: DirectLLMRequest): Promise<string | void> {
    const {prompt, userId, userName, channel, client, replyToMessage, imageUrls, sendMessage = true, threadStarterContext, skipImageAnalysis = false, preAnalyzedImages = [], originalUserMessage, preStartedAnimation, skipMemory = false, returnResponse = false} = request;

    // Clé de mémoire unique par channel
    // Si on est dans le watched channel, utiliser son ID fixe
    // Sinon, utiliser l'ID du channel actuel (pour les mentions dans d'autres channels)
    const watchedChannelId = process.env.WATCH_CHANNEL_ID;
    const channelKey = channel.id === watchedChannelId ? watchedChannelId : channel.id;

    // Si returnResponse est demandé, créer une promesse pour attendre le résultat
    let responsePromise: Promise<string> | undefined;
    if (returnResponse) {
        responsePromise = new Promise<string>((resolve, reject) => {
            pendingResponses.set(channelKey, {resolve, reject});
        });
    }

    // Mettre en queue globale unique (un seul LLM pour toutes les requêtes)
    enqueueGlobally(async () => {
        const requestStartTime = Date.now();
        console.log(`[GlobalQueue] Processing request from user ${userId} in ${channel.type === ChannelType.DM ? 'DM' : `#${(channel as any).name || channelKey}`}`);
        console.log(`[processLLMRequest] User ${userId} sent prompt: ${prompt}${imageUrls && imageUrls.length > 0 ? ` with ${imageUrls.length} image(s)` : ""}`);


        // Enregistrer ce stream comme actif
        const streamInfo = {abortFlag: false, channelId: channel.id};
        activeStreams.set(channelKey, streamInfo);

        // Changer le statut selon l'activité
        if (imageUrls && imageUrls.length > 0 && !skipImageAnalysis) {
            await setStatus(client, imageUrls.length === 1 ? BotStatus.ANALYZING_IMAGE : BotStatus.ANALYZING_IMAGES(imageUrls.length));
        } else {
            await setStatus(client, BotStatus.READING_MEMORY);
        }

        // Gérer l'animation d'analyse d'image (seulement si pas déjà analysée)
        // Si une animation a déjà été démarrée (par forumThreadHandler), la réutiliser
        const analysisAnimation = preStartedAnimation || new ImageAnalysisAnimation();
        if (imageUrls && imageUrls.length > 0 && !skipImageAnalysis && !preStartedAnimation) {
            await analysisAnimation.start(replyToMessage, channel);
        }

        // Traiter les images avec métadonnées complètes
        let imageResults: ImageAnalysisResult[] = [];
        let imageDescriptions: string[] = [];

        if (imageUrls && imageUrls.length > 0) {
            // Si les images sont déjà analysées (depuis forumThreadHandler), utiliser les résultats
            if (skipImageAnalysis && preAnalyzedImages.length > 0) {
                console.log(`[processLLMRequest] Using pre-analyzed images (${preAnalyzedImages.length})`);
                imageResults = preAnalyzedImages;
                imageDescriptions = imageResults.map(r => r.description);
                // Ne pas logger ici, déjà loggé dans forumThreadHandler
            } else {
                // Sinon, analyser les images normalement
                imageResults = await processImagesWithMetadata(imageUrls);
                imageDescriptions = imageResults.map(r => r.description);

                // Logger l'analyse d'images avec toutes les métadonnées
                if (imageResults.length > 0) {
                    await logBotImageAnalysis(userName, imageResults);
                }
            }
        }

        // Traiter les images du thread starter si présent
        let threadStarterImageDescriptions: string[] = [];
        if (threadStarterContext && threadStarterContext.imageUrls.length > 0) {
            console.log(`[processLLMRequest] Processing ${threadStarterContext.imageUrls.length} image(s) from thread starter`);
            const threadImageResults = await processImagesWithMetadata(threadStarterContext.imageUrls);
            threadStarterImageDescriptions = threadImageResults.map(r => r.description);

            if (threadImageResults.length > 0) {
                await logBotImageAnalysis(`${userName} (thread starter)`, threadImageResults);
            }
        }

        // Déterminer si c'est un DM
        const isDM = channel.type === ChannelType.DM;

        // Charger les prompts système avec le contexte approprié (DM ou serveur)
        const {finalPrompt: finalSystemPrompt} = ollamaService.loadSystemPrompts(channel.id, isDM);

        // Charger la mémoire appropriée
        let recentTurns;

        if (isDM) {
            // Charger la mémoire DM de l'utilisateur
            recentTurns = await getDMRecentTurns(userId, MEMORY_MAX_TURNS);
            console.log(`[Memory]: ${recentTurns.length} DM turns loaded for ${userName}`);
        } else {
            // Charger l'historique de mémoire GLOBAL avec Sliding Window
            recentTurns = await memory.getRecentTurns(MEMORY_MAX_TURNS);
            console.log(`[Memory]: ${recentTurns.length} turns loaded (Sliding Window active)`);
        }

        // Obtenir le contexte web si nécessaire
        const webSearchStartTime = Date.now();

        // Détecter si une recherche web est nécessaire
        const needsWebSearch = prompt.toLowerCase().includes("recherche") ||
            prompt.toLowerCase().includes("google") ||
            prompt.toLowerCase().includes("cherche") ||
            prompt.includes("?");

        if (needsWebSearch) {
            await setStatus(client, BotStatus.SEARCHING_WEB);
        }

        const webContext = await getWebContext(prompt);
        if (webContext) {
            const webSearchTime = Date.now() - webSearchStartTime;
            console.log(`[SearchService] Web context added to prompt (${webSearchTime}ms)`);

            // Logger la recherche web avec le temps
            await logBotWebSearch(userName, prompt, webContext.facts?.length || 0, webSearchTime);

            // Changer le statut après la recherche web
            await setStatus(client, BotStatus.THINKING);
        }

        // Récupérer le profil de l'utilisateur actuel
        const userProfileSummary = UserProfileService.getProfileSummary(userId);
        let userProfileBlock = "";
        if (userProfileSummary) {
            userProfileBlock = `\n\n═══ PROFIL DE L'UTILISATEUR ACTUEL: ${userName.toUpperCase()} (UID Discord: ${userId}) ═══\n⚠️ Ce profil appartient à la personne qui t'envoie le message actuel.\n${userProfileSummary}\n═══ FIN DU PROFIL DE ${userName.toUpperCase()} ═══`;
            console.log(`[UserProfile] Profile loaded for ${userName}`);
        }

        // Obtenir le nom du channel actuel (ou "DM avec {userName}" si c'est un DM)
        const channelName = isDM
            ? `DM avec ${userName}`
            : ((channel as any).name || `channel-${channel.id}`);

        // Construire les blocs de prompt
        const threadStarterBlock = threadStarterContext ? buildThreadStarterBlock(threadStarterContext, threadStarterImageDescriptions) : "";
        const historyBlock = buildHistoryBlock(recentTurns, channel.id);
        const webBlock = buildWebContextBlock(webContext);
        const currentUserBlock = buildCurrentUserBlock(userId, userName, prompt, imageDescriptions, recentTurns);

        // Assembler les messages pour l'API
        // Le thread starter va EN PREMIER, avant l'historique
        // Le profil utilisateur vient après le prompt système mais avant le reste
        const messages = [
            {
                role: "system" as const,
                content: `${finalSystemPrompt}${userProfileBlock}\n\n${threadStarterBlock}${webBlock}${historyBlock.length > 0 ? `\n\n${historyBlock}` : ""}`,
            },
            {
                role: "user" as const,
                content: currentUserBlock,
            },
        ];

        if (imageDescriptions.length > 0) {
            console.log(`[Images]: ${imageDescriptions.length} image description(s) included in context`);
        }

        // Changer le statut à "écrit"
        await setStatus(client, BotStatus.WRITING);

        // Démarrer l'indicateur "est en train d'écrire" de Discord
        let typingInterval: NodeJS.Timeout | null = null;
        try {
            // Envoyer l'indicateur immédiatement
            await channel.sendTyping();
            // Renouveler toutes les 5 secondes (l'indicateur expire après 10 secondes)
            typingInterval = setInterval(async () => {
                try {
                    await channel.sendTyping();
                } catch (error) {
                    // Ignorer les erreurs (canal supprimé, etc.)
                }
            }, 5000);
        } catch (error) {
            console.warn("[processLLMRequest] Could not send typing indicator:", error);
        }

        console.log(`[processLLMRequest] Sending request to Ollama`);

        try {
            // TWO-STEP APPROACH :
            // 1. Première requête : Générer la réponse SANS tools (pour garantir une réponse textuelle)
            // 2. Deuxième requête : Analyser avec tools en arrière-plan pour extraire les infos
            const response = await ollamaService.chat(messages, {}, true, undefined); // Pas de tools pour la première requête
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let result = "";

            // Gestionnaires
            const messageManager = new DiscordMessageManager(channel, replyToMessage);
            messageManager.setAnalysisAnimation(analysisAnimation);

            // Configurer le callback pour arrêter le typing indicator dès le premier message envoyé
            messageManager.setOnFirstMessageSent(() => {
                if (typingInterval) {
                    clearInterval(typingInterval);
                    typingInterval = null;
                    console.log("[processLLMRequest] Typing indicator stopped (first message sent)");
                }
            });

            const emojiHandler = new EmojiReactionHandler(replyToMessage);

            let jsonBuffer = "";
            let promptTokens = 0;
            let completionTokens = 0;
            let totalTokens = 0;
            let toolCalls: any[] = []; // Stocker les tool calls (pour la 2e requête)

            const throttleResponseInterval = setInterval(() => {
                if (sendMessage) {
                    messageManager.throttleUpdate().catch((err) => console.error("[Throttle] Update error:", err));
                }
            }, DISCORD_TYPING_UPDATE_INTERVAL);


            return new ReadableStream({
                start(controller) {
                    return pump();

                    function pump(): any {
                        return reader?.read().then(async function ({done, value}) {
                            if (streamInfo.abortFlag) {
                                console.log(`[processLLMRequest] Stream aborted by user for channel ${channelKey}`);
                                clearInterval(throttleResponseInterval);
                                if (typingInterval) clearInterval(typingInterval);
                                await analysisAnimation.stop();
                                activeStreams.delete(channelKey);
                                controller.close();
                                return;
                            }

                            if (done) {
                                console.log(`[processLLMRequest] Request complete for user ${userId}`);

                                if (totalTokens > 0) {
                                    console.log(`[Tokens] Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}`);
                                }

                                await wait(2000);
                                if (sendMessage && messageManager.hasMessages()) {
                                    await messageManager.finalizeLastMessage();
                                }

                                // Nettoyer et sauvegarder
                                const cleanedText = await emojiHandler.extractAndApply(result);
                                const isModerationRefusal =
                                    cleanedText.toLowerCase().includes("je suis désolée") ||
                                    cleanedText.toLowerCase().includes("je ne peux pas répondre") ||
                                    cleanedText.toLowerCase().includes("je ne répondrai pas");

                                // Vérifier qu'il y a du texte en plus de l'emoji
                                const hasTextContent = cleanedText.trim().length > 0;

                                if (!hasTextContent) {
                                    console.log(`[processLLMRequest] ⚠️ No text content after emoji extraction, skipping message send`);
                                }

                                if (sendMessage && hasTextContent && !isModerationRefusal) {
                                    // Récupérer les réactions appliquées
                                    const appliedEmojis = emojiHandler.getAppliedEmojis();
                                    const reactionEmoji = appliedEmojis.length > 0 ? appliedEmojis[0] : undefined;

                                    // Calculer le temps de réponse total
                                    const responseTime = Date.now() - requestStartTime;

                                    // Filtrage intelligent de la mémoire
                                    const shouldStoreUser = shouldStoreUserMessage(prompt);
                                    const shouldStoreAssistant = shouldStoreAssistantMessage(cleanedText);

                                    // Forcer la sauvegarde si le message contient des images ou du contexte web
                                    const hasImportantContext = imageDescriptions.length > 0 || webContext !== null;
                                    const willSaveInMemory = (shouldStoreUser && shouldStoreAssistant) || hasImportantContext;

                                    // Logger la réponse de Netricsa avec l'info de mémoire
                                    await logBotResponse(
                                        userName,
                                        userId,
                                        channelName,
                                        originalUserMessage || prompt, // Utiliser le message original si fourni, sinon le prompt complet
                                        cleanedText,
                                        totalTokens,
                                        imageDescriptions.length > 0,
                                        webContext !== null,
                                        reactionEmoji,
                                        responseTime,
                                        willSaveInMemory
                                    );

                                    if (willSaveInMemory && !skipMemory) {
                                        const messageType = analyzeMessageType(prompt);

                                        // Détecter si c'est un reply
                                        const isReply = !!replyToMessage?.reference?.messageId;

                                        await memory.appendTurn(
                                            {
                                                ts: Date.now(),
                                                discordUid: userId,
                                                displayName: userName,
                                                channelId: channel.id,
                                                channelName: channelName,
                                                userText: prompt,
                                                assistantText: cleanedText,
                                                isReply: isReply, // NOUVEAU : enregistrer si c'est un reply
                                                ...(imageDescriptions.length > 0 ? {imageDescriptions: imageDescriptions.slice(0, 5)} : {}),
                                                ...(webContext ? {webContext} : {}),
                                                ...(emojiHandler.getAppliedEmojis().length > 0 ? {assistantReactions: emojiHandler.getAppliedEmojis()} : {}),
                                            },
                                            MEMORY_MAX_TURNS
                                        );

                                        const contextInfo = [];
                                        if (imageDescriptions.length > 0) contextInfo.push("images");
                                        if (emojiHandler.getAppliedEmojis().length > 0) contextInfo.push("reactions");
                                        if (messageType.confidence > 0.7) contextInfo.push(`type:${messageType.type}`);
                                        if (isReply) contextInfo.push("reply");

                                        console.log(`[Memory]: ✅ Saved in #${channelName}${contextInfo.length > 0 ? ` [${contextInfo.join(", ")}]` : ""}`);
                                    } else {
                                        // Message filtré (bruit conversationnel)
                                        const reason = !shouldStoreUser ? "user message too short/noisy" : "assistant response too short";
                                        console.log(`[Memory]: ⏭️  Skipped (${reason}) in #${channelName}`);
                                    }
                                } else if (isModerationRefusal) {
                                    console.log(`[Memory]: 🚫 Moderation refusal detected, NOT saving to memory`);
                                }

                                // Réinitialiser le statut
                                await clearStatus(client);

                                activeStreams.delete(channelKey);
                                clearInterval(throttleResponseInterval);
                                if (typingInterval) clearInterval(typingInterval);
                                controller.close();

                                // Résoudre la promesse avec le contenu si demandé
                                const pending = pendingResponses.get(channelKey);
                                if (pending) {
                                    pending.resolve(cleanedText);
                                    pendingResponses.delete(channelKey);
                                }
                                return;
                            }

                            jsonBuffer += decoder.decode(value, {stream: true});
                            const lines = jsonBuffer.split("\n");
                            jsonBuffer = lines.pop() || "";

                            for (const line of lines) {
                                if (!line.trim()) continue;

                                if (process.env.DEBUG_OLLAMA_RAW === "1") {
                                    console.log("[Ollama Raw Line]", line);
                                }

                                let decodedChunk: any;
                                try {
                                    decodedChunk = JSON.parse(line);
                                } catch (parseError) {
                                    console.error("[processLLMRequest] JSON parse error:", parseError);
                                    continue;
                                }

                                const chunk = decodedChunk.message?.delta || decodedChunk.message?.content || "";

                                // Détecter les tool calls
                                if (decodedChunk.message?.tool_calls && decodedChunk.message.tool_calls.length > 0) {
                                    toolCalls.push(...decodedChunk.message.tool_calls);
                                    console.log(`[ToolCall] Detected ${decodedChunk.message.tool_calls.length} tool call(s)`);
                                }

                                if (decodedChunk.prompt_eval_count) promptTokens = decodedChunk.prompt_eval_count;
                                if (decodedChunk.eval_count) completionTokens = decodedChunk.eval_count;
                                if (promptTokens && completionTokens) totalTokens = promptTokens + completionTokens;

                                result += chunk;

                                const cleanedResult = await emojiHandler.extractAndApply(result);
                                messageManager.addToCurrentChunk(cleanedResult);
                            }

                            controller.enqueue(value);
                            return pump();
                        });
                    }
                },
            });
        } catch (error) {
            console.error("[processLLMRequest] Error:", error);

            // Arrêter l'indicateur typing
            if (typingInterval) clearInterval(typingInterval);

            // Réinitialiser le statut en cas d'erreur
            await clearStatus(client);

            // Rejeter la promesse en cas d'erreur
            const pending = pendingResponses.get(channelKey);
            if (pending) {
                pending.reject(error);
                pendingResponses.delete(channelKey);
            }

            await logError("Erreur de traitement LLM", undefined, [
                {name: "Utilisateur", value: userName, inline: true},
                {name: "Canal", value: (channel as any).name || channel.type === ChannelType.DM ? "DM" : "Thread", inline: true},
                {name: "Erreur", value: error instanceof Error ? error.message : String(error)}
            ]);

            if (replyToMessage) {
                await replyToMessage.reply("An error occurred while processing your message.");
            } else {
                await channel.send("An error occurred while processing your message.");
            }
        }
    });

    // Retourner la promesse si returnResponse est demandé
    return responsePromise;
}
