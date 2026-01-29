import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {clearAllMemory} from "../../queue/queue";
import {hasOwnerPermission} from "../../utils/permissions";
import {logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder().setName("reset").setDescription("Efface la mémoire de conversation de Netricsa"),
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
                content: "**Effacement de la mémoire de conversation**\n\nCeci va effacer toute ma mémoire de conversation (tous les salons).\n\nÊtes-vous sûr ?",
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
                        content: "Effacement de la mémoire de conversation en cours...",
                        components: [],
                    });

                    await clearAllMemory();

                    console.log(`[Reset-Memory Command] Conversation memory cleared by ${interaction.user.displayName}`);

                    // Logger la commande
                    await logCommand("🗑️ Mémoire effacée", undefined, [
                        {name: "👤 Par", value: interaction.user.displayName, inline: true},
                    ]);

                    // Mettre à jour le message éphémère
                    await confirmation.editReply({
                        content: "Ma mémoire de conversation a été effacée.",
                        components: [],
                    });
                } else {
                    // L'utilisateur a annulé
                    await confirmation.update({
                        content: "Opération annulée. Ma mémoire n'a pas été modifiée.",
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
            console.error("[Reset Command] Error:", error);

            // Gérer les erreurs d'interaction expirée
            if (error?.code === 10062) {
                console.warn("[Reset Command] Interaction expired");
                return;
            }

            try {
                await interaction.reply({
                    content: "Une erreur est survenue lors de l'effacement de la mémoire.",
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
