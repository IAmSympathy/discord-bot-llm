import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
import {getAllXP} from "../../services/xpSystem";
import {getAllStats} from "../../services/userStatsService";
import {getGlobalLeaderboard} from "../../games/common/globalStats";
import {getMonthlyXP} from "../../services/monthlyXPService";
import {getDailyXP, getWeeklyXP} from "../../services/dailyWeeklyXPService";
import {getCurrentDate} from "../../services/dailyStatsService";
import {getCurrentWeek, getWeeklyStatsForWeek} from "../../services/weeklyStatsService";

type LeaderboardCategory = "xp" | "messages" | "vocal" | "images" | "jeux";
type LeaderboardMode = "alltime" | "daily" | "weekly" | "monthly";

/**
 * Récupère le displayName d'un utilisateur depuis le serveur et le normalise
 */
async function getDisplayName(interaction: ChatInputCommandInteraction, userId: string, fallbackName: string): Promise<string> {
    try {
        if (!interaction.guild) return normalizeDisplayName(fallbackName);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const rawName = member?.displayName || fallbackName;
        return normalizeDisplayName(rawName);
    } catch {
        return normalizeDisplayName(fallbackName);
    }
}

/**
 * Filtre les bots, applications et Netricsa de la liste
 */
async function filterBots(interaction: ChatInputCommandInteraction, userIds: string[]): Promise<Set<string>> {
    const botIds = new Set<string>();
    if (!interaction.guild) return botIds;

    // Noms de bots connus à exclure
    const knownBotNames = ['netricsa', 'freestuff', 'wordle', 'mee6', 'dyno', 'carl-bot', 'pokétwo'];

    for (const userId of userIds) {
        try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) {
                // Filtrer les bots (bot flag)
                if (member.user.bot) {
                    botIds.add(userId);
                    continue;
                }
                // Filtrer les applications Discord (system flag)
                if (member.user.system) {
                    botIds.add(userId);
                    continue;
                }
                // Filtrer par nom connu
                const username = member.user.username.toLowerCase();
                if (knownBotNames.some(botName => username.includes(botName))) {
                    botIds.add(userId);

                }
            } else {
                // Si on ne peut pas fetch le membre, essayer de vérifier dans les stats
                const {getUserStats} = require("../../services/userStatsService");
                const stats = getUserStats(userId);
                if (stats && stats.username) {
                    const username = stats.username.toLowerCase();
                    if (knownBotNames.some(botName => username.includes(botName))) {
                        botIds.add(userId);
                    }
                }
            }
        } catch (error) {
            // Ignorer les erreurs de fetch
        }
    }

    // S'assurer que Netricsa (le bot actuel) est toujours exclu
    if (interaction.client.user) {
        botIds.add(interaction.client.user.id);
    }

    return botIds;
}

/**
 * Calcule la largeur visuelle approximative d'une chaîne en monospace
 * Certains caractères prennent plus d'espace que d'autres
 */
function getVisualWidth(str: string): number {
    let width = 0;
    for (const char of str) {
        const code = char.codePointAt(0)!;
        // Caractères CJK (chinois, japonais, coréen) = 2 largeurs
        if ((code >= 0x4E00 && code <= 0x9FFF) ||
            (code >= 0x3040 && code <= 0x30FF) ||
            (code >= 0xAC00 && code <= 0xD7AF)) {
            width += 2;
        }
        // Caractères de contrôle = 0 largeur
        else if (code < 0x20 || (code >= 0x7F && code < 0xA0)) {
            width += 0;
        }
        // Caractères normaux = 1 largeur
        else {
            width += 1;
        }
    }
    return width;
}

/**
 * Tronque et pad une chaîne à une largeur visuelle spécifique
 */
function padToVisualWidth(str: string, targetWidth: number): string {
    const currentWidth = getVisualWidth(str);

    if (currentWidth > targetWidth) {
        // Tronquer si trop long
        let result = '';
        let width = 0;
        for (const char of str) {
            const charWidth = getVisualWidth(char);
            if (width + charWidth > targetWidth) {
                break;
            }
            result += char;
            width += charWidth;
        }
        return result;
    } else if (currentWidth < targetWidth) {
        // Ajouter des espaces si trop court
        return str + ' '.repeat(targetWidth - currentWidth);
    }

    return str;
}

