import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {getNextLevelRole, updateUserLevelRoles} from "./levelRoleService";
import {getRoleUpImage} from "./levelUpImageService";
import {DATA_DIR} from "../utils/constants";
import {recordYearlyXP} from "./yearlyXPService";
import {recordMonthlyXP} from "./monthlyXPService";

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
    imageGeneree: 15,               // Réduit de 50 à 35 (-30%)
    imageReimaginee: 20,            // Réduit de 40 à 28 (-30%)
    imageUpscalee: 10,              // Réduit de 30 à 21 (-30%)
    conversationIA: 8,              // Réduit de 12 à 8 (-33%)
    memeRecherche: 5,               // Réduit de 15 à 11 (-27%)
    promptCree: 20,                 // Réduit de 30 à 21 (-30%)

    // Stats Création
    postCreation: 500,              // Réduit de 1000 à 500 (-50%)

// === ROCHE PAPIER CISEAUX ===
    rpsVictoireVsJoueur: 10,
    rpsDefaiteVsJoueur: 3,        // +3 XP
    rpsEgaliteVsJoueur: 5,        // +3 XP
    rpsVictoireVsIA: 8,
    rpsDefaiteVsIA: 2,            // +2 XP
    rpsEgaliteVsIA: 4,            // +2 XP

// === TIC TAC TOE ===
    tttVictoireVsJoueur: 15,
    tttDefaiteVsJoueur: 3,        // +4 XP
    tttEgaliteVsJoueur: 7,
    tttVictoireVsIA: 10,
    tttDefaiteVsIA: 3,            // +2 XP
    tttEgaliteVsIA: 5,

// === CONNECT 4 ===
    c4VictoireVsJoueur: 25,
    c4DefaiteVsJoueur: 8,         // +5 XP
    c4EgaliteVsJoueur: 13,
    c4VictoireVsIA: 13,
    c4DefaiteVsIA: 3,             // +3 XP
    c4EgaliteVsIA: 6,

// === HANGMAN ===
    hangmanVictoire: 30,
    hangmanDefaite: 8,            // +2 XP

// === BLACKJACK ===
    blackjackVictoireVsIA: 12,    // +4 XP
    blackjackDefaiteVsIA: 3,      // +4 XP (enlever pénalité)
    blackjackEgaliteVsIA: 6,      // +3 XP
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
 * Récupère le niveau d'un utilisateur
 */
export function getUserLevel(userId: string): number {
    const xpData = loadXP();
    return xpData[userId]?.level || 0;
}

/**
 * Enregistre l'XP gagné dans toutes les périodes temporelles
 * (quotidien, hebdomadaire, mensuel, annuel)
 */
