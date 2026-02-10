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

                // Vérifier aussi les achievements du compteur
                const counterUnlocked = await checkAndUnlockCounterAchievements(
                    profile.userId,
                    profile.username,
                    client
                );

                // Vérifier aussi les achievements Netricsa
                const netricsaUnlocked = await checkAndUnlockNetricsaAchievements(
                    profile.userId,
                    profile.username,
                    client
                );

                checkedCount++;
                unlockedCount += unlocked + counterUnlocked + netricsaUnlocked;
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

/**
 * Vérifie et débloque les achievements du compteur pour un utilisateur spécifique
 * Envoie des notifications en DM pour les achievements débloqués
 */
async function checkAndUnlockCounterAchievements(
    userId: string,
    username: string,
    client: Client
): Promise<number> {
    let unlockedCount = 0;

    try {
        const {getUserCounterContributions} = require("./counterService");
        const {unlockAchievement} = require("./achievementService");

        // Récupérer les contributions depuis counter_state.json
        const counterContributions = getUserCounterContributions(userId);
        if (counterContributions === 0) return 0;

        const dummyChannelId = "startup_check";

        // === ACHIEVEMENT: Compteur Amateur ===
        if (counterContributions >= 10) {
            if (!isAchievementUnlocked(userId, "counter_10_counts")) {
                const unlocked = await unlockAchievement(userId, username, "counter_10_counts", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Compteur Amateur" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Compteur Confirmé ===
        if (counterContributions >= 50) {
            if (!isAchievementUnlocked(userId, "counter_50_counts")) {
                const unlocked = await unlockAchievement(userId, username, "counter_50_counts", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Compteur Confirmé" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Maître du Compteur ===
        if (counterContributions >= 100) {
            if (!isAchievementUnlocked(userId, "counter_100_counts")) {
                const unlocked = await unlockAchievement(userId, username, "counter_100_counts", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Maître du Compteur" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Légende du Compteur ===
        if (counterContributions >= 500) {
            if (!isAchievementUnlocked(userId, "counter_500_counts")) {
                const unlocked = await unlockAchievement(userId, username, "counter_500_counts", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Légende du Compteur" for ${username}`);
                }
            }
        }

        // === ACHIEVEMENT: Dieu du Compteur ===
        if (counterContributions >= 1000) {
            if (!isAchievementUnlocked(userId, "counter_1000_counts")) {
                const unlocked = await unlockAchievement(userId, username, "counter_1000_counts", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Dieu du Compteur" for ${username}`);
                }
            }
        }

    } catch (error) {
        logger.error(`[AchievementStartup] Error checking counter achievements for ${username}:`, error);
    }

    return unlockedCount;
}

/**
 * Vérifie et débloque les achievements Netricsa pour un utilisateur spécifique
 * Envoie des notifications en DM pour les achievements débloqués
 */
async function checkAndUnlockNetricsaAchievements(
    userId: string,
    username: string,
    client: Client
): Promise<number> {
    let unlockedCount = 0;

    try {
        const {getUserStats} = require("./userStatsService");
        const {unlockAchievement} = require("./achievementService");

        const stats = getUserStats(userId);
        if (!stats) return 0;

        const netricsa = stats.netricsa;
        const dummyChannelId = "startup_check";

        // === GÉNÉRATION D'IMAGES ===
        const genChecks = [
            {id: "netricsa_gen_10", threshold: 10, name: "Créateur Amateur"},
            {id: "netricsa_gen_50", threshold: 50, name: "Artiste Confirmé"},
            {id: "netricsa_gen_200", threshold: 200, name: "Maître Artiste"},
            {id: "netricsa_gen_500", threshold: 500, name: "Légende de l'Art"}
        ];

        for (const check of genChecks) {
            if (netricsa.imagesGenerees >= check.threshold) {
                if (!isAchievementUnlocked(userId, check.id)) {
                    const unlocked = await unlockAchievement(userId, username, check.id, client, dummyChannelId);
                    if (unlocked) {
                        unlockedCount++;
                        logger.info(`[AchievementStartup] Unlocked "${check.name}" for ${username}`);
                    }
                }
            }
        }

        // === RÉIMAGINATION ===
        const reimagineChecks = [
            {id: "netricsa_reimagine_10", threshold: 10, name: "Réimaginateur Amateur"},
            {id: "netricsa_reimagine_50", threshold: 50, name: "Réimaginateur Confirmé"},
            {id: "netricsa_reimagine_200", threshold: 200, name: "Maître Réimaginateur"}
        ];

        for (const check of reimagineChecks) {
            if (netricsa.imagesReimaginee >= check.threshold) {
                if (!isAchievementUnlocked(userId, check.id)) {
                    const unlocked = await unlockAchievement(userId, username, check.id, client, dummyChannelId);
                    if (unlocked) {
                        unlockedCount++;
                        logger.info(`[AchievementStartup] Unlocked "${check.name}" for ${username}`);
                    }
                }
            }
        }

        // === UPSCALING ===
        const upscaleChecks = [
            {id: "netricsa_upscale_10", threshold: 10, name: "HD Amateur"},
            {id: "netricsa_upscale_50", threshold: 50, name: "HD Master"},
            {id: "netricsa_upscale_200", threshold: 200, name: "4K Legend"}
        ];

        for (const check of upscaleChecks) {
            if (netricsa.imagesUpscalee >= check.threshold) {
                if (!isAchievementUnlocked(userId, check.id)) {
                    const unlocked = await unlockAchievement(userId, username, check.id, client, dummyChannelId);
                    if (unlocked) {
                        unlockedCount++;
                        logger.info(`[AchievementStartup] Unlocked "${check.name}" for ${username}`);
                    }
                }
            }
        }

        // === CONVERSATIONS ===
        const convChecks = [
            {id: "netricsa_conv_5", threshold: 5, name: "Première Conversation"},
            {id: "netricsa_conv_50", threshold: 50, name: "Bavard IA"},
            {id: "netricsa_conv_200", threshold: 200, name: "Causeur Expert"},
            {id: "netricsa_conv_500", threshold: 500, name: "Meilleur Ami de Netricsa"}
        ];

        for (const check of convChecks) {
            if (netricsa.conversationsIA >= check.threshold) {
                if (!isAchievementUnlocked(userId, check.id)) {
                    const unlocked = await unlockAchievement(userId, username, check.id, client, dummyChannelId);
                    if (unlocked) {
                        unlockedCount++;
                        logger.info(`[AchievementStartup] Unlocked "${check.name}" for ${username}`);
                    }
                }
            }
        }

        // === PROMPTS ===
        const promptChecks = [
            {id: "netricsa_prompt_5", threshold: 5, name: "Prompt Amateur"},
            {id: "netricsa_prompt_20", threshold: 20, name: "Maître du Prompt"},
            {id: "netricsa_prompt_50", threshold: 50, name: "Architecte de Prompts"}
        ];

        for (const check of promptChecks) {
            if (netricsa.promptsCrees >= check.threshold) {
                if (!isAchievementUnlocked(userId, check.id)) {
                    const unlocked = await unlockAchievement(userId, username, check.id, client, dummyChannelId);
                    if (unlocked) {
                        unlockedCount++;
                        logger.info(`[AchievementStartup] Unlocked "${check.name}" for ${username}`);
                    }
                }
            }
        }

        // === MEMES ===
        const memeChecks = [
            {id: "fun_meme_10", threshold: 10, name: "Chercheur de Memes"},
            {id: "fun_meme_50", threshold: 50, name: "Collectionneur de Memes"},
            {id: "fun_meme_200", threshold: 200, name: "Roi des Memes"}
        ];

        for (const check of memeChecks) {
            if (netricsa.memesRecherches >= check.threshold) {
                if (!isAchievementUnlocked(userId, check.id)) {
                    const unlocked = await unlockAchievement(userId, username, check.id, client, dummyChannelId);
                    if (unlocked) {
                        unlockedCount++;
                        logger.info(`[AchievementStartup] Unlocked "${check.name}" for ${username}`);
                    }
                }
            }
        }

        // === COMBINÉS ===

        // Touche-à-tout
        if (netricsa.imagesGenerees >= 1 && netricsa.imagesReimaginee >= 1 && netricsa.imagesUpscalee >= 1) {
            if (!isAchievementUnlocked(userId, "netricsa_all_features")) {
                const unlocked = await unlockAchievement(userId, username, "netricsa_all_features", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Touche-à-tout" for ${username}`);
                }
            }
        }

        // Créateur Complet
        if (netricsa.imagesGenerees >= 100 && netricsa.promptsCrees >= 10) {
            if (!isAchievementUnlocked(userId, "netricsa_creator")) {
                const unlocked = await unlockAchievement(userId, username, "netricsa_creator", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Créateur Complet" for ${username}`);
                }
            }
        }

        // Maître Netricsa
        if (netricsa.imagesGenerees >= 200 && netricsa.conversationsIA >= 100 && netricsa.promptsCrees >= 20) {
            if (!isAchievementUnlocked(userId, "netricsa_master")) {
                const unlocked = await unlockAchievement(userId, username, "netricsa_master", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Maître Netricsa" for ${username}`);
                }
            }
        }

        // Artiste Total
        if (netricsa.imagesGenerees >= 500 && netricsa.imagesReimaginee >= 200 && netricsa.imagesUpscalee >= 100) {
            if (!isAchievementUnlocked(userId, "netricsa_total_artist")) {
                const unlocked = await unlockAchievement(userId, username, "netricsa_total_artist", client, dummyChannelId);
                if (unlocked) {
                    unlockedCount++;
                    logger.info(`[AchievementStartup] Unlocked "Artiste Total" for ${username}`);
                }
            }
        }

    } catch (error) {
        logger.error(`[AchievementStartup] Error checking Netricsa achievements for ${username}:`, error);
    }

    return unlockedCount;
}

