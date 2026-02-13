import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("UserStats");
const STATS_FILE = path.join(DATA_DIR, "user_stats.json");

// ID et nom de Netricsa (le bot)
export const NETRICSA_USER_ID = "1462959115528835092";
export const NETRICSA_USERNAME = "Netricsa";

/**
 * Structure des statistiques Discord d'un utilisateur
 */
export interface DiscordStats {
    messagesEnvoyes: number;
    reactionsAjoutees: number;
    reactionsRecues: number;
    commandesUtilisees: number;
    mentionsRecues: number;
    repliesRecues: number;
    tempsVocalMinutes: number; // Temps passé en vocal en minutes
    emojisUtilises?: { [emoji: string]: number }; // Compteur d'emojis utilisés
}

/**
 * Structure des statistiques Netricsa d'un utilisateur
 */
export interface NetricsaStats {
    imagesGenerees: number;
    imagesReimaginee: number;
    imagesUpscalee: number;
    conversationsIA: number;
    memesRecherches: number;
    promptsCrees: number;
    recherchesWebNetricsa?: number; // Seulement pour Netricsa elle-même
}

/**
 * Structure complète des statistiques d'un utilisateur
 */
export interface UserStats {
    userId: string;
    username: string;
    discord: DiscordStats;
    netricsa: NetricsaStats;
    lastUpdate: number;
}

/**
 * Base de données des statistiques
 */
interface StatsDatabase {
    [userId: string]: UserStats;
}

/**
 * Charge les statistiques depuis le fichier JSON
 */
