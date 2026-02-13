/**
 * Service pour gérer le mode Standby (Veille) du bot
 * Active automatiquement quand les services locaux (Ollama/Python API) sont inaccessibles
 * Fait des vérifications régulières pour revenir en mode normal
 */

import {Client} from "discord.js";
import {createLogger} from "../utils/logger";
import {setNormalStatus, setStandbyStatus} from "./statusService";
import {OLLAMA_API_URL} from "../utils/constants";

const logger = createLogger("StandbyMode");

const IMAGE_API_URL = process.env.IMAGE_API_URL || "http://localhost:8000";
const CHECK_INTERVAL_STANDBY = 2 * 60 * 1000; // Vérifier toutes les 2 minutes en mode Standby
const CHECK_INTERVAL_NORMAL = 5 * 60 * 1000; // Vérifier toutes les 5 minutes en mode normal
const TIMEOUT_MS = 30000; // Timeout de 30 secondes pour les checks

interface StandbyState {
    enabled: boolean;
    lastCheck: Date | null;
    failedChecks: number;
    checkIntervalId: NodeJS.Timeout | null;
}

let standbyState: StandbyState = {
    enabled: false,
    lastCheck: null,
    failedChecks: 0,
    checkIntervalId: null
};

/**
 * Vérifie si Ollama est accessible
 */
async function checkOllamaConnection(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        logger.debug(`Checking Ollama at: ${OLLAMA_API_URL}/api/tags`);

        const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
            method: "GET",
            signal: controller.signal,
            headers: {
                'User-Agent': 'Netricsa-Bot/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            logger.info(`✅ Ollama connection successful (${response.status})`);
            return true;
        } else {
            logger.warn(`⚠️ Ollama responded with status ${response.status}`);
            return false;
        }
    } catch (error) {
        if (error instanceof Error) {
            logger.warn(`❌ Ollama connection check failed: ${error.name} - ${error.message}`);
            if (error.stack) {
                logger.debug(`Stack trace: ${error.stack}`);
            }
        } else {
            logger.warn(`❌ Ollama connection check failed: ${String(error)}`);
        }
        return false;
    }
}

/**
 * Vérifie si l'API Python est accessible
 */
