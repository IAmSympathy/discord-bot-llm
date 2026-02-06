import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("YearlyStats");
const YEARLY_STATS_FILE = path.join(DATA_DIR, "yearly_stats.json");

/**
 * Structure des statistiques annuelles par action
 */
interface YearlyActionStats {
    [year: string]: {
        [userId: string]: {
            username: string;
            discord: {
                messagesEnvoyes: number;
                reactionsAjoutees: number;
                reactionsRecues: number;
                commandesUtilisees: number;
                mentionsRecues: number;
                repliesRecues: number;
                tempsVocalMinutes: number;
            };
            netricsa: {
                imagesGenerees: number;
                imagesReimaginee: number;
                imagesUpscalee: number;
                conversationsIA: number;
                memesRecherches: number;
                promptsCrees: number;
                recherchesWebNetricsa?: number;
            };
        };
    };
}

/**
 * Charge les statistiques annuelles
 */
function loadYearlyStats(): YearlyActionStats {
    try {
        if (fs.existsSync(YEARLY_STATS_FILE)) {
            const data = fs.readFileSync(YEARLY_STATS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading yearly stats:", error);
    }
    return {};
}

/**
 * Sauvegarde les statistiques annuelles
 */
function saveYearlyStats(stats: YearlyActionStats): void {
    try {
        const dir = path.dirname(YEARLY_STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(YEARLY_STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (error) {
        logger.error("Error saving yearly stats:", error);
    }
}

/**
 * Obtient l'année actuelle au format YYYY
 */
function getCurrentYear(): string {
    return new Date().getFullYear().toString();
}

/**
 * Initialise les stats d'un utilisateur pour une année
 */
function initYearlyUserStats(username: string, isNetricsa: boolean = false): any {
    return {
        username,
        discord: {
            messagesEnvoyes: 0,
            reactionsAjoutees: 0,
            reactionsRecues: 0,
            commandesUtilisees: 0,
            mentionsRecues: 0,
            repliesRecues: 0,
            tempsVocalMinutes: 0
        },
        netricsa: {
            imagesGenerees: 0,
            imagesReimaginee: 0,
            imagesUpscalee: 0,
            conversationsIA: 0,
            memesRecherches: 0,
            promptsCrees: 0,
            ...(isNetricsa ? {recherchesWebNetricsa: 0} : {})
        }
    };
}

// === FONCTIONS D'INCRÉMENTATION DISCORD ===

export function recordYearlyMessageSent(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.messagesEnvoyes++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyReactionAdded(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.reactionsAjoutees++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyReactionReceived(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.reactionsRecues++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyCommandUsed(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.commandesUtilisees++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyMentionReceived(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.mentionsRecues++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyReplyReceived(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.repliesRecues++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyVoiceTime(userId: string, username: string, minutes: number): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username);

    stats[year][userId].discord.tempsVocalMinutes += minutes;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

// === FONCTIONS D'INCRÉMENTATION NETRICSA ===

export function recordYearlyImageGenerated(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const isNetricsa = userId === "NETRICSA_BOT";
    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, isNetricsa);

    stats[year][userId].netricsa.imagesGenerees++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyImageReimagined(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const isNetricsa = userId === "NETRICSA_BOT";
    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, isNetricsa);

    stats[year][userId].netricsa.imagesReimaginee++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyImageUpscaled(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const isNetricsa = userId === "NETRICSA_BOT";
    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, isNetricsa);

    stats[year][userId].netricsa.imagesUpscalee++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyAIConversation(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const isNetricsa = userId === "NETRICSA_BOT";
    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, isNetricsa);

    stats[year][userId].netricsa.conversationsIA++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyMemeSearched(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const isNetricsa = userId === "NETRICSA_BOT";
    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, isNetricsa);

    stats[year][userId].netricsa.memesRecherches++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyPromptCreated(userId: string, username: string): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const isNetricsa = userId === "NETRICSA_BOT";
    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, isNetricsa);

    stats[year][userId].netricsa.promptsCrees++;
    stats[year][userId].username = username;
    saveYearlyStats(stats);
}

export function recordYearlyNetricsaWebSearch(): void {
    const stats = loadYearlyStats();
    const year = getCurrentYear();

    const userId = "NETRICSA_BOT";
    const username = "Netricsa";

    if (!stats[year]) stats[year] = {};
    if (!stats[year][userId]) stats[year][userId] = initYearlyUserStats(username, true);

    if (stats[year][userId].netricsa.recherchesWebNetricsa === undefined) {
        stats[year][userId].netricsa.recherchesWebNetricsa = 0;
    }

    stats[year][userId].netricsa.recherchesWebNetricsa!++;
    saveYearlyStats(stats);
}

/**
 * Récupère les stats d'une année spécifique
 */
export function getYearlyStats(year: string): any {
    const stats = loadYearlyStats();
    return stats[year] || {};
}

/**
 * Calcule les stats globales du serveur pour une année
 */
export function getYearlyServerStats(year: string, excludeBots: boolean = false): any {
    const yearStats = getYearlyStats(year);

    const stats = {
        totalUsers: 0,
        totalMessages: 0,
        totalReactions: 0,
        totalCommands: 0,
        totalImages: 0,
        totalUpscales: 0,
        totalSearches: 0,
        totalConversations: 0
    };

    for (const [userId, userStat] of Object.entries(yearStats)) {
        // Exclure les bots si demandé
        if (excludeBots && (userId === "NETRICSA_BOT" || userId.startsWith("bot_"))) {
            continue;
        }

        const user = userStat as any;
        stats.totalUsers++;
        stats.totalMessages += user.discord.messagesEnvoyes;
        stats.totalReactions += user.discord.reactionsAjoutees;
        stats.totalCommands += user.discord.commandesUtilisees;
        stats.totalImages += user.netricsa.imagesGenerees + user.netricsa.imagesReimaginee;
        stats.totalUpscales += user.netricsa.imagesUpscalee;
        stats.totalConversations += user.netricsa.conversationsIA;
    }

    return stats;
}
