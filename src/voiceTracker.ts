import {Client, Events, VoiceState} from "discord.js";
import {recordVoiceTime} from "./services/userStatsService";
import {createLogger} from "./utils/logger";

const logger = createLogger("VoiceTracker");

// Map pour stocker le timestamp de début de session vocale
const voiceSessions = new Map<string, number>();

/**
 * Formate le temps en heures et minutes
 */
function formatVoiceTime(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Enregistre le début d'une session vocale
 */
function startVoiceSession(userId: string): void {
    voiceSessions.set(userId, Date.now());
    logger.info(`Voice session started for user ${userId}`);
}

/**
 * Termine une session vocale et enregistre le temps
 */
function endVoiceSession(userId: string, username: string): void {
    const startTime = voiceSessions.get(userId);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000); // Convertir ms en minutes

    // Seulement enregistrer si la session a duré au moins 1 minute
    if (minutes >= 1) {
        recordVoiceTime(userId, username, minutes);
        logger.info(`Voice session ended for ${username}: ${formatVoiceTime(minutes)}`);
    }

    voiceSessions.delete(userId);
}

/**
 * Enregistre les événements vocaux pour tracker le temps passé
 */
export function registerVoiceTracker(client: Client): void {
    logger.info("Voice tracker initialized");

    client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
        try {
            const userId = newState.id;
            const username = newState.member?.user.username || "Unknown";

            const wasInVoice = oldState.channelId !== null;
            const isInVoice = newState.channelId !== null;

            // Utilisateur rejoint un canal vocal
            if (!wasInVoice && isInVoice) {
                startVoiceSession(userId);
            }
            // Utilisateur quitte un canal vocal
            else if (wasInVoice && !isInVoice) {
                endVoiceSession(userId, username);
            }
            // Utilisateur change de canal vocal (transférer la session)
            else if (wasInVoice && isInVoice && oldState.channelId !== newState.channelId) {
                // Terminer la session dans l'ancien canal
                endVoiceSession(userId, username);
                // Démarrer une nouvelle session dans le nouveau canal
                startVoiceSession(userId);
                logger.info(`User ${username} moved to another voice channel`);
            }
        } catch (error) {
            logger.error("Error handling voice state update:", error);
        }
    });

    // Sauvegarder les sessions en cours quand le bot s'arrête
    process.on('SIGINT', () => {
        logger.info("Saving ongoing voice sessions before shutdown...");
        voiceSessions.forEach((startTime, userId) => {
            const duration = Date.now() - startTime;
            const minutes = Math.floor(duration / 60000);
            if (minutes >= 1) {
                recordVoiceTime(userId, "User", minutes);
            }
        });
        voiceSessions.clear();
    });
}