/**
 * Normalise un nom pour l'affichage en monospace
 * Remplace les caractères Unicode spéciaux par des équivalents ASCII
 */
function normalizeDisplayName(name: string): string {
    // Normaliser les accents d'abord (é -> e, à -> a, etc.)
    let normalized = name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        // Caractères Unicode stylisés (Mathematical Alphanumeric Symbols)
        .replace(/[\u{1D400}-\u{1D7FF}]/gu, (char) => {
            const code = char.codePointAt(0)!;

            // Bold Uppercase (𝐀-𝐙)
            if (code >= 0x1D400 && code <= 0x1D419) {
                return String.fromCharCode(0x41 + (code - 0x1D400));
            }
            // Bold Lowercase (𝐚-𝐳)
            if (code >= 0x1D41A && code <= 0x1D433) {
                return String.fromCharCode(0x61 + (code - 0x1D41A));
            }
            // Italic Uppercase (𝐴-𝑍)
            if (code >= 0x1D434 && code <= 0x1D44D) {
                return String.fromCharCode(0x41 + (code - 0x1D434));
            }
            // Italic Lowercase (𝑎-𝑧)
            if (code >= 0x1D44E && code <= 0x1D467) {
                return String.fromCharCode(0x61 + (code - 0x1D44E));
            }
            // Bold Italic Uppercase (𝑨-𝒁)
            if (code >= 0x1D468 && code <= 0x1D481) {
                return String.fromCharCode(0x41 + (code - 0x1D468));
            }
            // Bold Italic Lowercase (𝒂-𝒛)
            if (code >= 0x1D482 && code <= 0x1D49B) {
                return String.fromCharCode(0x61 + (code - 0x1D482));
            }
            // Bold digits (𝟎-𝟗)
            if (code >= 0x1D7CE && code <= 0x1D7D7) {
                return String.fromCharCode(0x30 + (code - 0x1D7CE));
            }
            // Autres variantes Unicode - essayer de trouver l'équivalent ASCII
            // Retourner le caractère tel quel s'il n'est pas reconnu (sera traité par la suite)
            return char;
        })
        // Convertir les caractères accentués en leur base (é -> e, à -> a, etc.)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        // Supprimer les emojis
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        // Espaces multiples -> un seul
        .replace(/\s+/g, ' ')
        .trim();

    // Si après normalisation c'est vide, retourner un placeholder
    return normalized || "User";
}

/**
 * Crée l'embed du leaderboard pour une catégorie donnée
 */
