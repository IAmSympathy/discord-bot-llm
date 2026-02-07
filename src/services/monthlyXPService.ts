import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("MonthlyXP");
const MONTHLY_XP_FILE = path.join(DATA_DIR, "monthly_xp.json");

/**
 * Structure de l'XP mensuel
 */
interface MonthlyXPData {
    [yearMonth: string]: { // Format: "YYYY-MM"
        [userId: string]: {
            username: string;
            xpGained: number;
        };
    };
}

/**
 * Charge l'XP mensuel
 */
function loadMonthlyXP(): MonthlyXPData {
    try {
        if (fs.existsSync(MONTHLY_XP_FILE)) {
            const data = fs.readFileSync(MONTHLY_XP_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading monthly XP:", error);
    }
    return {};
}

/**
 * Sauvegarde l'XP mensuel
 */
function saveMonthlyXP(data: MonthlyXPData): void {
    try {
        const dir = path.dirname(MONTHLY_XP_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(MONTHLY_XP_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving monthly XP:", error);
    }
}

/**
 * Obtient le mois actuel au format YYYY-MM
 */
function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Enregistre l'XP gagné pour le mois en cours
 */
export function recordMonthlyXP(userId: string, username: string, xpAmount: number): void {
    const data = loadMonthlyXP();
    const month = getCurrentMonth();

    if (!data[month]) {
        data[month] = {};
    }

    if (!data[month][userId]) {
        data[month][userId] = {
            username,
            xpGained: 0
        };
    }

    data[month][userId].xpGained += xpAmount;
    data[month][userId].username = username;
    saveMonthlyXP(data);
}

/**
 * Récupère l'XP gagné pour un mois spécifique
 */
export function getMonthlyXP(yearMonth: string): any {
    const data = loadMonthlyXP();
    return data[yearMonth] || {};
}

/**
 * Récupère l'XP gagné par un utilisateur pour un mois
 */
export function getUserMonthlyXP(userId: string, yearMonth: string): number {
    const monthData = getMonthlyXP(yearMonth);
    return monthData[userId]?.xpGained || 0;
}

/**
 * Nettoie les vieux mois (garde seulement les 3 derniers mois)
 */
export function cleanupOldMonths(): void {
    try {
        const data = loadMonthlyXP();
        const months = Object.keys(data).sort();

        // Garder seulement les 3 derniers mois
        if (months.length > 3) {
            const toDelete = months.slice(0, months.length - 3);
            for (const month of toDelete) {
                delete data[month];
                logger.info(`Cleaned up old monthly XP data for ${month}`);
            }
            saveMonthlyXP(data);
        }
    } catch (error) {
        logger.error("Error cleaning up old months:", error);
    }
}
