import {ChannelType, Client, Message, TextChannel} from "discord.js";
import {processLLMRequest, recordPassiveMessage} from "./queue/queue";
import {setBotPresence} from "./bot";
import {generateMentionEmoji} from "./services/emojiService";
import {collectAllMediaUrls} from "./services/gifService";
import {updateUserActivityFromPresence} from "./services/activityService";
import {logBotReaction} from "./utils/discordLogger";
import {BotStatus, clearStatus, setStatus} from "./services/statusService";
import {isLowPowerMode} from "./services/botStateService";
import {appendDMTurn, getDMRecentTurns} from "./services/dmMemoryService";
import {EnvConfig} from "./utils/envConfig";
import {createLogger} from "./utils/logger";
import {NETRICSA_USER_ID, NETRICSA_USERNAME, recordAIConversation, recordEmojisUsed, recordMentionReceived, recordMessageSent, recordReactionAdded, recordReplyReceived} from "./services/userStatsService";
import {addXP, XP_REWARDS} from "./services/xpSystem";
import {handleCounterMessage} from "./services/counterService";

const logger = createLogger("WatchChannel");

function isWatchedChannel(message: Message, watchedChannelId?: string): boolean {
    return !!watchedChannelId && message.channelId === watchedChannelId;
}

/**
 * Extrait les informations sur les utilisateurs mentionnés dans le message
 * et retourne un contexte formaté pour l'IA
 */function extractMentionContext(message: Message, client: Client): string {
    if (message.mentions.users.size === 0) return "";

    const mentionedUsers: string[] = [];
    message.mentions.users.forEach((user) => {
        // Exclure le bot lui-même des mentions
        if (user.id === client.user?.id) return;

        const displayName = user.displayName || user.username;
        mentionedUsers.push(`@${displayName} (Username: ${user.username}, UID: ${user.id})`);
    });

    // Si aucun utilisateur (sauf le bot) n'a été mentionné, ne pas ajouter de contexte
    if (mentionedUsers.length === 0) return "";

    return `\n[UTILISATEURS MENTIONNÉS DANS CE MESSAGE]\n${mentionedUsers.join("\n")}\n[Si l'information concerne une personne mentionnée, utilise SON UID, pas celui de ${message.author.displayName}]\n\n`;
}

async function handleNettieReaction(client: Client, message: Message): Promise<string> {
    logger.info(`Message from ${message.author.username} talks about Nettie`);
    const statusId = await setStatus(client, BotStatus.CHOOSING_REACTION);

    try {
        const emoji = await generateMentionEmoji(message.content);
        await message.react(emoji);
        logger.info(`Reacted with: ${emoji}`);

        // Enregistrer la réaction de Netricsa dans les stats
        recordReactionAdded(NETRICSA_USER_ID, NETRICSA_USERNAME);

        await clearStatus(client, statusId);
        return emoji;
    } catch (error) {
        logger.error("Failed to get emoji from LLM:", error);
        await clearStatus(client, statusId);
        await message.react("🤗");

        // Enregistrer la réaction de fallback de Netricsa
        recordReactionAdded(NETRICSA_USER_ID, NETRICSA_USERNAME);

        return "🤗";
    }

}

async function getThreadStarterMessage(thread: any) {
    try {
        // Utiliser la méthode officielle Discord.js pour récupérer le message starter
        const starterMessage = await thread.fetchStarterMessage();
        return starterMessage;
    } catch (error) {
        logger.warn("Failed to fetch thread starter message:", error);
        return null;
    }
}

interface ReferencedMessageContext {
    contextPrompt: string;
    imageUrls: string[];
    referencedMessage: Message;
    mustReact: boolean;
}

