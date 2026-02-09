import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {AttachmentBuilder, EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {getNextLevelRole, updateUserLevelRoles} from "./levelRoleService";
import {DATA_DIR, LEVEL_ROLES} from "../utils/constants";
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
    messageEnvoye: 5,               // Réduit de 7 à 5 (-29%)
    reactionAjoutee: 1,
    reactionRecue: 2,
    commandeUtilisee: 3,            // Réduit de 5 à 3 (-40%) - XP pour commandes fun (ascii, choose, rollthedice, coinflip)
    mentionRecue: 3,
    replyRecue: 4,
    minuteVocale: 1,                // Réduit de 2 à 1 (-50%)

    // Stats Netricsa
    imageGeneree: 35,               // Réduit de 50 à 35 (-30%)
    imageReimaginee: 28,            // Réduit de 40 à 28 (-30%)
    imageUpscalee: 21,              // Réduit de 30 à 21 (-30%)
    conversationIA: 8,              // Réduit de 12 à 8 (-33%)
    memeRecherche: 11,              // Réduit de 15 à 11 (-27%)
    promptCree: 21,                 // Réduit de 30 à 21 (-30%)

    // Stats Création
    postCreation: 500,              // Réduit de 1000 à 500 (-50%)

    // === JEUX - ROCHE PAPIER CISEAUX ===
    // Contre joueur (PvP)
    rpsVictoireVsJoueur: 15,
    rpsDefaiteVsJoueur: 0,
    rpsEgaliteVsJoueur: 0,
    // Contre Netricsa (PvE)
    rpsVictoireVsIA: 8,
    rpsDefaiteVsIA: 0,
    rpsEgaliteVsIA: 0,

    // === JEUX - TIC TAC TOE ===
    // Contre joueur (PvP)
    tttVictoireVsJoueur: 20,
    tttDefaiteVsJoueur: 0,
    tttEgaliteVsJoueur: 10,
    // Contre Netricsa (PvE)
    tttVictoireVsIA: 10,
    tttDefaiteVsIA: 0,
    tttEgaliteVsIA: 5,

    // === JEUX - CONNECT 4 ===
    // Contre joueur (PvP)
    c4VictoireVsJoueur: 25,
    c4DefaiteVsJoueur: 0,
    c4EgaliteVsJoueur: 12,
    // Contre Netricsa (PvE)
    c4VictoireVsIA: 12,
    c4DefaiteVsIA: 0,
    c4EgaliteVsIA: 6,

    // === JEUX - PENDU ===
    // Le pendu est toujours contre l'IA
    hangmanVictoire: 15,
    hangmanDefaite: 0
};

/**
 * Calcule le niveau basé sur l'XP total
 * Formule : niveau = floor(sqrt(xp / 75))
 * Niveau 1 = 75 XP, Niveau 2 = 300 XP, Niveau 3 = 675 XP, etc.
 * Ajusté de /85 à /75 pour cibler niveau 80 en ~2 ans avec 5-8h/jour en vocal
 */
export function calculateLevel(totalXP: number): number {
    return Math.floor(Math.sqrt(totalXP / 75));
}

/**
 * Calcule l'XP nécessaire pour un niveau donné
 */
