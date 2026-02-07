import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("8ball")
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
                {answer: "Oui", emoji: "✅", color: 0x57F287},
                {answer: "Non", emoji: "❌", color: 0xED4245},
                {answer: "Peut-être", emoji: "🤷", color: 0xFEE75C},
                {answer: "Les signes pointent vers oui", emoji: "🔮", color: 0x5865F2},
                {answer: "Certainement pas", emoji: "⛔", color: 0xED4245},
                {answer: "Assurément", emoji: "💫", color: 0x57F287},
                {answer: "Sans aucun doute", emoji: "🌟", color: 0x57F287},
                {answer: "Réessaie plus tard", emoji: "❓", color: 0x99AAB5},
                {answer: "Je ne peux pas prédire maintenant", emoji: "🤔", color: 0x99AAB5},
                {answer: "Concentre-toi et redemande", emoji: "💭", color: 0x99AAB5},
                {answer: "Mieux vaut ne pas te le dire", emoji: "⚠️", color: 0xFEE75C},
                {answer: "C'est certain", emoji: "🎯", color: 0x57F287},
                {answer: "Mes sources disent non", emoji: "🚫", color: 0xED4245},
                {answer: "Les perspectives sont bonnes", emoji: "🌈", color: 0x57F287},
                {answer: "Très probable", emoji: "⚡", color: 0x57F287},
                {answer: "Peu probable", emoji: "💀", color: 0xED4245},
                {answer: "C'est incertain", emoji: "🎲", color: 0xFEE75C},
                {answer: "Absolument", emoji: "🔥", color: 0x57F287},
                {answer: "Absolument pas", emoji: "❄️", color: 0xED4245},
                {answer: "Tu peux compter dessus", emoji: "🌠", color: 0x57F287}
            ];

            // Choisir une réponse aléatoire
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];

            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setColor(randomResponse.color)
                .setTitle(`${randomResponse.emoji} Réponse du destin`);

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
                `${randomResponse.emoji} Yes or No`,
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
            console.error("Error in 8ball command:", error);
            await interaction.reply({
                content: "Une erreur s'est produite lors de la consultation du destin.",
                ephemeral: true
            });
        }
    },
};
