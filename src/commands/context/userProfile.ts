import {ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ComponentType, ContextMenuCommandBuilder, MessageFlags, UserContextMenuCommandInteraction} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {updateUserActivityFromPresence} from "../../services/activityService";
import {createBackToProfileButton, createDetailedGameStatsEmbed, createDiscordStatsEmbed, createGameSelectMenu, createNetricsaStatsEmbed, createProfileEmbed, createServerStatsEmbed, createStatsNavigationButtons, StatsCategory} from "../../utils/statsEmbedBuilder";

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Voir le profil")
        .setType(ApplicationCommandType.User),

    async execute(interaction: UserContextMenuCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.targetUser;

            // Mettre à jour l'activité actuelle de l'utilisateur
            await updateUserActivityFromPresence(interaction.client, targetUser.id);

            // Mettre à jour les rôles Discord de l'utilisateur si possible
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
                    console.log(`[Profile Context Menu] Could not fetch member roles for ${targetUser.username}`);
                }
            }

            // Créer l'embed de profil
            const embed = createProfileEmbed(targetUser);

            // Créer le bouton pour accéder aux stats
            const statsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_view_stats_${targetUser.id}`)
                    .setLabel("📊 Afficher les statistiques")
                    .setStyle(ButtonStyle.Success)
            );

            const message = await interaction.editReply({
                embeds: [embed],
                components: [statsButton],
            });

            // Créer un collector pour le bouton des stats
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: "❌ Ce bouton n'est pas pour vous !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (buttonInteraction.customId.startsWith("profile_view_stats_")) {
                    const userId = buttonInteraction.customId.replace("profile_view_stats_", "");

                    // Afficher les stats avec navigation (importé depuis statsEmbedBuilder)
                    await showStatsFromProfile(buttonInteraction, targetUser);
                }
            });

            collector.on("end", () => {
                // Désactiver les boutons après expiration
                statsButton.components[0].setDisabled(true);
                interaction.editReply({
                    embeds: [embed],
                    components: [statsButton],
                }).catch(() => {
                });
            });

        } catch (error) {
            console.error("[Profile Context Menu] Error:", error);
            await interaction.editReply({
                content: "❌ Une erreur est survenue lors de l'affichage du profil."
            });
        }
    }
};

/**
 * Affiche les stats avec navigation complète
 */
async function showStatsFromProfile(buttonInteraction: any, targetUser: any) {
    await buttonInteraction.deferUpdate();

    let currentCategory: StatsCategory = "discord";
    let currentGameType = "global";

    let embed = createDiscordStatsEmbed(targetUser);
    let navigationButtons = createStatsNavigationButtons(currentCategory);
    const backToProfileButton = createBackToProfileButton(targetUser.id);
    const gameSelectMenu = createGameSelectMenu();

    await buttonInteraction.editReply({
        embeds: [embed],
        components: [navigationButtons, backToProfileButton]
    });

    const message = await buttonInteraction.fetchReply();

    // Créer un collector pour les interactions
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
    });

    const selectCollector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 300000
    });

    collector.on("collect", async (i: any) => {
        if (i.user.id !== buttonInteraction.user.id) {
            await i.reply({
                content: "❌ Ce bouton n'est pas pour vous !",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (i.customId === "stats_discord") {
            currentCategory = "discord";
            embed = createDiscordStatsEmbed(targetUser);
            navigationButtons = createStatsNavigationButtons(currentCategory);
            await i.update({embeds: [embed], components: [navigationButtons, backToProfileButton]});
        } else if (i.customId === "stats_netricsa") {
            currentCategory = "netricsa";
            embed = createNetricsaStatsEmbed(targetUser);
            navigationButtons = createStatsNavigationButtons(currentCategory);
            await i.update({embeds: [embed], components: [navigationButtons, backToProfileButton]});
        } else if (i.customId === "stats_jeux") {
            currentCategory = "jeux";
            currentGameType = "global";
            embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
            navigationButtons = createStatsNavigationButtons(currentCategory);
            await i.update({embeds: [embed], components: [navigationButtons, gameSelectMenu, backToProfileButton]});
        } else if (i.customId === "stats_serveur") {
            currentCategory = "serveur";
            embed = createServerStatsEmbed(i.guild);
            navigationButtons = createStatsNavigationButtons(currentCategory);
            await i.update({embeds: [embed], components: [navigationButtons, backToProfileButton]});
        } else if (i.customId.startsWith("stats_back_to_profile_")) {
            // Retour au profil
            const profileEmbed = createProfileEmbed(targetUser);
            const statsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_view_stats_${targetUser.id}`)
                    .setLabel("📊 Afficher les statistiques")
                    .setStyle(ButtonStyle.Success)
            );
            await i.update({embeds: [profileEmbed], components: [statsButton]});
            collector.stop();
            selectCollector.stop();
        }
    });

    selectCollector.on("collect", async (i: any) => {
        if (i.user.id !== buttonInteraction.user.id) {
            await i.reply({
                content: "❌ Ce menu n'est pas pour vous !",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (i.customId === "stats_game_select") {
            currentGameType = i.values[0];
            embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
            await i.update({embeds: [embed]});
        }
    });

    collector.on("end", () => {
        // Désactiver les boutons après expiration
    });
}
