import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";
import {Client, TextChannel} from "discord.js";

const logger = createLogger("AchievementService");
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, "user_achievements.json");

/**
 * Catégories d'achievements
 */
export enum AchievementCategory {
    PROFIL = "profil",
    NETRICSA = "netricsa",
    DISCORD = "discord",
    JEUX = "jeux",
    NIVEAU = "niveau",
    SECRET = "secret"
}

/**
 * Définition d'un achievement
 */
export interface Achievement {
    id: string;
    category: AchievementCategory;
    name: string;
    description: string;
    emoji: string;
    secret: boolean; // Si true, la description n'est pas visible tant que non débloqué
    xpReward: number;
}

/**
 * Progression d'un achievement pour un utilisateur
 */
export interface UserAchievement {
    achievementId: string;
    unlockedAt: number | null; // timestamp ou null si pas débloqué
    notified: boolean; // Si l'utilisateur a été notifié du déblocage
}

/**
 * Base de données des achievements utilisateurs
 */
interface AchievementsDatabase {
    [userId: string]: {
        username: string;
        achievements: UserAchievement[];
        lastUpdate: number;
    };
}

/**
 * Liste de tous les achievements disponibles
 */
export const ALL_ACHIEVEMENTS: Achievement[] = [
    // === ACHIEVEMENTS PROFIL ===
    {
        id: "profile_birthday_set",
        category: AchievementCategory.PROFIL,
        name: "Gâteau d'anniversaire",
        description: "Ajouter sa date d'anniversaire à son profil avec notification activée",
        emoji: "🎂",
        secret: false,
        xpReward: 100
    },
    {
        id: "profile_nickname",
        category: AchievementCategory.PROFIL,
        name: "Surnommé",
        description: "Avoir au moins 1 surnom enregistré par Netricsa",
        emoji: "🏷️",
        secret: false,
        xpReward: 100
    },
    {
        id: "profile_facts_3",
        category: AchievementCategory.PROFIL,
        name: "Livre ouvert",
        description: "Avoir 3 faits enregistrés dans son profil par Netricsa",
        emoji: "📚",
        secret: false,
        xpReward: 100
    },
    {
        id: "profile_interests_5",
        category: AchievementCategory.PROFIL,
        name: "Passionné",
        description: "Avoir 5 centres d'intérêt enregistrés par Netricsa",
        emoji: "❤️",
        secret: false,
        xpReward: 150
    }
];

/**
 * Charge les achievements depuis le fichier
 * @internal - Exposé pour le startup checker
 */
