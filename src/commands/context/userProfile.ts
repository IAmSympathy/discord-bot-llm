import {ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ComponentType, ContextMenuCommandBuilder, MessageFlags, UserContextMenuCommandInteraction} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {updateUserActivityFromPresence} from "../../services/activityService";
import {createDetailedGameStatsEmbed, createDiscordStatsEmbed, createGameSelectMenu, createNetricsaStatsEmbed, createProfileEmbed, createServerStatsEmbed, createStatsNavigationButtons, StatsCategory} from "../../utils/statsEmbedBuilder";
import {AchievementCategory} from "../../services/achievementService";

const CATEGORY_EMOJIS: { [key in AchievementCategory]: string } = {
    [AchievementCategory.PROFIL]: "📋",
    [AchievementCategory.NETRICSA]: "🤖",
    [AchievementCategory.DISCORD]: "💬",
    [AchievementCategory.JEUX]: "🎮",
    [AchievementCategory.NIVEAU]: "⭐",
    [AchievementCategory.SECRET]: "🔒"
};

const CATEGORY_NAMES: { [key in AchievementCategory]: string } = {
    [AchievementCategory.PROFIL]: "Profil",
    [AchievementCategory.NETRICSA]: "Netricsa",
    [AchievementCategory.DISCORD]: "Discord",
    [AchievementCategory.JEUX]: "Jeux",
    [AchievementCategory.NIVEAU]: "Niveau",
    [AchievementCategory.SECRET]: "Secrets"
};

/**
 * Crée l'embed des achievements
 */
function createAchievementEmbed(targetUser: any, category: AchievementCategory): any {
    const {EmbedBuilder} = require("discord.js");
    const {getAchievementsByCategory, getAchievementStats, getCompletionPercentage} = require("../../services/achievementService");

    const achievements = getAchievementsByCategory(targetUser.id, targetUser.username, category);
    const stats = getAchievementStats(targetUser.id);
    const completion = getCompletionPercentage(targetUser.id);

    const categoryStats = stats[category];
    const categoryName = CATEGORY_NAMES[category];
    const categoryEmoji = CATEGORY_EMOJIS[category];

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`${categoryEmoji} Achievements ${categoryName} - ${targetUser.displayName}`)
        .setThumbnail(targetUser.displayAvatarURL({size: 128}))
        .setFooter({
            text: `Complétion globale: ${completion}% | ${categoryStats.unlocked}/${categoryStats.total} dans cette catégorie`
        })
        .setTimestamp();

    if (achievements.length === 0) {
        embed.setDescription("Aucun achievement dans cette catégorie pour le moment.");
        return embed;
    }

    let description = "";

    for (const {achievement, unlocked, unlockedAt} of achievements) {
        const status = unlocked ? "✅" : "🔒";

        if (achievement.secret && !unlocked) {
            description += `${status} **${achievement.emoji} ${achievement.name}**\n`;
            description += `*Achievement secret - Débloquez-le pour voir la description*\n\n`;
        } else {
            description += `${status} **${achievement.emoji} ${achievement.name}**\n`;
            description += `${achievement.description}\n`;

            if (unlocked && unlockedAt) {
                const date = new Date(unlockedAt);
                description += `*Débloqué le ${date.toLocaleDateString("fr-FR")}*\n`;
            }

            description += `\n`;
        }
    }

    embed.setDescription(description || "Aucun achievement dans cette catégorie.");
    return embed;
}

/**
 * Crée les boutons de navigation des achievements
 */