function loadStats(): StatsDatabase {
    try {
        if (!fs.existsSync(STATS_FILE)) {
            return {};
        }
        const data = fs.readFileSync(STATS_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        logger.error("Error loading user stats:", error);
        return {};
    }
}

/**
 * Sauvegarde les statistiques dans le fichier JSON
 */
function saveStats(stats: StatsDatabase): void {
    try {
        const dir = path.dirname(STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (error) {
        logger.error("Error saving user stats:", error);
    }
}

/**
 * Initialise les statistiques par défaut pour un utilisateur
 */
function initUserStats(userId: string, username: string): UserStats {
    const isNetricsa = userId === NETRICSA_USER_ID;

    return {
        userId,
        username,
        discord: {
            messagesEnvoyes: 0,
            reactionsAjoutees: 0,
            reactionsRecues: 0,
            commandesUtilisees: 0,
            mentionsRecues: 0,
            repliesRecues: 0,
            tempsVocalMinutes: 0,
            emojisUtilises: {}
        },
        netricsa: {
            imagesGenerees: 0,
            imagesReimaginee: 0,
            imagesUpscalee: 0,
            conversationsIA: 0,
            memesRecherches: 0,
            promptsCrees: 0,
            ...(isNetricsa ? {recherchesWebNetricsa: 0} : {})
        },
        lastUpdate: Date.now()
    };
}

/**
 * Récupère les statistiques d'un utilisateur
 */
export function getUserStats(userId: string): UserStats | null {
    const stats = loadStats();
    const userStat = stats[userId];

    if (!userStat) {
        return null;
    }

    // Migration : ajouter tempsVocalMinutes si manquant (anciennes données)
    if (userStat.discord && userStat.discord.tempsVocalMinutes === undefined) {
        userStat.discord.tempsVocalMinutes = 0;
    }

    return userStat;
}

/**
 * Récupère les statistiques de Netricsa (le bot)
 */
export function getNetricsaStats(): UserStats | null {
    return getUserStats(NETRICSA_USER_ID);
}

/**
 * Met à jour le nom d'utilisateur
 */
function updateUsername(userId: string, username: string): void {
    const stats = loadStats();
    if (stats[userId]) {
        stats[userId].username = username;
        stats[userId].lastUpdate = Date.now();
        saveStats(stats);
    }
}

// === FONCTIONS D'INCRÉMENTATION DISCORD ===

/**
 * Enregistre un message envoyé
 */
export function recordMessageSent(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.messagesEnvoyes++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);

    // Note: XP est ajouté avec notification dans watchChannel.ts
}

/**
 * Enregistre une réaction ajoutée
 */
export function recordReactionAdded(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.reactionsAjoutees++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);

    // Note: XP avec notification est ajouté dans bot.ts lors de l'événement reactionAdd
}

/**
 * Enregistre une réaction reçue
 */
export function recordReactionReceived(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.reactionsRecues++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une commande utilisée
 */
export function recordCommandUsed(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.commandesUtilisees++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une mention reçue
 */
export function recordMentionReceived(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.mentionsRecues++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une reply reçue
 */
export function recordReplyReceived(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.repliesRecues++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre le temps passé en vocal (en minutes)
 */
export function recordVoiceTime(userId: string, username: string, minutes: number): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].discord.tempsVocalMinutes += minutes;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

// === FONCTIONS D'INCRÉMENTATION NETRICSA ===

/**
 * Enregistre une génération d'image
 */
export function recordImageGenerated(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].netricsa.imagesGenerees++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une réimagination d'image
 */
export function recordImageReimagined(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].netricsa.imagesReimaginee++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre un upscale d'image
 */
export function recordImageUpscaled(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].netricsa.imagesUpscalee++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une conversation IA
 */
export function recordAIConversation(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].netricsa.conversationsIA++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une recherche de meme
 */
export function recordMemeSearched(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].netricsa.memesRecherches++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre la création d'un prompt
 */
export function recordPromptCreated(userId: string, username: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }
    stats[userId].netricsa.promptsCrees++;
    stats[userId].username = username;
    stats[userId].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre une recherche web de Netricsa (uniquement pour Netricsa elle-même)
 */
export function recordNetricsaWebSearch(): void {
    const stats = loadStats();
    if (!stats[NETRICSA_USER_ID]) {
        stats[NETRICSA_USER_ID] = initUserStats(NETRICSA_USER_ID, NETRICSA_USERNAME);
    }

    // Initialiser le champ s'il n'existe pas
    if (stats[NETRICSA_USER_ID].netricsa.recherchesWebNetricsa === undefined) {
        stats[NETRICSA_USER_ID].netricsa.recherchesWebNetricsa = 0;
    }

    stats[NETRICSA_USER_ID].netricsa.recherchesWebNetricsa!++;
    stats[NETRICSA_USER_ID].lastUpdate = Date.now();
    saveStats(stats);
}

/**
 * Enregistre les emojis utilisés dans un message
 */
export function recordEmojisUsed(userId: string, username: string, messageContent: string): void {
    const stats = loadStats();
    if (!stats[userId]) {
        stats[userId] = initUserStats(userId, username);
    }

    // Initialiser le champ s'il n'existe pas
    if (!stats[userId].discord.emojisUtilises) {
        stats[userId].discord.emojisUtilises = {};
    }

    // Regex pour extraire les emojis Unicode et Discord personnalisés
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)/gu;
    const emojis = messageContent.match(emojiRegex);

    if (emojis && emojis.length > 0) {
        for (const emoji of emojis) {
            // Pour les emojis Discord personnalisés, on garde juste le nom
            let cleanEmoji = emoji;
            const customEmojiMatch = emoji.match(/<a?:(\w+):\d+>/);
            if (customEmojiMatch) {
                cleanEmoji = `:${customEmojiMatch[1]}:`;
            }

            if (!stats[userId].discord.emojisUtilises![cleanEmoji]) {
                stats[userId].discord.emojisUtilises![cleanEmoji] = 0;
            }
            stats[userId].discord.emojisUtilises![cleanEmoji]++;
        }

        stats[userId].username = username;
        stats[userId].lastUpdate = Date.now();
        saveStats(stats);
    }
}

/**
 * Récupère l'emoji le plus utilisé par un utilisateur
 */
export function getMostUsedEmoji(userId: string): { emoji: string; count: number } | null {
    const stats = loadStats();
    const userStat = stats[userId];

    if (!userStat || !userStat.discord.emojisUtilises || Object.keys(userStat.discord.emojisUtilises).length === 0) {
        return null;
    }

    let mostUsedEmoji = "";
    let maxCount = 0;

    for (const [emoji, count] of Object.entries(userStat.discord.emojisUtilises)) {
        if (count > maxCount) {
            maxCount = count;
            mostUsedEmoji = emoji;
        }
    }

    return mostUsedEmoji ? {emoji: mostUsedEmoji, count: maxCount} : null;
}

/**
 * Récupère l'emoji le plus utilisé sur tout le serveur
 */
export function getServerMostUsedEmoji(): { emoji: string; count: number } | null {
    const stats = loadStats();
    const emojiCounts: { [emoji: string]: number } = {};

    // Agréger tous les emojis de tous les utilisateurs
    for (const userStat of Object.values(stats)) {
        if (userStat.discord.emojisUtilises) {
            for (const [emoji, count] of Object.entries(userStat.discord.emojisUtilises)) {
                if (!emojiCounts[emoji]) {
                    emojiCounts[emoji] = 0;
                }
                emojiCounts[emoji] += count;
            }
        }
    }

    if (Object.keys(emojiCounts).length === 0) {
        return null;
    }

    let mostUsedEmoji = "";
    let maxCount = 0;

    for (const [emoji, count] of Object.entries(emojiCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostUsedEmoji = emoji;
        }
    }

    return mostUsedEmoji ? {emoji: mostUsedEmoji, count: maxCount} : null;
}

/**
 * Sauvegarde les stats de l'année dans un fichier backup
 */
export function backupYearlyStats(year: string): void {
    try {
        const stats = loadStats();
        const backupFile = path.join(DATA_DIR, `user_stats_${year}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(stats, null, 2));
        logger.info(`✅ Stats backed up to user_stats_${year}.json`);
    } catch (error) {
        logger.error("Error backing up yearly stats:", error);
    }
}

/**
 * Réinitialise toutes les stats pour une nouvelle année
 */
export function resetAllStats(): void {
    try {
        const stats = loadStats();

        // Réinitialiser chaque utilisateur en gardant les IDs et usernames
        for (const userId in stats) {
            const username = stats[userId].username;
            stats[userId] = initUserStats(userId, username);
        }

        saveStats(stats);
        logger.info(`✅ All stats reset for new year`);
    } catch (error) {
        logger.error("Error resetting stats:", error);
    }
}

/**
 * Récupère toutes les statistiques (pour le serveur)
 */
export function getAllStats(): StatsDatabase {
    return loadStats();
}

/**
 * Calcule les statistiques globales du serveur
 */
export interface ServerStats {
    totalUsers: number;
    totalMessages: number;
    totalReactions: number;
    totalCommands: number;
    totalImages: number;
    totalUpscales: number;
    totalSearches: number;
    totalConversations: number;
}

export function getServerStats(excludeBots: boolean = false): ServerStats {
    const allStats = loadStats();
    const stats: ServerStats = {
        totalUsers: 0,
        totalMessages: 0,
        totalReactions: 0,
        totalCommands: 0,
        totalImages: 0,
        totalUpscales: 0,
        totalSearches: 0,
        totalConversations: 0
    };

    for (const userStat of Object.values(allStats)) {
        // Si excludeBots est true, ignorer Netricsa et les autres bots
        if (excludeBots && (userStat.userId === NETRICSA_USER_ID || userStat.userId.startsWith('bot_'))) {
            continue;
        }

        stats.totalUsers++;
        stats.totalMessages += userStat.discord.messagesEnvoyes;
        stats.totalReactions += userStat.discord.reactionsAjoutees;
        stats.totalCommands += userStat.discord.commandesUtilisees;
        stats.totalImages += userStat.netricsa.imagesGenerees + userStat.netricsa.imagesReimaginee;
        stats.totalUpscales += userStat.netricsa.imagesUpscalee;
        // Les recherches web ne sont plus comptées (uniquement pour Netricsa)
        stats.totalConversations += userStat.netricsa.conversationsIA;
    }

    return stats;
}
