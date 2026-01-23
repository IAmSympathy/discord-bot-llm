import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";
import { clearMemory } from "../../queue/queue";

module.exports = {
  data: new SlashCommandBuilder().setName("reset").setDescription("Efface la mémoire de Nettie dans ce channel"),
  async execute(interaction: ChatInputCommandInteraction) {
    // Vérifier les rôles autorisés
    const ALLOWED_ROLES = ["1122751212299767929", "829521404214640671", "828652861218226196"];
    const member = interaction.member;

    if (!member || !(member instanceof GuildMember)) {
      await interaction.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
      return;
    }

    const hasRole = ALLOWED_ROLES.some((roleId) => member.roles.cache.has(roleId));
    if (!hasRole) {
      await interaction.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande. (Owner, Admin ou Membre certifié requis)", ephemeral: true });
      return;
    }

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
