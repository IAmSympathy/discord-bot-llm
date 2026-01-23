import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { clearMemory } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("reset").setDescription("Efface la mémoire de Milton"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const channelKey = process.env.WATCH_CHANNEL_ID || interaction.channelId;
      await clearMemory(channelKey);

      await interaction.editReply({
        content: "La mémoire a été effacée. Nous repartons d'un vide contemplatif.",
      });

      console.log(`[Reset Command] Memory cleared by ${interaction.user.displayName}`);
    } catch (error) {
      console.error("[Reset Command] Error:", error);
      await interaction.editReply({
        content: "Une anomalie s'est glissée lors de l'effacement. Le chaos demeure… pour l'instant.",
      });
    }
  },
};
