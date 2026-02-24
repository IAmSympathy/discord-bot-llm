import {Client, Events, Message} from "discord.js";
import {generateCitationEmoji} from "./services/emojiService";
import {BotStatus, clearStatus, setStatus} from "./services/statusService";
import {isLowPowerMode} from "./services/botStateService";
import {isStandbyMode} from "./services/standbyModeService";
import {EnvConfig} from "./utils/envConfig";
import {createLogger} from "./utils/logger";
import {consumePendingQuote} from "./services/quotePendingCache";

const CITATIONS_THREAD_ID = EnvConfig.CITATIONS_THREAD_ID;
const logger = createLogger("CitationsThread");

export function registerCitationsThreadHandler(client: Client) {
    client.on(Events.MessageCreate, async (message: Message) => {
        let statusId: string = "";

        try {
            if (!CITATIONS_THREAD_ID || message.channelId !== CITATIONS_THREAD_ID) return;
            if (!message.channel.isThread()) return;

            // Vérifier si le bot est en Low Power Mode ou Standby
            if (isLowPowerMode() || isStandbyMode(client)) return;

            // Si c'est le bot lui-même, vérifier s'il y a une citation en attente
            if (message.author.bot) {
                const pendingText = consumePendingQuote(message.channelId);
                if (!pendingText) return; // Pas une citation postée par commande

                statusId = await setStatus(client, BotStatus.GENERATING_CITATION);
                logger.info(`Citation postée par le bot — texte récupéré depuis le cache`);

                const emoji = await generateCitationEmoji(pendingText);
                await message.react(emoji);
                logger.info(`Réaction ${emoji} ajoutée`);

                await clearStatus(client, statusId);
                return;
            }

            statusId = await setStatus(client, BotStatus.GENERATING_CITATION);

            const threadName = message.channel.name;
            const parentChannel = message.channel.parent?.name || "Unknown";

            logger.info(`Nouveau message dans "${threadName}" (${parentChannel})`);

            const userMessage = message.content || "[Image sans texte]";
            logger.info(`Citation publiée par ${message.author.username}: "${userMessage.substring(0, 50)}..."`);

            const emoji = await generateCitationEmoji(userMessage);
            await message.react(emoji);

            logger.info(`Réaction ${emoji} ajoutée`);

            await clearStatus(client, statusId);
        } catch (error) {
            logger.error("Erreur lors du traitement du message:", error);
            await clearStatus(client, statusId);
        }
    });

    logger.info(`Handler enregistré pour le thread Citations (ID: ${CITATIONS_THREAD_ID})`);
}
