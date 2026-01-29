import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {clearAllMemory} from "../../queue/queue";
import {hasOwnerPermission} from "../../utils/permissions";
import {createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed, logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder().setName("reset").setDescription("Efface la mémoire de conversation de Netricsa"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            if (!hasOwnerPermission(member)) {
                const errorEmbed = createErrorEmbed(
                    "Permission refusée",
                    "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*"
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Créer les boutons de confirmation
            const confirmButton = new ButtonBuilder().setCustomId("confirm_reset").setLabel("✓ Confirmer").setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder().setCustomId("cancel_reset").setLabel("✕ Annuler").setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

            // Créer l'embed de confirmation
            const confirmEmbed = createWarningEmbed(
                "Effacement de la mémoire",
                "⚠️ **Attention !** Cette action va effacer **toute la mémoire de conversation de Netricsa** (tous les salons).\n\n" +
                "Netricsa ne se souviendra plus d'aucune conversation précédente.\n\n" +
                "**Êtes-vous sûr de vouloir continuer ?**"
            );

            // Envoyer le message de confirmation
            const response = await interaction.reply({
                embeds: [confirmEmbed],
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
                    const processingEmbed = createInfoEmbed(
                        "Effacement en cours...",
                        "⏳ La mémoire de Netricsa est en cours d'effacement..."
                    );

                    await confirmation.update({
                        embeds: [processingEmbed],
                        components: [],
                    });

                    await clearAllMemory();

                    console.log(`[Reset-Memory Command] Conversation memory cleared by ${interaction.user.displayName}`);

                    // Logger la commande
                    await logCommand("🗑️ Mémoire effacée", undefined, [
                        {name: "👤 Par", value: interaction.user.displayName, inline: true},
                    ]);

                    // Mettre à jour le message éphémère
                    const successEmbed = createSuccessEmbed(
                        "Mémoire effacée",
                        "✅ La mémoire de conversation de Netricsa a été **complètement effacée**.\n\n" +
                        "Netricsa ne se souvient plus d'aucune conversation précédente."
                    );

                    await confirmation.editReply({
                        embeds: [successEmbed],
                        components: [],
                    });
                } else {
                    // L'utilisateur a annulé
                    const cancelEmbed = createInfoEmbed(
                        "Opération annulée",
                        "La mémoire de Netricsa n'a **pas été modifiée**."
                    );

                    await confirmation.update({
                        embeds: [cancelEmbed],
                        components: [],
                    });
                }
            } catch (error: any) {
                // Timeout - l'utilisateur n'a pas répondu à temps
                if (error?.code === "InteractionCollectorError") {
                    const timeoutEmbed = createWarningEmbed(
                        "Temps écoulé",
                        "Vous n'avez pas répondu à temps. L'opération a été **annulée**.\n\n" +
                        "La mémoire de Netricsa n'a pas été modifiée."
                    );

                    await interaction.editReply({
                        embeds: [timeoutEmbed],
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
                const errorEmbed = createErrorEmbed(
                    "Erreur",
                    "Une erreur est survenue lors de l'effacement de la mémoire de Netricsa."
                );

                await interaction.reply({
                    embeds: [errorEmbed],
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
