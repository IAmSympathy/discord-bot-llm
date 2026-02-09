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

// Map pour tracker le temps vocal quotidien de chaque utilisateur (reset à minuit)
interface DailyVoiceTime {
    totalMinutes: number;
    lastReset: string; // Format: YYYY-MM-DD
}

const voiceSessions = new Map<string, VoiceSession>();
const dailyVoiceTime = new Map<string, DailyVoiceTime>();

/**
 * Paliers de rendements décroissants pour l'XP vocal quotidien
 * Encourage la présence sans récompenser le farming passif sur de longues périodes
 */
const VOICE_XP_DIMINISHING_RETURNS = [
    {minMinutes: 0, maxMinutes: 60, multiplier: 1.0},   // 0-1h : 100% XP
    {minMinutes: 60, maxMinutes: 120, multiplier: 0.75},  // 1-2h : 75% XP
    {minMinutes: 120, maxMinutes: 180, multiplier: 0.5},   // 2-3h : 50% XP
    {minMinutes: 180, maxMinutes: 240, multiplier: 0.25},  // 3-4h : 25% XP
    {minMinutes: 240, maxMinutes: Infinity, multiplier: 0.1} // 4h+ : 10% XP
];

/**
 * Obtient le multiplicateur XP basé sur le temps vocal quotidien
 */
function getVoiceXPMultiplier(userId: string): number {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    let dailyTime = dailyVoiceTime.get(userId);

    // Reset si c'est un nouveau jour
    if (!dailyTime || dailyTime.lastReset !== today) {
        dailyTime = {totalMinutes: 0, lastReset: today};
        dailyVoiceTime.set(userId, dailyTime);
    }

    // Trouver le palier approprié
    for (const tier of VOICE_XP_DIMINISHING_RETURNS) {
        if (dailyTime.totalMinutes >= tier.minMinutes && dailyTime.totalMinutes < tier.maxMinutes) {
            return tier.multiplier;
        }
    }

    return 0.1; // Par défaut, 10% (au-delà de 4h)
}

/**
 * Incrémente le temps vocal quotidien d'un utilisateur
 */
function incrementDailyVoiceTime(userId: string, minutes: number): void {
    const today = new Date().toISOString().split('T')[0];
    let dailyTime = dailyVoiceTime.get(userId);

    if (!dailyTime || dailyTime.lastReset !== today) {
        dailyTime = {totalMinutes: 0, lastReset: today};
    }

    dailyTime.totalMinutes += minutes;
    dailyVoiceTime.set(userId, dailyTime);
}

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

        // Tracker le temps vocal pour la mission imposteur
        try {
            const channel = client.guilds.cache
                .flatMap(guild => guild.channels.cache)
                .find(c => c.id === channelId);

            if (channel && channel.isVoiceBased()) {
                // Compter le nombre de personnes dans le canal (excluant les bots)
                const members = Array.from(channel.members.values());
                const humanMembers = members.filter(m => !m.user.bot);
                const isAlone = humanMembers.length === 1 && humanMembers[0].id === userId;

                // Tracker pour la mission imposteur (1 minute à la fois, cumulatif)
                const {trackImpostorVoiceTime} = require("./services/events/impostorMissionTracker");
                await trackImpostorVoiceTime(client, userId, 1, !isAlone);

                // Appliquer le système de rendements décroissants
                const multiplier = getVoiceXPMultiplier(userId);
                const baseXP = XP_REWARDS.minuteVocale;
                const adjustedXP = Math.ceil(baseXP * multiplier); // Arrondir vers le haut pour éviter 0 XP

                // Incrémenter le temps vocal quotidien
                incrementDailyVoiceTime(userId, 1);

                // Donner de l'XP ajusté pour cette minute
                await addXP(
                    userId,
                    username,
                    adjustedXP,
                    channel as any,
                    isBot // Pas de notification pour les bots
                );

                // Log avec info sur le multiplicateur
                const dailyTime = dailyVoiceTime.get(userId);
                const totalMinutes = dailyTime ? dailyTime.totalMinutes : 0;
                logger.info(
                    `Gave ${adjustedXP} XP (${Math.round(multiplier * 100)}% multiplier) to ${username} ` +
                    `for 1 minute in voice (session: ${session.minutesTracked} min, daily: ${totalMinutes} min)`
                );
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

/**
 * Obtient le temps vocal quotidien d'un utilisateur (en minutes)
 * Utilisé pour la commande /voicestatus
 */
export function getDailyVoiceTime(userId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const dailyTime = dailyVoiceTime.get(userId);

    if (!dailyTime || dailyTime.lastReset !== today) {
        return 0; // Pas de temps vocal aujourd'hui ou reset nécessaire
    }

    return dailyTime.totalMinutes;
}


