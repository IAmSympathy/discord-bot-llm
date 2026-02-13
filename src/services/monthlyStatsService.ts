import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("MonthlyStats");
const MONTHLY_STATS_FILE = path.join(DATA_DIR, "monthly_stats.json");

/**
 * Structure des stats mensuelles d'un utilisateur
 */
export interface MonthlyUserStats {
    username: string;
    messagesEnvoyes: number;
    reactionsAjoutees: number;
    tempsVocalMinutes: number;
    gamesPlayed: number;
    gamesWon: number;
    hangmanPlayed: number;
    hangmanWon: number;
    imagesGenerees: number;
    imagesReimaginee: number;
    imagesUpscalee: number;
    counterContributions: number;
    conversationsIA: number;
    memesRecherches: number;
    promptsCrees: number;
    commandesUtilisees: number;
}

/**
 * Structure des stats mensuelles
 */
interface MonthlyStatsData {
    [yearMonth: string]: { // Format: "YYYY-MM"
        [userId: string]: MonthlyUserStats;
    };
}

/**
 * Charge les stats mensuelles
 */
function loadMonthlyStats(): MonthlyStatsData {
    try {
        if (fs.existsSync(MONTHLY_STATS_FILE)) {
            const data = fs.readFileSync(MONTHLY_STATS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading monthly stats:", error);
    }
    return {};
}

/**
 * Sauvegarde les stats mensuelles
 */
function saveMonthlyStats(data: MonthlyStatsData): void {
    try {
        const dir = path.dirname(MONTHLY_STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(MONTHLY_STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving monthly stats:", error);
    }
}

/**
 * Obtient le mois actuel au format YYYY-MM
 */
export function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Initialise les stats mensuelles d'un utilisateur
 */
function initMonthlyUserStats(username: string): MonthlyUserStats {
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
        imagesReimaginee: 0,
        imagesUpscalee: 0,
        counterContributions: 0,
        conversationsIA: 0,
        memesRecherches: 0,
        promptsCrees: 0,
        commandesUtilisees: 0
    };
}

/**
 * Récupère les stats mensuelles d'un utilisateur pour un mois donné
 */
export function getUserMonthlyStats(userId: string, yearMonth: string): MonthlyUserStats | null {
    const data = loadMonthlyStats();
    return data[yearMonth]?.[userId] || null;
}

/**
 * Récupère toutes les stats d'un mois donné
 */
export function getMonthlyStatsForMonth(yearMonth: string): Record<string, MonthlyUserStats> {
    const data = loadMonthlyStats();
    return data[yearMonth] || {};
}

/**
 * Enregistre un message envoyé ce mois
 */
export function recordMonthlyMessage(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].messagesEnvoyes++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une réaction ajoutée ce mois
 */
export function recordMonthlyReaction(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].reactionsAjoutees++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre du temps vocal ce mois
 */
export function recordMonthlyVoiceTime(userId: string, username: string, minutes: number): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].tempsVocalMinutes += minutes;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une partie jouée ce mois
 */
export function recordMonthlyGamePlayed(userId: string, username: string, won: boolean): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].gamesPlayed++;
    if (won) {
        data[month][userId].gamesWon++;
    }
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une partie de pendu jouée ce mois
 */
export function recordMonthlyHangmanPlayed(userId: string, username: string, won: boolean): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].hangmanPlayed++;
    if (won) {
        data[month][userId].hangmanWon++;
    }
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une image générée ce mois
 */
export function recordMonthlyImageGenerated(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].imagesGenerees++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une image réimaginée ce mois
 */
export function recordMonthlyImageReimagined(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].imagesReimaginee++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une image upscalée ce mois
 */
export function recordMonthlyImageUpscaled(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].imagesUpscalee++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une conversation IA ce mois
 */
export function recordMonthlyAIConversation(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].conversationsIA++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une recherche de meme ce mois
 */
export function recordMonthlyMemeSearched(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].memesRecherches++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre un prompt créé ce mois
 */
export function recordMonthlyPromptCreated(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].promptsCrees++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une commande utilisée ce mois
 */
export function recordMonthlyCommand(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].commandesUtilisees++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Enregistre une contribution au compteur ce mois
 */
export function recordMonthlyCounterContribution(userId: string, username: string): void {
    const data = loadMonthlyStats();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }
    if (!data[month][userId]) {
        data[month][userId] = initMonthlyUserStats(username);
    }

    data[month][userId].counterContributions++;
    data[month][userId].username = username;
    saveMonthlyStats(data);
}

/**
 * Nettoie les anciennes données mensuelles (garde 24 derniers mois)
 */
export function cleanupOldMonthlyStats(): void {
    const data = loadMonthlyStats();
    const months = Object.keys(data);
    const currentMonth = getCurrentMonth();
    const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);

    let cleaned = 0;
    for (const month of months) {
        const [year, monthNum] = month.split('-').map(Number);

        // Garder seulement les 24 derniers mois
        const monthsDiff = (currentYear - year) * 12 + (currentMonthNum - monthNum);
        if (monthsDiff > 24) {
            delete data[month];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        saveMonthlyStats(data);
        logger.info(`Cleaned ${cleaned} old monthly stats entries`);
    }
}

/**
 * Récupère toutes les stats mensuelles
 */
export function getAllMonthlyStats(): MonthlyStatsData {
    return loadMonthlyStats();
}

