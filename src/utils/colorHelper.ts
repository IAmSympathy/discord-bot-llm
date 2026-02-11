import {Client} from "discord.js";
import {NETRICSA_COLOR, NETRICSA_ROLE_ID} from "./constants";
import {EnvConfig} from "./envConfig";
import {createLogger} from "./logger";

const logger = createLogger("ColorHelper");

/**
 * Cache de la couleur avec timestamp pour rafraîchissement périodique
 */
let cachedColor: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // Rafraîchir toutes les 5 minutes

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
        logger.debug(`Netricsa role color fetched: #${roleColor.toString(16).padStart(6, '0')}`);
        return roleColor;
    } catch (error) {
        logger.error("Error fetching Netricsa role color:", error);
        return NETRICSA_COLOR;
    }
}

/**
 * Récupère la couleur Netricsa avec cache et rafraîchissement automatique
 * Le cache expire après 5 minutes pour permettre la détection des changements
 */
export async function getNetricsaColorCached(client: Client): Promise<number> {
    const now = Date.now();

    // Si le cache est valide (moins de 5 minutes), utiliser la couleur en cache
    if (cachedColor !== null && (now - lastFetchTime) < CACHE_DURATION) {
        return cachedColor;
    }

    // Sinon, rafraîchir le cache
    logger.debug("Refreshing Netricsa color cache...");
    cachedColor = await getNetricsaColor(client);
    lastFetchTime = now;

    return cachedColor;
}

/**
 * Réinitialise le cache de couleur immédiatement
 * Utile pour forcer un rafraîchissement après un changement de rôle
 */
export function resetColorCache(): void {
    cachedColor = null;
    lastFetchTime = 0;
    logger.info("Color cache reset - will refresh on next request");
}

/**
 * Récupère la couleur de manière synchrone depuis le cache
 * Retourne la couleur par défaut si le cache n'est pas initialisé
 * À utiliser uniquement si getNetricsaColorCached a déjà été appelé
 */
export function getNetricsaColorSync(): number {
    return cachedColor !== null ? cachedColor : NETRICSA_COLOR;
}