async function checkPythonAPIConnection(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        logger.debug(`Checking Python API at: ${IMAGE_API_URL}/`);

        const response = await fetch(`${IMAGE_API_URL}/`, {
            method: "GET",
            signal: controller.signal,
            headers: {
                'User-Agent': 'Netricsa-Bot/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            logger.info(`✅ Python API connection successful (${response.status})`);
            return true;
        } else {
            logger.warn(`⚠️ Python API responded with status ${response.status}`);
            return false;
        }
    } catch (error) {
        if (error instanceof Error) {
            logger.warn(`❌ Python API connection check failed: ${error.name} - ${error.message}`);
            if (error.stack) {
                logger.debug(`Stack trace: ${error.stack}`);
            }
        } else {
            logger.warn(`❌ Python API connection check failed: ${String(error)}`);
        }
        return false;
    }
}

/**
 * Vérifie la connectivité aux services locaux
 * @returns true si au moins un service est accessible
 */
export async function checkServicesAvailability(): Promise<{ ollama: boolean, pythonAPI: boolean, anyAvailable: boolean }> {
    const [ollamaOk, pythonOk] = await Promise.all([
        checkOllamaConnection(),
        checkPythonAPIConnection()
    ]);

    return {
        ollama: ollamaOk,
        pythonAPI: pythonOk,
        anyAvailable: ollamaOk || pythonOk
    };
}

/**
 * Active le mode Standby
 */
async function enableStandbyMode(client: Client): Promise<void> {
    if (standbyState.enabled) return;

    standbyState.enabled = true;
    standbyState.failedChecks++;

    logger.warn(`🌙 Entering STANDBY MODE (failed checks: ${standbyState.failedChecks})`);
    await setStandbyStatus(client);

    // Remplacer les missions impossibles dans les événements actifs
    try {
        const {handleStandbyModeTransition} = require('./events/impostorEvent');
        await handleStandbyModeTransition(client);
    } catch (error) {
        logger.error('Error handling Standby Mode transition for impostor events:', error);
    }

    // Passer à des vérifications plus fréquentes
    startPeriodicChecks(client);
}

/**
 * Désactive le mode Standby
 */
async function disableStandbyMode(client: Client): Promise<void> {
    if (!standbyState.enabled) return;

    standbyState.enabled = false;
    standbyState.failedChecks = 0;

    logger.info(`✅ Exiting STANDBY MODE - Services reconnected`);
    await setNormalStatus(client);

    // Restaurer les missions originales dans les événements actifs
    try {
        const {handleStandbyModeExit} = require('./events/impostorEvent');
        await handleStandbyModeExit(client);
    } catch (error) {
        logger.error('Error handling Standby Mode exit for impostor events:', error);
    }

    // Repasser à des vérifications moins fréquentes
    startPeriodicChecks(client);
}

/**
 * Démarre les vérifications périodiques
 * Adapte l'intervalle selon le mode (Standby = 2min, Normal = 5min)
 */
function startPeriodicChecks(client: Client): void {
    // Arrêter l'intervalle existant si présent
    if (standbyState.checkIntervalId) {
        clearInterval(standbyState.checkIntervalId);
    }

    // Choisir l'intervalle selon le mode
    const interval = standbyState.enabled ? CHECK_INTERVAL_STANDBY : CHECK_INTERVAL_NORMAL;
    const modeLabel = standbyState.enabled ? "Standby" : "Normal";

    logger.info(`🔄 Starting periodic connectivity checks in ${modeLabel} mode (every ${interval / 1000}s)`);

    standbyState.checkIntervalId = setInterval(async () => {
        await performConnectivityCheck(client);
    }, interval);
}

/**
 * Arrête les vérifications périodiques
 */
function stopPeriodicChecks(): void {
    if (standbyState.checkIntervalId) {
        clearInterval(standbyState.checkIntervalId);
        standbyState.checkIntervalId = null;
        logger.info(`🛑 Stopped periodic connectivity checks`);
    }
}

/**
 * Effectue une vérification de connectivité
 */
async function performConnectivityCheck(client: Client): Promise<void> {
    standbyState.lastCheck = new Date();

    const status = await checkServicesAvailability();

    logger.info(`🔍 Connectivity check - Ollama: ${status.ollama ? '✅' : '❌'}, Python API: ${status.pythonAPI ? '✅' : '❌'}`);

    if (standbyState.enabled && status.anyAvailable) {
        // Services revenus en ligne, sortir du mode Standby
        await disableStandbyMode(client);
    } else if (!standbyState.enabled && !status.anyAvailable) {
        // Services inaccessibles (détection proactive), entrer en mode Standby
        logger.warn("⚠️ Proactive check detected services are down - entering Standby Mode");
        await enableStandbyMode(client);
    }
}

/**
 * Vérifie la connectivité et active le mode Standby si nécessaire
 * À appeler lors d'une erreur de connexion
 */
export async function handleConnectionError(client: Client): Promise<void> {
    const status = await checkServicesAvailability();

    if (!status.anyAvailable) {
        await enableStandbyMode(client);
    }
}

/**
 * Initialise le service de mode Standby
 * Effectue une vérification initiale et démarre les vérifications périodiques
 */
export async function initializeStandbyMode(client: Client): Promise<void> {
    logger.info("Initializing Standby Mode service...");

    const status = await checkServicesAvailability();
    logger.info(`Initial connectivity check - Ollama: ${status.ollama ? '✅' : '❌'}, Python API: ${status.pythonAPI ? '✅' : '❌'}`);

    if (!status.anyAvailable) {
        logger.warn("⚠️ No services available at startup, entering Standby Mode");
        await enableStandbyMode(client);
    } else {
        logger.info("✅ Services available, operating in normal mode");
        // Démarrer les vérifications périodiques même en mode normal
        startPeriodicChecks(client);
    }
}

/**
 * Retourne l'état actuel du mode Standby
 */
export function isStandbyMode(): boolean {
    return standbyState.enabled;
}

/**
 * Retourne les statistiques du mode Standby
 */
export function getStandbyStats(): {
    enabled: boolean;
    lastCheck: Date | null;
    failedChecks: number;
    checkInterval: number;
} {
    return {
        enabled: standbyState.enabled,
        lastCheck: standbyState.lastCheck,
        failedChecks: standbyState.failedChecks,
        checkInterval: standbyState.enabled ? CHECK_INTERVAL_STANDBY : CHECK_INTERVAL_NORMAL
    };
}

/**
 * Force une vérification immédiate de la connectivité
 */
export async function forceConnectivityCheck(client: Client): Promise<{ ollama: boolean, pythonAPI: boolean, anyAvailable: boolean }> {
    logger.info("🔍 Forcing connectivity check...");
    const status = await checkServicesAvailability();
    await performConnectivityCheck(client);
    return status;
}

