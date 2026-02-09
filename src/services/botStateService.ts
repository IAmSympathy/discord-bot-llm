/**
 * Service pour gérer le mode Low Power du bot
 * En mode Low Power, Netricsa ne fait pas d'appels LLM coûteux
 * Supporte le mode automatique basé sur l'activité de jeu de l'owner
 */

import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";

const logger = createLogger("BotState");
const BLACKLIST_FILE = path.join(process.cwd(), "data", "game_blacklist.json");
const OWNER_USER_ID = "288799652902469633"; // Tah-Um

interface BotState {
    lowPowerMode: boolean;
    isManualMode: boolean; // true si activé/désactivé manuellement, false si automatique
    gameBlacklist: string[]; // Liste des jeux qui ne déclenchent PAS le low power
}

let botState: BotState = {
    lowPowerMode: false,
    isManualMode: false,
    gameBlacklist: []
};

/**
 * Charge la blacklist des jeux depuis le fichier
 */
function loadGameBlacklist(): void {
    try {
        if (fs.existsSync(BLACKLIST_FILE)) {
            const data = fs.readFileSync(BLACKLIST_FILE, "utf-8");
            const parsed = JSON.parse(data);
            botState.gameBlacklist = parsed.gameBlacklist || [];
            logger.info(`Loaded ${botState.gameBlacklist.length} game(s) in blacklist`);
        }
    } catch (error) {
        logger.error("Error loading game blacklist:", error);
        botState.gameBlacklist = [];
    }
}

/**
 * Sauvegarde la blacklist des jeux dans le fichier
 */
function saveGameBlacklist(): void {
    try {
        const dir = path.dirname(BLACKLIST_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify({gameBlacklist: botState.gameBlacklist}, null, 2), "utf-8");
        logger.info(`Saved game blacklist (${botState.gameBlacklist.length} game(s))`);
    } catch (error) {
        logger.error("Error saving game blacklist:", error);
    }
}

// Charger la blacklist au démarrage
loadGameBlacklist();

export function isLowPowerMode(): boolean {
    return botState.lowPowerMode;
}

export function isManualMode(): boolean {
    return botState.isManualMode;
}

export function getGameBlacklist(): string[] {
    return [...botState.gameBlacklist];
}

/**
 * Toggle manuel du Low Power Mode
 * Marque le mode comme manuel pour empêcher l'activation automatique
 */
export function toggleLowPowerMode(): boolean {
    botState.lowPowerMode = !botState.lowPowerMode;
    botState.isManualMode = true; // Marquer comme manuel
    logger.info(`${botState.lowPowerMode ? '🔋' : '⚡'} Low Power Mode ${botState.lowPowerMode ? 'ENABLED' : 'DISABLED'} (MANUAL)`);
    return botState.lowPowerMode;
}

/**
 * Active le Low Power Mode automatiquement (par détection de jeu)
 * Ne fait rien si le mode est manuel
 */
export function enableLowPowerModeAuto(client?: any): boolean {
    if (botState.isManualMode) {
        logger.info(`⚠️ Low Power Mode is in MANUAL mode, ignoring auto-enable`);
        return false;
    }

    if (!botState.lowPowerMode) {
        botState.lowPowerMode = true;
        logger.info(`🔋 Low Power Mode ENABLED (AUTO - gaming detected)`);

        // Remplacer les missions impossibles dans les événements actifs
        if (client) {
            (async () => {
                try {
                    const {handleLowPowerModeTransition} = require('./events/impostorEvent');
                    await handleLowPowerModeTransition(client);
                } catch (error) {
                    logger.error('Error handling Low Power Mode transition:', error);
                }
            })();
        }
    }
    return true;
}

/**
 * Désactive le Low Power Mode automatiquement (arrêt du jeu)
 * Ne fait rien si le mode est manuel
 */
export function disableLowPowerModeAuto(client?: any): boolean {
    if (botState.isManualMode) {
        logger.info(`⚠️ Low Power Mode is in MANUAL mode, ignoring auto-disable`);
        return false;
    }

    if (botState.lowPowerMode) {
        botState.lowPowerMode = false;
        logger.info(`⚡ Low Power Mode DISABLED (AUTO - gaming stopped)`);

        // Restaurer les missions originales dans les événements actifs
        if (client) {
            (async () => {
                try {
                    const {handleLowPowerModeExit} = require('./events/impostorEvent');
                    await handleLowPowerModeExit(client);
                } catch (error) {
                    logger.error('Error handling Low Power Mode exit:', error);
                }
            })();
        }
    }
    return true;
}

/**
 * Réinitialise le mode manuel (permet à nouveau l'automatique)
 */
export function resetToAutoMode(): void {
    botState.isManualMode = false;
    logger.info(`🔄 Low Power Mode reset to AUTO mode`);
}

/**
 * Ajoute un jeu à la blacklist
 */
export function addGameToBlacklist(gameName: string): void {
    const normalized = gameName.trim();
    if (!botState.gameBlacklist.includes(normalized)) {
        botState.gameBlacklist.push(normalized);
        saveGameBlacklist();
        logger.info(`➕ Added "${normalized}" to game blacklist`);
    } else {
        logger.info(`⚠️ "${normalized}" already in blacklist`);
    }
}

/**
 * Retire un jeu de la blacklist
 */
export function removeGameFromBlacklist(gameName: string): boolean {
    const normalized = gameName.trim();
    const index = botState.gameBlacklist.indexOf(normalized);
    if (index !== -1) {
        botState.gameBlacklist.splice(index, 1);
        saveGameBlacklist();
        logger.info(`➖ Removed "${normalized}" from game blacklist`);
        return true;
    }
    logger.info(`⚠️ "${normalized}" not found in blacklist`);
    return false;
}

/**
 * Vérifie si un jeu est dans la blacklist
 */
export function isGameBlacklisted(gameName: string): boolean {
    const normalized = gameName.trim();
    return botState.gameBlacklist.includes(normalized);
}

export const OWNER_ID = OWNER_USER_ID;