async function extractReferencedMessageContext(message: Message, messageReferenceId: string, forumChannelId?: string): Promise<ReferencedMessageContext | null> {
    try {
        const referencedMessage = await message.channel.messages.fetch(messageReferenceId);

        // Si le message référencé est du bot lui-même, ne pas ajouter de contexte car il est déjà dans l'historique
        const isBotMessage = referencedMessage.author.bot;

        logger.info(`Fetching referenced message from ${referencedMessage.author.displayName}`);
        logger.info(`Referenced message content: "${referencedMessage.content}"`);
        logger.info(`Referenced message has ${referencedMessage.attachments.size} attachment(s)`);

        // Collecter tous les médias (images + GIFs + Tenor)
        const imageUrls = await collectAllMediaUrls(referencedMessage);

        logger.info(`Collected ${imageUrls.length} media URL(s) from referenced message:`, imageUrls);

        let mustReact = false;
        if (message.channel.isThread() && forumChannelId) {
            const thread = message.channel;
            if (thread.parent?.type === ChannelType.GuildForum && thread.parent.id === forumChannelId) {
                const firstMessage = await getThreadStarterMessage(thread);
                if (firstMessage && firstMessage.id === referencedMessage.id) {
                    mustReact = true;
                    logger.info(`Detected reply to original post in Création forum - must react`);
                }
            }
        }

        // Si c'est un message du bot, retourner seulement les images et mustReact, sans ajouter de contexte textuel
        if (isBotMessage) {
            logger.info(`Message references bot's own message - skipping context (already in history)`);
            return {
                contextPrompt: "",
                imageUrls,
                referencedMessage,
                mustReact
            };
        }

        // Pour les messages d'autres utilisateurs, ajouter le contexte complet
        const refAuthor = referencedMessage.author.displayName || referencedMessage.author.username;
        const refContent = referencedMessage.content || "[message sans texte]";
        const refImageNotice = imageUrls.length > 0 ? ` [contient ${imageUrls.length} média(s)]` : "";
        const contextPrompt = `[L'utilisateur répond au message suivant]\n${refAuthor}: ${refContent}${refImageNotice}\n\n[Réponse de l'utilisateur]\n`;

        logger.info(`Message references another message from ${refAuthor}${refImageNotice}`);

        return {contextPrompt, imageUrls, referencedMessage, mustReact};
    } catch (error) {
        logger.warn("Failed to fetch referenced message:", error);
        return null;
    }
}

