import {ButtonStyle, EmbedBuilder, User} from "discord.js";
import {getMostUsedEmoji, getServerStats, getUserStats} from "../services/userStatsService";
import {getUserXP} from "../services/xpSystem";
import {getPlayerStats} from "../games/common/globalStats";
import {UserProfileService} from "../services/userProfileService";
import {getUserCounterContributions} from "../services/counterService";
import * as fs from "fs";
import * as path from "path";
import {getLevelRoleForLevel} from "../services/levelRoleService";
import {LEVEL_ROLES} from "../utils/constants";
import {getNetricsaColorCached} from "./colorHelper";

const DAILY_FILE = path.join(process.cwd(), "data", "daily_streaks.json");

/**
 * Récupère les données du daily streak d'un utilisateur
 */
function getDailyStreak(userId: string): { streak: number; totalClaims: number } | null {
    try {
        if (fs.existsSync(DAILY_FILE)) {
            const data = fs.readFileSync(DAILY_FILE, "utf-8");
            const dailyData = JSON.parse(data);
            if (dailyData[userId]) {
                return {
                    streak: dailyData[userId].streak || 0,
                    totalClaims: dailyData[userId].totalClaims || 0
                };
            }
        }
    } catch (error) {
        // Silently fail
    }
    return null;
}

/**
 * Crée une barre de progression visuelle pour l'XP
 */
export function createXPBar(currentXP: number, level: number): string {
    const xpForCurrent = level * level * 75;
    const xpForNext = (level + 1) * (level + 1) * 75;
    const xpInLevel = currentXP - xpForCurrent;
    const xpNeeded = xpForNext - xpForCurrent;

    // S'assurer que xpNeeded n'est pas zéro pour éviter division par zéro
    if (xpNeeded <= 0) {
        return "█".repeat(10) + " 100%"; // Barre pleine si niveau max ou erreur
    }

    // S'assurer que le pourcentage est entre 0 et 100
    let percentage = (xpInLevel / xpNeeded) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    const totalBars = 10;
    // S'assurer que filledBars est entre 0 et totalBars
    const filledBars = Math.max(0, Math.min(totalBars, Math.floor((percentage / 100) * totalBars)));
    const emptyBars = totalBars - filledBars;

    const bar = "█".repeat(filledBars) + "░".repeat(emptyBars);
    return `${bar} ${percentage.toFixed(0)}%`;
}

/**
 * Crée le texte d'affichage du niveau et de l'XP
 */
