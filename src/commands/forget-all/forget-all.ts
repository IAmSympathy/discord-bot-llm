import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {clearAllMemory} from "../../queue/queue";
import {hasOwnerPermission} from "../../utils/permissions";

module.exports = {
    data: new SlashCommandBuilder().setName("forget-all").setDescription("Efface TOUTE la mémoire de Nettie (tous les salons)"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            if (!hasOwnerPermission(member)) {
                await interaction.reply({content: "Vous n'avez pas la permission d'utiliser cette commande. (Tah-Um)", flags: MessageFlags.Ephemeral});
                return;
            }

            // Créer les boutons de confirmation
            const confirmButton = new ButtonBuilder().setCustomId("confirm_resetall").setLabel("✓ Confirmer").setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder().setCustomId("cancel_resetall").setLabel("✕ Annuler").setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

            // Envoyer le message de confirmation
            const response = await interaction.reply({
                content: "**ATTENTION** : Ceci va effacer ma mémoire de TOUS les salons. Cette action est irréversible.\n\nÊtes-vous sûr de vouloir continuer ?",
                components: [row],
                flags: MessageFlags.Ephemeral,
            });

            // Attendre la réponse de l'utilisateur (10 secondes)
            try {
                const confirmation = await response.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    time: 10000,
                    filter: (i) => i.user.id === interaction.user.id,
                });

                if (confirmation.customId === "confirm_resetall") {
                    // L'utilisateur a confirmé
                    await confirmation.update({
                        content: "Effacement de toute ma mémoire en cours...",
                        components: [],
                    });

                    await clearAllMemory();

                    // Mettre à jour le message éphémère
                    await confirmation.editReply({
                        content: "Opération terminée.",
                        components: [],
                    });

                    // Envoyer un message PUBLIC (non-éphémère)
                    if (interaction.channel && "send" in interaction.channel) {
                        await interaction.channel.send("------ Ma mémoire a été effacée pour tous les salons. ------");
                    }

                    console.log(`[ResetAll Command] All memory cleared by ${interaction.user.displayName}`);
                } else {
                    // L'utilisateur a annulé
                    await confirmation.update({
                        content: "Annulé. Ma mémoire n'a pas été effacée.",
                        components: [],
                    });

                    console.log(`[ResetAll Command] Memory clear cancelled by ${interaction.user.displayName}`);
                }
            } catch (error) {
                // Timeout - l'utilisateur n'a pas répondu
                await interaction.editReply({
                    content: "Temps écoulé. Ma mémoire n'a pas été effacée.",
                    components: [],
                });
                console.log(`[ResetAll Command] Memory clear timeout for ${interaction.user.displayName}`);
            }
        } catch (error: any) {
            console.error("[ResetAll Command] Error:", error);

            // Gérer les interactions expirées
            if (error?.code === 10062) {
                console.warn(`[forget-all] Interaction expired - user took too long to confirm`);
                return;
            }

            try {
                await interaction.reply({
                    content: "Une erreur s'est produite lors de la tentative d'effacement de ma mémoire.",
                    flags: MessageFlags.Ephemeral,
                });
            } catch (replyError: any) {
                if (replyError?.code !== 10062) {
                    console.error("[forget-all] Error sending error message:", replyError);
                }
            }
        }
    },
};
