import {ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ComponentType, ContextMenuCommandBuilder, MessageFlags, UserContextMenuCommandInteraction} from "discord.js";
import {createBackToProfileButton, createDetailedGameStatsEmbed, createDiscordStatsEmbed, createGameSelectMenu, createNetricsaStatsEmbed, createProfileEmbed, createServerStatsEmbed, createStatsNavigationButtons, StatsCategory} from "../../utils/statsEmbedBuilder";

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Voir les stats")
        .setType(ApplicationCommandType.User),

    async execute(interaction: UserContextMenuCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.targetUser;
            let currentCategory: StatsCategory = "discord";
            let currentGameType = "global";

            // Créer l'embed initial (Discord)
            let embed = createDiscordStatsEmbed(targetUser);
            let navigationButtons = createStatsNavigationButtons(currentCategory);
            const backToProfileButton = createBackToProfileButton(targetUser.id);
            const gameSelectMenu = createGameSelectMenu();

            const message = await interaction.editReply({
                embeds: [embed],
                components: [navigationButtons, backToProfileButton],
            });

            // Créer un collector principal pour toutes les interactions
            const mainCollector = message.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });

            mainCollector.on("collect", async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: "❌ Ce bouton n'est pas pour vous !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                try {
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
                        // Ne pas arrêter le collector, il continue de fonctionner
                    } else if (i.customId.startsWith("profile_view_stats_")) {
                        // Réafficher les stats depuis le profil
                        currentCategory = "discord";
                        embed = createDiscordStatsEmbed(targetUser);
                        navigationButtons = createStatsNavigationButtons(currentCategory);
                        await i.update({embeds: [embed], components: [navigationButtons, backToProfileButton]});
                    } else if (i.customId === "stats_game_select" && i.isStringSelectMenu()) {
                        currentGameType = i.values[0];
                        embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
                        await i.update({embeds: [embed]});
                    }
                } catch (error) {
                    console.error("[Stats Context Menu] Error handling interaction:", error);
                }
            });

            mainCollector.on("end", () => {
                // Désactiver les boutons après expiration
            });

        } catch (error) {
            console.error("[Stats Context Menu] Error:", error);
            await interaction.editReply({
                content: "❌ Une erreur est survenue lors de l'affichage des statistiques."
            });
        }
    }
};
