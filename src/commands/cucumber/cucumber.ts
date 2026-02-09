import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {logCommand} from "../../utils/discordLogger";

const logger = createLogger("CucumberCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cucumber")
        .setDescription("🥒 Mesurez votre concombre... pour des raisons scientifiques bien sûr"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            // Générer une taille aléatoire entre 1 et 25 cm
            const size = Math.floor(Math.random() * 25) + 1;

            // Créer la représentation visuelle
            const shaft = "=".repeat(size);
            const cucumber = `8${shaft}D`;

            // Convertir en pouces (1 pouce = 2.54 cm)
            const inches = (size / 2.54).toFixed(1);

            // Messages variés selon la taille (moyenne = 15 cm)
            let comment = "";

            if (size <= 8) {
                comment = "Bien en dessous de la moyenne... 😬";
            } else if (size <= 12) {
                comment = "Un peu en dessous de la moyenne. 😅";
            } else if (size <= 18) {
                comment = "Dans la moyenne, parfait ! 😊";
            } else if (size <= 22) {
                comment = "Au-dessus de la moyenne, impressionnant ! 😳";
            } else {
                comment = "EXCEPTIONNEL ! Bien au-dessus de la moyenne ! 🤯";
            }

            const embed = new EmbedBuilder()
                .setColor(0x71aa51)
                .setTitle("🥒 Mesure du Concombre")
                .setDescription(
                    `**Résultat pour <@${interaction.user.id}> :**\n\n` +
                    `${cucumber}\n`
                )
                .addFields(
                    {name: "📏 Taille", value: `${inches}" (${size} cm)`, inline: true},
                    {name: "📊 Moyenne", value: `5.9" (15 cm)`, inline: true}
                )
                .addFields(
                    {name: "💬 Verdict", value: comment, inline: false}
                )
                .setFooter({text: "Pour des raisons purement scientifiques, évidemment."})
                .setTimestamp();

            await interaction.reply({embeds: [embed]});

            // Logger la commande
            await logCommand(
                "🥒 Cucumber",
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "📏 Taille", value: `${inches}" (${size} cm)`, inline: true},
                    {name: "💬 Commentaire", value: comment, inline: false}
                ]
            );

            // Ajouter XP
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.commandeUtilisee,
                    interaction.channel as TextChannel,
                    false
                );
            }

            logger.info(`${interaction.user.username} measured their cucumber: ${size} cm (${inches}")`);

        } catch (error) {
            logger.error("Error in cucumber command:", error);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ Une erreur s'est produite lors de la mesure du concombre.",
                        ephemeral: true
                    });
                } else {
                    await interaction.followUp({
                        content: "❌ Une erreur s'est produite lors de la mesure du concombre.",
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error("Failed to send error message:", replyError);
            }
        }
    },
};
