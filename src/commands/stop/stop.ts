import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { abortStream } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Arrête de force le raisonnement de Netricsa dans un cas où elle est coincé dans uen boucle"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const channelKey = process.env.WATCH_CHANNEL_ID || interaction.channelId;
      const success = abortStream(channelKey);

      if (success) {
        await interaction.editReply({
          content: "D'accord, j'arrête de parler.",
        });
        console.log(`[Stop Command] Stream aborted by ${interaction.user.displayName}`);
      } else {
        await interaction.editReply({
          content: "Mais... Je ne suis pas en train de parler...",
        });
      }
    } catch (error) {
      console.error("[Stop Command] Error:", error);
      await interaction.editReply({
        content: "FUCK YOU JE CONTINUE À PARLER HAHAHAHA",
      });
    }
  },
};
