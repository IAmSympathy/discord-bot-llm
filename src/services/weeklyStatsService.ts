import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("WeeklyStats");
const WEEKLY_STATS_FILE = path.join(DATA_DIR, "weekly_stats.json");

/**
 * Structure des stats hebdomadaires d'un utilisateur
 */
export interface WeeklyUserStats {
    username: string;
    messagesEnvoyes: number;
    reactionsAjoutees: number;
    tempsVocalMinutes: number;
    gamesPlayed: number;
    gamesWon: number;
    hangmanPlayed: number;
    hangmanWon: number;
    imagesGenerees: number;
    counterContributions: number;
    conversationsIA: number;
    commandesUtilisees: number;
}

/**
 * Structure des stats hebdomadaires
 */
interface WeeklyStatsData {
    [week: string]: { // Format: "YYYY-Www" (ex: "2026-W06")
        [userId: string]: WeeklyUserStats;
    };
}

/**
 * Charge les stats hebdomadaires
 */
function loadWeeklyStats(): WeeklyStatsData {
    try {
        if (fs.existsSync(WEEKLY_STATS_FILE)) {
            const data = fs.readFileSync(WEEKLY_STATS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading weekly stats:", error);
    }
    return {};
}

/**
 * Sauvegarde les stats hebdomadaires
 */
function saveWeeklyStats(data: WeeklyStatsData): void {
    try {
        const dir = path.dirname(WEEKLY_STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(WEEKLY_STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving weekly stats:", error);
    }
}

/**
 * Obtient la semaine actuelle au format YYYY-Www (ISO 8601)
 */
export function getCurrentWeek(): string {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Initialise les stats hebdomadaires d'un utilisateur
 */
function initWeeklyUserStats(username: string): WeeklyUserStats {
    return {
        username,
        messagesEnvoyes: 0,
        reactionsAjoutees: 0,
        tempsVocalMinutes: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        hangmanPlayed: 0,
        hangmanWon: 0,
        imagesGenerees: 0,
        counterContributions: 0,
        conversationsIA: 0,
        commandesUtilisees: 0
    };
}

/**
 * Récupère les stats hebdomadaires d'un utilisateur pour une semaine donnée
 */
export function getUserWeeklyStats(userId: string, week: string): WeeklyUserStats | null {
    const data = loadWeeklyStats();
    return data[week]?.[userId] || null;
}

/**
 * Récupère toutes les stats d'une semaine donnée
 */
export function getWeeklyStatsForWeek(week: string): Record<string, WeeklyUserStats> {
    const data = loadWeeklyStats();
    return data[week] || {};
}

/**
 * Enregistre un message envoyé cette semaine
 */
export function recordWeeklyMessage(userId: string, username: string): void {
    const data = loadWeeklyStats();
    const week = getCurrentWeek();

    if (!data[week]) {
        data[week] = {};
    }
    if (!data[week][userId]) {
        data[week][userId] = initWeeklyUserStats(username);
    }

    data[week][userId].messagesEnvoyes++;
    data[week][userId].username = username;
    saveWeeklyStats(data);
}

/**
 * Enregistre une réaction ajoutée cette semaine
 */
export function recordWeeklyReaction(userId: string, username: string): void {
    const data = loadWeeklyStats();
    const week = getCurrentWeek();

    if (!data[week]) {
        data[week] = {};
    }
    if (!data[week][userId]) {
        data[week][userId] = initWeeklyUserStats(username);
    }

    data[week][userId].reactionsAjoutees++;
    data[week][userId].username = username;
    saveWeeklyStats(data);
}

/**
 * Enregistre du temps vocal cette semaine
 */
export function recordWeeklyVoiceTime(userId: string, username: string, minutes: number): void {
    const data = loadWeeklyStats();
    const week = getCurrentWeek();

    if (!data[week]) {
        data[week] = {};
    }
    if (!data[week][userId]) {
        data[week][userId] = initWeeklyUserStats(username);
    }

    data[week][userId].tempsVocalMinutes += minutes;
    data[week][userId].username = username;
    saveWeeklyStats(data);
}

/**
 * Enregistre une partie jouée cette semaine
 */
export function recordWeeklyGamePlayed(userId: string, username: string, won: boolean): void {
    const data = loadWeeklyStats();
    const week = getCurrentWeek();

    if (!data[week]) {
        data[week] = {};
    }
    if (!data[week][userId]) {
        data[week][userId] = initWeeklyUserStats(username);
    }

    data[week][userId].gamesPlayed++;
    if (won) {
        data[week][userId].gamesWon++;
    }
    data[week][userId].username = username;
    saveWeeklyStats(data);
}

/**
 * Enregistre une image générée cette semaine
 */
export function recordWeeklyImageGenerated(userId: string, username: string): void {
    const data = loadWeeklyStats();
    const week = getCurrentWeek();

    if (!data[week]) {
        data[week] = {};
    }
    if (!data[week][userId]) {
        data[week][userId] = initWeeklyUserStats(username);
    }

    data[week][userId].imagesGenerees++;
    data[week][userId].username = username;
    saveWeeklyStats(data);
}

/**
 * Nettoie les anciennes données hebdomadaires (garde 12 dernières semaines)
 */
export function cleanupOldWeeklyStats(): void {
    const data = loadWeeklyStats();
    const weeks = Object.keys(data);
    const currentWeek = getCurrentWeek();
    const currentWeekNum = parseInt(currentWeek.split('-W')[1]);
    const currentYear = parseInt(currentWeek.split('-W')[0]);

    let cleaned = 0;
    for (const week of weeks) {
        const weekParts = week.split('-W');
        const year = parseInt(weekParts[0]);
        const weekNum = parseInt(weekParts[1]);

        // Garder seulement les 12 dernières semaines
        const weeksDiff = (currentYear - year) * 52 + (currentWeekNum - weekNum);
        if (weeksDiff > 12) {
            delete data[week];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        saveWeeklyStats(data);
        logger.info(`Cleaned ${cleaned} old weekly stats entries`);
    }
}

