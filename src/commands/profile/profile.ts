import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, MessageFlags, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {updateUserActivityFromPresence} from "../../services/activityService";
import {createErrorEmbed} from "../../utils/interactionUtils";
import {createProfileEmbed, createStatsEmbed, StatsCategory} from "../../utils/statsEmbedBuilder";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Affiche le profil d'un utilisateur")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("L'utilisateur dont afficher le profil (optionnel, par défaut vous-même)")
                .setRequired(false)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;

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
                    console.log(`[Profile Command] Could not fetch member roles for ${targetUser.username}`);
                }
            }

            // Créer l'embed de profil en utilisant la fonction partagée
            const embed = createProfileEmbed(targetUser);

            // Créer le bouton pour accéder aux stats
            const statsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_view_stats_${targetUser.id}`)
                    .setLabel("Voir les statistiques")
                    .setEmoji("📊")
                    .setStyle(ButtonStyle.Primary)
            );

            const message = await interaction.editReply({
                embeds: [embed],
                components: [statsButton]
            });

            // Créer un collector pour le bouton
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: "❌ Ce bouton n'est pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const customId = buttonInteraction.customId;

                if (customId.startsWith("profile_view_stats_")) {
                    // Afficher les stats en éditant le message
                    await buttonInteraction.deferUpdate();

                    // Créer l'embed des stats Discord (par défaut)
                    const statsEmbed = createStatsEmbed(targetUser, "discord", interaction.guild);

                    // Créer les boutons de navigation des stats + bouton retour
                    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`profile_back_${targetUser.id}`)
                            .setLabel("Retour au profil")
                            .setEmoji("◀️")
                            .setStyle(ButtonStyle.Danger)
                    );

                    const categoryButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`stats_discord_${targetUser.id}`)
                            .setLabel("Discord")
                            .setEmoji("📨")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`stats_netricsa_${targetUser.id}`)
                            .setLabel("Netricsa")
                            .setEmoji("🤖")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`stats_jeux_${targetUser.id}`)
                            .setLabel("Jeux")
                            .setEmoji("🎮")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`stats_serveur_${targetUser.id}`)
                            .setLabel("Serveur")
                            .setEmoji("🌐")
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await buttonInteraction.editReply({
                        embeds: [statsEmbed],
                        components: [categoryButtons, backButton]
                    });
                } else if (customId.startsWith("profile_back_")) {
                    // Retour au profil
                    await buttonInteraction.deferUpdate();
                    await buttonInteraction.editReply({
                        embeds: [embed],
                        components: [statsButton]
                    });
                } else if (customId.startsWith("stats_")) {
                    // Changer de catégorie de stats
                    await buttonInteraction.deferUpdate();

                    const category = customId.split("_")[1] as StatsCategory;
                    const statsEmbed = createStatsEmbed(targetUser, category, interaction.guild);

                    // Garder les mêmes boutons
                    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`profile_back_${targetUser.id}`)
                            .setLabel("Retour au profil")
                            .setEmoji("◀️")
                            .setStyle(ButtonStyle.Danger)
                    );

                    const categoryButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`stats_discord_${targetUser.id}`)
                            .setLabel("Discord")
                            .setEmoji("📨")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(category === "discord"),
                        new ButtonBuilder()
                            .setCustomId(`stats_netricsa_${targetUser.id}`)
                            .setLabel("Netricsa")
                            .setEmoji("🤖")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(category === "netricsa"),
                        new ButtonBuilder()
                            .setCustomId(`stats_jeux_${targetUser.id}`)
                            .setLabel("Jeux")
                            .setEmoji("🎮")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(category === "jeux"),
                        new ButtonBuilder()
                            .setCustomId(`stats_serveur_${targetUser.id}`)
                            .setLabel("Serveur")
                            .setEmoji("🌐")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(category === "serveur")
                    );

                    await buttonInteraction.editReply({
                        embeds: [statsEmbed],
                        components: [categoryButtons, backButton]
                    });
                }
            });

            collector.on("end", async () => {
                try {
                    await interaction.editReply({
                        components: []
                    });
                } catch (error) {
                    // Ignorer les erreurs si le message a été supprimé
                }
            });
        } catch (error) {
            console.error("[Profile Command] Error:", error);

            const errorEmbed = createErrorEmbed(
                "❌ Erreur",
                "Une erreur s'est produite lors de la récupération du profil."
            );

            await interaction.editReply({embeds: [errorEmbed]});
        }
    },
};
