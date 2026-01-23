import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, GuildMember, SlashCommandBuilder } from "discord.js";
import { clearAllMemory } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("resetall").setDescription("Efface TOUTE la mémoire de Nettie (tous les channels)"),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Vérifier le rôle Owner uniquement
      const OWNER_ROLE_ID = "1122751212299767929";
      const member = interaction.member;

      if (!member || !(member instanceof GuildMember)) {
        await interaction.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
        return;
      }

      if (!member.roles.cache.has(OWNER_ROLE_ID)) {
        await interaction.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande. (Owner requis)", ephemeral: true });
        return;
      }

      // Créer les boutons de confirmation
      const confirmButton = new ButtonBuilder().setCustomId("confirm_resetall").setLabel("✓ Confirmer").setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder().setCustomId("cancel_resetall").setLabel("✕ Annuler").setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

      // Envoyer le message de confirmation
      const response = await interaction.reply({
        content: "**ATTENTION** : Ceci va effacer TOUTE ma mémoire dans TOUS les channels. Cette action est irréversible.\n\nÊtes-vous sûr de vouloir continuer ?",
        components: [row],
        ephemeral: true,
      });

      // Attendre la réponse de l'utilisateur (60 secondes)
      try {
        const confirmation = await response.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 60000,
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
            await interaction.channel.send("Toute ma mémoire a été effacée dans tous les channels.");
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
    } catch (error) {
      console.error("[ResetAll Command] Error:", error);
      await interaction.reply({
        content: "Une erreur s'est produite lors de la tentative d'effacement de ma mémoire.",
        ephemeral: true,
      });
    }
  },
};
