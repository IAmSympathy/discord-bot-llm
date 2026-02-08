import {Client, Events, VoiceState} from "discord.js";
import {createLogger} from "./utils/logger";
import {addXP, XP_REWARDS} from "./services/xpSystem";
import {recordVoiceTimeStats} from "./services/statsRecorder";

const logger = createLogger("VoiceTracker");

// Map pour stocker le timestamp de début de session vocale et le canal
interface VoiceSession {
    startTime: number;
    channelId: string;
    xpInterval?: NodeJS.Timeout; // Interval pour donner de l'XP en temps réel
    minutesTracked: number; // Nombre de minutes pour lesquelles l'XP a été donnée
    isBot: boolean; // Si c'est un bot
}

const voiceSessions = new Map<string, VoiceSession>();

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
 * Enregistre le début d'une session vocale et démarre le tracking d'XP en temps réel
 */
function startVoiceSession(userId: string, channelId: string, username: string, client: Client, isBot: boolean): void {
    // Créer un interval qui donne de l'XP toutes les minutes
    const xpInterval = setInterval(async () => {
        const session = voiceSessions.get(userId);
        if (!session) {
            clearInterval(xpInterval);
            return;
        }

        // Incrémenter le compteur de minutes
        session.minutesTracked++;

        // Enregistrer 1 minute de temps vocal dans les stats (en temps réel)
        recordVoiceTimeStats(userId, username, 1);

        // Vérifier les achievements Discord (vocal)
        const {checkDiscordAchievements} = require("./services/discordAchievementChecker");
        checkDiscordAchievements(userId, username, client, channelId).catch((error: any) => {
            console.error("Error checking Discord achievements:", error);
        });

        // Donner de l'XP pour cette minute
        try {
            const channel = client.guilds.cache
                .flatMap(guild => guild.channels.cache)
                .find(c => c.id === channelId);

            if (channel && channel.isVoiceBased()) {
                await addXP(
                    userId,
                    username,
                    XP_REWARDS.minuteVocale,
                    channel as any,
                    isBot // Pas de notification pour les bots
                );
                logger.info(`Gave ${XP_REWARDS.minuteVocale} XP to ${username} for 1 minute in voice (total: ${session.minutesTracked} min)`);
            }
        } catch (error) {
            logger.error(`Error giving XP for voice time:`, error);
        }
    }, 60000); // Toutes les 60 secondes (1 minute)

    voiceSessions.set(userId, {
        startTime: Date.now(),
        channelId,
        xpInterval,
        minutesTracked: 0,
        isBot
    });
    logger.info(`Voice session started for user ${userId} in channel ${channelId} with real-time XP tracking`);
}

/**
 * Termine une session vocale
 */
async function endVoiceSession(userId: string, username: string, voiceState: VoiceState): Promise<void> {
    const session = voiceSessions.get(userId);
    if (!session) return;

    // Arrêter l'interval d'XP
    if (session.xpInterval) {
        clearInterval(session.xpInterval);
    }

    const duration = Date.now() - session.startTime;
    const totalMinutes = Math.floor(duration / 60000);

    // Les minutes ont déjà été enregistrées en temps réel par l'interval
    // Mais enregistrer les minutes partielles restantes (moins d'une minute)
    const remainingTime = totalMinutes - session.minutesTracked;
    if (remainingTime > 0) {
        recordVoiceTimeStats(userId, username, remainingTime);
    }

    logger.info(`Voice session ended for ${username}: ${formatVoiceTime(totalMinutes)} (XP given in real-time: ${session.minutesTracked} min)`);

    voiceSessions.delete(userId);
}

/**
 * Enregistre les événements vocaux pour tracker le temps passé
 */
export function registerVoiceTracker(client: Client): void {
    logger.info("Voice tracker initialized with real-time XP system");

    // Initialiser les sessions pour les utilisateurs déjà en vocal au démarrage
    client.once(Events.ClientReady, () => {
        logger.info("Checking for users already in voice channels...");

        client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                if (channel.isVoiceBased()) {
                    channel.members.forEach(member => {
                        const userId = member.user.id;
                        const username = member.user.username;
                        const isBot = member.user.bot;

                        // Démarrer une session pour cet utilisateur
                        startVoiceSession(userId, channel.id, username, client, isBot);
                        logger.info(`Started voice session for ${username} (already in voice at startup)`);
                    });
                }
            });
        });

        logger.info("Voice session initialization complete");
    });

    client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
        try {
            const userId = newState.id;
            const username = newState.member?.user.username || "Unknown";
            const isBot = newState.member?.user.bot || false;

            // Ne plus ignorer les bots - ils peuvent aussi gagner de l'XP en vocal

            const wasInVoice = oldState.channelId !== null;
            const isInVoice = newState.channelId !== null;

            // Utilisateur rejoint un canal vocal
            if (!wasInVoice && isInVoice && newState.channelId) {
                startVoiceSession(userId, newState.channelId, username, client, isBot);
            }
            // Utilisateur quitte un canal vocal
            else if (wasInVoice && !isInVoice) {
                await endVoiceSession(userId, username, oldState);
            }
            // Utilisateur change de canal vocal
            else if (wasInVoice && isInVoice && oldState.channelId !== newState.channelId && newState.channelId) {
                // Terminer la session dans l'ancien canal
                await endVoiceSession(userId, username, oldState);
                // Démarrer une nouvelle session dans le nouveau canal
                startVoiceSession(userId, newState.channelId, username, client, isBot);
                logger.info(`User ${username} moved to another voice channel`);
            }
        } catch (error) {
            logger.error("Error handling voice state update:", error);
        }
    });

    // Sauvegarder les sessions en cours quand le bot s'arrête
    process.on('SIGINT', () => {
        logger.info("Saving ongoing voice sessions before shutdown...");
        voiceSessions.forEach((session, userId) => {
            // Arrêter l'interval
            if (session.xpInterval) {
                clearInterval(session.xpInterval);
            }

            const duration = Date.now() - session.startTime;
            const minutes = Math.floor(duration / 60000);
            if (minutes >= 1) {
                recordVoiceTimeStats(userId, "User", minutes);
            }
        });
        voiceSessions.clear();
    });
}
