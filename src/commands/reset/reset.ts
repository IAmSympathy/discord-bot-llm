import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {clearAllMemory} from "../../queue/queue";
import {hasOwnerPermission} from "../../utils/permissions";

module.exports = {
    data: new SlashCommandBuilder().setName("reset").setDescription("Efface toute la mémoire globale de Netricsa"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            if (!hasOwnerPermission(member)) {
                await interaction.reply({content: "Vous n'avez pas la permission d'utiliser cette commande. (Tah-Um uniquement)", flags: MessageFlags.Ephemeral});
                return;
            }

            // Créer les boutons de confirmation
            const confirmButton = new ButtonBuilder().setCustomId("confirm_reset").setLabel("✓ Confirmer").setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder().setCustomId("cancel_reset").setLabel("✕ Annuler").setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

            // Envoyer le message de confirmation
            const response = await interaction.reply({
                content: "**ATTENTION** : Ceci va effacer toute ma mémoire globale (tous les salons). Cette action est irréversible.\n\nÊtes-vous sûr de vouloir continuer ?",
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

                if (confirmation.customId === "confirm_reset") {
                    // L'utilisateur a confirmé
                    await confirmation.update({
                        content: "🧹 Effacement de toute ma mémoire en cours...",
                        components: [],
                    });

                    await clearAllMemory();

                    console.log(`[Reset Command] Global memory cleared by ${interaction.user.displayName}`);

                    // Mettre à jour le message éphémère
                    await confirmation.editReply({
                        content: "✅ Ma mémoire globale a été complètement effacée.",
                        components: [],
                    });
                } else {
                    // L'utilisateur a annulé
                    await confirmation.update({
                        content: "❌ Opération annulée. Ma mémoire n'a pas été modifiée.",
                        components: [],
                    });
                }
            } catch (error: any) {
                // Timeout - l'utilisateur n'a pas répondu à temps
                if (error?.code === "InteractionCollectorError") {
                    await interaction.editReply({
                        content: "⏱️ Temps écoulé. Opération annulée.",
                        components: [],
                    });
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error("[Reset Command] Error:", error);

            // Gérer les erreurs d'interaction expirée
            if (error?.code === 10062) {
                console.warn("[Reset Command] Interaction expired");
                return;
            }

            try {
                await interaction.reply({
                    content: "❌ Une erreur est survenue lors de l'effacement de la mémoire.",
                    flags: MessageFlags.Ephemeral,
                });
            } catch (replyError: any) {
                if (replyError?.code === 10062) {
                    console.warn("[Reset Command] Could not send error reply - interaction expired");
                }
            }
        }
    },
};
