import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {handleRiddleAnswer} from "../../services/events/riddleEvent";
import {handleSequenceAnswer} from "../../services/events/sequenceEvent";

const logger = createLogger("AnswerCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("answer")
        .setDescription("🔴 Réponds à l'événement actuel")
        .addStringOption((option) =>
            option
                .setName("answer")
                .setDescription("Ta réponse")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const answer = interaction.options.getString("answer", true);

            // Répondre de manière éphémère (seulement visible par l'utilisateur)
            await interaction.deferReply({ephemeral: true});

            // Essayer d'abord pour une énigme
            const riddleResult = await handleRiddleAnswer(
                interaction.client,
                interaction.user.id,
                interaction.user.username,
                answer,
                interaction.channelId || ""
            );

            // Si pas d'énigme, essayer pour une suite logique
            const sequenceResult = !riddleResult ? await handleSequenceAnswer(
                interaction.client,
                interaction.user.id,
                interaction.user.username,
                answer,
                interaction.channelId || ""
            ) : null;

            const result = riddleResult || sequenceResult;

            if (!result) {
                const noEventEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle("❌ Aucun événement actif")
                    .setDescription("Il n'y a pas d'énigme ou de suite logique active en ce moment.\n\nAttends qu'un événement soit lancé pour pouvoir répondre !")
                    .setTimestamp();

                await interaction.editReply({embeds: [noEventEmbed]});
                return;
            }

            if (result.alreadySolved) {
                const alreadySolvedEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle("✅ Déjà trouvé !")
                    .setDescription("Tu as déjà trouvé la réponse à cette énigme !\n\nTu ne peux pas répondre une deuxième fois.")
                    .setTimestamp();

                await interaction.editReply({embeds: [alreadySolvedEmbed]});
                return;
            }

            if (result.correct) {
                const correctEmbed = new EmbedBuilder()
                    .setColor(result.position === 1 ? 0xFFD700 : result.position === 2 ? 0xC0C0C0 : result.position === 3 ? 0xCD7F32 : 0x2ECC71)
                    .setTitle(`${result.positionEmoji} BONNE RÉPONSE !`)
                    .setDescription(
                        `Tu as trouvé la réponse en **${result.timeString}** !\n\n` +
                        `**Position :** ${result.positionEmoji} ${result.positionText}\n` +
                        `**XP gagné :** +${result.xpEarned} XP` +
                        (result.isTest ? '\n\n⚠️ *Mode test - Aucun XP distribué*' : '')
                    )
                    .setFooter({text: "Félicitations ! 🎉"})
                    .setTimestamp();

                await interaction.editReply({embeds: [correctEmbed]});
            } else {
                const wrongEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle("❌ Mauvaise réponse")
                    .setDescription(
                        `Ta réponse **"${answer}"** n'est pas correcte.\n\n` +
                        `Réessaye avec \`/answer\` !`
                    )
                    .setFooter({text: "Continue d'essayer !"})
                    .setTimestamp();

                await interaction.editReply({embeds: [wrongEmbed]});
            }

        } catch (error) {
            logger.error("Error in answer command:", error);
            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";

            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle("❌ Erreur")
                    .setDescription(errorMessage)
                    .setTimestamp();

                if (interaction.deferred) {
                    await interaction.editReply({embeds: [errorEmbed]});
                } else if (!interaction.replied) {
                    await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                }
            } catch (replyError) {
                logger.error("Could not send error message to user:", replyError);
            }
        }
    },
};
