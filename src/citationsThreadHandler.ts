import {Client, Events, Message} from "discord.js";
import {setBotPresence} from "./bot";
import {generateCitationEmoji} from "./services/emojiService";

const CITATIONS_THREAD_ID = process.env.CITATIONS_THREAD_ID;

export function registerCitationsThreadHandler(client: Client) {
    client.on(Events.MessageCreate, async (message: Message) => {
        try {
            if (message.author.bot) return;
            if (!CITATIONS_THREAD_ID || message.channelId !== CITATIONS_THREAD_ID) return;
            if (!message.channel.isThread()) return;

            await setBotPresence(client, "dnd", "Réfléchit…");

            const threadName = message.channel.name;
            const parentChannel = message.channel.parent?.name || "Unknown";

            console.log(`[CitationsThread] Nouveau message dans "${threadName}" (${parentChannel})`);

            const userMessage = message.content || "[Image sans texte]";
            console.log(`[CitationsThread] Citation de ${message.author.username}: "${userMessage.substring(0, 50)}..."`);

            const emoji = await generateCitationEmoji(userMessage);
            await message.react(emoji);

            console.log(`[CitationsThread] Réaction ${emoji} ajoutée`);

            await setBotPresence(client, "online");
        } catch (error) {
            console.error("[CitationsThread] Erreur lors du traitement du message:", error);
        }
    });

    console.log(`[CitationsThread] Handler enregistré pour le thread Citations (ID: ${CITATIONS_THREAD_ID})`);
}
