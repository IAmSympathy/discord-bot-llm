import {Client, Events, Message} from "discord.js";
import {generateCitationEmoji} from "./services/emojiService";
import {BotStatus, clearStatus, setStatus} from "./services/statusService";

const CITATIONS_THREAD_ID = process.env.CITATIONS_THREAD_ID;

export function registerCitationsThreadHandler(client: Client) {
    client.on(Events.MessageCreate, async (message: Message) => {
        try {
            if (message.author.bot) return;
            if (!CITATIONS_THREAD_ID || message.channelId !== CITATIONS_THREAD_ID) return;
            if (!message.channel.isThread()) return;

            await setStatus(client, BotStatus.GENERATING_CITATION);

            const threadName = message.channel.name;
            const parentChannel = message.channel.parent?.name || "Unknown";

            console.log(`[CitationsThread] Nouveau message dans "${threadName}" (${parentChannel})`);

            const userMessage = message.content || "[Image sans texte]";
            console.log(`[CitationsThread] Citation publiée par ${message.author.username}: "${userMessage.substring(0, 50)}..."`);

            const emoji = await generateCitationEmoji(userMessage);
            await message.react(emoji);

            console.log(`[CitationsThread] Réaction ${emoji} ajoutée`);

            await clearStatus(client);
        } catch (error) {
            console.error("[CitationsThread] Erreur lors du traitement du message:", error);
            await clearStatus(client);
        }
    });

    console.log(`[CitationsThread] Handler enregistré pour le thread Citations (ID: ${CITATIONS_THREAD_ID})`);
}
