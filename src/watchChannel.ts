import {ChannelType, Client, Message, TextChannel} from "discord.js";
import {processLLMRequest} from "./queue/queue";
import {setBotPresence} from "./bot";
import {generateMentionEmoji} from "./services/emojiService";

function isWatchedChannel(message: Message, watchedChannelId?: string): boolean {
    return !!watchedChannelId && message.channelId === watchedChannelId;
}

async function handleNettieReaction(client: Client, message: Message) {
    console.log(`Message from ${message.author.username} talks about Nettie`);
    await setBotPresence(client, "dnd", "Réfléchit…");

    try {
        const emoji = await generateMentionEmoji(message.content);
        await message.react(emoji);
        console.log(`[Emoji] Reacted with: ${emoji}`);
    } catch (error) {
        console.error("[watchChannel] Failed to get emoji from LLM:", error);
        await message.react("🤗");
    }
}

async function getThreadStarterMessage(thread: any) {
    try {
        const messages = await thread.messages.fetch({limit: 1, after: "0"});
        return messages.first();
    } catch (error) {
        console.warn("[watchChannel] Failed to fetch thread starter message:", error);
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

        const imageUrls: string[] = [];
        for (const attachment of referencedMessage.attachments.values()) {
            if (attachment.contentType?.startsWith("image/")) {
                imageUrls.push(attachment.url);
                console.log(`[watchChannel] Found image in referenced message: ${attachment.url}`);
            }
        }

        let mustReact = false;
        if (message.channel.isThread() && forumChannelId) {
            const thread = message.channel;
            if (thread.parent?.type === ChannelType.GuildForum && thread.parent.id === forumChannelId) {
                const firstMessage = await getThreadStarterMessage(thread);
                if (firstMessage && firstMessage.id === referencedMessage.id) {
                    mustReact = true;
                    console.log(`[watchChannel] Detected reply to original post in Création forum - must react`);
                }
            }
        }

        // Si c'est un message du bot, retourner seulement les images et mustReact, sans ajouter de contexte textuel
        if (isBotMessage) {
            console.log(`[watchChannel] Message references bot's own message - skipping context (already in history)`);
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
        const refImageNotice = referencedMessage.attachments.size > 0 ? " [contient une image]" : "";
        const contextPrompt = `[L'utilisateur répond au message suivant]\n${refAuthor}: ${refContent}${refImageNotice}\n\n[Réponse de l'utilisateur]\n`;

        console.log(`[watchChannel] Message references another message from ${refAuthor}`);

        return {contextPrompt, imageUrls, referencedMessage, mustReact};
    } catch (error) {
        console.warn("[watchChannel] Failed to fetch referenced message:", error);
        return null;
    }
}

export function registerWatchedChannelResponder(client: Client) {
    const watchedChannelId = process.env.WATCH_CHANNEL_ID;
    const forumChannelId = process.env.FORUM_CHANNEL_ID;

    if (watchedChannelId) {
        console.log(`[watchChannel] Watching channel: ${watchedChannelId}`);
    }

    console.log(`[watchChannel] Bot mention detection enabled in all channels`);

    client.on("messageCreate", async (message) => {
        try {
            // Ignore bots (évite boucle infinie)
            if (message.author?.bot) return;

            // Ignorer les commandes slash-like tapées en texte
            if (message.content?.startsWith("/")) return;

            // Filtrer les messages qui commencent par "!s"
            if (message.content.trim().startsWith("!s ")) {
                console.log(`Ignored message from ${message.author} because it starts with "!s"`);
                return; // Ne rien faire
            }

            const userText = message.content?.trim();
            const isMentioned = message.mentions.has(client.user!.id);
            const isInWatchedChannel = isWatchedChannel(message, watchedChannelId);

            // Gestion des mentions de Nettie (réaction uniquement)
            const mentionsNettie = message.content.toLowerCase().includes("nettie") || message.content.toLowerCase().includes("netricsa");
            if (mentionsNettie && !isMentioned && !isInWatchedChannel) {
                await handleNettieReaction(client, message);
                return;
            }

            if (!isMentioned && !isInWatchedChannel) return;

            // Collecter tous les médias (images, GIFs uploadés, GIFs Tenor)
            const imageUrls = await collectAllMediaUrls(message);

            if (!userText && imageUrls.length === 0) return;

            let contextPrompt = userText || "[Image envoyée sans texte]";
            let referencedMsg: Message | undefined = undefined;
            let mustReact = false;

            // Auto-référencer le message starter d'un thread
            let messageReferenceId = message.reference?.messageId;
            if (!messageReferenceId && message.channel.isThread()) {
                const starterMessage = await getThreadStarterMessage(message.channel);
                if (starterMessage) {
                    messageReferenceId = starterMessage.id;
                    console.log(`[watchChannel] Auto-referencing thread starter message in thread "${message.channel.name}"`);
                }
            }

            // Traiter le message référencé
            if (messageReferenceId) {
                const refContext = await extractReferencedMessageContext(message, messageReferenceId, forumChannelId);
                if (refContext) {
                    contextPrompt = refContext.contextPrompt + contextPrompt;
                    imageUrls.push(...refContext.imageUrls);
                    referencedMsg = refContext.referencedMessage;
                    mustReact = refContext.mustReact;
                }
            }

            if (mustReact) {
                contextPrompt = `[Note: Ajoute obligatoirement un emoji au début de ton message pour donner ton avis]\n${contextPrompt}`;
            }

            await message.channel.sendTyping();

            const triggerReason = isMentioned ? "mentioned" : "watched channel";
            console.log(`[watchChannel] Processing message from ${message.author.displayName} (${triggerReason}): ${userText}${imageUrls.length > 0 ? ` [${imageUrls.length} image(s)]` : ""}`);

            await processLLMRequest({
                prompt: contextPrompt,
                userId: message.author.id,
                userName: message.author.displayName,
                channel: message.channel as TextChannel,
                replyToMessage: message,
                referencedMessage: referencedMsg,
                imageUrls,
            });

            await setBotPresence(client, "online");
        } catch (err) {
            console.error("[watchChannel] messageCreate error:", err);
            try {
                await message.reply({content: "An error occurred while processing your message."});
            } catch (replyErr) {
                console.error("[watchChannel] Failed to send error message:", replyErr);
            }
        }
    });
}
