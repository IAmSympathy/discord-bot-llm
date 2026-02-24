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

            // Envoyer chaque jeu dans un message séparé (ephemeral = seulement le premier peut être ephemeral)
            for (let i = 0; i < games.length; i++) {
                const {container, logoAttachment} = games[i];
                const message: any = {
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                };
                if (logoAttachment) message.files = [logoAttachment];

                if (i === 0) {
                    await interaction.editReply(message);
                } else {
                    await interaction.followUp(message);
                }
            }

        } catch (error: any) {
            await handleInteractionError(interaction, error, "FreeGames");
        }
    },
};