export function getXPForLevel(level: number): number {
    return level * level * 75;
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
    const oldTotalXP = xpData[userId].totalXP;

    xpData[userId].totalXP += amount;

    // Empêcher l'XP de devenir négatif
    if (xpData[userId].totalXP < 0) {
        xpData[userId].totalXP = 0;
    }

    xpData[userId].username = username;
    xpData[userId].level = calculateLevel(xpData[userId].totalXP);
    xpData[userId].lastUpdate = Date.now();

    const newLevel = xpData[userId].level;
    const levelUp = newLevel > oldLevel;
    const levelDown = newLevel < oldLevel;

    saveXP(xpData);

    // Enregistrer l'XP gagné/perdu pour l'année en cours
    recordYearlyXP(userId, username, amount);

    // Enregistrer l'XP gagné/perdu pour le mois en cours
    recordMonthlyXP(userId, username, amount);

    if (levelUp) {
        logger.info(`${username} level up! ${oldLevel} → ${newLevel} (${xpData[userId].totalXP} XP)`);

        // Envoyer une notification seulement si c'est un humain et qu'un canal est fourni
        if (!isBot && channel) {
            await sendLevelUpMessage(channel, userId, username, newLevel);
        }
    } else if (levelDown) {
        logger.warn(`${username} level down! ${oldLevel} → ${newLevel} (${oldTotalXP} → ${xpData[userId].totalXP} XP, penalty: ${amount})`);

        // Envoyer une notification de descente de niveau
        if (!isBot && channel) {
            await sendLevelDownMessage(channel, userId, username, oldLevel, newLevel, Math.abs(amount));
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
        const roleResult = await updateUserLevelRoles(guild, userId, newLevel);

        // Vérifier le prochain rôle
        const nextRole = getNextLevelRole(newLevel);

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
        let imageAttachment: AttachmentBuilder | null;
        let embedTitle = "🎉 Niveau Gagné !";

        // Récupérer le rôle actuel pour l'image
        const currentRoleName = levelRoleInfo?.roleKey || "HATCHLING";
        const currentRoleId = LEVEL_ROLES[currentRoleName as keyof typeof LEVEL_ROLES];
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
        let description = `### Félicitations !\n\n`;
        description += `Tu as atteint le **niveau ${newLevel}** !\n`;

        // Section changement de rôle (si applicable)
        if (roleResult.changed && roleResult.newRole) {
            description += `Tu es maintenant **${roleResult.newRole}** !\n`;
        }

        // Section progression XP
        description += `### 📊 Progression\n`;
        description += `\`\`\``;
        description += `${progressBar} ${progressPercent}%`;
        description += `\`\`\``;
        description += `💫 ${xpInCurrentLevel.toLocaleString()} XP / ${xpNeededForNext.toLocaleString()} XP\n`;

        // Section prochain rôle
        if (nextRole) {
            description += `### 🎯 Prochain Objectif\n`;
            description += `Plus que **${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}** avant <@&${nextRole.roleId}> !`;
        } else {
            description += `### 👑 Rang Maximum\n`;
            description += `Tu as atteint le rang suprême ! Continue à accumuler de l'XP pour dominer le classement !`;
        }
        description += `\n---\n`;

        // Créer un embed de level up amélioré
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(description)
            .addFields(
                {
                    name: "💫 XP Total",
                    value: `${currentXP.toLocaleString()} XP`,
                    inline: true
                },
                {
                    name: "⭐ Niveau",
                    value: `${newLevel}`,
                    inline: true
                },
                {
                    name: "🏆 Rang",
                    value: currentRoleId ? `<@&${currentRoleId}>` : currentRoleName,
                    inline: true
                }
            )
            .setFooter({text: "Continue à être actif pour gagner plus d'XP !"})
            .setTimestamp();

        // Ajouter l'image si disponible
        if (imageAttachment) {
            embed.setThumbnail(`attachment://${imageAttachment.name}`);
        }

        // Préparer le message avec les pièces jointes
        const messageOptions: any = {
            content: `<@${userId}>`,
            embeds: [embed],
            allowedMentions: {
                users: [userId]
            }
        };

        if (imageAttachment) {
            messageOptions.files = [imageAttachment];
        }

        // Décider où envoyer la notification :
        // - Role up : toujours PUBLIC dans le channel
        // - Level up normal : en DM
        const isRoleUp = roleResult.changed && roleResult.newRole;

        if (isRoleUp) {
            // ROLE UP : Envoyer publiquement dans le channel
            if (isCounterChannel) {
                // Dans le salon compteur, envoyer un message éphémère qui se supprime après 10 secondes
                const msg = await channel.send(messageOptions);
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (error) {
                        // Ignore si le message est déjà supprimé
                    }
                }, 10000);
                logger.info(`Role up message sent (ephemeral) for ${username} (Level ${newLevel}, Role: ${roleResult.newRole}) in counter channel`);
            } else {
                // Message public dans le channel
                await channel.send(messageOptions);
                logger.info(`Role up message sent publicly for ${username} (Level ${newLevel}, Role: ${roleResult.newRole}) in ${channel.name || 'channel'}`);
            }
        } else {
            // LEVEL UP NORMAL : Envoyer en DM
            try {
                const user = await member.user.fetch();
                await user.send(messageOptions);
                logger.info(`Level up message sent via DM for ${username} (Level ${newLevel})`);
            } catch (error) {
                logger.warn(`Failed to send level up DM to ${username}, DMs probably closed. No notification sent.`, error);
                // Ne pas envoyer de fallback dans le channel - simplement ne rien envoyer
            }
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
 * Envoie un message de level down dans le canal approprié
 */
async function sendLevelDownMessage(
    channel: TextChannel | VoiceChannel,
    userId: string,
    username: string,
    oldLevel: number,
    newLevel: number,
    xpLost: number
): Promise<void> {
    try {
        const guild = channel.guild;
        if (!guild) {
            logger.warn("No guild found for level down message");
            return;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member || member.user.bot) {
            return;
        }

        // Mettre à jour les rôles de niveau (descente)
        await updateUserLevelRoles(guild, userId, newLevel);

        // Récupérer les informations XP
        const xpData = loadXP();
        const userXP = xpData[userId];
        const currentXP = userXP?.totalXP || 0;
        const currentLevelXP = getXPForLevel(newLevel);
        const nextLevelXP = getXPForNextLevel(newLevel);
        const xpInCurrentLevel = currentXP - currentLevelXP;
        const xpNeededForNext = nextLevelXP - currentLevelXP;
        const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));

        // Barre de progression
        const barLength = 10;
        const filledBars = Math.round((progressPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

        // Récupérer les informations du rôle actuel
        const levelRoleInfo = await import("./levelRoleService").then(m => m.getLevelRoleForLevel(newLevel));
        const currentRoleName = levelRoleInfo?.roleKey || "HATCHLING";
        const currentRoleId = LEVEL_ROLES[currentRoleName as keyof typeof LEVEL_ROLES];

        // Récupérer la couleur du rôle de niveau (rouge par défaut pour level down)
        let embedColor = 0xED4245; // Rouge par défaut
        const levelRole = guild.roles.cache.get(currentRoleId);
        if (levelRole && levelRole.color !== 0) {
            // Utiliser une version plus foncée de la couleur du rôle pour indiquer la descente
            embedColor = levelRole.color;
        }

        // Récupérer l'image du rôle actuel
        const imageAttachment = getRoleUpImage(currentRoleName);

        const description = `### ⚠️ Pénalité de niveau\n\n` +
            `Tu es descendu du **niveau ${oldLevel}** au **niveau ${newLevel}** suite à une pénalité de **${xpLost} XP**.\n\n` +
            `### 📊 Progression Actuelle\n` +
            `\`\`\`${progressBar} ${progressPercent}%\`\`\`\n` +
            `💫 ${xpInCurrentLevel.toLocaleString()} XP / ${xpNeededForNext.toLocaleString()} XP\n\n` +
            `### 💪 Récupération\n` +
            `Il te faut **${xpNeededForNext - xpInCurrentLevel} XP** pour retrouver le niveau ${newLevel + 1} !\n` +
            `---\n`;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("📉 Niveau Perdu")
            .setDescription(description)
            .addFields(
                {
                    name: "💫 XP Total",
                    value: `${currentXP.toLocaleString()} XP`,
                    inline: true
                },
                {
                    name: "⭐ Niveau",
                    value: `${newLevel}`,
                    inline: true
                },
                {
                    name: "🏆 Rang",
                    value: currentRoleId ? `<@&${currentRoleId}>` : currentRoleName,
                    inline: true
                }
            )
            .setFooter({text: "Sois plus prudent la prochaine fois !"})
            .setTimestamp();

        // Ajouter l'image du rôle si disponible
        if (imageAttachment) {
            embed.setThumbnail(`attachment://${imageAttachment.name}`);
        }

        // Préparer le message avec l'image
        const messageOptions: any = {
            content: `<@${userId}>`,
            embeds: [embed],
            allowedMentions: {
                users: [userId]
            }
        };

        if (imageAttachment) {
            messageOptions.files = [imageAttachment];
        }

        // Envoyer la descente de niveau en DM
        try {
            const user = await member.user.fetch();
            await user.send(messageOptions);
            logger.info(`Level down message sent via DM for ${username} (${oldLevel} → ${newLevel})`);
        } catch (error) {
            logger.warn(`Failed to send level down DM to ${username}, DMs probably closed. No notification sent.`, error);
            // Ne pas envoyer de fallback dans le channel - simplement ne rien envoyer
        }
    } catch (error) {
        logger.error(`Error sending level down message for ${username}:`, error);
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

