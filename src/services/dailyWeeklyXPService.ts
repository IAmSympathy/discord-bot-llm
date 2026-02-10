import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("DailyWeeklyXP");
const DAILY_XP_FILE = path.join(DATA_DIR, "daily_xp.json");
const WEEKLY_XP_FILE = path.join(DATA_DIR, "weekly_xp.json");

/**
 * Structure des données XP quotidiennes
 */
interface DailyXPData {
    [date: string]: { // Format: YYYY-MM-DD
        [userId: string]: {
            username: string;
            xpGained: number;
            voiceMinutes: number;
        };
    };
}

/**
 * Structure des données XP hebdomadaires
 */
interface WeeklyXPData {
    [week: string]: { // Format: YYYY-Www (ex: 2026-W06)
        [userId: string]: {
            username: string;
            xpGained: number;
            voiceMinutes: number;
        };
    };
}

/**
 * Charge l'XP quotidien
 */
function loadDailyXP(): DailyXPData {
    try {
        if (fs.existsSync(DAILY_XP_FILE)) {
            return JSON.parse(fs.readFileSync(DAILY_XP_FILE, "utf-8"));
        }
    } catch (error) {
        logger.error("Error loading daily XP:", error);
    }
    return {};
}

/**
 * Sauvegarde l'XP quotidien
 */
function saveDailyXP(data: DailyXPData): void {
    try {
        const dir = path.dirname(DAILY_XP_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(DAILY_XP_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving daily XP:", error);
    }
}

/**
 * Charge l'XP hebdomadaire
 */
function loadWeeklyXP(): WeeklyXPData {
    try {
        if (fs.existsSync(WEEKLY_XP_FILE)) {
            return JSON.parse(fs.readFileSync(WEEKLY_XP_FILE, "utf-8"));
        }
    } catch (error) {
        logger.error("Error loading weekly XP:", error);
    }
    return {};
}

/**
 * Sauvegarde l'XP hebdomadaire
 */
function saveWeeklyXP(data: WeeklyXPData): void {
    try {
        const dir = path.dirname(WEEKLY_XP_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(WEEKLY_XP_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving weekly XP:", error);
    }
}

/**
 * Obtient la date actuelle au format YYYY-MM-DD (dans le fuseau horaire America/Montreal)
 */
export function getCurrentDate(): string {
    // Utiliser le fuseau horaire America/Montreal pour être cohérent peu importe où le serveur est hébergé
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montreal',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';

    return `${year}-${month}-${day}`;
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
 * Enregistre l'XP gagné pour le jour en cours
 */
export function recordDailyXP(userId: string, username: string, xpAmount: number, voiceMinutes: number = 0): void {
    const data = loadDailyXP();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }

    if (!data[date][userId]) {
        data[date][userId] = {
            username,
            xpGained: 0,
            voiceMinutes: 0
        };
    }

    data[date][userId].xpGained += xpAmount;
    data[date][userId].voiceMinutes += voiceMinutes;
    data[date][userId].username = username;
    saveDailyXP(data);
}

/**
 * Enregistre l'XP gagné pour la semaine en cours
 */
export function recordWeeklyXP(userId: string, username: string, xpAmount: number, voiceMinutes: number = 0): void {
    const data = loadWeeklyXP();
    const week = getCurrentWeek();

    if (!data[week]) {
        data[week] = {};
    }

    if (!data[week][userId]) {
        data[week][userId] = {
            username,
            xpGained: 0,
            voiceMinutes: 0
        };
    }

    data[week][userId].xpGained += xpAmount;
    data[week][userId].voiceMinutes += voiceMinutes;
    data[week][userId].username = username;
    saveWeeklyXP(data);
}

/**
 * Récupère l'XP gagné pour une date spécifique
 */
export function getDailyXP(date: string): any {
    const data = loadDailyXP();
    return data[date] || {};
}

/**
 * Récupère l'XP gagné pour une semaine spécifique
 */
export function getWeeklyXP(week: string): any {
    const data = loadWeeklyXP();
    return data[week] || {};
}

/**
 * Récupère l'XP quotidien de l'utilisateur pour aujourd'hui
 */
export function getTodayXP(userId: string): number {
    const data = loadDailyXP();
    const today = getCurrentDate();
    return data[today]?.[userId]?.xpGained || 0;
}

/**
 * Récupère l'XP hebdomadaire de l'utilisateur pour cette semaine
 */
export function getThisWeekXP(userId: string): number {
    const data = loadWeeklyXP();
    const week = getCurrentWeek();
    return data[week]?.[userId]?.xpGained || 0;
}

/**
 * Récupère les minutes vocales d'aujourd'hui
 */
export function getTodayVoiceMinutes(userId: string): number {
    const data = loadDailyXP();
    const today = getCurrentDate();
    return data[today]?.[userId]?.voiceMinutes || 0;
}

/**
 * Nettoie les anciennes données quotidiennes (garde 30 derniers jours)
 */
export function cleanupOldDailyData(): void {
    const data = loadDailyXP();
    const dates = Object.keys(data);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let cleaned = 0;
    for (const date of dates) {
        const dateObj = new Date(date);
        if (dateObj < thirtyDaysAgo) {
            delete data[date];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        saveDailyXP(data);
        logger.info(`Cleaned ${cleaned} old daily data entries`);
    }
}

/**
 * Nettoie les anciennes données hebdomadaires (garde 12 dernières semaines)
 */
export function cleanupOldWeeklyData(): void {
    const data = loadWeeklyXP();
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
        saveWeeklyXP(data);
        logger.info(`Cleaned ${cleaned} old weekly data entries`);
    }
}


