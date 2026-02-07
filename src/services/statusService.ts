import {ActivityType, Client} from "discord.js";
import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";
import {DATA_DIR} from "../utils/constants";

/**
 * Service pour gérer les statuts dynamiques de Netricsa avec système de pile
 */

const logger = createLogger("StatusService");

const STATUS_FILE = path.join(DATA_DIR, "bot_default_status.json");

interface StatusData {
    text: string;
    type: "PLAYING" | "WATCHING" | "LISTENING" | "COMPETING";
}

function loadDefaultStatus(): StatusData {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading default status:", error);
    }
    return {text: "", type: "PLAYING"};
}

export function applyDefaultStatus(client: Client): void {
    if (!client.user) return;

    const statusData = loadDefaultStatus();

    const activityType = {
        PLAYING: 0,
        STREAMING: 1,
        LISTENING: 2,
        WATCHING: 3,
        COMPETING: 5
    }[statusData.type];

    client.user.setPresence({
        activities: statusData.text ? [{name: statusData.text, type: activityType}] : [],
        status: "online"
    });

    if (statusData.text) {
        logger.info(`✨ Default status applied: ${statusData.type} ${statusData.text}`);
    }
}

/**
 * Interface pour un élément de la pile de statuts
 */
interface StatusStackItem {
    id: string;
    status: string;
    timeoutId?: NodeJS.Timeout;
}

/**
 * Pile de statuts (LIFO - Last In First Out)
 * Le statut au sommet de la pile est celui affiché
 */
let statusStack: StatusStackItem[] = [];

/**
 * Génère un ID unique pour un statut
 */
function generateStatusId(): string {
    return `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Applique le statut actuel (celui au sommet de la pile)
 */
async function applyCurrentStatus(client: Client): Promise<void> {
    if (!client.user) {
        logger.warn("Client user not available, cannot apply status");
        return;
    }

    try {
        if (statusStack.length === 0) {
            // Aucun statut dans la pile, appliquer le statut par défaut
            applyDefaultStatus(client);
            logger.info("📭 Status cleared (applying default status)");
        } else {
            // Afficher le statut au sommet de la pile
            const currentStatus = statusStack[statusStack.length - 1];
            await client.user.setPresence({
                status: "online",
                activities: [{
                    name: currentStatus.status,
                    type: ActivityType.Playing
                }]
            });
            logger.info(`📊 Status applied: ${currentStatus.status} (stack depth: ${statusStack.length})`);
        }
    } catch (error) {
        logger.error(`Error applying status: ${error}`);
    }
}

/**
 * Ajoute un statut à la pile et l'affiche
 * @returns ID du statut pour le retirer plus tard
 */
export async function setStatus(client: Client, status: string, durationMs: number = 30000): Promise<string> {
    if (!client.user) {
        logger.warn("Client user not available, cannot set status");
        return "";
    }

    const statusId = generateStatusId();
    const statusItem: StatusStackItem = {
        id: statusId,
        status: status
    };

    // Ajouter à la pile
    statusStack.push(statusItem);
    logger.info(`➕ Added status to stack: ${status} (ID: ${statusId}, depth: ${statusStack.length})`);

    // Appliquer le nouveau statut
    await applyCurrentStatus(client);

    // Configurer le timeout pour retirer automatiquement
    if (durationMs > 0) {
        statusItem.timeoutId = setTimeout(async () => {
            await clearStatus(client, statusId);
        }, durationMs);
    }

    return statusId;
}

/**
 * Retire un statut spécifique de la pile
 * Si aucun ID n'est fourni, retire le statut au sommet
 */
export async function clearStatus(client: Client, statusId?: string): Promise<void> {
    if (!client.user) {
        logger.warn("Client user not available, cannot clear status");
        return;
    }

    if (statusStack.length === 0) {
        logger.info("⚠️ No status to clear (stack already empty)");
        return;
    }

    if (statusId) {
        // Retirer un statut spécifique
        const index = statusStack.findIndex(item => item.id === statusId);
        if (index === -1) {
            logger.warn(`⚠️ Status ID not found in stack: ${statusId}`);
            return;
        }

        const removedStatus = statusStack[index];

        // Annuler le timeout s'il existe
        if (removedStatus.timeoutId) {
            clearTimeout(removedStatus.timeoutId);
        }

        // Retirer de la pile
        statusStack.splice(index, 1);
        logger.info(`➖ Removed status from stack: ${removedStatus.status} (ID: ${statusId}, remaining: ${statusStack.length})`);
    } else {
        // Retirer le statut au sommet de la pile
        const removedStatus = statusStack.pop();
        if (removedStatus) {
            // Annuler le timeout s'il existe
            if (removedStatus.timeoutId) {
                clearTimeout(removedStatus.timeoutId);
            }
            logger.info(`➖ Removed top status from stack: ${removedStatus.status} (remaining: ${statusStack.length})`);
        }
    }

    // Appliquer le statut actuel (celui qui est maintenant au sommet)
    await applyCurrentStatus(client);
}

/**
 * Vide complètement la pile de statuts
 */
export async function clearAllStatuses(client: Client): Promise<void> {
    logger.info(`🧹 Clearing all statuses (${statusStack.length} in stack)`);

    // Annuler tous les timeouts
    for (const item of statusStack) {
        if (item.timeoutId) {
            clearTimeout(item.timeoutId);
        }
    }

    // Vider la pile
    statusStack = [];

    // Appliquer le statut vide
    await applyCurrentStatus(client);
}

/**
 * Met Netricsa en mode "Ne pas déranger" avec un statut Low Power
 * Ce statut est permanent et vide la pile des autres statuts
 */
export async function setLowPowerStatus(client: Client): Promise<void> {
    if (!client.user) return;

    // Vider la pile des statuts temporaires
    await clearAllStatuses(client);

    await client.user.setPresence({
        status: "dnd",
        activities: [{
            name: "🔋 Mode économie d'énergie",
            type: ActivityType.Playing
        }]
    });

    logger.info("🔋 Status set to DND - Low Power Mode (stack cleared)");
}

/**
 * Remet Netricsa en mode normal (online)
 * Vide la pile et restaure le statut par défaut
 */
export async function setNormalStatus(client: Client): Promise<void> {
    if (!client.user) return;

    // Vider la pile des statuts
    await clearAllStatuses(client);

    // Appliquer le statut par défaut
    applyDefaultStatus(client);

    logger.info("⚡ Status set to Online - Normal Mode (default status applied)");
}

/**
 * Statuts prédéfinis pour différentes activités
 */
export const BotStatus = {
    ANALYZING_IMAGE: "🖼️ analyse une image...",
    ANALYZING_IMAGES: (count: number) => `🖼️ analyse ${count} images...`,
    GENERATING_IMAGE: "🎨 génère une image...",
    REIMAGINING_IMAGE: "🌀 réimagine une image...",
    UPSCALING_IMAGE: "🔍 upscale une image...",
    SEARCHING_WEB: "🌐 recherche sur le web...",
    GENERATING_PROMPT: "📝 crée un prompt...",
    THINKING: "💭 réfléchit...",
    WRITING: "✍️ écrit un message...",
    CHOOSING_REACTION: "🤔 choisit une réaction...",
    CHOOSING_EMOJI: "😊 choisit un emoji...",
    READING_MEMORY: "📚 consulte sa mémoire...",
    GENERATING_CITATION: "🤔 choisit une réaction...",
    PROCESSING: "⚙️ traite la demande...",
};
