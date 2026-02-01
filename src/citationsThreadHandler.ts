import {Client, Events, Message} from "discord.js";
import {generateCitationEmoji} from "./services/emojiService";
import {BotStatus, clearStatus, setStatus} from "./services/statusService";
import {isLowPowerMode} from "./services/botStateService";
import {EnvConfig} from "./utils/envConfig";
import {createLogger} from "./utils/logger";

const CITATIONS_THREAD_ID = EnvConfig.CITATIONS_THREAD_ID;
const logger = createLogger("CitationsThread");

export function registerCitationsThreadHandler(client: Client) {
    client.on(Events.MessageCreate, async (message: Message) => {
        try {
            if (message.author.bot) return;
            if (!CITATIONS_THREAD_ID || message.channelId !== CITATIONS_THREAD_ID) return;
            if (!message.channel.isThread()) return;

            // Vérifier si le bot est en Low Power Mode
            if (isLowPowerMode()) {
                return;
            }

            await setStatus(client, BotStatus.GENERATING_CITATION);

            const threadName = message.channel.name;
            const parentChannel = message.channel.parent?.name || "Unknown";

            logger.info(`Nouveau message dans "${threadName}" (${parentChannel})`);

            const userMessage = message.content || "[Image sans texte]";
            logger.info(`Citation publiée par ${message.author.username}: "${userMessage.substring(0, 50)}..."`);

            const emoji = await generateCitationEmoji(userMessage);
            await message.react(emoji);

            logger.info(`Réaction ${emoji} ajoutée`);

            await clearStatus(client);
        } catch (error) {
            logger.error("Erreur lors du traitement du message:", error);
            await clearStatus(client);
        }
    });

    logger.info(`Handler enregistré pour le thread Citations (ID: ${CITATIONS_THREAD_ID})`);
}
