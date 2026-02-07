import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
import {getAllXP} from "../../services/xpSystem";
import {getAllStats} from "../../services/userStatsService";
import {getGlobalLeaderboard} from "../../games/common/globalStats";
import {getYearlyXP} from "../../services/yearlyXPService";

type LeaderboardCategory = "xp" | "messages" | "vocal" | "images" | "jeux";
type LeaderboardMode = "alltime" | "monthly";

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
 * Filtre les bots de la liste (incluant Netricsa)
 */
async function filterBots(interaction: ChatInputCommandInteraction, userIds: string[]): Promise<Set<string>> {
    const botIds = new Set<string>();
    if (!interaction.guild) return botIds;

    for (const userId of userIds) {
        try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member?.user.bot) {
                botIds.add(userId);
            }
        } catch {
            // Ignorer les erreurs
        }
    }

    // S'assurer que Netricsa (le bot actuel) est toujours exclu
    if (interaction.client.user) {
        botIds.add(interaction.client.user.id);
    }

    return botIds;
}

/**
 * Normalise un nom pour l'affichage en monospace
 * Remplace les caractères Unicode spéciaux par des équivalents ASCII
 */
function normalizeDisplayName(name: string): string {
    // Supprimer les emojis et autres caractères spéciaux qui cassent l'alignement
    let normalized = name
        // Caractères Unicode stylisés (bold, italic, etc.) -> ASCII
        .replace(/[\u{1D400}-\u{1D7FF}]/gu, (char) => {
            const code = char.codePointAt(0)!;
            // Mathematical Alphanumeric Symbols
            if (code >= 0x1D400 && code <= 0x1D433) {
                // Bold A-Z, a-z
                return String.fromCharCode(0x41 + ((code - 0x1D400) % 26));
            }
            if (code >= 0x1D434 && code <= 0x1D467) {
                return String.fromCharCode(0x61 + ((code - 0x1D434) % 26));
            }
            if (code >= 0x1D7CE && code <= 0x1D7D7) {
                // Bold digits 0-9
                return String.fromCharCode(0x30 + (code - 0x1D7CE));
            }
            return char;
        })
        // Supprimer les emojis (Basic emoticons et extended)
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        // Caractères de combinaison
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
    const modeText = mode === "monthly" ? "📅 Mensuel (Février 2026)" : "📊 All-Time";

    // Récupérer tous les userIds pour filtrer les bots
    let allUserIds: string[] = [];

    switch (category) {
        case "xp": {
            title = `🏆 Classement XP - ${modeText}`;

            let sortedXP: any[] = [];

            if (mode === "monthly") {
                // XP mensuel (année en cours)
                const yearlyData = getYearlyXP("2026");
                sortedXP = Object.entries(yearlyData)
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

                    if (mode === "monthly") {
                        const xpStr = data.xpGained.toLocaleString().padStart(8);
                        description += `${rankEmoji.padEnd(4)} ${displayName.padEnd(20).substring(0, 20)} ${xpStr} XP\n`;
                    } else {
                        const xpStr = data.totalXP.toLocaleString().padStart(8);
                        const levelStr = `Niv.${data.level}`.padStart(7);
                        description += `${rankEmoji.padEnd(4)} ${displayName.padEnd(16).substring(0, 16)} ${levelStr} ${xpStr} XP\n`;
                    }
                }
                description += "```";
            }
            break;
        }

        case "messages": {
            title = `📨 Classement Messages - ${modeText}`;
            const allStats = getAllStats();
            let sortedStats = Object.values(allStats);
            allUserIds = sortedStats.map((s: any) => s.userId);

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedStats = sortedStats
                .filter((s: any) => !botIds.has(s.userId))
                .sort((a: any, b: any) => b.discord.messagesEnvoyes - a.discord.messagesEnvoyes)
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
                    const msgStr = data.discord.messagesEnvoyes.toLocaleString().padStart(8);
                    description += `${rankEmoji.padEnd(4)} ${displayName.padEnd(20).substring(0, 20)} ${msgStr} msg\n`;
                }
                description += "```";
            }
            break;
        }

        case "vocal": {
            title = `🎤 Classement Vocal - ${modeText}`;
            const allStats = getAllStats();
            let sortedStats = Object.values(allStats)
                .filter((s: any) => s.discord.tempsVocalMinutes > 0);
            allUserIds = sortedStats.map((s: any) => s.userId);

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            sortedStats = sortedStats
                .filter((s: any) => !botIds.has(s.userId))
                .sort((a: any, b: any) => b.discord.tempsVocalMinutes - a.discord.tempsVocalMinutes)
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
                    const hours = Math.floor(data.discord.tempsVocalMinutes / 60);
                    const mins = data.discord.tempsVocalMinutes % 60;
                    const timeStr = `${hours}h${mins.toString().padStart(2, '0')}`.padStart(8);
                    description += `${rankEmoji.padEnd(4)} ${displayName.padEnd(20).substring(0, 20)} ${timeStr}\n`;
                }
                description += "```";
            }
            break;
        }

        case "images": {
            title = `🎨 Classement Images - ${modeText}`;
            const allStats = getAllStats();
            let sortedStats = Object.values(allStats)
                .map((s: any) => ({
                    ...s,
                    totalImages: s.netricsa.imagesGenerees + s.netricsa.imagesReimaginee
                }))
                .filter((s: any) => s.totalImages > 0);
            allUserIds = sortedStats.map((s: any) => s.userId);

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
                    description += `${rankEmoji.padEnd(4)} ${displayName.padEnd(20).substring(0, 20)} ${imgStr} img\n`;
                }
                description += "```";
            }
            break;
        }

        case "jeux": {
            title = `🎮 Classement Jeux - ${modeText}`;
            let leaderboard = getGlobalLeaderboard(50); // Récupérer plus pour filtrer les bots
            allUserIds = leaderboard.map(e => e.userId);

            // Filtrer les bots
            const botIds = await filterBots(interaction, allUserIds);
            leaderboard = leaderboard
                .filter(e => !botIds.has(e.userId))
                .slice(0, 10);

            if (leaderboard.length === 0) {
                description = "*Aucune donnée de jeux disponible.*";
            } else {
                description += "```\n";
                for (let index = 0; index < leaderboard.length; index++) {
                    const entry = leaderboard[index];
                    const displayName = await getDisplayName(interaction, entry.userId, entry.username);
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const totalGames = entry.wins + entry.losses + entry.draws;
                    const winRate = ((entry.wins / totalGames) * 100).toFixed(0);
                    const statsStr = `${winRate}% (${entry.wins}V/${totalGames}P)`.padStart(16);
                    description += `${rankEmoji.padEnd(4)} ${displayName.padEnd(16).substring(0, 16)} ${statsStr}\n`;
                }
                description += "```";
            }
            break;
        }
    }

    embed.setTitle(title);
    embed.setDescription(description || "*Aucune donnée disponible.*");
    embed.setFooter({text: mode === "monthly" ? "Stats depuis février 2026" : "Stats depuis le 5 février 2026"});

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
            .setLabel("All-Time")
            .setEmoji("📊")
            .setStyle(currentMode === "alltime" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentMode === "alltime"),
        new ButtonBuilder()
            .setCustomId("leaderboard_mode_monthly")
            .setLabel("Mensuel")
            .setEmoji("📅")
            .setStyle(currentMode === "monthly" ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(currentMode === "monthly")
    );

    return [categoryRow, modeRow];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Affiche le classement des utilisateurs"),

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


