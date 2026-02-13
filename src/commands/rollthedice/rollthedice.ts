import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {recordFunCommandStats} from "../../services/statsRecorder";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rollthedice")
        .setDescription("🎲 Lance un ou plusieurs dés")
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type de dé à lancer")
                .setRequired(false)
                .addChoices(
                    {name: "🎲 D4 (1-4)", value: "d4"},
                    {name: "🎲 D6 (1-6)", value: "d6"},
                    {name: "🎲 D8 (1-8)", value: "d8"},
                    {name: "🎲 D10 (1-10)", value: "d10"},
                    {name: "🎲 D12 (1-12)", value: "d12"},
                    {name: "🎲 D20 (1-20)", value: "d20"},
                    {name: "🎲 D100 (1-100)", value: "d100"}
                )
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Nombre de dés à lancer (par défaut: 1)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const diceType = interaction.options.getString("type") || "d6";
            const numberOfDice = interaction.options.getInteger("amount") || 1;

            // Déterminer le nombre maximum selon le type de dé
            const maxValues: { [key: string]: number } = {
                d4: 4,
                d6: 6,
                d8: 8,
                d10: 10,
                d12: 12,
                d20: 20,
                d100: 100
            };

            const maxValue = maxValues[diceType];

            // Lancer les dés
            const results: number[] = [];
            for (let i = 0; i < numberOfDice; i++) {
                results.push(Math.floor(Math.random() * maxValue) + 1);
            }

            // Calculer le total
            const total = results.reduce((sum, val) => sum + val, 0);

            // Déterminer l'emoji selon le résultat
            let emoji = "🎲";
            if (diceType === "d20") {
                if (results.includes(20)) emoji = "🌟"; // Critique réussite
                else if (results.includes(1)) emoji = "💀"; // Critique échec
            }

            // Message d'animation
            if (numberOfDice > 1) {
                await interaction.reply(`<a:znDice:1471941139287375882> *Lance les dés...*`);
            } else {
                await interaction.reply(`<a:znDice:1471941139287375882> *Lance le dé...*`);
            }

            // Attendre un peu pour l'effet d'animation
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setColor(0xea596e)
                .setTitle(`${emoji} Lancer de dé${numberOfDice > 1 ? 's' : ''}`)
                .setDescription(`${numberOfDice} x ${diceType.toUpperCase()}`)
                .addFields({
                    name: numberOfDice > 1 ? "Résultats" : "Résultat",
                    value: numberOfDice > 1 ? results.join(", ") : `${results[0]}`,
                    inline: true
                });

            // Ajouter le total si plusieurs dés
            if (numberOfDice > 1) {
                embed.addFields({
                    name: "Total",
                    value: `**${total}**`,
                    inline: true
                });
            }

            // Ajouter des notes spéciales pour D20
            if (diceType === "d20") {
                const notes: string[] = [];
                if (results.includes(20)) notes.push("🌟 **Critique !** (20)");
                if (results.includes(1)) notes.push("💀 **Échec critique !** (1)");
                if (notes.length > 0) {
                    embed.addFields({
                        name: "Notes",
                        value: notes.join("\n"),
                        inline: false
                    });
                }
            }

            embed.setFooter({text: `Lancé par ${interaction.user.displayName}`})
                .setTimestamp();

            await interaction.editReply({content: "", embeds: [embed]});

            // Logger la commande
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                `🎲 Lancer de dé${numberOfDice > 1 ? 's' : ''}`,
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "🎲 Dé", value: `${numberOfDice}${diceType.toUpperCase()}`, inline: true},
                    {name: "📊 Résultat", value: numberOfDice > 1 ? `Total: ${total}` : `${results[0]}`, inline: true}
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
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

            // Tracker les achievements de dice
            const {trackDiceAchievements} = require("../../services/achievementService");
            await trackDiceAchievements(interaction.user.id, interaction.user.username, diceType, results[0], interaction.client, interaction.channelId);

        } catch (error) {
            console.error("Error in rollthedice command:", error);

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({
                        content: "❌ Une erreur s'est produite lors du lancer de dés.",
                        embeds: []
                    });
                } else {
                    await interaction.reply({
                        content: "❌ Une erreur s'est produite lors du lancer de dés.",
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error("Failed to send error message:", replyError);
            }
        }
    },
};
