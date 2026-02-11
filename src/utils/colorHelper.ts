import {Client} from "discord.js";
import {NETRICSA_COLOR, NETRICSA_ROLE_ID} from "./constants";
import {EnvConfig} from "./envConfig";
import {createLogger} from "./logger";

const logger = createLogger("ColorHelper");

/**
 * Cache de la couleur (mis à jour uniquement lors des changements détectés)
 */
let cachedColor: number = 0x397d86;

/**
 * Récupère la couleur du rôle Netricsa depuis Discord
 * Utilise une couleur par défaut si le rôle n'est pas trouvé
 */
export async function getNetricsaColor(client: Client): Promise<number> {
    try {
        // Récupérer le guild principal
        const guildId = EnvConfig.GUILD_ID;
        if (!guildId) {
            logger.warn("GUILD_ID not configured, using default color");
            return NETRICSA_COLOR;
        }

        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            logger.warn("Guild not found, using default color");
            return NETRICSA_COLOR;
        }

        // Récupérer le rôle Netricsa
        const role = await guild.roles.fetch(NETRICSA_ROLE_ID);
        if (!role) {
            logger.warn(`Netricsa role (${NETRICSA_ROLE_ID}) not found, using default color`);
            return NETRICSA_COLOR;
        }

        // Retourner la couleur du rôle
        const roleColor = role.color;
        logger.info(`Netricsa role color fetched: #${roleColor.toString(16).padStart(6, '0')}`);
        return roleColor;
    } catch (error) {
        logger.error("Error fetching Netricsa role color:", error);
        return NETRICSA_COLOR;
    }
}

/**
 * Initialise le cache de couleur au démarrage
 */
export async function initializeNetricsaColor(client: Client): Promise<void> {
    cachedColor = await getNetricsaColor(client);
    logger.info(`Netricsa color initialized: #${cachedColor.toString(16).padStart(6, '0')}`);
}

/**
 * Met à jour le cache de couleur (appelé lors d'un changement de rôle détecté)
 */
export async function updateNetricsaColor(client: Client): Promise<void> {
    const newColor = await getNetricsaColor(client);
    if (newColor !== cachedColor) {
        const oldColor = cachedColor;
        cachedColor = newColor;
        logger.info(`Netricsa color updated: #${oldColor.toString(16).padStart(6, '0')} → #${cachedColor.toString(16).padStart(6, '0')}`);
    }
}

/**
 * Récupère la couleur Netricsa depuis le cache
 * Retourne toujours la couleur actuellement en cache
 */
export function getNetricsaColorCached(): number {
    return cachedColor;
}



