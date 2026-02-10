import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("DailyStats");
const DAILY_STATS_FILE = path.join(DATA_DIR, "daily_stats.json");

/**
 * Structure des stats quotidiennes d'un utilisateur
 */
export interface DailyUserStats {
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
 * Structure des stats quotidiennes
 */
interface DailyStatsData {
    [date: string]: { // Format: "YYYY-MM-DD"
        [userId: string]: DailyUserStats;
    };
}

/**
 * Charge les stats quotidiennes
 */
function loadDailyStats(): DailyStatsData {
    try {
        if (fs.existsSync(DAILY_STATS_FILE)) {
            const data = fs.readFileSync(DAILY_STATS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading daily stats:", error);
    }
    return {};
}

/**
 * Sauvegarde les stats quotidiennes
 */
function saveDailyStats(data: DailyStatsData): void {
    try {
        const dir = path.dirname(DAILY_STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(DAILY_STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving daily stats:", error);
    }
}

/**
 * Obtient la date actuelle au format YYYY-MM-DD
 */
export function getCurrentDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Initialise les stats quotidiennes d'un utilisateur
 */
function initDailyUserStats(username: string): DailyUserStats {
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
 * Enregistre un message envoyé aujourd'hui
 */
export function recordDailyMessage(userId: string, username: string): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].messagesEnvoyes++;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une réaction ajoutée aujourd'hui
 */
export function recordDailyReaction(userId: string, username: string): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].reactionsAjoutees++;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre du temps vocal aujourd'hui
 */
export function recordDailyVoiceTime(userId: string, username: string, minutes: number): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].tempsVocalMinutes += minutes;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une partie jouée aujourd'hui
 */
export function recordDailyGamePlayed(userId: string, username: string, won: boolean): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].gamesPlayed++;
    if (won) {
        data[date][userId].gamesWon++;
    }
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une image générée aujourd'hui
 */
export function recordDailyImageGenerated(userId: string, username: string): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].imagesGenerees++;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une contribution au compteur aujourd'hui
 */
export function recordDailyCounterContribution(userId: string, username: string): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].counterContributions++;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une conversation IA aujourd'hui
 */
export function recordDailyAIConversation(userId: string, username: string): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].conversationsIA++;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une commande utilisée aujourd'hui
 */
export function recordDailyCommand(userId: string, username: string): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].commandesUtilisees++;
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Enregistre une partie de pendu jouée aujourd'hui
 */
export function recordDailyHangmanPlayed(userId: string, username: string, won: boolean): void {
    const data = loadDailyStats();
    const date = getCurrentDate();

    if (!data[date]) {
        data[date] = {};
    }
    if (!data[date][userId]) {
        data[date][userId] = initDailyUserStats(username);
    }

    data[date][userId].hangmanPlayed++;
    if (won) {
        data[date][userId].hangmanWon++;
    }
    data[date][userId].username = username;
    saveDailyStats(data);
}

/**
 * Récupère les stats quotidiennes pour une date spécifique
 */
export function getDailyStats(date: string): any {
    const data = loadDailyStats();
    return data[date] || {};
}

/**
 * Récupère les stats quotidiennes d'un utilisateur pour une date
 */
export function getUserDailyStats(userId: string, date: string): DailyUserStats | null {
    const dayData = getDailyStats(date);
    return dayData[userId] || null;
}

/**
 * Récupère toutes les données quotidiennes (pour debug)
 */
export function getAllDailyStats(): DailyStatsData {
    return loadDailyStats();
}
