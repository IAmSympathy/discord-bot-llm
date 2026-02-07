import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {AttachmentBuilder, EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {getNextLevelRole, updateUserLevelRoles} from "./levelRoleService";
import {DATA_DIR} from "../utils/constants";
import {recordYearlyXP} from "./yearlyXPService";
import {recordMonthlyXP} from "./monthlyXPService";
import {getRoleUpImage} from "./levelUpImageService";

const logger = createLogger("XPSystem");
const XP_FILE = path.join(DATA_DIR, "user_xp.json");

/**
 * Configuration des points d'XP par action
 */
export const XP_REWARDS = {
    // Stats Discord
    messageEnvoye: 7,               // Augmenté de 5 à 7 (+40%)
    reactionAjoutee: 1,
    reactionRecue: 2,
    commandeUtilisee: 0,
    mentionRecue: 3,
    replyRecue: 4,
    minuteVocale: 2,                // Augmenté de 1 à 2 (+100%)

    // Stats Netricsa
    imageGeneree: 50,
    imageReimaginee: 40,
    imageUpscalee: 30,
    conversationIA: 12,             // Augmenté de 10 à 12 (+20%)
    memeRecherche: 15,
    promptCree: 30,

    // Stats Création
    postCreation: 500,              // Réduit de 1000 à 500 (-50%)

    // === JEUX - ROCHE PAPIER CISEAUX ===
    // Contre joueur (PvP)
    rpsVictoireVsJoueur: 15,
    rpsDefaiteVsJoueur: 6,
    rpsEgaliteVsJoueur: 8,
    // Contre Netricsa (PvE)
    rpsVictoireVsIA: 8,
    rpsDefaiteVsIA: 3,
    rpsEgaliteVsIA: 4,

    // === JEUX - TIC TAC TOE ===
    // Contre joueur (PvP)
    tttVictoireVsJoueur: 20,
    tttDefaiteVsJoueur: 8,
    tttEgaliteVsJoueur: 10,
    // Contre Netricsa (PvE)
    tttVictoireVsIA: 10,
    tttDefaiteVsIA: 4,
    tttEgaliteVsIA: 5,

    // === JEUX - CONNECT 4 ===
    // Contre joueur (PvP)
    c4VictoireVsJoueur: 25,
    c4DefaiteVsJoueur: 10,
    c4EgaliteVsJoueur: 12,
    // Contre Netricsa (PvE)
    c4VictoireVsIA: 12,
    c4DefaiteVsIA: 5,
    c4EgaliteVsIA: 6,

    // === JEUX - PENDU ===
    // Le pendu est toujours contre l'IA
    hangmanVictoire: 15,
    hangmanDefaite: 5
};

/**
 * Calcule le niveau basé sur l'XP total
 * Formule : niveau = floor(sqrt(xp / 85))
 * Niveau 1 = 85 XP, Niveau 2 = 340 XP, Niveau 3 = 765 XP, etc.
 * Ajusté de /100 à /85 pour une progression -15% plus rapide
 */
export function calculateLevel(totalXP: number): number {
    return Math.floor(Math.sqrt(totalXP / 85));
}

/**
 * Calcule l'XP nécessaire pour un niveau donné
 */
export function getXPForLevel(level: number): number {
    return level * level * 85;
}

/**
 * Calcule l'XP nécessaire pour passer au niveau suivant
 */
export function getXPForNextLevel(currentLevel: number): number {
    return getXPForLevel(currentLevel + 1);
}

/**
 * Structure d'XP d'un utilisateur
 */
export interface UserXP {
    userId: string;
    username: string;
    totalXP: number;
    level: number;
    lastUpdate: number;
}

interface XPDatabase {
    [userId: string]: UserXP;
}

/**
 * Charge les XP depuis le fichier JSON
 */
function loadXP(): XPDatabase {
    try {
        if (!fs.existsSync(XP_FILE)) {
            return {};
        }
        const data = fs.readFileSync(XP_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        logger.error("Error loading XP:", error);
        return {};
    }
}

/**
 * Sauvegarde les XP dans le fichier JSON
 */
function saveXP(xp: XPDatabase): void {
    try {
        const dir = path.dirname(XP_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(XP_FILE, JSON.stringify(xp, null, 2));
    } catch (error) {
        logger.error("Error saving XP:", error);
    }
}

/**
 * Récupère l'XP d'un utilisateur
 */
export function getUserXP(userId: string): UserXP | null {
    const xpData = loadXP();
    return xpData[userId] || null;
}

/**
 * Ajoute de l'XP à un utilisateur
 * Si c'est un bot, l'XP est ajoutée sans notification
 * Si c'est un humain et qu'un canal est fourni, envoie une notification de level up
 *
 * @param userId - ID de l'utilisateur
 * @param username - Nom de l'utilisateur
 * @param amount - Quantité d'XP à ajouter
 * @param channel - (Optionnel) Canal pour envoyer la notification de level up
 * @param isBot - (Optionnel) Si true, pas de notification même si un canal est fourni
 */
export async function addXP(
    userId: string,
    username: string,
    amount: number,
    channel?: TextChannel | VoiceChannel,
    isBot: boolean = false
): Promise<{ levelUp: boolean; newLevel: number; totalXP: number }> {
    const xpData = loadXP();

    if (!xpData[userId]) {
        xpData[userId] = {
            userId,
            username,
            totalXP: 0,
            level: 0,
            lastUpdate: Date.now()
        };
    }

    const oldLevel = xpData[userId].level;
    xpData[userId].totalXP += amount;
    xpData[userId].username = username;
    xpData[userId].level = calculateLevel(xpData[userId].totalXP);
    xpData[userId].lastUpdate = Date.now();

    const newLevel = xpData[userId].level;
    const levelUp = newLevel > oldLevel;

    saveXP(xpData);

    // Enregistrer l'XP gagné pour l'année en cours
    recordYearlyXP(userId, username, amount);

    // Enregistrer l'XP gagné pour le mois en cours
    recordMonthlyXP(userId, username, amount);

    if (levelUp) {
        logger.info(`${username} level up! ${oldLevel} → ${newLevel} (${xpData[userId].totalXP} XP)`);

        // Envoyer une notification seulement si c'est un humain et qu'un canal est fourni
        if (!isBot && channel) {
            await sendLevelUpMessage(channel, userId, username, newLevel);
        }
    }

    return {
        levelUp,
        newLevel,
        totalXP: xpData[userId].totalXP
    };
}

/**
 * Envoie un message de level up dans le canal approprié
 */
async function sendLevelUpMessage(channel: TextChannel | VoiceChannel, userId: string, username: string, newLevel: number): Promise<void> {
    try {
        // Vérifier si c'est un bot
        const guild = channel.guild;
        if (!guild) {
            logger.warn("No guild found for level up message");
            return;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            logger.warn(`Member ${userId} not found for level up message`);
            return;
        }

        // Les bots ne devraient jamais recevoir de notification de level up
        // Mais au cas où, on s'assure qu'ils ne reçoivent pas de rôles
        if (member.user.bot) {
            logger.info(`Skipping level up message for bot ${username}`);
            return;
        }

        // Vérifier si on est dans le salon compteur
        const EnvConfig = await import("../utils/envConfig").then(m => m.EnvConfig);
        const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
        const isCounterChannel = COUNTER_CHANNEL_ID && channel.id === COUNTER_CHANNEL_ID;

        // Mettre à jour les rôles de niveau
        let roleChangeInfo = "";
        const roleResult = await updateUserLevelRoles(guild, userId, newLevel);

        if (roleResult.changed && roleResult.newRole) {
            roleChangeInfo = `\n\n🎖️ **Tu es maintenant ${roleResult.newRole} !**`;
        }

        // Vérifier le prochain rôle
        const nextRole = getNextLevelRole(newLevel);
        let nextRoleInfo = "";
        if (nextRole) {
            nextRoleInfo = `\n\n⬆️ Plus que **${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}** avant d'atteindre <@&${nextRole.roleId}> !`;
        } else {
            nextRoleInfo = `\n\n👑 **Tu as atteint le rang maximum !**`;
        }

        // Récupérer la couleur du rôle de niveau de l'utilisateur
        let embedColor = 0xFFD700; // Gold par défaut
        const levelRoleInfo = await import("./levelRoleService").then(m => m.getLevelRoleForLevel(newLevel));
        if (levelRoleInfo) {
            const LEVEL_ROLES = await import("../utils/constants").then(m => m.LEVEL_ROLES);
            const levelRoleId = LEVEL_ROLES[levelRoleInfo.roleKey as keyof typeof LEVEL_ROLES];
            const levelRole = guild.roles.cache.get(levelRoleId);
            if (levelRole && levelRole.color !== 0) {
                embedColor = levelRole.color;
            }
        }

        // Récupérer l'image appropriée (toujours basée sur le rôle actuel)
        let imageAttachment: AttachmentBuilder | null = null;
        let embedTitle = "🎉 Level Up !";

        // Récupérer le rôle actuel pour l'image
        const currentRoleName = levelRoleInfo?.roleKey || "HATCHLING";
        imageAttachment = getRoleUpImage(currentRoleName);

        // Si c'est un changement de rôle, changer le titre
        if (roleResult.changed && roleResult.newRole) {
            embedTitle = "🎖️ Nouveau Rôle !";
        }

        // Récupérer les données XP pour la progression
        const xpData = loadXP();
        const userXP = xpData[userId];
        const currentXP = userXP?.totalXP || 0;
        const currentLevelXP = getXPForLevel(newLevel);
        const nextLevelXP = getXPForNextLevel(newLevel);
        const xpInCurrentLevel = currentXP - currentLevelXP;
        const xpNeededForNext = nextLevelXP - currentLevelXP;
        const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));

        // Créer une barre de progression visuelle
        const barLength = 10;
        const filledBars = Math.round((progressPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

        // Construire la description avec sections séparées
        let description = `### Félicitations <@${userId}> ! 🎊\n\n`;
        description += `Tu as atteint le **niveau ${newLevel}** !\n\n`;

        // Section changement de rôle (si applicable)
        if (roleResult.changed && roleResult.newRole) {
            description += `### 🎖️ Nouveau Rôle Débloqué\n`;
            description += `Tu es maintenant **${roleResult.newRole}** !\n\n`;
        }

        // Section progression XP
        description += `### 📊 Progression\n`;
        description += `\`\`\`\n`;
        description += `${progressBar} ${progressPercent}%\n`;
        description += `\`\`\`\n`;
        description += `**${xpInCurrentLevel.toLocaleString()} / ${xpNeededForNext.toLocaleString()} XP**\n`;
        description += `*${(xpNeededForNext - xpInCurrentLevel).toLocaleString()} XP restants jusqu'au niveau ${newLevel + 1}*\n\n`;

        // Section prochain rôle
        if (nextRole) {
            description += `### 🎯 Prochain Objectif\n`;
            description += `Plus que **${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}** avant <@&${nextRole.roleId}> !`;
        } else {
            description += `### 👑 Rang Maximum\n`;
            description += `Tu as atteint le rang suprême ! Continue à accumuler de l'XP pour dominer le classement !`;
        }

        // Créer un embed de level up amélioré
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(description)
            .addFields(
                {
                    name: "💎 XP Total",
                    value: `**${currentXP.toLocaleString()}** XP`,
                    inline: true
                },
                {
                    name: "⭐ Niveau",
                    value: `**${newLevel}**`,
                    inline: true
                },
                {
                    name: "🏆 Rang",
                    value: `${currentRoleName}`,
                    inline: true
                }
            )
            .setFooter({text: "Continue à être actif pour gagner plus d'XP !"})
            .setTimestamp();

        // Ajouter l'image si disponible
        if (imageAttachment) {
            embed.setImage(`attachment://${imageAttachment.name}`);
        }

        // Préparer le message avec les pièces jointes
        const messageOptions: any = {
            content: `||<@${userId}>||`,
            embeds: [embed],
            allowedMentions: {
                users: [userId]
            }
        };

        if (imageAttachment) {
            messageOptions.files = [imageAttachment];
        }

        // Dans le salon compteur, envoyer un message éphémère qui se supprime après 10 secondes
        if (isCounterChannel) {
            const msg = await channel.send(messageOptions);

            // Supprimer le message après 10 secondes
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (error) {
                    // Ignore si le message est déjà supprimé
                }
            }, 10000);

            logger.info(`Level up message sent (ephemeral) for ${username} (Level ${newLevel}) in counter channel`);
        } else {
            // Message normal dans les autres salons
            await channel.send(messageOptions);

            logger.info(`Level up message sent for ${username} (Level ${newLevel}) in ${channel.name || 'channel'}`);
        }

        // Log Discord pour le level up
        const {logCommand} = require("../utils/discordLogger");
        const xpDataForLog = loadXP();
        const userXPForLog = xpDataForLog[userId];

        const fields: any[] = [
            {name: "👤 Utilisateur", value: username, inline: true},
            {name: "⭐ Niveau", value: `${newLevel}`, inline: true},
            {name: "🎯 XP Total", value: `${userXPForLog?.totalXP || 0} XP`, inline: true}
        ];

        if (roleResult.changed && roleResult.newRole) {
            fields.push({name: "🎖️ Nouveau Rôle", value: roleResult.newRole, inline: true});
        }

        if (nextRole) {
            fields.push({name: "⬆️ Prochain Rôle", value: `${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}`, inline: true});
        }

        await logCommand("⭐ Level Up", undefined, fields);

    } catch (error) {
        logger.error(`Error sending level up message for ${username}:`, error);
    }
}

/**
 * Récupère le classement des utilisateurs par XP
 */
export function getLeaderboard(limit: number = 10): UserXP[] {
    const xpData = loadXP();
    return Object.values(xpData)
        .sort((a, b) => b.totalXP - a.totalXP)
        .slice(0, limit);
}

/**
 * Calcule l'XP total basé sur les statistiques d'un utilisateur
 */
export function calculateTotalXPFromStats(stats: any): number {
    let totalXP = 0;

    // Stats Discord
    if (stats.discord) {
        totalXP += stats.discord.messagesEnvoyes * XP_REWARDS.messageEnvoye;
        totalXP += stats.discord.reactionsAjoutees * XP_REWARDS.reactionAjoutee;
        totalXP += stats.discord.reactionsRecues * XP_REWARDS.reactionRecue;
        totalXP += stats.discord.commandesUtilisees * XP_REWARDS.commandeUtilisee;
        totalXP += stats.discord.mentionsRecues * XP_REWARDS.mentionRecue;
        totalXP += stats.discord.repliesRecues * XP_REWARDS.replyRecue;
        totalXP += stats.discord.tempsVocalMinutes * XP_REWARDS.minuteVocale;
    }

    // Stats Netricsa
    if (stats.netricsa) {
        totalXP += stats.netricsa.imagesGenerees * XP_REWARDS.imageGeneree;
        totalXP += stats.netricsa.imagesReimaginee * XP_REWARDS.imageReimaginee;
        totalXP += stats.netricsa.imagesUpscalee * XP_REWARDS.imageUpscalee;
        // Les recherches web sont automatiques et font partie des conversations IA
        totalXP += stats.netricsa.conversationsIA * XP_REWARDS.conversationIA;
    }

    return totalXP;
}

/**
 * Recalcule l'XP de tous les utilisateurs basé sur leurs stats
 * Note: Les XP des jeux ne sont pas recalculés car chaque jeu a des valeurs différentes
 * et on ne peut pas déterminer rétroactivement si c'était vs IA ou vs joueur
 */
export function recalculateAllXP(userStatsService: any, gameStatsService: any): void {
    logger.info("Recalculating all user XP...");

    const allStats = userStatsService.getAllStats();
    const xpData = loadXP();

    for (const [userId, stats] of Object.entries(allStats)) {
        const userStat = stats as any;
        let totalXP = calculateTotalXPFromStats(userStat);

        // Note: Les XP des jeux ne sont pas recalculés car maintenant chaque jeu
        // a des valeurs d'XP différentes selon le type d'adversaire (joueur vs IA)
        // et on ne peut pas déterminer rétroactivement le type d'adversaire

        xpData[userId] = {
            userId,
            username: userStat.username,
            totalXP,
            level: calculateLevel(totalXP),
            lastUpdate: Date.now()
        };
    }

    saveXP(xpData);
    logger.info(`Recalculated XP for ${Object.keys(xpData).length} users`);
}

/**
 * Récupère toutes les données XP (pour le leaderboard)
 */
export function getAllXP(): XPDatabase {
    return loadXP();
}

/**
 * Exporte le type XPData pour utilisation externe
 */
export type XPData = UserXP;