function recordXPForAllPeriods(userId: string, username: string, xpAmount: number, voiceMinutes: number = 0): void {
    // Enregistrer pour le jour en cours
    const {recordDailyXP} = require("./dailyWeeklyXPService");
    recordDailyXP(userId, username, xpAmount, voiceMinutes);

    // Enregistrer pour la semaine en cours
    const {recordWeeklyXP} = require("./dailyWeeklyXPService");
    recordWeeklyXP(userId, username, xpAmount, voiceMinutes);

    // Enregistrer pour le mois en cours
    recordMonthlyXP(userId, username, xpAmount);

    // Enregistrer pour l'année en cours
    recordYearlyXP(userId, username, xpAmount);
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
 * @param skipMultiplier - (Optionnel) Si true, n'applique PAS le multiplicateur saisonnier (pour achievements/mystery box)
 * @param voiceMinutes - (Optionnel) Nombre de minutes vocales à enregistrer (pour le tracking vocal)
 */
export async function addXP(
    userId: string,
    username: string,
    amount: number,
    channel?: TextChannel | VoiceChannel,
    isBot: boolean = false,
    skipMultiplier: boolean = false,
    voiceMinutes: number = 0
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

    let finalAmount = amount;

    // [DÉSACTIVÉ] Appliquer le multiplicateur saisonnier SAUF si skipMultiplier est true
    // Le multiplicateur de feu de foyer est désactivé
    // if (!skipMultiplier || amount < 0) {
    //     try {
    //         const {getCurrentFireMultiplier} = require("./seasonal/fireManager");
    //         const fireMultiplier = getCurrentFireMultiplier();
    //         finalAmount = Math.round(amount * fireMultiplier);
    //     } catch (error) {
    //         // Si le système de feu n'est pas initialisé, utiliser 1.0 (pas de multiplicateur)
    //         logger.debug("Fire system not initialized, using default multiplier 1.0");
    //     }
    // }

    xpData[userId].totalXP += finalAmount;

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

    // Enregistrer l'XP pour toutes les périodes (jour, semaine, mois, année)
    recordXPForAllPeriods(userId, username, amount, voiceMinutes);

    if (levelUp) {
        logger.info(`${username} level up! ${oldLevel} → ${newLevel} (${xpData[userId].totalXP} XP)`);

        // Envoyer une notification seulement si c'est un humain
        if (!isBot) {
            await sendLevelUpNotification(userId, username, newLevel, channel);
        }
    } else if (levelDown) {
        logger.warn(`${username} level down! ${oldLevel} → ${newLevel} (${oldTotalXP} → ${xpData[userId].totalXP} XP, penalty: ${amount})`);

        // Envoyer une notification de descente de niveau
        if (!isBot) {
            await sendLevelDownNotification(userId, username, oldLevel, newLevel, Math.abs(amount), channel);
        }
    }

    // Log l'ajout d'XP
    if (amount > 0) {
        logger.debug(`Added ${finalAmount} XP (base: ${amount}) to ${username} (${userId}). Total: ${xpData[userId].totalXP}. Level: ${newLevel}`);
    } else if (amount < 0) {
        logger.debug(`Removed ${Math.abs(amount)} XP from ${username} (${userId}). Total: ${xpData[userId].totalXP}. Level: ${newLevel}`);
    }


    return {
        levelUp,
        newLevel,
        totalXP: xpData[userId].totalXP
    };
}

/**
 * Envoie une notification de level up intelligente
 * Gère TOUS les cas : avec channel, sans channel, avec guild, sans guild
 * Détecte automatiquement les Role Up même sans guild
 */
async function sendLevelUpNotification(userId: string, username: string, newLevel: number, channel?: TextChannel | VoiceChannel): Promise<void> {
    try {
        const client = (global as any).discordClient;
        if (!client) {
            logger.error(`Cannot send level up notification: Discord client not available`);
            return;
        }

        // Récupérer le guild si un channel est fourni
        const guild = channel?.guild;
        let member = null;
        let roleResult: { changed: boolean; newRole?: string; oldRole?: string; skipped?: 'bot' | 'left' } = {changed: false};

        // Si on a un guild, récupérer le member et mettre à jour les rôles
        if (guild) {
            member = await guild.members.fetch(userId).catch(() => null);
            if (member && !member.user.bot) {
                roleResult = await updateUserLevelRoles(guild, userId, newLevel);
            }
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

        // Créer une barre de progression
        const barLength = 10;
        const filledBars = Math.round((progressPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

        // Récupérer les informations du rôle de niveau
        const levelRoleInfo = await import("./levelRoleService").then(m => m.getLevelRoleForLevel(newLevel));
        const currentRoleName = levelRoleInfo?.roleName || "Hatchling";
        const currentRoleKey = levelRoleInfo?.roleKey || "HATCHLING";
        const nextRole = getNextLevelRole(newLevel);

        // Récupérer la couleur du rôle et l'ID (si on a un guild)
        let embedColor = 0xFFD700; // Gold par défaut
        let currentRoleId: string | null = null;
        const GUILD_ID = process.env.GUILD_ID;
        const isMainServer = guild && guild.id === GUILD_ID;

        if (guild && levelRoleInfo) {
            const LEVEL_ROLES = await import("../utils/constants").then(m => m.LEVEL_ROLES);
            const levelRoleId = LEVEL_ROLES[levelRoleInfo.roleKey as keyof typeof LEVEL_ROLES];
            currentRoleId = levelRoleId;
            const levelRole = guild.roles.cache.get(levelRoleId);
            if (levelRole && levelRole.color !== 0) {
                embedColor = levelRole.color;
            }
        }

        // Déterminer si c'est un Role Up
        const isRoleUp = roleResult.changed && roleResult.newRole;

        // Formater le rôle : ping si serveur principal, nom sinon
        const roleDisplay = (isMainServer && currentRoleId) ? `<@&${currentRoleId}>` : currentRoleName;
        const newRoleDisplay = (isMainServer && roleResult.newRole) ? roleResult.newRole : roleResult.newRole;

        // Construire la description
        let embedTitle = isRoleUp ? "🎖️ Nouveau Rôle !" : "🎉 Niveau Gagné !";
        let description = `### Félicitations !\n\n`;
        description += `Tu as atteint le **niveau ${newLevel}** !\n`;

        if (isRoleUp) {
            description += `Tu es maintenant **${newRoleDisplay}** !\n`;
        } else {
            description += `**Rang actuel :** ${roleDisplay}\n`;
        }

        // Section progression XP
        description += `\n### 📊 Progression\n`;
        description += `\`\`\`${progressBar} ${progressPercent}%\`\`\`\n`;
        description += `💫 ${xpInCurrentLevel.toLocaleString()} XP / ${xpNeededForNext.toLocaleString()} XP\n`;

        // Section prochain rôle
        if (nextRole) {
            description += `\n### 🎯 Prochain Objectif\n`;
            description += `Plus que **${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}** avant **${nextRole.roleName}** !`;
        } else {
            description += `\n### 👑 Rang Maximum\n`;
            description += `Tu as atteint le rang suprême !`;
        }

        // Créer l'embed
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(description)
            .addFields(
                {name: "💫 XP Total", value: `${currentXP.toLocaleString()} XP`, inline: true},
                {name: "⭐ Niveau", value: `${newLevel}`, inline: true},
                {name: "🏆 Rang", value: roleDisplay, inline: true}
            )
            .setFooter({text: "Continue à être actif pour gagner plus d'XP !"})
            .setTimestamp();

        // Récupérer l'image du rôle
        const imageAttachment = getRoleUpImage(currentRoleKey);
        if (imageAttachment) {
            embed.setThumbnail(`attachment://${imageAttachment.name}`);
        }

        // Préparer le message
        const messageOptions: any = {embeds: [embed]};
        if (imageAttachment) {
            messageOptions.files = [imageAttachment];
        }

        // Décider où envoyer la notification
        let notificationSent = false;

        // Vérifier si on est dans un contexte externe (DM, Groupe DM, ou Serveur externe)
        const isExternalContext = channel && (!channel.guild || channel.guildId !== GUILD_ID);

        if (channel && !isExternalContext) {
            // CAS 1 : Channel fourni ET serveur principal - Envoyer dans le channel
            const EnvConfig = await import("../utils/envConfig").then(m => m.EnvConfig);
            const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
            const isCounterChannel = COUNTER_CHANNEL_ID && channel.id === COUNTER_CHANNEL_ID;

            messageOptions.content = `<@${userId}>`;
            messageOptions.allowedMentions = {users: [userId]};

            try {
                if (isCounterChannel) {
                    const msg = await channel.send(messageOptions);
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (error) {
                            // Ignore
                        }
                    }, 10000);
                    logger.info(`${isRoleUp ? 'Role up' : 'Level up'} sent (ephemeral) for ${username} in counter channel`);
                } else {
                    await channel.send(messageOptions);
                    const channelType = channel.isVoiceBased() ? 'voice chat' : 'channel';
                    logger.info(`${isRoleUp ? 'Role up' : 'Level up'} sent for ${username} in ${channelType} ${channel.name}`);
                }
                notificationSent = true;
            } catch (channelError) {
                logger.warn(`Failed to send in channel for ${username}, will try DM:`, channelError);
            }
        }

        // CAS 2 : Pas de channel OU contexte externe OU erreur d'envoi - Fallback DM
        if (!notificationSent) {
            // Retirer la mention pour le DM
            delete messageOptions.content;

            try {
                const user = await client.users.fetch(userId).catch(() => null);
                if (!user) {
                    logger.error(`Cannot send level up DM to ${username}: User not found`);
                    return;
                }

                await user.send(messageOptions);
                logger.info(`${isRoleUp ? 'Role up' : 'Level up'} DM sent to ${username} (Level ${newLevel}${isRoleUp ? `, Role: ${roleResult.newRole}` : ''})`);
                notificationSent = true;
            } catch (dmError) {
                logger.error(`Failed to send level up notification to ${username}:`, dmError);
            }
        }

        // Log Discord si notification envoyée avec succès
        if (notificationSent && guild) {
            const {logCommand} = require("../utils/discordLogger");
            const fields: any[] = [
                {name: "👤 Utilisateur", value: username, inline: true},
                {name: "⭐ Niveau", value: `${newLevel}`, inline: true},
                {name: "🎯 XP Total", value: `${currentXP} XP`, inline: true}
            ];

            if (isRoleUp) {
                fields.push({name: "🎖️ Nouveau Rôle", value: roleResult.newRole!, inline: true});
            }

            if (nextRole) {
                fields.push({name: "⬆️ Prochain Rôle", value: `${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}`, inline: true});
            }

            // Déterminer le nom du canal
            let channelName: string;
            if (channel) {
                channelName = (channel as any).name || channel.id;
            } else {
                // Si pas de channel, c'était envoyé en DM
                channelName = `DM avec ${username}`;
            }

            // Récupérer l'avatar de l'utilisateur si possible
            let avatarUrl: string | undefined;
            try {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    avatarUrl = user.displayAvatarURL();
                }
            } catch (error) {
                // Ignorer si on ne peut pas récupérer l'avatar
            }

            await logCommand(isRoleUp ? "🎖️ Role Up" : "⭐ Level Up", undefined, fields, undefined, channelName, avatarUrl);
        }

    } catch (error) {
        logger.error(`Error sending level up notification for ${username}:`, error);
    }
}

/**
 * Envoie une notification de level down intelligente (version unifiée)
 */
async function sendLevelDownNotification(userId: string, username: string, oldLevel: number, newLevel: number, xpLost: number, channel?: TextChannel | VoiceChannel): Promise<void> {
    try {
        const client = (global as any).discordClient;
        if (!client) {
            logger.error(`Cannot send level down notification: Discord client not available`);
            return;
        }

        // Récupérer le guild si disponible
        const guild = channel?.guild;

        // Mettre à jour les rôles si on a un guild
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && !member.user.bot) {
                await updateUserLevelRoles(guild, userId, newLevel);
            }
        }

        // Récupérer les données XP
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

        // Récupérer les informations du rôle
        const levelRoleInfo = await import("./levelRoleService").then(m => m.getLevelRoleForLevel(newLevel));
        const currentRoleName = levelRoleInfo?.roleName || "Hatchling";
        const currentRoleKey = levelRoleInfo?.roleKey || "HATCHLING";

        // Récupérer l'ID du rôle et déterminer si on est dans le serveur principal
        let currentRoleId: string | null = null;
        const GUILD_ID = process.env.GUILD_ID;
        const isMainServer = guild && guild.id === GUILD_ID;

        if (guild && levelRoleInfo) {
            const LEVEL_ROLES = await import("../utils/constants").then(m => m.LEVEL_ROLES);
            const levelRoleId = LEVEL_ROLES[levelRoleInfo.roleKey as keyof typeof LEVEL_ROLES];
            currentRoleId = levelRoleId;
        }

        // Formater le rôle : ping si serveur principal, nom sinon
        const roleDisplay = (isMainServer && currentRoleId) ? `<@&${currentRoleId}>` : currentRoleName;

        const description = `### ⚠️ Pénalité de niveau\n\n` +
            `Tu es descendu du **niveau ${oldLevel}** au **niveau ${newLevel}** suite à une pénalité de **${xpLost} XP**.\n\n` +
            `### 📊 Progression Actuelle\n` +
            `\`\`\`${progressBar} ${progressPercent}%\`\`\`\n` +
            `💫 ${xpInCurrentLevel.toLocaleString()} XP / ${xpNeededForNext.toLocaleString()} XP\n\n` +
            `### 💪 Récupération\n` +
            `Il te faut **${xpNeededForNext - xpInCurrentLevel} XP** pour retrouver le niveau ${newLevel + 1} !`;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("📉 Niveau Perdu")
            .setDescription(description)
            .addFields(
                {name: "💫 XP Total", value: `${currentXP.toLocaleString()} XP`, inline: true},
                {name: "⭐ Niveau", value: `${newLevel}`, inline: true},
                {name: "🏆 Rang", value: roleDisplay, inline: true}
            )
            .setFooter({text: "Sois plus prudent la prochaine fois !"})
            .setTimestamp();

        // Récupérer l'image
        const imageAttachment = getRoleUpImage(currentRoleKey);
        if (imageAttachment) {
            embed.setThumbnail(`attachment://${imageAttachment.name}`);
        }

        // Préparer le message
        const messageOptions: any = {embeds: [embed]};
        if (imageAttachment) {
            messageOptions.files = [imageAttachment];
        }

        // Décider où envoyer
        let notificationSent = false;

        if (channel) {
            // Envoyer dans le channel
            const EnvConfig = await import("../utils/envConfig").then(m => m.EnvConfig);
            const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
            const isCounterChannel = COUNTER_CHANNEL_ID && channel.id === COUNTER_CHANNEL_ID;

            messageOptions.content = `<@${userId}>`;
            messageOptions.allowedMentions = {users: [userId]};

            try {
                if (isCounterChannel) {
                    const msg = await channel.send(messageOptions);
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (error) {
                            // Ignore
                        }
                    }, 10000);
                    logger.info(`Level down sent (ephemeral) for ${username} in counter channel`);
                } else {
                    await channel.send(messageOptions);
                    const channelType = channel.isVoiceBased() ? 'voice chat' : 'channel';
                    logger.info(`Level down sent for ${username} in ${channelType} ${channel.name}`);
                }
                notificationSent = true;
            } catch (channelError) {
                logger.warn(`Failed to send level down in channel for ${username}, will try DM:`, channelError);
            }
        }

        // Fallback DM
        if (!notificationSent) {
            delete messageOptions.content;
            try {
                const user = await client.users.fetch(userId).catch(() => null);
                if (!user) {
                    logger.error(`Cannot send level down DM to ${username}: User not found`);
                    return;
                }

                await user.send(messageOptions);
                logger.info(`Level down DM sent to ${username} (${oldLevel} → ${newLevel})`);
            } catch (dmError) {
                logger.error(`Failed to send level down notification to ${username}:`, dmError);
            }
        }

    } catch (error) {
        logger.error(`Error sending level down notification for ${username}:`, error);
    }
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

