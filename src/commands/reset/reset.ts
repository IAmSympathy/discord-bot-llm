import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { clearMemory } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("reset").setDescription("Efface la mémoire de Nettie dans ce channel"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const channelKey = interaction.channelId;
      await clearMemory(channelKey);

      await interaction.editReply({
        content: `Ma mémoire a été effacée pour ce channel.`,
      });

      console.log(`[Reset Command] Memory cleared for channel ${channelKey} by ${interaction.user.displayName}`);
    } catch (error) {
      console.error("[Reset Command] Error:", error);
      await interaction.editReply({
        content: "Ma mémoire n'a pas pu être effacée.",
      });
    }
  },
};