function createAchievementNavigationButtons(currentCategory: AchievementCategory, userId: string): ActionRowBuilder<ButtonBuilder>[] {
    const categories = Object.values(AchievementCategory);
    const row1Buttons: ButtonBuilder[] = [];
    const row2Buttons: ButtonBuilder[] = [];

    categories.forEach((category, index) => {
        const emoji = CATEGORY_EMOJIS[category];
        const isCurrentCategory = category === currentCategory;

        const button = new ButtonBuilder()
            .setCustomId(`achievements_${category}_${userId}`)
            .setEmoji(emoji)
            .setStyle(isCurrentCategory ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(isCurrentCategory);

        if (index < 3) {
            row1Buttons.push(button);
        } else {
            row2Buttons.push(button);
        }
    });

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(row1Buttons),
        new ActionRowBuilder<ButtonBuilder>().addComponents(row2Buttons)
    ];
}

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Voir le profil")
        .setType(ApplicationCommandType.User),

    async execute(interaction: UserContextMenuCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.targetUser;

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

            // État de navigation
            type ViewType = "profile" | "stats" | "achievements";
            let currentView: ViewType = "profile";
            let currentStatsCategory: StatsCategory = "discord";
            let currentAchievementCategory: AchievementCategory = AchievementCategory.PROFIL;
            let currentGameType = "global";

            // Créer l'embed initial du profil
            const profileEmbed = createProfileEmbed(targetUser);

            // Boutons principaux du profil
            const profileButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_stats_${targetUser.id}`)
                    .setLabel("📊 Statistiques")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`view_achievements_${targetUser.id}`)
                    .setLabel("🏆 Achievements")
                    .setStyle(ButtonStyle.Primary)
            );

            const message = await interaction.editReply({
                embeds: [profileEmbed],
                components: [profileButtons]
            });

            // Collector unique pour tout
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
                        currentView = "stats";
                        currentStatsCategory = "discord";
                        const embed = createDiscordStatsEmbed(targetUser);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [navButtons, backButton]});
                    } else if (customId.startsWith("view_achievements_")) {
                        currentView = "achievements";
                        currentAchievementCategory = AchievementCategory.PROFIL;
                        const embed = createAchievementEmbed(targetUser, currentAchievementCategory);
                        const navButtons = createAchievementNavigationButtons(currentAchievementCategory, targetUser.id);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [...navButtons, backButton]});
                    } else if (customId.startsWith("back_to_profile_")) {
                        currentView = "profile";
                        const embed = createProfileEmbed(targetUser);
                        await i.update({embeds: [embed], components: [profileButtons]});
                    }

                    // === NAVIGATION STATS ===
                    else if (customId === "stats_discord") {
                        currentStatsCategory = "discord";
                        const embed = createDiscordStatsEmbed(targetUser);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [navButtons, backButton]});
                    } else if (customId === "stats_netricsa") {
                        currentStatsCategory = "netricsa";
                        const embed = createNetricsaStatsEmbed(targetUser);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [navButtons, backButton]});
                    } else if (customId === "stats_jeux") {
                        currentStatsCategory = "jeux";
                        currentGameType = "global";
                        const embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const gameMenu = createGameSelectMenu();
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [navButtons, gameMenu, backButton]});
                    } else if (customId === "stats_serveur") {
                        currentStatsCategory = "serveur";
                        const embed = createServerStatsEmbed(i.guild);
                        const navButtons = createStatsNavigationButtons(currentStatsCategory);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [navButtons, backButton]});
                    } else if (customId === "stats_game_select" && i.isStringSelectMenu()) {
                        currentGameType = i.values[0];
                        const embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
                        await i.update({embeds: [embed]});
                    }

                    // === NAVIGATION ACHIEVEMENTS ===
                    else if (customId.startsWith("achievements_")) {
                        const [, categoryStr] = customId.split("_");
                        currentAchievementCategory = categoryStr as AchievementCategory;
                        const embed = createAchievementEmbed(targetUser, currentAchievementCategory);
                        const navButtons = createAchievementNavigationButtons(currentAchievementCategory, targetUser.id);
                        const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`back_to_profile_${targetUser.id}`)
                                .setLabel("◀️ Retour au profil")
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.update({embeds: [embed], components: [...navButtons, backButton]});
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
