import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {recordFunCommandStats} from "../../services/statsRecorder";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("choose")
        .setDescription("🎯 Choisit aléatoirement parmi plusieurs options")
        .addStringOption((option) =>
            option
                .setName("options")
                .setDescription("Options séparées par des virgules (ex: pizza,burger,sushi)")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const optionsString = interaction.options.getString("options", true);

            // Séparer les options par des virgules et nettoyer les espaces
            const options = optionsString.split(",").map(opt => opt.trim()).filter(opt => opt.length > 0);

            // Vérifier qu'il y a au moins 2 options
            if (options.length < 2) {
                await interaction.reply({
                    content: "❌ Tu dois fournir au moins 2 options séparées par des virgules !\n**Exemple :** `pizza, burger, sushi`",
                    ephemeral: true
                });
                return;
            }

            // Limiter à 20 options maximum
            if (options.length > 20) {
                await interaction.reply({
                    content: "❌ Tu ne peux pas avoir plus de 20 options !",
                    ephemeral: true
                });
                return;
            }

            // Choisir une option aléatoire
            const chosenOption = options[Math.floor(Math.random() * options.length)];

            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🎯 Choix aléatoire")
                .addFields(
                    {
                        name: "Options",
                        value: options.map(opt => `• ${opt}`).join("\n"),
                        inline: false
                    },
                    {
                        name: "J'ai choisi",
                        value: `${chosenOption}`,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.reply({embeds: [embed]});

            // Logger la commande
            await logCommand(
                "🎯 Choose",
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "📊 Options", value: `${options.length} options`, inline: true},
                    {name: "✨ Résultat", value: chosenOption, inline: true}
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

            // Tracker les achievements de choose
            const {trackChooseAchievements} = require("../../services/achievementService");
            await trackChooseAchievements(interaction.user.id, interaction.user.username, interaction.client, interaction.channelId);

        } catch (error) {
            console.error("Error in choose command:", error);
            await interaction.reply({
                content: "Une erreur s'est produite lors du choix.",
                ephemeral: true
            });
        }
    },
};
