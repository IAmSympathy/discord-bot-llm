import {Message as DiscordMessage, TextChannel, ThreadChannel} from "discord.js";
import {FileMemory} from "../memory/fileMemory";
import {DISCORD_TYPING_UPDATE_INTERVAL, MEMORY_FILE_PATH, MEMORY_MAX_TURNS} from "../utils/constants";
import {processImages} from "../services/imageService";
import {getWebContext} from "../services/searchService";
import {OllamaService} from "../services/ollamaService";
import {DiscordMessageManager, ImageAnalysisAnimation} from "./discordMessageManager";
import {EmojiReactionHandler} from "./emojiReactionHandler";
import {buildCurrentUserBlock, buildHistoryBlock, buildWebContextBlock} from "./promptBuilder";

const wait = require("node:timers/promises").setTimeout;

interface DirectLLMRequest {
    prompt: string;
    userId: string;
    userName: string;
    channel: TextChannel | ThreadChannel;
    replyToMessage?: DiscordMessage;
    referencedMessage?: DiscordMessage;
    imageUrls?: string[];
    sendMessage?: boolean;
}

// Configuration mémoire persistante
const memory = new FileMemory(MEMORY_FILE_PATH);
const ollamaService = new OllamaService();

// Système de queue par channel pour traiter les requêtes séquentiellement
type AsyncJob<T> = () => Promise<T>;
const channelQueues = new Map<string, Promise<unknown>>();
const activeStreams = new Map<string, { abortFlag: boolean; channelId: string }>();

function enqueuePerChannel<T>(channelKey: string, job: AsyncJob<T>): Promise<T> {
    const prev = channelQueues.get(channelKey) ?? Promise.resolve();

    const next = prev
        .catch(() => {
            // Avaler les erreurs du job précédent pour ne pas bloquer la file
        })
        .then(job);

    channelQueues.set(
        channelKey,
        next.finally(() => {
            // Nettoyage si personne n'a enchaîné après
            if (channelQueues.get(channelKey) === next) channelQueues.delete(channelKey);
        }),
    );

    return next;
}

// Fonction pour effacer la mémoire d'un channel
export async function clearMemory(channelKey: string): Promise<void> {
    await memory.clearChannel(channelKey);
    console.log(`[Memory] Channel ${channelKey} memory cleared`);
}

// Fonction pour effacer TOUTE la mémoire (tous les channels)
export async function clearAllMemory(): Promise<void> {
    await memory.clearAll();
    console.log(`[Memory] All channels memory cleared`);
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

// Fonction pour traiter une requête LLM directement (sans thread, pour le watch de channel)
export async function processLLMRequest(request: DirectLLMRequest) {
    const {prompt, userId, userName, channel, replyToMessage, imageUrls, sendMessage = true} = request;

    // Clé de mémoire unique par channel
    // Si on est dans le watched channel, utiliser son ID fixe
    // Sinon, utiliser l'ID du channel actuel (pour les mentions dans d'autres channels)
    const watchedChannelId = process.env.WATCH_CHANNEL_ID;
    const channelKey = channel.id === watchedChannelId ? watchedChannelId : channel.id;

    // Mettre en queue pour traiter séquentiellement par channel
    return enqueuePerChannel(channelKey, async () => {
        console.log(`[processLLMRequest] User ${userId} sent prompt: ${prompt}${imageUrls && imageUrls.length > 0 ? ` with ${imageUrls.length} image(s)` : ""}`);

        // Enregistrer ce stream comme actif
        const streamInfo = {abortFlag: false, channelId: channel.id};
        activeStreams.set(channelKey, streamInfo);

        // Gérer l'animation d'analyse d'image
        const analysisAnimation = new ImageAnalysisAnimation();
        if (imageUrls && imageUrls.length > 0) {
            await analysisAnimation.start(replyToMessage, channel);
        }

        // Traiter les images
        const imageDescriptions = imageUrls && imageUrls.length > 0 ? await processImages(imageUrls) : [];

        // Charger les prompts système
        const {finalPrompt: finalSystemPrompt} = ollamaService.loadSystemPrompts(channel.id);

        // Récupérer l'historique de mémoire
        const recentTurns = await memory.getRecentTurns(channelKey, MEMORY_MAX_TURNS);

        // Obtenir le contexte web si nécessaire
        const webContext = await getWebContext(prompt);
        if (webContext) {
            console.log("[SearchService] Web context added to prompt");
        }

        // Construire les blocs de prompt
        const historyBlock = buildHistoryBlock(recentTurns);
        const webBlock = buildWebContextBlock(webContext);
        const currentUserBlock = buildCurrentUserBlock(userId, userName, prompt, imageDescriptions);

        // Assembler les messages pour l'API
        const messages = [
            {
                role: "system" as const,
                content: `${finalSystemPrompt}\n\n${webBlock}${historyBlock.length > 0 ? `\n\n${historyBlock}` : ""}`,
            },
            {
                role: "user" as const,
                content: currentUserBlock,
            },
        ];

        console.log(`[Memory]: ${recentTurns.length} turns loaded`);
        if (imageDescriptions.length > 0) {
            console.log(`[Images]: ${imageDescriptions.length} image description(s) included in context`);
        }


        console.log(`[processLLMRequest] Sending request to Ollama`);

        try {
            const response = await ollamaService.chat(messages);
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let result = "";

            // Gestionnaires
            const messageManager = new DiscordMessageManager(channel, replyToMessage);
            messageManager.setAnalysisAnimation(analysisAnimation);
            const emojiHandler = new EmojiReactionHandler(replyToMessage);

            let jsonBuffer = "";
            let promptTokens = 0;
            let completionTokens = 0;
            let totalTokens = 0;

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

                                if (sendMessage && cleanedText.length > 0 && !isModerationRefusal) {
                                    await memory.appendTurn(
                                        channelKey,
                                        {
                                            ts: Date.now(),
                                            discordUid: userId,
                                            displayName: userName,
                                            userText: prompt,
                                            assistantText: cleanedText,
                                            ...(imageDescriptions.length > 0 ? {imageDescriptions: imageDescriptions.slice(0, 5)} : {}),
                                            ...(webContext ? {webContext} : {}),
                                            ...(emojiHandler.getAppliedEmojis().length > 0 ? {assistantReactions: emojiHandler.getAppliedEmojis()} : {}),
                                        },
                                        MEMORY_MAX_TURNS
                                    );
                                    console.log(`[Memory]: Conversation saved${imageDescriptions.length > 0 ? " with images" : ""}${emojiHandler.getAppliedEmojis().length > 0 ? " and reactions" : ""}`);
                                } else if (isModerationRefusal) {
                                    console.log(`[Memory]: Moderation refusal detected, NOT saving to memory`);
                                }

                                activeStreams.delete(channelKey);
                                clearInterval(throttleResponseInterval);
                                controller.close();
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
            if (replyToMessage) {
                await replyToMessage.reply("An error occurred while processing your message.");
            } else {
                await channel.send("An error occurred while processing your message.");
            }
        }
    });
}
