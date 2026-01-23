import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { abortStream } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Arrête le stream actuel si le bot est bloqué"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channelKey = process.env.WATCH_CHANNEL_ID || interaction.channelId;
      const success = abortStream(channelKey);

      if (success) {
        await interaction.editReply({
          content: "✅ Stream arrêté. Le bot devrait se calmer maintenant.",
        });
        console.log(`[Stop Command] Stream aborted by ${interaction.user.displayName}`);
      } else {
        await interaction.editReply({
          content: "Aucun stream actif détecté dans ce channel.",
        });
      }
    } catch (error) {
      console.error("[Stop Command] Error:", error);
      await interaction.editReply({
        content: "Une erreur s'est produite lors de l'arrêt du stream.",
      });
    }
  },
};
