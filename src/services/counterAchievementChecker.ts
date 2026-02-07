import {Client} from "discord.js";
import {unlockAchievement} from "./achievementService";
import {getUserCounterContributions} from "./counterService";
import {createLogger} from "../utils/logger";

const logger = createLogger("CounterAchievementChecker");

/**
 * Vérifie et débloque les achievements du compteur pour un utilisateur
 */
export async function checkCounterAchievements(
    userId: string,
    username: string,
    client?: Client,
    channelId?: string
): Promise<void> {
    try {
        // Ne pas vérifier les achievements pour les bots
        if (client) {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user?.bot) {
                return; // Skip bots
            }
        }

        // Récupérer les contributions depuis counter_state.json
        const counterContributions = getUserCounterContributions(userId);

        // === ACHIEVEMENT: Compteur Amateur (10 contributions) ===
        if (counterContributions >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "counter_10_counts", client, channelId);
            }
        }

        // === ACHIEVEMENT: Compteur Confirmé (50 contributions) ===
        if (counterContributions >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "counter_50_counts", client, channelId);
            }
        }

        // === ACHIEVEMENT: Maître du Compteur (100 contributions) ===
        if (counterContributions >= 100) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "counter_100_counts", client, channelId);
            }
        }

        // === ACHIEVEMENT: Légende du Compteur (500 contributions) ===
        if (counterContributions >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "counter_500_counts", client, channelId);
            }
        }

        // === ACHIEVEMENT: Dieu du Compteur (1000 contributions) ===
        if (counterContributions >= 1000) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "counter_1000_counts", client, channelId);
            }
        }

    } catch (error) {
        logger.error(`Error checking counter achievements for ${username}:`, error);
    }
}
