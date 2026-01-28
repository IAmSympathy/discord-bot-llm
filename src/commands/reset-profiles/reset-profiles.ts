import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {hasOwnerPermission} from "../../utils/permissions";
import {UserProfileService} from "../../services/userProfileService";

module.exports = {
    data: new SlashCommandBuilder().setName("reset-profiles").setDescription("Efface UNIQUEMENT les profils utilisateurs (garde la mémoire de conversation)"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            if (!hasOwnerPermission(member)) {
                await interaction.reply({content: "Vous n'avez pas la permission d'utiliser cette commande. (Tah-Um uniquement)", flags: MessageFlags.Ephemeral});
                return;
            }

            // Créer les boutons de confirmation
            const confirmButton = new ButtonBuilder().setCustomId("confirm_reset_profiles").setLabel("✓ Confirmer").setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder().setCustomId("cancel_reset_profiles").setLabel("✕ Annuler").setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

            // Envoyer le message de confirmation
            const response = await interaction.reply({
                content: "**Effacement des profils utilisateurs**\n\nCeci va effacer :\n• Tous les profils utilisateurs (infos personnelles, intérêts, traits)\n\nÊtes-vous sûr ?",
                components: [row],
                flags: MessageFlags.Ephemeral,
            });

            // Attendre la réponse de l'utilisateur (15 secondes)
            try {
                const confirmation = await response.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    time: 15000,
                    filter: (i) => i.user.id === interaction.user.id,
                });

                if (confirmation.customId === "confirm_reset_profiles") {
                    // L'utilisateur a confirmé
                    await confirmation.update({
                        content: "Effacement des profils utilisateurs en cours...",
                        components: [],
                    });

                    const deletedCount = UserProfileService.deleteAllProfiles();

                    console.log(`[Reset-Profiles Command] ${deletedCount} profile(s) deleted by ${interaction.user.displayName}`);

                    // Mettre à jour le message éphémère
                    await confirmation.editReply({
                        content: `Profils utilisateurs effacés : ${deletedCount} supprimé(s).`,
                        components: [],
                    });
                } else {
                    // L'utilisateur a annulé
                    await confirmation.update({
                        content: "Opération annulée. Les profils n'ont pas été modifiés.",
                        components: [],
                    });
                }
            } catch (error: any) {
                // Timeout - l'utilisateur n'a pas répondu à temps
                if (error?.code === "InteractionCollectorError") {
                    await interaction.editReply({
                        content: "Temps écoulé. Opération annulée.",
                        components: [],
                    });
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error("[Reset-Profiles Command] Error:", error);

            // Gérer les erreurs d'interaction expirée
            if (error?.code === 10062) {
                console.warn("[Reset-Profiles Command] Interaction expired");
                return;
            }

            try {
                await interaction.reply({
                    content: "Une erreur est survenue lors de l'effacement des profils.",
                    flags: MessageFlags.Ephemeral,
                });
            } catch (replyError: any) {
                if (replyError?.code === 10062) {
                    console.warn("[Reset-Profiles Command] Could not send error reply - interaction expired");
                }
            }
        }
    },
};
