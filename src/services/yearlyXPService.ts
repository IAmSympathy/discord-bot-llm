import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("YearlyXP");
const YEARLY_XP_FILE = path.join(DATA_DIR, "yearly_xp.json");

/**
 * Structure de l'XP annuel
 */
interface YearlyXPData {
    [year: string]: {
        [userId: string]: {
            username: string;
            xpGained: number;
        };
    };
}

/**
 * Charge l'XP annuel
 */
function loadYearlyXP(): YearlyXPData {
    try {
        if (fs.existsSync(YEARLY_XP_FILE)) {
            const data = fs.readFileSync(YEARLY_XP_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading yearly XP:", error);
    }
    return {};
}

/**
 * Sauvegarde l'XP annuel
 */
function saveYearlyXP(data: YearlyXPData): void {
    try {
        const dir = path.dirname(YEARLY_XP_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(YEARLY_XP_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving yearly XP:", error);
    }
}

/**
 * Obtient l'année actuelle
 */
function getCurrentYear(): string {
    return new Date().getFullYear().toString();
}

/**
 * Enregistre l'XP gagné pour l'année en cours
 */
export function recordYearlyXP(userId: string, username: string, xpAmount: number): void {
    const data = loadYearlyXP();
    const year = getCurrentYear();

    if (!data[year]) {
        data[year] = {};
    }

    if (!data[year][userId]) {
        data[year][userId] = {
            username,
            xpGained: 0
        };
    }

    data[year][userId].xpGained += xpAmount;
    data[year][userId].username = username;
    saveYearlyXP(data);
}

/**
 * Récupère l'XP gagné pour une année spécifique
 */
export function getYearlyXP(year: string): any {
    const data = loadYearlyXP();
    return data[year] || {};
}

/**
 * Récupère l'XP gagné par un utilisateur pour une année
 */
export function getUserYearlyXP(userId: string, year: string): number {
    const yearData = getYearlyXP(year);
    return yearData[userId]?.xpGained || 0;
}
