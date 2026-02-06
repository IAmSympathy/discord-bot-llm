import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, MessageFlags, SlashCommandBuilder, User} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {createBackToProfileButton, createDetailedGameStatsEmbed, createDiscordStatsEmbed, createGameSelectMenu, createNetricsaStatsEmbed, createProfileEmbed, createServerStatsEmbed, createStatsNavigationButtons, StatsCategory} from "../../utils/statsEmbedBuilder";

/**
 * Crée le bouton "Voir les statistiques" pour le profil
 */
function createViewStatsButton(userId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`profile_view_stats_${userId}`)
            .setLabel("Voir les statistiques")
            .setEmoji("📊")
            .setStyle(ButtonStyle.Primary)
    );
}

const statsCommand = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Affiche tes statistiques")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Voir les stats d'un autre utilisateur")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            let currentCategory: StatsCategory = "discord";
            let currentGameType = "global";

            // Créer l'embed initial (Discord)
            let embed = createDiscordStatsEmbed(targetUser);
            let navigationButtons = createStatsNavigationButtons(currentCategory);
            const backToProfileButton = createBackToProfileButton(targetUser.id);
            const gameSelectMenu = createGameSelectMenu();

            const message = await interaction.reply({
                embeds: [embed],
                components: [navigationButtons, backToProfileButton],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });

            // Créer un collector pour les interactions
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            const selectCollector = message.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 300000
            });

            collector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: "❌ Ces boutons ne sont pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const buttonId = buttonInteraction.customId;

                if (buttonId === "stats_jeux") {
                    currentCategory = "jeux";
                    embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
                    navigationButtons = createStatsNavigationButtons(currentCategory);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, gameSelectMenu, backToProfileButton]
                    });
                } else if (buttonId === "stats_discord") {
                    currentCategory = "discord";
                    embed = createDiscordStatsEmbed(targetUser);
                    navigationButtons = createStatsNavigationButtons(currentCategory);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                } else if (buttonId === "stats_netricsa") {
                    currentCategory = "netricsa";
                    embed = createNetricsaStatsEmbed(targetUser);
                    navigationButtons = createStatsNavigationButtons(currentCategory);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                } else if (buttonId === "stats_serveur") {
                    currentCategory = "serveur";
                    embed = createServerStatsEmbed(interaction.guild);
                    navigationButtons = createStatsNavigationButtons(currentCategory);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                } else if (buttonId.startsWith("stats_back_to_profile_")) {
                    // Retour au profil
                    const profileEmbed = createProfileEmbed(targetUser);
                    const viewStatsButton = createViewStatsButton(targetUser.id);
                    await buttonInteraction.update({
                        embeds: [profileEmbed],
                        components: [viewStatsButton]
                    });
                } else if (buttonId.startsWith("profile_view_stats_")) {
                    // Retour aux stats depuis le profil
                    currentCategory = "discord";
                    embed = createDiscordStatsEmbed(targetUser);
                    navigationButtons = createStatsNavigationButtons(currentCategory);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                }
            });

            selectCollector.on("collect", async (selectInteraction) => {
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({
                        content: "❌ Ce menu n'est pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                currentGameType = selectInteraction.values[0];
                embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
                await selectInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons, gameSelectMenu, backToProfileButton]
                });
            });

            collector.on("end", async () => {
                // Désactiver les boutons après expiration
                try {
                    await interaction.editReply({
                        components: []
                    });
                } catch (error) {
                    // Ignorer les erreurs si le message a été supprimé
                }
            });

        } catch (error: any) {
            await handleInteractionError(interaction, error, "Stats");
        }
    },
};

/**
 * Export de la fonction pour l'appeler depuis d'autres fichiers (comme profile)
 */
async function showStatsForUser(interaction: any, targetUser: User) {
    try {
        let currentCategory: StatsCategory = "discord";
        let currentGameType = "global";

        let embed = createDiscordStatsEmbed(targetUser);
        const navigationButtons = createStatsNavigationButtons();
        const gameSelectMenu = createGameSelectMenu();

        // Détecter si l'interaction a été différée ou répondue
        const isDeferred = interaction.deferred && !interaction.replied;
        const isAlreadyReplied = interaction.replied;

        let message;
        if (isDeferred) {
            // Pour les interactions différées (deferReply), utiliser editReply
            message = await interaction.editReply({
                embeds: [embed],
                components: [navigationButtons],
                fetchReply: true
            });
        } else if (isAlreadyReplied) {
            // Pour les interactions déjà répondues, utiliser followUp
            message = await interaction.followUp({
                embeds: [embed],
                components: [navigationButtons],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });
        } else {
            // Pour les nouvelles interactions (commandes slash), utiliser reply
            message = await interaction.reply({
                embeds: [embed],
                components: [navigationButtons],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });
        }

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000
        });

        const selectCollector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 300000
        });

        collector.on("collect", async (buttonInteraction: any) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: "❌ Ces boutons ne sont pas pour toi !",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const buttonId = buttonInteraction.customId;

            if (buttonId === "stats_jeux") {
                currentCategory = "jeux";
                embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons, gameSelectMenu]
                });
            } else if (buttonId === "stats_discord") {
                currentCategory = "discord";
                embed = createDiscordStatsEmbed(targetUser);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons]
                });
            } else if (buttonId === "stats_netricsa") {
                currentCategory = "netricsa";
                embed = createNetricsaStatsEmbed(targetUser);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons]
                });
            } else if (buttonId === "stats_serveur") {
                currentCategory = "serveur";
                embed = createServerStatsEmbed(interaction.guild);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons]
                });
            }
        });

        selectCollector.on("collect", async (selectInteraction: any) => {
            if (selectInteraction.user.id !== interaction.user.id) {
                await selectInteraction.reply({
                    content: "❌ Ce menu n'est pas pour toi !",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            currentGameType = selectInteraction.values[0];
            embed = createDetailedGameStatsEmbed(targetUser, currentGameType);
            await selectInteraction.update({
                embeds: [embed],
                components: [navigationButtons, gameSelectMenu]
            });
        });

        collector.on("end", async () => {
            try {
                // Désactiver les composants du message des stats
                if (isDeferred || !isAlreadyReplied) {
                    // Pour les interactions différées ou les commandes slash, utiliser editReply
                    await interaction.editReply({
                        components: []
                    });
                } else {
                    // Pour les interactions déjà répondues (followUp), éditer le message directement
                    await message.edit({
                        components: []
                    });
                }
            } catch (error) {
                // Ignorer les erreurs
            }
        });
    } catch (error) {
        console.error("Error showing stats:", error);
    }
}

// Export de la commande pour le système de chargement de bot.ts
module.exports = statsCommand;
