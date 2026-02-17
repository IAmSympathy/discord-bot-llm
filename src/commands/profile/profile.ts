import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {updateUserActivityFromPresence} from "../../services/activityService";
import {createDetailedGameStatsEmbed, createDiscordStatsEmbed, createFunStatsEmbed, createGameSelectMenu, createNetricsaStatsEmbed, createProfileEmbed, createServerStatsEmbed, createStatsNavigationButtons, StatsCategory} from "../../utils/statsEmbedBuilder";
import {AchievementCategory} from "../../services/achievementService";

const CATEGORY_EMOJIS: Partial<{ [key in AchievementCategory]: string }> = {
    [AchievementCategory.PROFIL]: "📋",
    [AchievementCategory.NETRICSA]: "<:zzzRole_NetricsaModule:1466997072564584631>",
    [AchievementCategory.DISCORD]: "💬",
    [AchievementCategory.JEUX]: "🎮",
    [AchievementCategory.FUN]: "🎪"
};

const CATEGORY_NAMES: Partial<{ [key in AchievementCategory]: string }> = {
    [AchievementCategory.PROFIL]: "Profil",
    [AchievementCategory.NETRICSA]: "Netricsa",
    [AchievementCategory.DISCORD]: "Discord",
    [AchievementCategory.JEUX]: "Jeux",
    [AchievementCategory.FUN]: "Fun"
};

/**
 * Crée l'embed des achievements avec pagination pour toutes les catégories
 */
