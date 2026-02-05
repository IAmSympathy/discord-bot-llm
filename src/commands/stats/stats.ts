import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {getPlayerStats} from "../../games/common/globalStats";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Affiche tes statistiques de jeux")
        .addStringOption(option =>
            option
                .setName("jeu")
                .setDescription("Jeu spécifique ou global")
                .addChoices(
                    {name: "🌐 Global", value: "global"},
                    {name: "🪨 Roche-Papier-Ciseaux", value: "rockpaperscissors"},
                    {name: "❌ Tic-Tac-Toe", value: "tictactoe"},
                    {name: "🔤 Pendu", value: "hangman"}
                )
        )
        .addUserOption(option =>
            option
                .setName("joueur")
                .setDescription("Voir les stats d'un autre joueur")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const targetUser = interaction.options.getUser("joueur") || interaction.user;
            const gameChoice = interaction.options.getString("jeu") || "global";

            const stats = getPlayerStats(targetUser.id);

            let description = "";
            let title = `📊 Statistiques de ${targetUser.username}`;

            if (gameChoice === "global") {
                title += " - Global";
                const globalStats = stats.global;
                const totalGames = globalStats.wins + globalStats.losses + globalStats.draws;

                if (totalGames === 0) {
                    description = "Aucune partie jouée pour le moment.";
                } else {
                    description += `**Total de parties :** ${totalGames}\n\n`;
                    description += `🏆 **Victoires :** ${globalStats.wins}\n`;
                    description += `💀 **Défaites :** ${globalStats.losses}\n`;
                    if (globalStats.draws > 0) {
                        description += `🤝 **Égalités :** ${globalStats.draws}\n`;
                    }
                    description += `\n`;
                    if (globalStats.currentStreak > 0) {
                        description += `🔥 **Série actuelle :** ${globalStats.currentStreak}\n`;
                    }
                    if (globalStats.highestStreak > 0) {
                        description += `⭐ **Meilleure série :** ${globalStats.highestStreak}\n`;
                    }

                    // Calculer le taux de victoire
                    const winRate = ((globalStats.wins / totalGames) * 100).toFixed(1);
                    description += `\n📈 **Taux de victoire :** ${winRate}%`;
                }
            } else {
                const gameNames: Record<string, string> = {
                    rockpaperscissors: "Roche-Papier-Ciseaux",
                    tictactoe: "Tic-Tac-Toe",
                    hangman: "Pendu"
                };

                title += ` - ${gameNames[gameChoice]}`;
                const gameStats = stats[gameChoice as 'rockpaperscissors' | 'tictactoe' | 'hangman'];
                const totalGames = gameStats.wins + gameStats.losses + gameStats.draws;

                if (totalGames === 0) {
                    description = `Aucune partie de ${gameNames[gameChoice]} jouée pour le moment.`;
                } else {
                    description += `**Total de parties :** ${totalGames}\n\n`;
                    description += `🏆 **Victoires :** ${gameStats.wins}\n`;
                    description += `💀 **Défaites :** ${gameStats.losses}\n`;
                    if (gameStats.draws > 0) {
                        description += `🤝 **Égalités :** ${gameStats.draws}\n`;
                    }
                    description += `\n`;
                    if (gameStats.currentStreak > 0) {
                        description += `🔥 **Série actuelle :** ${gameStats.currentStreak}\n`;
                    }
                    if (gameStats.highestStreak > 0) {
                        description += `⭐ **Meilleure série :** ${gameStats.highestStreak}\n`;
                    }

                    // Calculer le taux de victoire
                    const winRate = ((gameStats.wins / totalGames) * 100).toFixed(1);
                    description += `\n📈 **Taux de victoire :** ${winRate}%`;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x2494DB)
                .setTitle(title)
                .setDescription(description)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({embeds: [embed]});

        } catch (error: any) {
            await handleInteractionError(interaction, error, "Stats");
        }
    },
};
