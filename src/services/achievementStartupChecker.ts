import {Client} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {isAchievementUnlocked} from "./achievementService";
import {createLogger} from "../utils/logger";

const logger = createLogger("AchievementStartup");

/**
 * Vérifie et attribue les achievements à tous les utilisateurs au démarrage du bot
 * Pour ceux qui ont déjà rempli les conditions
 */
export async function checkAllAchievementsOnStartup(client: Client): Promise<void> {
    try {
        logger.info("[AchievementStartup] Checking achievements for all users...");

        // Récupérer tous les profils
        const allProfiles = UserProfileService.getAllProfiles();
        let checkedCount = 0;
        let unlockedCount = 0;
        let skippedBots = 0;

        for (const profile of allProfiles) {
            try {
                // Vérifier si c'est un bot
                const user = await client.users.fetch(profile.userId).catch(() => null);
                if (user?.bot) {
                    skippedBots++;
                    logger.debug(`[AchievementStartup] Skipping bot ${profile.username}`);
                    continue;
                }

                const unlocked = await checkAndUnlockProfileAchievements(
                    profile.userId,
                    profile.username,
                    client
                );
                checkedCount++;
                unlockedCount += unlocked;
            } catch (error) {
                logger.error(`[AchievementStartup] Error checking achievements for ${profile.username}:`, error);
            }
        }

        logger.info(`[AchievementStartup] ✅ Checked ${checkedCount} users, unlocked ${unlockedCount} achievements (skipped ${skippedBots} bots)`);
    } catch (error) {
        logger.error("[AchievementStartup] Error checking achievements on startup:", error);
    }
}

/**
 * Vérifie et débloque les achievements de profil pour un utilisateur spécifique
 * Envoie des notifications en DM pour les achievements débloqués
 */
async function checkAndUnlockProfileAchievements(
    userId: string,
    username: string,
    client: Client
): Promise<number> {
    let unlockedCount = 0;

    try {
        const profile = UserProfileService.getProfile(userId);
        if (!profile) return 0;

        // Utiliser unlockAchievement pour avoir les notifications
        const {unlockAchievement} = require("./achievementService");

        // Pas de channelId = pas de notification de level up dans un channel
        // Mais la notification d'achievement sera envoyée en DM pour les achievements de profil
        const dummyChannelId = "startup_check";

        // === ACHIEVEMENT: Gâteau d'anniversaire ===
        if (profile.birthday?.day && profile.birthday?.month && profile.birthday?.notify) {
            if (!isAchievementUnlocked(userId, "profile_birthday_set")) {
                const unlocked = await unlockAchievement(userId, username, "profile_birthday_set", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Gâteau d'anniversaire" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Surnommé ===
        if (profile.aliases.length >= 1) {
            if (!isAchievementUnlocked(userId, "profile_nickname")) {
                const unlocked = await unlockAchievement(userId, username, "profile_nickname", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Surnommé" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Livre ouvert ===
        if (profile.facts.length >= 3) {
            if (!isAchievementUnlocked(userId, "profile_facts_3")) {
                const unlocked = await unlockAchievement(userId, username, "profile_facts_3", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Livre ouvert" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Passionné ===
        if (profile.interests.length >= 5) {
            if (!isAchievementUnlocked(userId, "profile_interests_5")) {
                const unlocked = await unlockAchievement(userId, username, "profile_interests_5", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Passionné" for ${username}`);
                }
            }
        }

    } catch (error) {
        logger.error(`[AchievementStartup] Error checking profile achievements for ${username}:`, error);
    }

    return unlockedCount;
}