function createAchievementEmbed(targetUser: any, category: AchievementCategory, page: number = 0, viewerId?: string): any {
    const {EmbedBuilder} = require("discord.js");
    const {getAchievementsByCategory, getAchievementStats, getCompletionPercentage} = require("../../services/achievementService");

    const achievements = getAchievementsByCategory(targetUser.id, targetUser.username, category);
    const stats = getAchievementStats(targetUser.id);
    const completion = getCompletionPercentage(targetUser.id);

    const categoryStats = stats[category];
    const categoryName = CATEGORY_NAMES[category];

    // Vérifier si on regarde le profil de quelqu'un d'autre
    const isViewingOtherProfile = viewerId && viewerId !== targetUser.id;

    // Pagination pour toutes les catégories si > 5 achievements
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(achievements.length / ITEMS_PER_PAGE);

    // S'assurer que la page est valide
    page = Math.max(0, Math.min(page, totalPages - 1));

    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedAchievements = achievements.slice(startIndex, endIndex);

    const footerText = totalPages > 1
        ? `Page ${page + 1}/${totalPages} | Complétion globale: ${completion}% | ${categoryStats.unlocked}/${categoryStats.total} dans cette catégorie`
        : `Complétion globale: ${completion}% | ${categoryStats.unlocked}/${categoryStats.total} dans cette catégorie`;

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🏆 Succès ${categoryName} - ${targetUser.displayName}`)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setFooter({text: footerText})
        .setTimestamp();

    if (achievements.length === 0) {
        embed.setDescription("Aucun succès dans cette catégorie pour le moment.");
        return embed;
    }

    let description = "";

    for (const {achievement, unlocked, unlockedAt} of paginatedAchievements) {
        // Si débloqué : emoji du succès, sinon : 🔒
        const displayEmoji = unlocked ? achievement.emoji : "🔒";

        // Si c'est un succès secret
        if (achievement.secret) {
            // Masquer la description si : pas débloqué OU on regarde le profil de quelqu'un d'autre
            if (!unlocked || isViewingOtherProfile) {
                description += `**${displayEmoji} ${achievement.name}**\n`;
                description += `*Succès secret - Débloquez-le pour voir la description*\n\n`;
            } else {
                // Secret débloqué ET on regarde son propre profil - afficher la description
                description += `**${displayEmoji} ${achievement.name}**\n`;
                description += `${achievement.description}\n`;

                if (unlockedAt) {
                    const date = new Date(unlockedAt);
                    description += `*✅ Débloqué le ${date.toLocaleDateString("fr-FR")}*\n`;
                }

                description += `\n`;
            }
        } else {
            // Succès non-secret normal
            description += `**${displayEmoji} ${achievement.name}**\n`;
            description += `${achievement.description}\n`;

            if (unlocked && unlockedAt) {
                const date = new Date(unlockedAt);
                description += `*✅ Débloqué le ${date.toLocaleDateString("fr-FR")}*\n`;
            }

            description += `\n`;
        }
    }

    embed.setDescription(description || "Aucun succès dans cette catégorie.");
    return embed;
}

/**
 * Crée les boutons de pagination pour les achievements Netricsa
 */
function createPaginationButtons(currentPage: number, totalPages: number, userId: string): ActionRowBuilder<ButtonBuilder> | null {
    if (totalPages <= 1) return null;

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`achievement_page_prev_${userId}`)
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`achievement_page_next_${userId}`)
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
}

/**
 * Crée les boutons de navigation des achievements
 */
function createAchievementNavigationButtons(currentCategory: AchievementCategory, userId: string): ActionRowBuilder<ButtonBuilder>[] {
    const categories = [
        AchievementCategory.PROFIL,
        AchievementCategory.NETRICSA,
        AchievementCategory.DISCORD,
        AchievementCategory.JEUX,
        AchievementCategory.FUN
    ];
    const buttons: ButtonBuilder[] = [];

    categories.forEach((category) => {
        const emoji = CATEGORY_EMOJIS[category];
        const name = CATEGORY_NAMES[category];
        if (!emoji || !name) return; // Skip si emoji ou nom non défini

        const isCurrentCategory = category === currentCategory;

        const button = new ButtonBuilder()
            .setCustomId(`achievements_${category}_${userId}`)
            .setLabel(name)
            .setEmoji(emoji)
            .setStyle(isCurrentCategory ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(isCurrentCategory);

        buttons.push(button);
    });

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("👤 Affiche le profil d'un utilisateur")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("L'utilisateur dont afficher le profil")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;

            // Mettre à jour l'activité et les rôles
            await updateUserActivityFromPresence(interaction.client, targetUser.id);

            if (interaction.guild) {
                try {
                    const member = await interaction.guild.members.fetch(targetUser.id);
                    if (member) {
                        const userRoles = member.roles.cache
                            .filter(role => role.name !== "@everyone")
                            .map(role => role.name);

                        if (userRoles.length > 0) {
                            await UserProfileService.updateRoles(targetUser.id, targetUser.username, userRoles);
                        }
                    }
                } catch (error) {
                    console.log(`[Profile] Could not fetch member roles for ${targetUser.username}`);
                }
            }

            // État de navigation (même logique que context menu)
            type ViewType = "profile" | "stats" | "achievements";
            let currentView: ViewType = "profile";
            let currentStatsCategory: StatsCategory = "discord";
            let currentAchievementCategory: AchievementCategory = AchievementCategory.PROFIL;
            let currentAchievementPage: number = 0;
            let currentGameType = "global";

            // Créer l'embed initial du profil
            const profileEmbed = createProfileEmbed(targetUser, interaction.guild);

            // Boutons principaux du profil (identiques au context menu)
            const profileButtonsArray = [
                new ButtonBuilder()
                    .setCustomId(`view_stats_${targetUser.id}`)
                    .setLabel("📊 Statistiques")
                    .setStyle(ButtonStyle.Primary)
            ];

            // N'ajouter le bouton achievements que si ce n'est pas un bot
            if (!targetUser.bot) {
                profileButtonsArray.push(
                    new ButtonBuilder()
                        .setCustomId(`view_inventory_${targetUser.id}`)
                        .setLabel("🎒 Inventaire")
                        .setStyle(ButtonStyle.Primary)
                );
                profileButtonsArray.push(
                    new ButtonBuilder()
                        .setCustomId(`view_achievements_${targetUser.id}`)
                        .setLabel("🏆 Succès")
                        .setStyle(ButtonStyle.Primary)
                );
            }

            const profileButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(...profileButtonsArray);

            const message = await interaction.editReply({
                embeds: [profileEmbed],
                components: [profileButtons]
            });

            // Collector unique pour tout (même logique que context menu)
            const collector = message.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });

            collector.on("collect", async (i: any) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: "❌ Ce bouton n'est pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                try {
                    const customId = i.customId;

                    // === NAVIGATION PRINCIPALE ===
                    if (customId.startsWith("view_stats_")) {
                        await i.deferUpdate();
                        currentView = "stats";
                        currentStatsCategory = "discord";
                        const embed = createDiscordStatsEmbed(targetUser, i.guild);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [...navButtons, backButton]});
                    } else if (customId.startsWith("view_achievements_")) {
                        await i.deferUpdate();
                        currentView = "achievements";
                        currentAchievementCategory = AchievementCategory.PROFIL;
                        currentAchievementPage = 0;
                        const embed = createAchievementEmbed(targetUser, currentAchievementCategory, currentAchievementPage, interaction.user.id);
                        const navButtons = createAchievementNavigationButtons(currentAchievementCategory, targetUser.id);

                        // Ajouter la pagination si nécessaire (> 5 achievements)
                        const {getAchievementsByCategory} = require("../../services/achievementService");
                        const achievements = getAchievementsByCategory(targetUser.id, targetUser.username, currentAchievementCategory);
                        const totalPages = Math.ceil(achievements.length / 5);
                        const paginationButtons = createPaginationButtons(currentAchievementPage, totalPages, targetUser.id);

                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );

                        const components = paginationButtons
                            ? [paginationButtons, ...navButtons, backButton]
                            : [...navButtons, backButton];

                        await interaction.editReply({embeds: [embed], components});
                    } else if (customId.startsWith("view_inventory_")) {
                        await i.deferUpdate();
                        currentView = "stats"; // Réutiliser le type stats
                        const {createInventoryEmbed} = require("../../utils/statsEmbedBuilder");
                        const embed = createInventoryEmbed(targetUser, i.guild);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [backButton]});
                    } else if (customId.startsWith("back_to_profile_")) {
                        await i.deferUpdate();
                        currentView = "profile";
                        const embed = createProfileEmbed(targetUser, i.guild);
                        await interaction.editReply({embeds: [embed], components: [profileButtons]});
                    }

                    // === NAVIGATION STATS ===
                    else if (customId === "stats_discord") {
                        await i.deferUpdate();
                        currentStatsCategory = "discord";
                        const embed = createDiscordStatsEmbed(targetUser, i.guild);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [...navButtons, backButton]});
                    } else if (customId === "stats_netricsa") {
                        await i.deferUpdate();
                        currentStatsCategory = "netricsa";
                        const embed = createNetricsaStatsEmbed(targetUser, i.guild);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [...navButtons, backButton]});
                    } else if (customId === "stats_jeux") {
                        await i.deferUpdate();
                        currentStatsCategory = "jeux";
                        currentGameType = "global";
                        const embed = createDetailedGameStatsEmbed(targetUser, currentGameType, i.guild);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const gameMenu = createGameSelectMenu();
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [...navButtons, gameMenu, backButton]});
                    } else if (customId === "stats_fun") {
                        await i.deferUpdate();
                        currentStatsCategory = "fun";
                        const embed = createFunStatsEmbed(targetUser, i.guild);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [...navButtons, backButton]});
                    } else if (customId === "stats_serveur") {
                        await i.deferUpdate();
                        currentStatsCategory = "serveur";
                        const embed = await createServerStatsEmbed(i.guild, i.client);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await interaction.editReply({embeds: [embed], components: [...navButtons, backButton]});
                    }
                        // [DÉSACTIVÉ] Bouton saisonnier retiré car événement terminé
                        // else if (customId === "stats_seasonal") {
                        //     await i.deferUpdate();
                        //     currentStatsCategory = "seasonal";
                        //     const {createSeasonalStatsEmbed} = require("../../utils/seasonalStatsEmbed");
                        //     const embed = createSeasonalStatsEmbed(targetUser.id, targetUser.displayName, targetUser.displayAvatarURL({size: 128}));
                        //     const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        //     const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        //         new ButtonBuilder()
                        //             .setCustomId(`back_to_profile_${targetUser.id}`)
                        //             .setLabel("◀️ Retour au profil")
                        //             .setStyle(ButtonStyle.Danger)
                        //     );
                        //     await interaction.editReply({embeds: [embed], components: [...navButtons, backButton]});
                    // }
                    else if (customId === "stats_game_select" && i.isStringSelectMenu()) {
                        await i.deferUpdate();
                        currentGameType = i.values[0];
                        const embed = createDetailedGameStatsEmbed(targetUser, currentGameType, i.guild);
                        await interaction.editReply({embeds: [embed]});
                    }

                    // === NAVIGATION ACHIEVEMENTS ===
                    else if (customId.startsWith("achievements_")) {
                        await i.deferUpdate();
                        const [, categoryStr] = customId.split("_");
                        currentAchievementCategory = categoryStr as AchievementCategory;
                        currentAchievementPage = 0; // Reset page quand on change de catégorie

                        const embed = createAchievementEmbed(targetUser, currentAchievementCategory, currentAchievementPage, interaction.user.id);
                        const navButtons = createAchievementNavigationButtons(currentAchievementCategory, targetUser.id);

                        // Ajouter la pagination si nécessaire (> 5 achievements)
                        const {getAchievementsByCategory} = require("../../services/achievementService");
                        const achievements = getAchievementsByCategory(targetUser.id, targetUser.username, currentAchievementCategory);
                        const totalPages = Math.ceil(achievements.length / 5);
                        const paginationButtons = createPaginationButtons(currentAchievementPage, totalPages, targetUser.id);

                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );

                        const components = paginationButtons
                            ? [paginationButtons, ...navButtons, backButton]
                            : [...navButtons, backButton];

                        await interaction.editReply({embeds: [embed], components});
                    }
                    // === PAGINATION ACHIEVEMENTS ===
                    else if (customId.startsWith("achievement_page_")) {
                        await i.deferUpdate();
                        const action = customId.includes("prev") ? "prev" : "next";

                        if (action === "prev" && currentAchievementPage > 0) {
                            currentAchievementPage--;
                        } else if (action === "next") {
                            const {getAchievementsByCategory} = require("../../services/achievementService");
                            const achievements = getAchievementsByCategory(targetUser.id, targetUser.username, currentAchievementCategory);
                            const totalPages = Math.ceil(achievements.length / 5);
                            if (currentAchievementPage < totalPages - 1) {
                                currentAchievementPage++;
                            }
                        }

                        const embed = createAchievementEmbed(targetUser, currentAchievementCategory, currentAchievementPage, interaction.user.id);
                        const navButtons = createAchievementNavigationButtons(currentAchievementCategory, targetUser.id);

                        const {getAchievementsByCategory} = require("../../services/achievementService");
                        const achievements = getAchievementsByCategory(targetUser.id, targetUser.username, currentAchievementCategory);
                        const totalPages = Math.ceil(achievements.length / 5);
                        const paginationButtons = createPaginationButtons(currentAchievementPage, totalPages, targetUser.id);

                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );

                        const components = paginationButtons
                            ? [paginationButtons, ...navButtons, backButton]
                            : [...navButtons, backButton];

                        await interaction.editReply({embeds: [embed], components});
                    }
                } catch (error) {
                    console.error("[Profile] Error handling button:", error);
                }
            });

            collector.on("end", () => {
                // Désactiver les boutons après expiration
                interaction.editReply({components: []}).catch(() => {
                });
            });

        } catch (error) {
            console.error("[Profile] Error:", error);
            await interaction.editReply({
                content: "❌ Une erreur est survenue lors de l'affichage du profil."
            });
        }
    }
};