export function registerWatchedChannelResponder(client: Client) {
    const watchedChannelId = EnvConfig.WATCH_CHANNEL_ID;
    const forumChannelId = EnvConfig.FORUM_CHANNEL_ID;

    if (watchedChannelId) {
        logger.info(`Watching channel: ${watchedChannelId}`);
    }

    logger.info(`Bot mention detection enabled in all channels`);

    client.on("messageCreate", async (message) => {
        try {
            // Ne plus ignorer complètement les bots - ils peuvent aussi gagner de l'XP
            // Mais on évite les réponses automatiques du bot lui-même pour éviter les boucles

            // Vérifier si c'est le salon compteur
            const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
            if (COUNTER_CHANNEL_ID && message.channelId === COUNTER_CHANNEL_ID && !message.author.bot) {
                // Gérer le message du compteur (validera et supprimera si invalide)
                const isValid = await handleCounterMessage(message);

                // Si le message est valide, donner très peu d'XP (1 XP seulement)
                // NE PAS enregistrer dans les stats de messages (ça fausserait les statistiques)
                if (isValid) {
                    await addXP(
                        message.author.id,
                        message.author.username,
                        1, // 1 XP seulement pour le compteur
                        message.channel as TextChannel,
                        false
                    );
                }

                // Ne pas continuer le traitement normal pour les messages du compteur
                // Pas de mémoire, pas de réponse aux mentions, rien
                return;
            }

            // Si c'est un bot qui essaie de mentionner Netricsa dans le compteur, ignorer aussi
            if (COUNTER_CHANNEL_ID && message.channelId === COUNTER_CHANNEL_ID) {
                return;
            }

            // Enregistrer le message envoyé dans les statistiques
            recordMessageSent(message.author.id, message.author.username);

            // Enregistrer les emojis utilisés dans le message
            recordEmojisUsed(message.author.id, message.author.username, message.content);

            // Vérifier les achievements Discord (messages, emojis, spéciaux)
            const {checkDiscordAchievements, checkTimeBasedAchievements, checkBirthdayAchievement} = require("./services/discordAchievementChecker");
            await checkDiscordAchievements(message.author.id, message.author.username, message.client, message.channelId);
            await checkTimeBasedAchievements(message.author.id, message.author.username, message.client, message.channelId);
            await checkBirthdayAchievement(message.author.id, message.author.username, message.client, message.channelId);

            // Ajouter XP (la fonction détecte automatiquement si c'est un bot)
            await addXP(
                message.author.id,
                message.author.username,
                XP_REWARDS.messageEnvoye,
                message.channel as TextChannel,
                message.author.bot
            );

            // Enregistrer les mentions dans les statistiques
            if (message.mentions.users.size > 0) {
                message.mentions.users.forEach(async (user) => {
                    recordMentionReceived(user.id, user.username);

                    // Ajouter XP (la fonction détecte automatiquement si c'est un bot)
                    await addXP(
                        user.id,
                        user.username,
                        XP_REWARDS.mentionRecue,
                        message.channel as TextChannel,
                        user.bot
                    );
                });
            }

            // Enregistrer les réponses (replies) dans les statistiques
            // Exclure les commandes slash et les messages des bots
            if (message.reference?.messageId && !message.author.bot && !message.content?.startsWith('/')) {
                try {
                    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    if (referencedMessage) {
                        recordReplyReceived(referencedMessage.author.id, referencedMessage.author.username);

                        // Ajouter XP (la fonction détecte automatiquement si c'est un bot)
                        await addXP(
                            referencedMessage.author.id,
                            referencedMessage.author.username,
                            XP_REWARDS.replyRecue,
                            message.channel as TextChannel,
                            referencedMessage.author.bot
                        );
                    }
                } catch (error) {
                    // Ignorer les erreurs de fetch (message supprimé, etc.)
                }
            }

            // Après avoir enregistré les stats, ignorer les messages des bots pour éviter les boucles
            if (message.author?.bot) return;

            // Ignorer les commandes slash-like tapées en texte
            if (message.content?.startsWith("/")) return;

            // Ignorer complètement les messages commençant par "!s"
            if (message.content?.trim().startsWith("!s")) {
                logger.info(`Message from ${message.author.username} starts with "!s" - completely ignored`);
                return;
            }

            // ===== GESTION DES DMs =====
            if (message.channel.type === ChannelType.DM) {
                logger.info(`[DM] Message from ${message.author.username}: "${message.content.substring(0, 50)}..."`);

                // Fetch le canal complet si c'est un partial
                const dmChannel = message.channel.partial ? await message.channel.fetch() : message.channel;

                // Vérifier si en Low Power Mode
                if (isLowPowerMode()) {
                    await message.reply(`🔋 Désolée, je suis en mode Low Power pour économiser les ressources. Je ne peux pas effectuer d'analyse LLM pour le moment.\n\n💡 Utilisez \`/lowpower\` pour me réactiver en mode normal.`);
                    logger.info(`[DM] Low Power Mode - sent message to ${message.author.username}`);
                    return;
                }

                let userText = message.content?.trim();
                if (!userText || userText.length === 0) {
                    logger.info(`[DM] Empty message from ${message.author.username}, ignoring`);
                    return;
                }


                const userId = message.author.id;
                const userName = message.author.username;

                // Collecter les médias (images, GIFs)
                const imageUrls = await collectAllMediaUrls(message);

                // Construire le prompt pour le DM
                let dmPrompt = `[Conversation privée (DM) avec ${userName}]\n\n${userText}`;

                // Récupérer l'historique de conversation DM
                const dmMemory = await getDMRecentTurns(userId, 20);

                logger.info(`[DM] Processing message from ${userName} (${dmMemory.length} turns in memory)`);

                // Traiter avec processLLMRequest
                await processLLMRequest({
                    prompt: dmPrompt,
                    userId: userId,
                    userName: userName,
                    channel: dmChannel,
                    client: client,
                    replyToMessage: message,
                    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
                    sendMessage: true,
                    skipMemory: true, // On gère la mémoire DM nous-mêmes
                    returnResponse: true
                }).then(async (response) => {
                    // Enregistrer dans la mémoire DM
                    if (response) {
                        await appendDMTurn(userId, {
                            ts: Date.now(),
                            discordUid: userId,
                            displayName: userName,
                            channelId: message.channelId,
                            channelName: "DM",
                            userText: userText,
                            assistantText: response,
                            isPassive: false,
                            ...(imageUrls.length > 0 ? {imageDescriptions: [`${imageUrls.length} image(s)`]} : {})
                        });
                        logger.info(`[DM] Saved conversation turn for ${userName}`);
                    }
                });

                return; // Sortir après traitement DM
            }
            // ===== FIN GESTION DES DMs =====

            // Vérifier si le bot est en Low Power Mode
            if (isLowPowerMode()) {
                // En mode Low Power, ne répondre que si mentionné ou dans le canal surveillé
                const isMentioned = message.mentions.has(client.user!.id) && !message.mentions.everyone;
                const isInWatchedChannel = isWatchedChannel(message, watchedChannelId);

                if (isMentioned || isInWatchedChannel) {
                    const lowPowerMessage = `Désolée, j'ai été mise en mode économie d'énergie par Tah-Um.\nJe ne peux pas générer de réponses ou analyser d'images pour le moment.`;

                    await message.reply(lowPowerMessage);
                    logger.info(`Low Power Mode - sent message to ${message.author.username}`);

                    // NE PAS enregistrer passivement : l'utilisateur attend une réponse
                    // Si on enregistrait, on aurait un message sans réponse dans la mémoire
                    return;
                }


                // Pour les autres messages (pas destinés à Netricsa), continuer à enregistrer passivement
                const userText = message.content?.trim();
                if (userText && userText.length > 0) {
                    const channelName = (message.channel as any).name || `channel-${message.channelId}`;
                    const isReply = !!message.reference?.messageId;
                    await recordPassiveMessage(
                        message.author.id,
                        message.author.displayName,
                        userText,
                        message.channelId,
                        channelName,
                        undefined,
                        undefined,
                        isReply
                    );
                }
                return; // Ne pas traiter plus loin
            }


            let userText = message.content?.trim();
            const isMentioned = message.mentions.has(client.user!.id);
            const isInWatchedChannel = isWatchedChannel(message, watchedChannelId);
            const channelName = (message.channel as any).name || `channel-${message.channelId}`;

            // Gestion des mentions de Nettie (réaction uniquement)
            const contentLower = message.content?.toLowerCase() || "";
            const mentionsNettie = contentLower.includes("nettie") || contentLower.includes("netricsa");
            if (mentionsNettie && !isMentioned && !isInWatchedChannel) {

                // Ajouter une réaction emoji
                const reactionEmoji = await handleNettieReaction(client, message);

                // NOUVEAU : Enregistrer aussi en mémoire avec la réaction (sans analyser les images)
                let savedInMemory = false;
                if (userText) {
                    // NE PAS collecter les médias pour les mentions Nettie (juste une réaction, pas d'analyse)

                    // Enregistrer avec la réaction du bot
                    savedInMemory = await recordPassiveMessage(
                        message.author.id,
                        message.author.displayName,
                        userText,
                        message.channelId,
                        channelName,
                        undefined, // Pas d'images
                        reactionEmoji, // ← Passer la réaction
                        undefined // Pas de isReply pour les mentions Nettie
                    );

                    logger.info(`[Nettie Reaction] Message recorded with reaction ${reactionEmoji} in #${channelName}${savedInMemory ? ' (saved in memory)' : ' (not saved)'}`);
                }

                // Logger la réaction
                await logBotReaction(
                    message.author.username,
                    channelName,
                    message.content,
                    reactionEmoji,
                    savedInMemory
                );

                return; // Ne pas répondre avec du texte, juste la réaction
            }

            // MODE HYBRIDE : Enregistrer TOUS les messages passivement (même sans mention)
            // L'IA voit tout mais ne répond que quand mentionnée ou dans le canal surveillé
            if (!isMentioned && !isInWatchedChannel) {
                // NE PAS collecter les médias pour les messages passifs (sans mention)
                // Les images ne sont analysées que si le bot est mentionné ou dans le canal surveillé

                // Si le message a du texte, l'enregistrer passivement
                if (userText) {
                    // Obtenir le nom du channel
                    const channelName = (message.channel as any).name || `channel-${message.channelId}`;

                    // Détecter si c'est une réponse à un autre message
                    const isReply = !!message.reference?.messageId;

                    // Enregistrer passivement (sans répondre et sans analyser les images)
                    await recordPassiveMessage(
                        message.author.id,
                        message.author.displayName,
                        userText,
                        message.channelId,
                        channelName,
                        undefined, // Pas d'images
                        undefined, // Pas de réaction
                        isReply // Passer le flag reply
                    );
                }

                return; // Ne pas répondre, juste enregistrer (ou ignorer si pas de texte)
            }

            // À partir d'ici, le bot VA RÉPONDRE (mention ou canal surveillé)

            // Collecter tous les médias (images, GIFs uploadés, GIFs Tenor)
            const imageUrls = await collectAllMediaUrls(message);

            if (!userText && imageUrls.length === 0) return;


            let contextPrompt = userText || "[Image envoyée sans texte]";
            let referencedMsg: Message | undefined = undefined;
            let mustReact = false;
            let threadStarterContext: { content: string; author: string; imageUrls: string[] } | undefined = undefined;

            // Capturer le contexte du thread starter si on est dans un thread
            // IMPORTANT: Ceci se fait TOUJOURS dans un thread, indépendamment des replies
            if (message.channel.isThread()) {
                const starterMessage = await getThreadStarterMessage(message.channel);
                if (starterMessage) {
                    const starterImageUrls = await collectAllMediaUrls(starterMessage);
                    threadStarterContext = {
                        content: starterMessage.content || "[Message sans texte]",
                        author: starterMessage.author.displayName,
                        imageUrls: starterImageUrls
                    };
                    logger.info(`Thread starter context captured from ${starterMessage.author.displayName}`);
                }
            }

            // Traiter le message référencé (si reply manuel)
            const messageReferenceId = message.reference?.messageId;
            if (messageReferenceId) {
                const refContext = await extractReferencedMessageContext(message, messageReferenceId, forumChannelId);
                if (refContext) {
                    contextPrompt = refContext.contextPrompt + contextPrompt;
                    imageUrls.push(...refContext.imageUrls);
                    referencedMsg = refContext.referencedMessage;
                    mustReact = refContext.mustReact;

                    if (refContext.imageUrls.length > 0) {
                        logger.info(`Added ${refContext.imageUrls.length} image(s) from referenced message to analysis`);
                    }
                }
            }

            if (mustReact) {
                contextPrompt = `[Note: Ajoute obligatoirement un emoji au début de ton message pour donner ton avis]\n${contextPrompt}`;
            }

            // Ajouter le contexte des utilisateurs mentionnés (avec leurs UIDs)
            const mentionContext = extractMentionContext(message, client);
            if (mentionContext) {
                contextPrompt = mentionContext + contextPrompt;
            }

            // Mettre à jour les rôles Discord si l'utilisateur en a

            const triggerReason = isMentioned ? "mentioned" : "watched channel";
            logger.info(`Processing message from ${message.author.displayName} (${triggerReason}): ${userText}${imageUrls.length > 0 ? ` [${imageUrls.length} image(s)]` : ""}`);

            // Mettre à jour l'activité de l'utilisateur (jeu en cours)
            await updateUserActivityFromPresence(client, message.author.id);

            // Mettre à jour les rôles Discord de l'utilisateur dans son profil
            if (message.member) {
                const userRoles = message.member.roles.cache
                    .filter(role => role.name !== "@everyone") // Exclure le rôle @everyone
                    .map(role => role.name);

                if (userRoles.length > 0) {
                    const {UserProfileService} = await import("./services/userProfileService");
                    await UserProfileService.updateRoles(message.author.id, message.author.displayName, userRoles);
                }
            }

            await processLLMRequest({
                prompt: contextPrompt,
                userId: message.author.id,
                userName: message.author.displayName,
                channel: message.channel as TextChannel,
                client: client,
                replyToMessage: message,
                referencedMessage: referencedMsg,
                imageUrls,
                threadStarterContext,
                originalUserMessage: userText || "[Image envoyée sans texte]", // Message original pour la mémoire
            });

            // Enregistrer la conversation IA dans les statistiques
            recordAIConversation(message.author.id, message.author.displayName);

            // Vérifier les achievements Netricsa
            const {checkNetricsaAchievements} = require("./services/netricsaAchievementChecker");
            await checkNetricsaAchievements(
                message.author.id,
                message.author.username,
                message.client,
                message.channelId
            );

            await setBotPresence(client, "online");
        } catch (err) {
            logger.error("messageCreate error:", err);
            try {
                await message.reply({content: "An error occurred while processing your message."});
            } catch (replyErr) {
                logger.error("Failed to send error message:", replyErr);
            }
        }
    });
}
