import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {recordFunCommandStats} from "../../services/statsRecorder";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("🪙 Lance une pièce (pile ou face)")
        .addStringOption((option) =>
            option
                .setName("choice")
                .setDescription("Ton choix (optionnel)")
                .setRequired(false)
                .addChoices(
                    {name: "🪙 Pile", value: "pile"},
                    {name: "🎭 Face", value: "face"},
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userChoice = interaction.options.getString("choice");

            // Simuler le lancer (pile, face, ou SUPER RARE : sur la tranche)
            const random = Math.random();
            let result: string;
            let resultEmoji: string;
            let resultText: string;

            if (random < 0.001) {
                // 0.1% de chance : la pièce atterrit sur la tranche !
                result = "tranche";
                resultEmoji = "⚡";
                resultText = "Sur la tranche";
            } else if (random < 0.5005) {
                // ~50% pile
                result = "pile";
                resultEmoji = "🪙";
                resultText = "Pile";
            } else {
                // ~50% face
                result = "face";
                resultEmoji = "🎭";
                resultText = "Face";
            }

            // Message d'animation
            await interaction.reply("🌀  *Lance la pièce...*");

            // Attendre un peu pour l'effet d'animation
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Déterminer si l'utilisateur a gagné (si il a fait un choix)
            let won: boolean | null = null;
            if (userChoice) {
                if (result === "tranche") {
                    // Cas spécial : la tranche annule tout
                    won = null;
                } else {
                    won = userChoice === result;
                }
            }

            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setColor(
                    result === "tranche" ? 0xFFD700 : // Or pour la tranche
                        won === true ? 0x57F287 :
                            won === false ? 0xED4245 :
                                0xffcc4d
                )
                .setTitle("🪙 Pile ou Face");

            if (userChoice) {
                const userChoiceEmoji = userChoice === "pile" ? "🪙" : "🎭";
                const userChoiceText = userChoice === "pile" ? "Pile" : "Face";

                embed.addFields(
                    {
                        name: "Ton choix",
                        value: `${userChoiceEmoji} **${userChoiceText}**`,
                        inline: true
                    },
                    {
                        name: "Résultat",
                        value: `${resultEmoji} ${resultText}`,
                        inline: true
                    }
                );

                // Message spécial selon le résultat
                if (result === "tranche") {
                    embed.addFields({
                        name: "⚡ INCROYABLE !",
                        value: "**LA PIÈCE EST TOMBÉE SUR LA TRANCHE !**\n🎰 Probabilité : 0.1% (1 sur 1000)\n\n🤯 C'est un événement ULTRA RARE ! Personne ne gagne, mais quelle chance d'avoir vu ça !",
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: " ",
                        value: won ? "\n**🎉 Tu as gagné !**" : "\n**😔 Tu as perdu !**",
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: "Résultat",
                    value: `${resultEmoji} ${resultText}`,
                    inline: false
                });

                // Message spécial si c'est la tranche
                if (result === "tranche") {
                    embed.addFields({
                        name: "⚡ INCROYABLE !",
                        value: "**LA PIÈCE EST TOMBÉE SUR LA TRANCHE !**\n🎰 Probabilité : 0.1% (1 sur 1000)\n\n🤯 C'est un événement ULTRA RARE !",
                        inline: false
                    });
                }
            }

            embed.setFooter({text: `Lancé par ${interaction.user.displayName}`})
                .setTimestamp();

            await interaction.editReply({content: null, embeds: [embed]});

            // Logger la commande
            await logCommand(
                "🪙 Coinflip",
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "🎯 Choix", value: userChoice ? (userChoice === "pile" ? "Pile" : "Face") : "Aucun", inline: true},
                    {name: "💫 Résultat", value: resultText, inline: true}
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

            // Enregistrer l'utilisation d'une commande fun (pour les défis quotidiens)
            const {recordFunCommandStats} = require("../../services/statsRecorder");
            recordFunCommandStats(interaction.user.id, interaction.user.username);

            // Chance d'obtenir un objet saisonnier (3% - commande Netricsa)
            const {tryRewardAndNotify} = require("../../services/rewardNotifier");
            await tryRewardAndNotify(interaction, interaction.user.id, interaction.user.username, "command");

            // Tracker les achievements de coinflip
            const {trackCoinflipAchievements} = require("../../services/achievementService");
            await trackCoinflipAchievements(interaction.user.id, interaction.user.username, result, interaction.client, interaction.channelId);

        } catch (error) {
            console.error("Error in coinflip command:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    content: "Une erreur s'est produite lors du lancer de pièce."
                });
            } else {
                await interaction.reply({
                    content: "Une erreur s'est produite lors du lancer de pièce.",
                    ephemeral: true
                });
            }
        }
    },
};
