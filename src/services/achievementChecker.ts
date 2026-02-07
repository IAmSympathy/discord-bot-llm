import {Client} from "discord.js";
import {unlockAchievement} from "./achievementService";
import {UserProfileService} from "./userProfileService";

/**
 * Vérifie et débloque les achievements de profil pour un utilisateur
 */
export async function checkProfileAchievements(
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

        const profile = UserProfileService.getProfile(userId);
        if (!profile) return;

        // === ACHIEVEMENT: Gâteau d'anniversaire (anniversaire + notification) ===
        if (profile.birthday?.day && profile.birthday?.month && profile.birthday?.notify) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "profile_birthday_set", client, channelId);
            }
        }

        // === ACHIEVEMENT: Surnommé (1 alias) ===
        if (profile.aliases.length >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "profile_nickname", client, channelId);
            }
        }

        // === ACHIEVEMENT: Livre ouvert (3 faits) ===
        if (profile.facts.length >= 3) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "profile_facts_3", client, channelId);
            }
        }

        // === ACHIEVEMENT: Passionné (5 intérêts) ===
        if (profile.interests.length >= 5) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "profile_interests_5", client, channelId);
            }
        }

    } catch (error) {
        console.error("[AchievementChecker] Error checking profile achievements:", error);
    }
}
