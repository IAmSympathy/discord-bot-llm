import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../../utils/logger";

const logger = createLogger("SeasonalUserStats");

const STATS_FILE = path.join(process.cwd(), "data", "seasonal_user_stats.json");

/**
 * Interface pour les statistiques saisonnières d'un utilisateur
 */
export interface SeasonalUserStats {
    totalLogsAdded: number; // Total de bûches ajoutées depuis le début de la saison
    totalProtectionsUsed: number; // Total de protections météo utilisées
    lastReset: number; // Timestamp du dernier reset (début de saison)
}

/**
 * Base de données des stats par utilisateur
 */
interface SeasonalStatsDatabase {
    [userId: string]: SeasonalUserStats;
}

/**
 * Charge les statistiques depuis le fichier
 */
function loadStats(): SeasonalStatsDatabase {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = fs.readFileSync(STATS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading seasonal user stats:", error);
    }
    return {};
}

/**
 * Sauvegarde les statistiques dans le fichier
 */
function saveStats(stats: SeasonalStatsDatabase): void {
    try {
        const dir = path.dirname(STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving seasonal user stats:", error);
    }
}

/**
 * Récupère les stats d'un utilisateur
 */
export function getUserSeasonalStats(userId: string): SeasonalUserStats {
    const stats = loadStats();

    if (!stats[userId]) {
        stats[userId] = {
            totalLogsAdded: 0,
            totalProtectionsUsed: 0,
            lastReset: Date.now()
        };
        saveStats(stats);
    }

    return stats[userId];
}

/**
 * Incrémente le compteur de bûches ajoutées pour un utilisateur
 */
export function incrementUserLogCount(userId: string): void {
    const stats = loadStats();

    if (!stats[userId]) {
        stats[userId] = {
            totalLogsAdded: 0,
            totalProtectionsUsed: 0,
            lastReset: Date.now()
        };
    }

    stats[userId].totalLogsAdded++;
    saveStats(stats);

    logger.info(`User ${userId} total logs: ${stats[userId].totalLogsAdded}`);
}

/**
 * Incrémente le compteur de protections utilisées pour un utilisateur
 */
export function incrementUserProtectionCount(userId: string): void {
    const stats = loadStats();

    if (!stats[userId]) {
        stats[userId] = {
            totalLogsAdded: 0,
            totalProtectionsUsed: 0,
            lastReset: Date.now()
        };
    }

    stats[userId].totalProtectionsUsed++;
    saveStats(stats);

    logger.info(`User ${userId} total protections: ${stats[userId].totalProtectionsUsed}`);
}

/**
 * Réinitialise les stats de tous les utilisateurs (à faire à chaque changement de saison)
 */
export function resetAllSeasonalStats(): void {
    const stats = loadStats();
    const now = Date.now();

    for (const userId in stats) {
        stats[userId] = {
            totalLogsAdded: 0,
            totalProtectionsUsed: 0,
            lastReset: now
        };
    }

    saveStats(stats);
    logger.info("All seasonal user stats have been reset");
}