async function createLeaderboardEmbed(
    category: LeaderboardCategory,
    mode: LeaderboardMode,
    interaction: ChatInputCommandInteraction
): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTimestamp();

    let description = "";
    let title = "";

    // Obtenir le mois actuel pour l'affichage
    const now = new Date();
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const currentMonthName = monthNames[now.getMonth()];

    let modeText = "";
    if (mode === "daily") {
        modeText = `📅 Quotidien (Aujourd'hui)`;
    } else if (mode === "weekly") {
        modeText = `📅 Hebdomadaire (Cette semaine)`;
    } else if (mode === "monthly") {
        modeText = `📅 Mensuel (${currentMonthName} ${now.getFullYear()})`;
    } else {
        modeText = "📊 Tout le temps";
    }

    // Récupérer tous les userIds pour filtrer les bots
    let allUserIds: string[] = [];

    switch (category) {
        case "xp": {
            title = `🏆 Classement XP - ${modeText}`;

            let sortedXP: any[] = [];

            if (mode === "daily") {
                // XP quotidien (aujourd'hui)
                const today = getCurrentDate();
                const dailyData = getDailyXP(today);
                sortedXP = Object.entries(dailyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        xpGained: data.xpGained,
                        voiceMinutes: data.voiceMinutes || 0
                    }))
                    .sort((a, b) => b.xpGained - a.xpGained);
                allUserIds = sortedXP.map(d => d.userId);
            } else if (mode === "weekly") {
                // XP hebdomadaire (cette semaine)
                const week = getCurrentWeek();
                const weeklyData = getWeeklyXP(week);
                sortedXP = Object.entries(weeklyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        xpGained: data.xpGained,
                        voiceMinutes: data.voiceMinutes || 0
                    }))
                    .sort((a, b) => b.xpGained - a.xpGained);
                allUserIds = sortedXP.map(d => d.userId);
            } else if (mode === "monthly") {
                // XP mensuel (mois en cours)
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const monthlyData = getMonthlyXP(currentMonth);
                sortedXP = Object.entries(monthlyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        xpGained: data.xpGained
                    }))
                    .sort((a, b) => b.xpGained - a.xpGained);
                allUserIds = sortedXP.map(d => d.userId);
            } else {
                // XP all-time
                const allXP = getAllXP();
                sortedXP = Object.values(allXP)
                    .sort((a, b) => b.totalXP - a.totalXP);
                allUserIds = sortedXP.map(d => d.userId);
            }

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedXP = sortedXP.filter(d => !botIds.has(d.userId)).slice(0, 10);

            if (sortedXP.length === 0) {
                description = "*Aucune donnée XP disponible.*";
            } else {
                description += "```\n";
                for (let index = 0; index < sortedXP.length; index++) {
                    const data = sortedXP[index];
                    const displayName = await getDisplayName(interaction, data.userId, data.username);
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

                    if (mode === "daily" || mode === "weekly") {
                        const xpStr = data.xpGained.toLocaleString().padStart(6);
                        const voiceStr = data.voiceMinutes > 0 ? `🎤${data.voiceMinutes}min` : "";
                        description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 16)} ${xpStr} XP ${voiceStr}\n`;
                    } else if (mode === "monthly") {
                        const xpStr = data.xpGained.toLocaleString().padStart(8);
                        description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 20)} ${xpStr} XP\n`;
                    } else {
                        const xpStr = data.totalXP.toLocaleString().padStart(8);
                        const levelStr = `Niv.${data.level}`.padStart(7);
                        description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 16)} ${levelStr} ${xpStr} XP\n`;
                    }
                }
                description += "```";
            }
            break;
        }

        case "messages": {
            title = `📨 Classement Messages - ${modeText}`;

            let sortedStats: any[] = [];

            if (mode === "daily") {
                // Messages quotidiens - utiliser daily_stats.json
                const today = getCurrentDate();
                const allStats = require("../../services/dailyStatsService").loadDailyStats?.() || {};
                const dailyData = allStats[today] || {};
                sortedStats = Object.entries(dailyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        messagesEnvoyes: data.messagesEnvoyes || 0
                    }))
                    .filter(d => d.messagesEnvoyes > 0);
                allUserIds = sortedStats.map(d => d.userId);
            } else if (mode === "weekly") {
                // Messages hebdomadaires - utiliser weekly_stats.json
                const week = getCurrentWeek();
                const weeklyData = getWeeklyStatsForWeek(week);
                sortedStats = Object.entries(weeklyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        messagesEnvoyes: data.messagesEnvoyes || 0
                    }))
                    .filter(d => d.messagesEnvoyes > 0);
                allUserIds = sortedStats.map(d => d.userId);
            } else {
                // Messages all-time ou monthly - utiliser getAllStats
                const allStats = getAllStats();
                sortedStats = Object.values(allStats).map((s: any) => ({
                    userId: s.userId,
                    username: s.username,
                    messagesEnvoyes: s.discord.messagesEnvoyes
                }));
                allUserIds = sortedStats.map((s: any) => s.userId);
            }

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedStats = sortedStats
                .filter((s: any) => !botIds.has(s.userId))
                .sort((a: any, b: any) => b.messagesEnvoyes - a.messagesEnvoyes)
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "*Aucune donnée disponible.*";
            } else {
                description += "```\n";
                for (let index = 0; index < sortedStats.length; index++) {
                    const data = sortedStats[index] as any;
                    const displayName = await getDisplayName(interaction, data.userId, data.username);
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const msgStr = data.messagesEnvoyes.toLocaleString().padStart(8);
                    description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 20)} ${msgStr} msg\n`;
                }
                description += "```";
            }
            break;
        }

        case "vocal": {
            title = `🎤 Classement Vocal - ${modeText}`;

            let sortedStats: any[] = [];

            if (mode === "daily") {
                // Vocal quotidien - utiliser les données de daily_xp.json
                const today = getCurrentDate();
                const dailyData = getDailyXP(today);
                sortedStats = Object.entries(dailyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        voiceMinutes: data.voiceMinutes || 0
                    }))
                    .filter(d => d.voiceMinutes > 0)
                    .sort((a, b) => b.voiceMinutes - a.voiceMinutes);
                allUserIds = sortedStats.map(d => d.userId);
            } else if (mode === "weekly") {
                // Vocal hebdomadaire - utiliser les données de weekly_xp.json
                const week = getCurrentWeek();
                const weeklyData = getWeeklyXP(week);
                sortedStats = Object.entries(weeklyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        voiceMinutes: data.voiceMinutes || 0
                    }))
                    .filter(d => d.voiceMinutes > 0)
                    .sort((a, b) => b.voiceMinutes - a.voiceMinutes);
                allUserIds = sortedStats.map(d => d.userId);
            } else {
                // Vocal all-time ou monthly - utiliser getAllStats
                const allStats = getAllStats();
                sortedStats = Object.values(allStats)
                    .map((s: any) => ({
                        userId: s.userId,
                        username: s.username,
                        voiceMinutes: s.discord.tempsVocalMinutes
                    }))
                    .filter((s: any) => s.voiceMinutes > 0);
                allUserIds = sortedStats.map((s: any) => s.userId);
            }

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedStats = sortedStats
                .filter((s: any) => !botIds.has(s.userId))
                .sort((a: any, b: any) => b.voiceMinutes - a.voiceMinutes)
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "*Aucune donnée disponible.*";
            } else {
                description += "```\n";
                for (let index = 0; index < sortedStats.length; index++) {
                    const data = sortedStats[index] as any;
                    const displayName = await getDisplayName(interaction, data.userId, data.username);
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const hours = Math.floor(data.voiceMinutes / 60);
                    const mins = data.voiceMinutes % 60;
                    const timeStr = `${hours}h${mins.toString().padStart(2, '0')}`.padStart(8);
                    description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 20)} ${timeStr}\n`;
                }
                description += "```";
            }
            break;
        }

        case "images": {
            title = `🎨 Classement Images - ${modeText}`;

            let sortedStats: any[] = [];

            if (mode === "daily") {
                // Images quotidiennes - utiliser daily_stats.json
                const today = getCurrentDate();
                const allStats = require("../../services/dailyStatsService").loadDailyStats?.() || {};
                const dailyData = allStats[today] || {};
                sortedStats = Object.entries(dailyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        totalImages: data.imagesGenerees || 0
                    }))
                    .filter(d => d.totalImages > 0);
                allUserIds = sortedStats.map(d => d.userId);
            } else if (mode === "weekly") {
                // Images hebdomadaires - utiliser weekly_stats.json
                const week = getCurrentWeek();
                const weeklyData = getWeeklyStatsForWeek(week);
                sortedStats = Object.entries(weeklyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        totalImages: data.imagesGenerees || 0
                    }))
                    .filter(d => d.totalImages > 0);
                allUserIds = sortedStats.map(d => d.userId);
            } else {
                // Images all-time ou monthly - utiliser getAllStats
                const allStats = getAllStats();
                sortedStats = Object.values(allStats)
                    .map((s: any) => ({
                        userId: s.userId,
                        username: s.username,
                        totalImages: s.netricsa.imagesGenerees + s.netricsa.imagesReimaginee
                    }))
                    .filter((s: any) => s.totalImages > 0);
                allUserIds = sortedStats.map((s: any) => s.userId);
            }

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedStats = sortedStats
                .filter((s: any) => !botIds.has(s.userId))
                .sort((a: any, b: any) => b.totalImages - a.totalImages)
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "*Aucune donnée disponible.*";
            } else {
                description += "```\n";
                for (let index = 0; index < sortedStats.length; index++) {
                    const data = sortedStats[index] as any;
                    const displayName = await getDisplayName(interaction, data.userId, data.username);
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const imgStr = data.totalImages.toString().padStart(6);
                    description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 20)} ${imgStr} img\n`;
                }
                description += "```";
            }
            break;
        }

        case "jeux": {
            title = `🎮 Classement Jeux - ${modeText}`;

            let sortedStats: any[] = [];

            if (mode === "daily") {
                // Jeux quotidiens - utiliser daily_stats.json
                const today = getCurrentDate();
                const allStats = require("../../services/dailyStatsService").loadDailyStats?.() || {};
                const dailyData = allStats[today] || {};
                sortedStats = Object.entries(dailyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        gamesPlayed: data.gamesPlayed || 0,
                        gamesWon: data.gamesWon || 0
                    }))
                    .filter(d => d.gamesPlayed > 0);
                allUserIds = sortedStats.map(d => d.userId);
            } else if (mode === "weekly") {
                // Jeux hebdomadaires - utiliser weekly_stats.json
                const week = getCurrentWeek();
                const weeklyData = getWeeklyStatsForWeek(week);
                sortedStats = Object.entries(weeklyData)
                    .map(([userId, data]: [string, any]) => ({
                        userId,
                        username: data.username,
                        gamesPlayed: data.gamesPlayed || 0,
                        gamesWon: data.gamesWon || 0
                    }))
                    .filter(d => d.gamesPlayed > 0);
                allUserIds = sortedStats.map(d => d.userId);
            } else {
                // Jeux all-time ou monthly - utiliser getGlobalLeaderboard
                let leaderboard = getGlobalLeaderboard(50);
                sortedStats = leaderboard.map(e => ({
                    userId: e.userId,
                    username: e.username,
                    gamesPlayed: e.wins + e.losses + e.draws,
                    gamesWon: e.wins
                }));
                allUserIds = sortedStats.map(e => e.userId);
            }

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedStats = sortedStats
                .filter(e => !botIds.has(e.userId))
                .sort((a, b) => {
                    // Trier par taux de victoire
                    const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
                    const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
                    return bRate - aRate;
                })
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "*Aucune donnée de jeux disponible.*";
            } else {
                description += "```\n";
                for (let index = 0; index < sortedStats.length; index++) {
                    const entry = sortedStats[index];
                    const displayName = await getDisplayName(interaction, entry.userId, entry.username);
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const winRate = entry.gamesPlayed > 0 ? ((entry.gamesWon / entry.gamesPlayed) * 100).toFixed(0) : "0";
                    const statsStr = `${winRate}% (${entry.gamesWon}V/${entry.gamesPlayed}P)`.padStart(16);
                    description += `${rankEmoji.padEnd(4)} ${padToVisualWidth(displayName, 16)} ${statsStr}\n`;
                }
                description += "```";
            }
            break;
        }
    }

    embed.setTitle(title);
    embed.setDescription(description || "*Aucune donnée disponible.*");
    embed.setFooter({text: mode === "monthly" ? `Stats de ${currentMonthName} ${now.getFullYear()}` : "Stats depuis le 5 février 2026"});

    return embed;
}

