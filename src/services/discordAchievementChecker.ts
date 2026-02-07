import {Client} from "discord.js";
import {unlockAchievement} from "./achievementService";
import {getUserStats} from "./userStatsService";
import {createLogger} from "../utils/logger";

const logger = createLogger("DiscordAchievementChecker");

/**
 * Vérifie et débloque les achievements Discord pour un utilisateur
 */
export async function checkDiscordAchievements(
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

        const stats = getUserStats(userId);
        if (!stats) return;

        const discord = stats.discord;

        // === MESSAGES ===
        if (discord.messagesEnvoyes >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_msg_10", client, channelId);
            }
        }

        if (discord.messagesEnvoyes >= 100) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_msg_100", client, channelId);
            }
        }

        if (discord.messagesEnvoyes >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_msg_500", client, channelId);
            }
        }

        if (discord.messagesEnvoyes >= 1000) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_msg_1000", client, channelId);
            }
        }

        if (discord.messagesEnvoyes >= 5000) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_msg_5000", client, channelId);
            }
        }

        // === RÉACTIONS DONNÉES ===
        if (discord.reactionsAjoutees >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_react_50", client, channelId);
            }
        }

        if (discord.reactionsAjoutees >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_react_200", client, channelId);
            }
        }

        if (discord.reactionsAjoutees >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_react_500", client, channelId);
            }
        }

        // === COMMANDES ===
        if (discord.commandesUtilisees >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_cmd_10", client, channelId);
            }
        }

        if (discord.commandesUtilisees >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_cmd_50", client, channelId);
            }
        }

        if (discord.commandesUtilisees >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_cmd_200", client, channelId);
            }
        }

        if (discord.commandesUtilisees >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_cmd_500", client, channelId);
            }
        }

        // === VOCAL (convertir minutes en heures) ===
        const hoursInVocal = discord.tempsVocalMinutes / 60;

        if (hoursInVocal >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_voice_1h", client, channelId);
            }
        }

        if (hoursInVocal >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_voice_10h", client, channelId);
            }
        }

        if (hoursInVocal >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_voice_50h", client, channelId);
            }
        }

        if (hoursInVocal >= 100) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_voice_100h", client, channelId);
            }
        }

        if (hoursInVocal >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_voice_500h", client, channelId);
            }
        }

        if (hoursInVocal >= 1000) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_voice_1000h", client, channelId);
            }
        }

        // === EMOJIS ===
        const totalEmojis = discord.emojisUtilises
            ? Object.values(discord.emojisUtilises).reduce((sum, count) => sum + count, 0)
            : 0;

        if (totalEmojis >= 100) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_emoji_100", client, channelId);
            }
        }

        if (totalEmojis >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_emoji_500", client, channelId);
            }
        }

        if (totalEmojis >= 1000) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_emoji_1000", client, channelId);
            }
        }

        if (totalEmojis >= 5000) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_emoji_5000", client, channelId);
            }
        }

        // Emoji favori (même emoji utilisé 100 fois)
        if (discord.emojisUtilises) {
            const maxEmojiCount = Math.max(...Object.values(discord.emojisUtilises));
            if (maxEmojiCount >= 100) {
                if (client && channelId) {
                    await unlockAchievement(userId, username, "discord_emoji_fav", client, channelId);
                }
            }
        }

        // === ACHIEVEMENTS COMBINÉS ===

        // Social Butterfly : 500 messages + 200 réactions + 50h vocal
        if (discord.messagesEnvoyes >= 500 && discord.reactionsAjoutees >= 200 && hoursInVocal >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_social", client, channelId);
            }
        }

        // Hyperactif : 1000 messages + 500 emojis + 100 commandes
        if (discord.messagesEnvoyes >= 1000 && totalEmojis >= 500 && discord.commandesUtilisees >= 100) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_active", client, channelId);
            }
        }

        // Légende Vivante : 5000 messages + 500 réactions + 500h vocal
        if (discord.messagesEnvoyes >= 5000 && discord.reactionsAjoutees >= 500 && hoursInVocal >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "discord_legend", client, channelId);
            }
        }

    } catch (error) {
        logger.error(`Error checking Discord achievements for ${username}:`, error);
    }
}

/**
 * Vérifie les achievements spéciaux basés sur l'heure
 */
export async function checkTimeBasedAchievements(
    userId: string,
    username: string,
    client: Client,
    channelId: string
): Promise<void> {
    try {
        const now = new Date();
        const hour = now.getHours();

        // Noctambule (3h du matin)
        if (hour === 3) {
            await unlockAchievement(userId, username, "discord_night_owl", client, channelId);
        }

        // Lève-tôt (6h du matin)
        if (hour === 6) {
            await unlockAchievement(userId, username, "discord_early_bird", client, channelId);
        }
    } catch (error) {
        logger.error(`Error checking time-based achievements for ${username}:`, error);
    }
}

/**
 * Vérifie l'achievement d'anniversaire
 */
export async function checkBirthdayAchievement(
    userId: string,
    username: string,
    client: Client,
    channelId: string
): Promise<void> {
    try {
        const {UserProfileService} = require("./userProfileService");
        const profile = await UserProfileService.getProfile(userId);

        if (profile && profile.birthday) {
            const now = new Date();
            const birthday = new Date(profile.birthday);

            // Vérifier si c'est le jour de l'anniversaire (même jour et mois)
            if (now.getDate() === birthday.getDate() && now.getMonth() === birthday.getMonth()) {
                await unlockAchievement(userId, username, "discord_birthday", client, channelId);
            }
        }
    } catch (error) {
        logger.error(`Error checking birthday achievement for ${username}:`, error);
    }
}
