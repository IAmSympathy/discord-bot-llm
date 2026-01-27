import {ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {clearMemory} from "../../queue/queue";
import {hasModeratorPermission} from "../../utils/permissions";

module.exports = {
    data: new SlashCommandBuilder().setName("forget-here").setDescription("Efface la mémoire de Nettie dans ce salon"),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const member = interaction.member instanceof GuildMember ? interaction.member : null;

        if (!hasModeratorPermission(member)) {
            await interaction.editReply({content: "Vous n'avez pas la permission d'utiliser cette commande. (Gnaar ou supérieur)"});
            return;
        }

        try {
            const channelKey = interaction.channelId;
            await clearMemory(channelKey);

            await interaction.editReply({
                content: `------ Ma mémoire a été effacée pour ce salon. ------`,
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
