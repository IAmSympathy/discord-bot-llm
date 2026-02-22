import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
import {getCurrentFreeGames} from "../../services/freeGamesService";
import {handleInteractionError} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("freegames")
        .setDescription("🎮 Affiche les offres de jeux gratuits disponibles en ce moment"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply({flags: MessageFlags.Ephemeral});

            const games = getCurrentFreeGames();

            if (games.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x95a5a6)
                    .setTitle("🎮 Jeux gratuits")
                    .setDescription("Aucun jeu gratuit disponible en ce moment.\n\nReviens plus tard, de nouvelles offres arrivent régulièrement !")
                    .setTimestamp();

                await interaction.editReply({embeds: [embed]});
                return;
            }

            const embeds = games.map(g => g.embed);
            const files = games.map(g => g.logoAttachment).filter(a => a !== null) as any[];

            const message: any = {embeds};
            if (files.length > 0) message.files = files;

            await interaction.editReply(message);

        } catch (error: any) {
            await handleInteractionError(interaction, error, "FreeGames");
        }
    },
};



