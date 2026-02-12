import {createLogger} from "../utils/logger";

const logger = createLogger("AskNetricsaTracker");

interface AskNetricsaRequest {
    userId: string;
    channelId: string;
    abortController: AbortController;
    animationInterval: NodeJS.Timeout | null;
    startTime: number;
}

// Map pour tracker les requêtes ask-netricsa actives par utilisateur
const activeRequests = new Map<string, AskNetricsaRequest>();

/**
 * Enregistre une nouvelle requête ask-netricsa
 */
export function registerAskNetricsaRequest(
    userId: string,
    channelId: string,
    abortController: AbortController,
    animationInterval: NodeJS.Timeout | null
): void {
    logger.info(`Registering ask-netricsa request for user ${userId}`);

    activeRequests.set(userId, {
        userId,
        channelId,
        abortController,
        animationInterval,
        startTime: Date.now()
    });
}

/**
 * Désenregistre une requête ask-netricsa terminée
 */
export function unregisterAskNetricsaRequest(userId: string): void {
    const request = activeRequests.get(userId);
    if (request) {
        logger.info(`Unregistering ask-netricsa request for user ${userId}`);
        activeRequests.delete(userId);
    }
}

/**
 * Vérifie si un utilisateur a une requête ask-netricsa en cours
 */
export function hasActiveRequest(userId: string): boolean {
    return activeRequests.has(userId);
}

/**
 * Annule une requête ask-netricsa en cours pour un utilisateur
 * @returns true si une requête a été annulée
 */
export function abortAskNetricsaRequest(userId: string): boolean {
    const request = activeRequests.get(userId);

    if (!request) {
        logger.info(`No active ask-netricsa request found for user ${userId}`);
        return false;
    }

    logger.info(`Aborting ask-netricsa request for user ${userId}`);

    // Arrêter l'animation
    if (request.animationInterval) {
        clearInterval(request.animationInterval);
    }

    // Déclencher l'abort
    request.abortController.abort();

    // Désenregistrer
    activeRequests.delete(userId);

    return true;
}

/**
 * Annule toutes les requêtes ask-netricsa dans un canal
 * @returns true si au moins une requête a été annulée
 */
export function abortAskNetricsaByChannel(
    channelId: string,
    requestingUserId?: string,
    isAdminOrOwner: boolean = false
): boolean {
    let aborted = false;

    logger.info(`Attempting to abort ask-netricsa in channel ${channelId}, requesting user: ${requestingUserId}, isAdmin: ${isAdminOrOwner}`);

    for (const [userId, request] of activeRequests.entries()) {
        if (request.channelId === channelId) {
            logger.info(`Found ask-netricsa request for user ${userId} in channel ${channelId}`);

            // Vérifier si l'utilisateur a le droit d'arrêter cette requête
            if (!isAdminOrOwner && requestingUserId && request.userId !== requestingUserId) {
                logger.info(`User ${requestingUserId} cannot abort request from ${userId} (not admin/owner)`);
                continue;
            }

            logger.info(`Aborting ask-netricsa request for user ${userId}`);

            // Arrêter l'animation
            if (request.animationInterval) {
                clearInterval(request.animationInterval);
            }

            // Déclencher l'abort
            request.abortController.abort();

            // Désenregistrer
            activeRequests.delete(userId);
            aborted = true;
        }
    }

    return aborted;
}