export function getLevelText(userId: string): string {
    const xpData = getUserXP(userId);

    if (xpData) {
        const xpForCurrent = xpData.level * xpData.level * 75;
        const xpForNext = (xpData.level + 1) * (xpData.level + 1) * 75;
        const xpInLevel = xpData.totalXP - xpForCurrent;
        const xpNeededInLevel = xpForNext - xpForCurrent;

        const progressBar = createXPBar(xpData.totalXP, xpData.level);

        const roleInfo = getLevelRoleForLevel(xpData.level);
        let roleDisplay = "Aucun";

        if (roleInfo) {
            // Récupérer l'ID du rôle depuis LEVEL_ROLES
            const roleId = LEVEL_ROLES[roleInfo.roleKey as keyof typeof LEVEL_ROLES];
            roleDisplay = `<@&${roleId}>`;
        }

        return `⭐ **Niveau ${xpData.level}**\u00A0\u00A0\u00A0\u00A0🏆 **Rang** ${roleDisplay}\n\`\`\`\n${progressBar}\n\`\`\`💫 ${xpInLevel.toLocaleString()} XP / ${xpNeededInLevel.toLocaleString()} XP \n\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    } else {
        return `⭐ **Niveau 0**\nAucune XP pour le moment. Commence à être actif pour gagner des niveaux !\n\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
}

/**
 * Formate le temps vocal en heures et minutes
 */
export function formatVoiceTime(minutes?: number): string {
    if (minutes === undefined || minutes === null || isNaN(minutes) || minutes === 0) {
        return "0 min";
    }

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Crée l'embed pour les statistiques Discord
 */
export function createDiscordStatsEmbed(targetUser: User): EmbedBuilder {
    const userStats = getUserStats(targetUser.id);

    let description = getLevelText(targetUser.id);

    // Afficher le daily streak
    const dailyData = getDailyStreak(targetUser.id);
    if (dailyData && dailyData.streak > 0) {
        description += `🔥 **Série quotidienne :** ${dailyData.streak} jour${dailyData.streak > 1 ? 's' : ''} (${dailyData.totalClaims} total)\n\n`;
    }

    if (!userStats) {
        description += "Aucune statistique disponible pour le moment.";
    } else {
        description += `📨 **Messages envoyés :** ${userStats.discord.messagesEnvoyes}\n`;
        description += `👍 **Réactions ajoutées :** ${userStats.discord.reactionsAjoutees}\n`;
        description += `❤️ **Réactions reçues :** ${userStats.discord.reactionsRecues}\n`;
        description += `⚡ **Commandes utilisées :** ${userStats.discord.commandesUtilisees}\n`;
        description += `📢 **Mentions reçues :** ${userStats.discord.mentionsRecues}\n`;
        description += `💬 **Replies reçues :** ${userStats.discord.repliesRecues}\n`;
        description += `🎤 **Temps en vocal :** ${formatVoiceTime(userStats.discord.tempsVocalMinutes)}\n`;

        // Afficher l'emoji le plus utilisé
        const mostUsedEmoji = getMostUsedEmoji(targetUser.id);
        if (mostUsedEmoji) {
            description += `😄 **Emoji préféré :** ${mostUsedEmoji.emoji} (×${mostUsedEmoji.count})`;
        }


    }

    return new EmbedBuilder()
        .setColor(0xe1e8ed)
        .setTitle(`📊 Statistiques Discord de ${targetUser.displayName}`)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setFooter({text: "Stats depuis le 5 février 2026"})
        .setTimestamp();
}

/**
 * Crée l'embed pour les statistiques Netricsa
 */
export function createNetricsaStatsEmbed(targetUser: User): EmbedBuilder {
    const userStats = getUserStats(targetUser.id);
    const isBot = targetUser.bot;

    let description = getLevelText(targetUser.id);

    if (!userStats) {
        description += "Aucune statistique disponible pour le moment.";
    } else {
        description += `🎨 **Images générées :** ${userStats.netricsa.imagesGenerees}\n`;
        description += `🖼️ **Images réimaginées :** ${userStats.netricsa.imagesReimaginee}\n`;
        description += `🔍 **Images upscalées :** ${userStats.netricsa.imagesUpscalee}\n`;
        description += `✍️ **Prompts créés :** ${userStats.netricsa.promptsCrees || 0}\n`;
        description += `💬 **Conversations IA :** ${userStats.netricsa.conversationsIA}\n`;

        // Afficher les recherches web uniquement pour Netricsa
        if (isBot && userStats.netricsa.recherchesWebNetricsa !== undefined) {
            description += `🌐 **Recherches web effectuées :** ${userStats.netricsa.recherchesWebNetricsa}\n`;
        }

        description += `🐸 **Memes recherchés :** ${userStats.netricsa.memesRecherches || 0}`;

        // Si c'est Netricsa, ajouter un message personnalisé
        if (isBot) {
            description += `\n\n✨ Voilà toutes mes actions depuis que j'ai commencé à les compter !`;
        }
    }

    return new EmbedBuilder()
        .setColor(0xe1e8ed)
        .setTitle(`<:zzzRole_NetricsaModule:1466997072564584631> Statistiques Netricsa de ${targetUser.displayName}`)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setFooter({text: "Stats depuis le 5 février 2026"})
        .setTimestamp();
}

/**
 * Crée l'embed pour les statistiques de jeux
 */
export function createGameStatsEmbed(targetUser: User): EmbedBuilder {
    const isBot = targetUser.bot;
    const gameStats = isBot ? getPlayerStats("NETRICSA_BOT") : getPlayerStats(targetUser.id);
    const userStats = getUserStats(targetUser.id);

    let description = getLevelText(targetUser.id);

    if (!gameStats) {
        description += "Aucune partie jouée pour le moment.";
    } else {
        const totalGames = gameStats.global.wins + gameStats.global.losses + gameStats.global.draws;

        if (totalGames === 0) {
            description += "Aucune partie jouée pour le moment.";
        } else {
            description += `🎮 **Parties jouées :** ${totalGames}\n`;
            description += `🏆 **Victoires :** ${gameStats.global.wins}\n`;
            description += `💀 **Défaites :** ${gameStats.global.losses}\n`;
            description += `🤝 **Égalités :** ${gameStats.global.draws}\n`;

            const winRate = totalGames > 0
                ? ((gameStats.global.wins / totalGames) * 100).toFixed(1)
                : "0";
            description += `📊 **Taux de victoire :** ${winRate}%`;
        }
    }

    // Ajouter les contributions au compteur (lire depuis counter_state.json)
    const compteurContributions = getUserCounterContributions(targetUser.id);
    if (compteurContributions > 0) {
        description += `\n\n🔢 **Compteur :** ${compteurContributions} contributions`;
    }

    return new EmbedBuilder()
        .setColor(0xe1e8ed)
        .setTitle(`🎮 Statistiques de Jeux de ${targetUser.displayName}`)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setFooter({text: "Stats depuis le 5 février 2026"})
        .setTimestamp();
}

/**
 * Crée l'embed pour les statistiques du serveur
 */
export async function createServerStatsEmbed(guild?: any, client?: any): Promise<EmbedBuilder> {
    const serverStats = getServerStats();

    // Pas de niveau pour les stats serveur
    let description = "";
    description += `👥 **Utilisateurs actifs :** ${serverStats.totalUsers}\n`;
    description += `📨 **Messages totaux :** ${serverStats.totalMessages.toLocaleString()}\n`;
    description += `👍 **Réactions totales :** ${serverStats.totalReactions.toLocaleString()}\n`;
    description += `⚡ **Commandes utilisées :** ${serverStats.totalCommands.toLocaleString()}\n`;
    description += `🎨 **Images créées :** ${serverStats.totalImages.toLocaleString()}\n`;
    description += `🔍 **Upscales :** ${serverStats.totalUpscales.toLocaleString()}\n`;
    description += `💬 **Conversations IA :** ${serverStats.totalConversations.toLocaleString()}`;

    const embed = new EmbedBuilder()
        .setColor(getNetricsaColorCached())
        .setTitle("🌐 Statistiques du Serveur")
        .setDescription(description)
        .setFooter({text: "Stats depuis le 5 février 2026"})
        .setTimestamp();

    // Si on n'a pas le guild mais qu'on a le client, essayer de le fetch
    let targetGuild = guild;
    if (!targetGuild && client) {
        const REQUIRED_GUILD_ID = process.env.GUILD_ID || "827364829567647774";
        try {
            targetGuild = await client.guilds.fetch(REQUIRED_GUILD_ID).catch(() => null);
        } catch (error) {
            // Ignorer les erreurs
        }
    }

    // Utiliser l'icône du serveur si disponible
    if (targetGuild && targetGuild.iconURL) {
        embed.setThumbnail(targetGuild.iconURL({size: 128}));
    }

    return embed;
}

/**
 * Type pour les catégories de stats
 */
export type StatsCategory = "discord" | "netricsa" | "jeux" | "serveur" | "seasonal";

/**
 * Crée l'embed pour une catégorie de stats donnée
 */
export async function createStatsEmbed(targetUser: User, category: StatsCategory, guild?: any, client?: any): Promise<EmbedBuilder> {
    switch (category) {
        case "discord":
            return createDiscordStatsEmbed(targetUser);
        case "netricsa":
            return createNetricsaStatsEmbed(targetUser);
        case "jeux":
            return createGameStatsEmbed(targetUser);
        case "serveur":
            return await createServerStatsEmbed(guild, client);
        default:
            return createDiscordStatsEmbed(targetUser);
    }
}

/**
 * Crée l'embed de profil pour l'utilisateur
 */
export function createProfileEmbed(targetUser: User): EmbedBuilder {
    const profile = UserProfileService.getProfile(targetUser.id);

    const embed = new EmbedBuilder()
        .setColor(getNetricsaColorCached())
        .setTitle(`📋 Profil de ${targetUser.displayName}`)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setTimestamp()
        .setFooter({text: `ID: ${targetUser.id}`});

    if (!profile) {
        embed.setDescription(`Aucun profil trouvé pour **${targetUser.username}**.\nL'IA n'a pas encore appris d'informations sur cet utilisateur.`);
        return embed;
    }

    // Vérifier si le profil a du contenu
    const hasContent =
        profile.roles.length > 0 ||
        profile.aliases.length > 0 ||
        profile.interests.length > 0 ||
        profile.facts.length > 0;

    if (!hasContent) {
        embed.setDescription("ℹ️ Le profil existe mais est vide pour le moment.");
        return embed;
    }

    // Aliases
    if (profile.aliases.length > 0) {
        const aliasesText = profile.aliases.map(alias => `• ${alias}`).join("\n");
        embed.addFields({name: "🏷️ Surnoms", value: aliasesText, inline: true});
    }

    // Rôles Discord
    if (profile.roles.length > 0) {
        const rolesText = profile.roles.map(role => `• ${role}`).join("\n");
        embed.addFields({name: "👥 Rôles Discord", value: rolesText, inline: true});
    }

    // Activité en cours
    if (profile.currentActivity) {
        const activityAge = Date.now() - profile.currentActivity.timestamp;
        const maxAge = 15 * 60 * 1000;

        if (activityAge < maxAge) {
            let activityText = `• ${profile.currentActivity.gameName}`;
            if (profile.currentActivity.details) {
                activityText += ` (${profile.currentActivity.details})`;
            }
            embed.addFields({name: "🎮 Joue actuellement à", value: activityText, inline: false});
        }
    }

    // Anniversaire
    if (profile.birthday) {
        const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
        let birthdayText = `Date: ${profile.birthday.day} ${monthNames[profile.birthday.month - 1]}`;

        if (profile.birthday.year) {
            const now = new Date();
            let age = now.getFullYear() - profile.birthday.year;
            const birthdayThisYear = new Date(now.getFullYear(), profile.birthday.month - 1, profile.birthday.day);
            if (now < birthdayThisYear) age--;
            birthdayText += ` ${profile.birthday.year} (${age} ans)`;
        }

        birthdayText += `\nNotification: ${profile.birthday.notify ? 'Activée' : 'Désactivée'}`;
        embed.addFields({name: "🎂 Anniversaire", value: birthdayText, inline: false});
    }

    // Intérêts
    if (profile.interests.length > 0) {
        const interestsText = profile.interests.map(interest => `• ${interest}`).join("\n");
        embed.addFields({name: "💡 Centres d'intérêt", value: interestsText});
    }

    // Faits
    if (profile.facts.length > 0) {
        const recentFacts = profile.facts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
        const factsText = recentFacts.map(fact => `• ${fact.content}`).join("\n");

        const factsTitle = profile.facts.length > 10
            ? `📝 Faits enregistrés (${profile.facts.length} - affichage limité à 10)`
            : `📝 Faits enregistrés (${profile.facts.length})`;

        embed.addFields({name: factsTitle, value: factsText, inline: false});
    }

    return embed;
}

/**
 * Crée une version détaillée de l'embed de stats de jeux avec sélection par type de jeu
 */
export function createDetailedGameStatsEmbed(targetUser: User, gameType: string): EmbedBuilder {
    const isBot = targetUser.bot;
    const stats = isBot ? getPlayerStats("NETRICSA_BOT") : getPlayerStats(targetUser.id);

    let description = "";
    let title = isBot ? `📊 Mes Statistiques de Jeux (Netricsa)` : `📊 Statistiques de ${targetUser.displayName}`;

    // Ajouter le niveau en haut (sauf pour Netricsa)
    if (!isBot) {
        description += getLevelText(targetUser.id);
    }

    if (gameType === "global") {
        title += " - Jeux (Global)";
        const globalStats = stats.global;
        const totalGames = globalStats.wins + globalStats.losses + globalStats.draws;

        if (totalGames === 0) {
            if (isBot) {
                description += "Aucune partie jouée pour le moment. Je suis prête à affronter les joueurs ! 🎮";
            } else {
                description += "Aucune partie jouée pour le moment.";
            }
        } else {
            description += `**Total de parties :** ${totalGames}\n\n`;
            description += `🏆 **Victoires :** ${globalStats.wins}\n`;
            description += `💀 **Défaites :** ${globalStats.losses}\n`;
            if (globalStats.draws > 0) {
                description += `🤝 **Égalités :** ${globalStats.draws}\n`;
            }

            const winRate = ((globalStats.wins / totalGames) * 100).toFixed(1);
            description += `\n📈 **Taux de victoire :** ${winRate}%`;

            if (isBot) {
                description += `\n\n✨ Voilà mes performances contre tous les joueurs !`;
            }
        }
    } else {
        const gameNames: Record<string, string> = {
            rockpaperscissors: "Roche-Papier-Ciseaux",
            tictactoe: "Tic-Tac-Toe",
            connect4: "Connect 4",
            hangman: "Pendu",
            blackjack: "Blackjack"
        };

        title += ` - Jeux (${gameNames[gameType]})`;
        const gameStats = stats[gameType as 'rockpaperscissors' | 'tictactoe' | 'connect4' | 'hangman' | 'blackjack'];
        const totalGames = gameStats.wins + gameStats.losses + gameStats.draws;

        if (totalGames === 0) {
            if (isBot && gameType === "hangman") {
                description += `Je ne joue pas au Pendu (c'est un jeu solo), mais je compte les scores ! 🎮`;
            } else if (isBot) {
                description += `Aucune partie de ${gameNames[gameType]} jouée pour le moment. Viens m'affronter ! 🎮`;
            } else {
                description += `Aucune partie de ${gameNames[gameType]} jouée pour le moment.`;
            }
        } else {
            description += `**Total de parties :** ${totalGames}\n\n`;
            description += `🏆 **Victoires :** ${gameStats.wins}\n`;
            description += `💀 **Défaites :** ${gameStats.losses}\n`;
            if (gameStats.draws > 0) {
                description += `🤝 **Égalités :** ${gameStats.draws}\n`;
            }
            description += `\n`;
            if (gameStats.currentStreak > 0) {
                description += `🔥 **Série actuelle :** ${gameStats.currentStreak}\n`;
            }
            if (gameStats.highestStreak > 0) {
                description += `⭐ **Meilleure série :** ${gameStats.highestStreak}\n`;
            }

            const winRate = ((gameStats.wins / totalGames) * 100).toFixed(1);
            description += `\n📈 **Taux de victoire :** ${winRate}%`;

            if (isBot) {
                description += `\n\n✨ Mes performances à ${gameNames[gameType]} !`;
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0xe1e8ed)
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({text: "Stats depuis le 5 février 2026"})
        .setTimestamp();

    return embed;
}

/**
 * Crée les boutons de navigation pour les stats
 */
export function createStatsNavigationButtons(currentCategory?: StatsCategory): import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder> {
    const {ActionRowBuilder, ButtonBuilder, ButtonStyle} = require("discord.js");

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("stats_discord")
            .setLabel("Discord")
            .setEmoji("📨")
            .setStyle(currentCategory === "discord" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "discord"),
        new ButtonBuilder()
            .setCustomId("stats_netricsa")
            .setLabel("Netricsa")
            .setEmoji("🤖")
            .setStyle(currentCategory === "netricsa" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "netricsa"),
        new ButtonBuilder()
            .setCustomId("stats_jeux")
            .setLabel("Jeux")
            .setEmoji("🎮")
            .setStyle(currentCategory === "jeux" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "jeux"),
        new ButtonBuilder()
            .setCustomId("stats_seasonal")
            .setLabel("Saisonnier")
            .setEmoji("❄️")
            .setStyle(currentCategory === "seasonal" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentCategory === "seasonal"),
        new ButtonBuilder()
            .setCustomId("stats_serveur")
            .setLabel("Serveur")
            .setEmoji("🌐")
            .setStyle(currentCategory === "serveur" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentCategory === "serveur")
    );
}


/**
 * Crée le menu de sélection des jeux
 */
export function createGameSelectMenu(): import("discord.js").ActionRowBuilder<import("discord.js").StringSelectMenuBuilder> {
    const {ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder} = require("discord.js");

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("stats_game_select")
            .setPlaceholder("Choisir un jeu")
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("Global")
                    .setDescription("Statistiques globales de tous les jeux")
                    .setValue("global")
                    .setEmoji("🌐"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Roche-Papier-Ciseaux")
                    .setDescription("Statistiques du jeu Roche-Papier-Ciseaux")
                    .setValue("rockpaperscissors")
                    .setEmoji("🪨"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Tic-Tac-Toe")
                    .setDescription("Statistiques du jeu Tic-Tac-Toe")
                    .setValue("tictactoe")
                    .setEmoji("❌"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Connect 4")
                    .setDescription("Statistiques du jeu Connect 4")
                    .setValue("connect4")
                    .setEmoji("🔴"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Blackjack")
                    .setDescription("Statistiques du jeu Blackjack")
                    .setValue("blackjack")
                    .setEmoji("🃏"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Pendu")
                    .setDescription("Statistiques du jeu Pendu")
                    .setValue("hangman")
                    .setEmoji("🔤")
            )
    );
}

/**
 * Crée l'embed pour l'inventaire de l'utilisateur
 */
export function createInventoryEmbed(targetUser: User): EmbedBuilder {
    const {getUserInventory, ITEM_CATALOG, getCurrentSeason, Season} = require("../services/userInventoryService");
    const inventory = getUserInventory(targetUser.id, targetUser.username);
    const currentSeason = getCurrentSeason();

    let description = getLevelText(targetUser.id);

    const itemCount = Object.keys(inventory.items).length;

    if (itemCount === 0) {
        description += "🎒 **Inventaire vide**\n\n";
        description += "Tu n'as aucun objet pour le moment.\n\n";
        description += "**Comment obtenir des objets ?**\n";
        description += "• 🏆 Débloque des achievements\n";
        description += "• 🎮 Gagne des parties de jeux (20% de chance)\n";
        description += "• 🎨 Utilise `/imagine`, `/upscale`, `/reimagine` (3% de chance)\n";
        description += "• 🔮 Utilise `/crystalball` (3% de chance)\n";
        description += "• 🎤 Passe du temps en vocal (0.8% par tranche)\n";
        description += "• ⚡ Utilise des commandes (1% de chance)\n";
    } else {
        description += "🎒 **Inventaire**\n\n";

        // Afficher les bûches en premier (catégorie spéciale)
        const {InventoryItemType} = require("../services/userInventoryService");
        const firewoodCount = inventory.items[InventoryItemType.FIREWOOD_LOG] || 0;

        if (firewoodCount > 0) {
            const firewoodInfo = ITEM_CATALOG[InventoryItemType.FIREWOOD_LOG];
            description += `${firewoodInfo.emoji} **${firewoodInfo.name}** × ${firewoodCount}\n`;
            description += `⠀⠀⠀↳ ${firewoodInfo.description}\n`;
        }

        // Afficher les items par saison
        const seasonNames: Record<string, string> = {
            [Season.WINTER]: "❄️ Hiver",
            [Season.SPRING]: "🌸 Printemps",
            [Season.SUMMER]: "☀️ Été",
            [Season.FALL]: "🍂 Automne"
        };

        const itemsBySeason: Record<string, Array<{ itemType: string, quantity: number }>> = {
            [Season.WINTER]: [],
            [Season.SPRING]: [],
            [Season.SUMMER]: [],
            [Season.FALL]: []
        };

        // Grouper les items par saison (exclure les bûches déjà affichées)
        for (const [itemType, quantity] of Object.entries(inventory.items) as Array<[string, number]>) {
            // Skip les bûches car déjà affichées
            if (itemType === InventoryItemType.FIREWOOD_LOG) continue;

            const itemInfo = ITEM_CATALOG[itemType];
            if (itemInfo && quantity > 0) {
                itemsBySeason[itemInfo.season].push({itemType, quantity});
            }
        }

        // Afficher la saison actuelle en premier
        const seasons = [currentSeason, ...Object.values(Season).filter(s => s !== currentSeason)];

        for (const season of seasons) {
            const items = itemsBySeason[season];
            if (items.length > 0) {
                for (const {itemType, quantity} of items) {
                    const itemInfo = ITEM_CATALOG[itemType];
                    description += `${itemInfo.emoji} **${itemInfo.name}** × ${quantity}\n`;
                    description += `⠀⠀⠀↳ ${itemInfo.description}\n`;
                }
                description += "\n";
            }
        }

        const totalItems = (Object.values(inventory.items) as number[]).reduce((a, b) => a + b, 0);
        description += `📦 **Total d'objets :** ${totalItems}`;
    }

    return new EmbedBuilder()
        .setColor(0xc1694f)
        .setTitle(`🎒 Inventaire de ${targetUser.displayName}`)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setTimestamp();
}
