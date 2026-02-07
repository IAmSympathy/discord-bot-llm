import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("crystalball")
        .setDescription("Pose une question et laisse le destin décider")
        .addStringOption((option) =>
            option
                .setName("question")
                .setDescription("Ta question")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const question = interaction.options.getString("question");

            // Réponses possibles
            const responses = [
                {answer: "Oui"},
                {answer: "Non"},
                {answer: "Peut-être"},
                {answer: "Les signes pointent vers oui"},
                {answer: "Certainement pas"},
                {answer: "Assurément"},
                {answer: "Sans aucun doute"},
                {answer: "Réessaie plus tard"},
                {answer: "Je ne peux pas prédire maintenant"},
                {answer: "Concentre-toi et redemande"},
                {answer: "Mieux vaut ne pas te le dire"},
                {answer: "C'est certain"},
                {answer: "Mes sources disent non"},
                {answer: "Les perspectives sont bonnes"},
                {answer: "Très probable"},
                {answer: "Peu probable"},
                {answer: "C'est incertain"},
                {answer: "Absolument"},
                {answer: "Absolument pas"},
                {answer: "Tu peux compter dessus"}
            ];

            // Choisir une réponse aléatoire
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];

            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setColor("#0c061c")
                .setTitle(`🔮 Réponse du destin`);

            if (question) {
                embed.addFields({
                    name: "Question",
                    value: question,
                    inline: false
                });
            }

            embed.addFields({
                name: "Réponse",
                value: `${randomResponse.answer}`,
                inline: false
            });

            embed.setFooter({text: `Demandé par ${interaction.user.displayName}`})
                .setTimestamp();

            await interaction.reply({embeds: [embed]});

            // Logger la commande
            await logCommand(
                `🔮 Crystal Ball`,
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "❓ Question", value: question || "Question aléatoire", inline: true},
                    {name: "💬 Réponse", value: randomResponse.answer, inline: true}
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

        } catch (error) {
            console.error("Error in crystalball command:", error);
            await interaction.reply({
                content: "Une erreur s'est produite lors de la consultation du destin.",
                ephemeral: true
            });
        }
    },
};
