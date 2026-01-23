import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { clearMemory } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("reset").setDescription("Efface la mémoire de Nettie"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const channelKey = process.env.WATCH_CHANNEL_ID || interaction.channelId;
      await clearMemory(channelKey);

      await interaction.editReply({
        content: "Ma mémoire a été effacée.",
      });

      console.log(`[Reset Command] Memory cleared by ${interaction.user.displayName}`);
    } catch (error) {
      console.error("[Reset Command] Error:", error);
      await interaction.editReply({
        content: "Ma mémoire n'a pas pu être effacée.",
      });
    }
  },
};