export function loadAchievements(): AchievementsDatabase {
    try {
        if (fs.existsSync(ACHIEVEMENTS_FILE)) {
            const data = fs.readFileSync(ACHIEVEMENTS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading achievements:", error);
    }
    return {};
}

/**
 * Sauvegarde les achievements dans le fichier
 * @internal - Exposé pour le startup checker
 */
export function saveAchievements(data: AchievementsDatabase): void {
    try {
        const dir = path.dirname(ACHIEVEMENTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving achievements:", error);
    }
}

/**
 * Initialise les achievements pour un utilisateur
 * @internal - Exposé pour le startup checker
 */
export function initUserAchievements(userId: string, username: string): void {
    const data = loadAchievements();

    if (!data[userId]) {
        data[userId] = {
            username,
            achievements: ALL_ACHIEVEMENTS.map(achievement => ({
                achievementId: achievement.id,
                unlockedAt: null,
                notified: false
            })),
            lastUpdate: Date.now()
        };
        saveAchievements(data);
    }
}

/**
 * Récupère les achievements d'un utilisateur
 */
export function getUserAchievements(userId: string, username: string): UserAchievement[] {
    const data = loadAchievements();

    if (!data[userId]) {
        initUserAchievements(userId, username);
        return getUserAchievements(userId, username);
    }

    // Vérifier si de nouveaux achievements ont été ajoutés
    const existingIds = data[userId].achievements.map(a => a.achievementId);
    const newAchievements = ALL_ACHIEVEMENTS.filter(a => !existingIds.includes(a.id));

    if (newAchievements.length > 0) {
        data[userId].achievements.push(...newAchievements.map(achievement => ({
            achievementId: achievement.id,
            unlockedAt: null,
            notified: false
        })));
        data[userId].lastUpdate = Date.now();
        saveAchievements(data);
    }

    return data[userId].achievements;
}

/**
 * Débloque un achievement pour un utilisateur
 */
export async function unlockAchievement(
    userId: string,
    username: string,
    achievementId: string,
    client?: Client,
    channelId?: string
): Promise<boolean> {
    let data = loadAchievements();

    if (!data[userId]) {
        initUserAchievements(userId, username);
        // Recharger les données après l'initialisation
        data = loadAchievements();
    }

    const userAchievement = data[userId].achievements.find(a => a.achievementId === achievementId);

    if (!userAchievement) {
        logger.warn(`Achievement ${achievementId} not found for user ${userId}`);
        return false;
    }

    // Déjà débloqué
    if (userAchievement.unlockedAt !== null) {
        return false;
    }

    // Débloquer l'achievement
    userAchievement.unlockedAt = Date.now();
    userAchievement.notified = false;
    data[userId].username = username;
    data[userId].lastUpdate = Date.now();
    saveAchievements(data);

    logger.info(`Achievement ${achievementId} unlocked for ${username}`);

    // Envoyer une notification si un client et un channel sont fournis
    if (client && channelId && !userAchievement.notified) {
        await sendAchievementNotification(client, channelId, userId, achievementId);
        userAchievement.notified = true;
        saveAchievements(data);
    }

    return true;
}

/**
 * Envoie une notification de déblocage d'achievement
 */
async function sendAchievementNotification(
    client: Client,
    channelId: string,
    userId: string,
    achievementId: string
): Promise<void> {
    try {
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return;

        // Si c'est un appel du startup check, pas besoin de fetch le channel
        const isStartupCheck = channelId === "startup_check";

        // Fetch le channel seulement si ce n'est pas le startup check et pas un achievement de profil
        let channel: any = null;
        if (!isStartupCheck && achievement.category !== AchievementCategory.PROFIL) {
            channel = await client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) return;
        }

        const {EmbedBuilder, AttachmentBuilder} = require("discord.js");
        const path = require("path");
        const fs = require("fs");

        // Charger l'image du badge d'achievement si elle existe
        const badgeImagePath = path.join(__dirname, "../../assets/achievement_badge.png");
        let attachment = null;
        let thumbnailUrl = null;

        if (fs.existsSync(badgeImagePath)) {
            attachment = new AttachmentBuilder(badgeImagePath, {name: "achievement_badge.png"});
            thumbnailUrl = "attachment://achievement_badge.png";
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700) // Gold
            .setTitle("✨ Succès !")
            .setDescription(
                `## ${achievement.emoji} ${achievement.name}\n\n` +
                `*${achievement.description}*\n\n` +
                `🎁 **+${achievement.xpReward} XP** gagné !\n\n` +
                `Consulte tous tes succès avec \`/profile\` ou en faisant clic droit sur ton nom : Applications → **Voir le profil** !`
            )
            .setFooter({text: "Continue comme ça pour débloquer plus de succès !"})
            .setTimestamp();

        // Ajouter la thumbnail seulement si l'image existe
        if (thumbnailUrl) {
            embed.setThumbnail(thumbnailUrl);
        }

        const messageOptions: any = {
            content: `<@${userId}> 🎉`,
            embeds: [embed],
            allowedMentions: {users: [userId]}
        };

        // Ajouter l'attachment seulement si l'image existe
        if (attachment) {
            messageOptions.files = [attachment];
        }

        let notificationSent = false;
        let targetChannel: TextChannel | null = null;

        // Si c'est un achievement de PROFIL, envoyer en DM
        if (achievement.category === AchievementCategory.PROFIL) {
            try {
                const user = await client.users.fetch(userId);
                await user.send(messageOptions);
                logger.info(`Achievement notification sent via DM to ${user.username}`);
                notificationSent = true;
                // Pour les notifications de level up, on utilisera le DM du user
                targetChannel = await user.createDM() as any;
            } catch (error) {
                logger.warn(`Failed to send DM to user ${userId} (DMs probably closed), no notification sent`, error);
                // NE PAS envoyer de fallback dans le channel - simplement ne rien envoyer
                notificationSent = false;
            }
        } else {
            // Pour les autres catégories, envoyer dans le channel
            // Si c'est le startup check, on ne peut pas envoyer dans un channel
            if (!isStartupCheck && channel && channel.isTextBased()) {
                await (channel as TextChannel).send(messageOptions);
                targetChannel = channel as TextChannel;
                notificationSent = true;
            }
        }

        // Ajouter l'XP de l'achievement SEULEMENT si la notification a été envoyée
        // ET envoyer la notification de level up au même endroit
        if (notificationSent) {
            // Log Discord pour l'achievement
            const {logCommand} = require("../utils/discordLogger");
            const user = await client.users.fetch(userId);
            await logCommand("🏆 Achievement Débloqué", undefined, [
                {name: "👤 Utilisateur", value: user.username, inline: true},
                {name: "🎯 Achievement", value: `${achievement.emoji} ${achievement.name}`, inline: true},
                {name: "🎁 XP", value: `+${achievement.xpReward} XP`, inline: true},
                {name: "📋 Catégorie", value: achievement.category, inline: true},
                {name: "📨 Notification", value: achievement.category === AchievementCategory.PROFIL ? "DM" : "Channel", inline: true}
            ]);

            const {addXP} = require("./xpSystem");
            const member = await client.guilds.cache.first()?.members.fetch(userId);
            if (member) {
                if (targetChannel) {
                    // La notification de level up sera envoyée dans targetChannel (DM ou channel)
                    await addXP(userId, member.user.username, achievement.xpReward, targetChannel, member.user.bot);
                } else {
                    // Pas de targetChannel (startup check sans DM) - attribuer XP sans notification de level up
                    await addXP(userId, member.user.username, achievement.xpReward, undefined, member.user.bot);
                }
            }
        } else {
            logger.info(`XP not awarded for achievement ${achievementId} because notification could not be sent`);
        }

    } catch (error) {
        logger.error("Error sending achievement notification:", error);
    }
}

/**
 * Vérifie si un achievement est débloqué
 */
export function isAchievementUnlocked(userId: string, achievementId: string): boolean {
    const data = loadAchievements();

    if (!data[userId]) return false;

    const userAchievement = data[userId].achievements.find(a => a.achievementId === achievementId);
    return userAchievement?.unlockedAt !== null;
}

/**
 * Récupère le nombre d'achievements débloqués par catégorie
 */
export function getAchievementStats(userId: string): {
    [category: string]: { unlocked: number; total: number };
} {
    const userAchievements = getUserAchievements(userId, "");
    const stats: { [category: string]: { unlocked: number; total: number } } = {};

    for (const category of Object.values(AchievementCategory)) {
        const categoryAchievements = ALL_ACHIEVEMENTS.filter(a => a.category === category);
        const unlockedCount = userAchievements.filter(ua => {
            const achievement = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
            return achievement?.category === category && ua.unlockedAt !== null;
        }).length;

        stats[category] = {
            unlocked: unlockedCount,
            total: categoryAchievements.length
        };
    }

    return stats;
}

/**
 * Récupère tous les achievements d'une catégorie pour un utilisateur
 */
export function getAchievementsByCategory(
    userId: string,
    username: string,
    category: AchievementCategory
): Array<{ achievement: Achievement; unlocked: boolean; unlockedAt: number | null }> {
    const userAchievements = getUserAchievements(userId, username);

    return ALL_ACHIEVEMENTS
        .filter(a => a.category === category)
        .map(achievement => {
            const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id);
            return {
                achievement,
                unlocked: userAchievement?.unlockedAt !== null,
                unlockedAt: userAchievement?.unlockedAt || null
            };
        });
}

/**
 * Récupère le pourcentage de complétion global
 */
export function getCompletionPercentage(userId: string): number {
    const userAchievements = getUserAchievements(userId, "");
    const unlockedCount = userAchievements.filter(ua => ua.unlockedAt !== null).length;
    const totalCount = ALL_ACHIEVEMENTS.length;

    if (totalCount === 0) return 0;
    return Math.round((unlockedCount / totalCount) * 100);
}
