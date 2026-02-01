import {ActivityType, Client} from "discord.js";
import {createLogger} from "../utils/logger";

/**
 * Service pour gérer les statuts dynamiques de Netricsa
 */

let statusTimeoutId: NodeJS.Timeout | null = null;
const logger = createLogger("StatusService");

/**
 * Change le statut de Netricsa avec réinitialisation automatique
 */
export async function setStatus(client: Client, status: string, durationMs: number = 30000) {
    if (!client.user) return;

    // Annuler le timeout précédent s'il existe
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    // Définir le nouveau statut
    await client.user.setPresence({
        status: "online",
        activities: [{
            name: status,
            type: ActivityType.Custom
        }]
    });

    // Réinitialiser après le délai
    statusTimeoutId = setTimeout(async () => {
        await clearStatus(client);
        statusTimeoutId = null;
    }, durationMs);
}

/**
 * Réinitialise le statut à vide
 */
export async function clearStatus(client: Client) {
    if (!client.user) return;

    // Annuler le timeout s'il existe
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    await client.user.setPresence({
        status: "online",
        activities: []
    });
}

/**
 * Met Netricsa en mode "Ne pas déranger" avec un statut Low Power
 */
export async function setLowPowerStatus(client: Client): Promise<void> {
    if (!client.user) return;

    // Annuler le timeout s'il existe
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    await client.user.setPresence({
        status: "dnd",
        activities: []
    });

    logger.info("🔋 Status set to DND - Low Power Mode");
}

/**
 * Remet Netricsa en mode normal (online)
 */
export async function setNormalStatus(client: Client): Promise<void> {
    if (!client.user) return;

    // Annuler le timeout s'il existe
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    await client.user.setPresence({
        status: "online",
        activities: []
    });

    logger.info("⚡ Status set to Online - Normal Mode");
}

/**
 * Statuts prédéfinis pour différentes activités
 */
export const BotStatus = {
    ANALYZING_IMAGE: "🖼️ analyse une image...",
    ANALYZING_IMAGES: (count: number) => `🖼️ analyse ${count} images...`,
    SEARCHING_WEB: "🌐 recherche sur le web...",
    THINKING: "💭 réfléchit...",
    WRITING: "✍️ écrit un message...",
    CHOOSING_REACTION: "🤔 choisit une réaction...",
    CHOOSING_EMOJI: "😊 choisit un emoji...",
    READING_MEMORY: "📚 consulte sa mémoire...",
    GENERATING_CITATION: "🤔 choisit une réaction...",
    PROCESSING: "⚙️ traite la demande...",
};