/**
 * Crée les boutons de navigation pour le leaderboard
 */
function createLeaderboardButtons(currentCategory: LeaderboardCategory, currentMode: LeaderboardMode): ActionRowBuilder<ButtonBuilder>[] {
    const categoryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("leaderboard_xp")
            .setLabel("XP")
            .setEmoji("🏆")
            .setStyle(currentCategory === "xp" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "xp"),
        new ButtonBuilder()
            .setCustomId("leaderboard_messages")
            .setLabel("Messages")
            .setEmoji("📨")
            .setStyle(currentCategory === "messages" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "messages"),
        new ButtonBuilder()
            .setCustomId("leaderboard_vocal")
            .setLabel("Vocal")
            .setEmoji("🎤")
            .setStyle(currentCategory === "vocal" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "vocal"),
        new ButtonBuilder()
            .setCustomId("leaderboard_images")
            .setLabel("Images")
            .setEmoji("🎨")
            .setStyle(currentCategory === "images" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "images"),
        new ButtonBuilder()
            .setCustomId("leaderboard_jeux")
            .setLabel("Jeux")
            .setEmoji("🎮")
            .setStyle(currentCategory === "jeux" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(currentCategory === "jeux")
    );

    const modeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("leaderboard_mode_alltime")
            .setLabel("Tout le temps")
            .setEmoji("📊")
            .setStyle(currentMode === "alltime" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentMode === "alltime"),
        new ButtonBuilder()
            .setCustomId("leaderboard_mode_monthly")
            .setLabel("Ce mois-ci")
            .setEmoji("📅")
            .setStyle(currentMode === "monthly" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentMode === "monthly"),
        new ButtonBuilder()
            .setCustomId("leaderboard_mode_weekly")
            .setLabel("Cette semaine")
            .setEmoji("📅")
            .setStyle(currentMode === "weekly" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentMode === "weekly"),
        new ButtonBuilder()
            .setCustomId("leaderboard_mode_daily")
            .setLabel("Aujourd'hui")
            .setEmoji("📆")
            .setStyle(currentMode === "daily" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentMode === "daily")
    );

    return [categoryRow, modeRow];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("🏆 Affiche le classement des utilisateurs"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply({flags: MessageFlags.Ephemeral});

            let currentCategory: LeaderboardCategory = "xp";
            let currentMode: LeaderboardMode = "alltime";

            // Créer l'embed initial
            let embed = await createLeaderboardEmbed(currentCategory, currentMode, interaction);
            const buttons = createLeaderboardButtons(currentCategory, currentMode);

            const message = await interaction.editReply({
                embeds: [embed],
                components: buttons
            });

            // Créer un collector pour les boutons
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: "❌ Ces boutons ne sont pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await buttonInteraction.deferUpdate();

                const buttonId = buttonInteraction.customId;

                if (buttonId.startsWith("leaderboard_mode_")) {
                    currentMode = buttonId.replace("leaderboard_mode_", "") as LeaderboardMode;
                } else if (buttonId.startsWith("leaderboard_")) {
                    currentCategory = buttonId.replace("leaderboard_", "") as LeaderboardCategory;
                }

                embed = await createLeaderboardEmbed(currentCategory, currentMode, interaction);
                const newButtons = createLeaderboardButtons(currentCategory, currentMode);

                await buttonInteraction.editReply({
                    embeds: [embed],
                    components: newButtons
                });
            });

            collector.on("end", async () => {
                try {
                    // Désactiver tous les boutons après expiration
                    const disabledCategoryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId("leaderboard_xp")
                            .setLabel("XP")
                            .setEmoji("🏆")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_messages")
                            .setLabel("Messages")
                            .setEmoji("📨")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_vocal")
                            .setLabel("Vocal")
                            .setEmoji("🎤")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_images")
                            .setLabel("Images")
                            .setEmoji("🎨")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_jeux")
                            .setLabel("Jeux")
                            .setEmoji("🎮")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );

                    const disabledModeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId("leaderboard_mode_alltime")
                            .setLabel("All-Time")
                            .setEmoji("📊")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_mode_monthly")
                            .setLabel("Mensuel")
                            .setEmoji("📅")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    await interaction.editReply({
                        components: [disabledCategoryRow, disabledModeRow]
                    });
                } catch (error) {
                    // Ignorer les erreurs si le message a été supprimé
                }
            });
        } catch (error) {
            console.error("[Leaderboard] Error:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("❌ Erreur")
                .setDescription("Une erreur s'est produite lors de l'affichage du leaderboard.");

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({embeds: [errorEmbed], components: []});
            } else {
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            }
        }
    }
};


