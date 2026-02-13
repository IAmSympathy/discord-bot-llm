import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {logCommand} from "../../utils/discordLogger";
import {createErrorEmbed, createSuccessEmbed} from "../../utils/interactionUtils";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set-birthday")
        .setDescription("🎂 Définit ta date d'anniversaire sur ton profil NETRICSA")
        .addIntegerOption((option) =>
            option
                .setName("jour")
                .setDescription("Jour de naissance (1-31)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(31)
        )
        .addIntegerOption((option) =>
            option
                .setName("mois")
                .setDescription("Mois de naissance (1-12)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(12)
        )
        .addBooleanOption((option) =>
            option
                .setName("notify")
                .setDescription("Recevoir un rôle et un message de Netricsa le jour de votre anniversaire")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("annee")
                .setDescription("Année de naissance (optionnel)")
                .setRequired(false)
                .setMinValue(1900)
                .setMaxValue(new Date().getFullYear())
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const day = interaction.options.getInteger("jour", true);
            const month = interaction.options.getInteger("mois", true);
            const year = interaction.options.getInteger("annee", false) ?? undefined;
            const notify = interaction.options.getBoolean("notify", false) ?? true; // Par défaut true

            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Validation de la date
            const testDate = new Date(year || 2000, month - 1, day);
            if (testDate.getDate() !== day || testDate.getMonth() !== month - 1) {
                const errorEmbed = createErrorEmbed(
                    "Date invalide",
                    `La date ${day}/${month}${year ? `/${year}` : ''} n'est pas valide.`
                );
                await interaction.editReply({embeds: [errorEmbed]});
                return;
            }

            // Enregistrer la date d'anniversaire
            await UserProfileService.setBirthday(userId, username, day, month, year, notify);

            // Vérifier les achievements de profil
            const {checkProfileAchievements} = require("../../services/achievementChecker");
            await checkProfileAchievements(userId, username, interaction.client, interaction.channelId);

            // Formater la date pour l'affichage
            const monthNames = [
                "janvier", "février", "mars", "avril", "mai", "juin",
                "juillet", "août", "septembre", "octobre", "novembre", "décembre"
            ];
            const dateStr = `${day} ${monthNames[month - 1]}${year ? ` ${year}` : ''}`;

            const successEmbed = createSuccessEmbed(
                "🎂 Anniversaire enregistré !",
                `Votre date d'anniversaire a été définie au **${dateStr}**.\n\n` +
                (notify
                    ? "Netricsa vous souhaitera bonne fête et vous donnera un rôle spécial le jour J !"
                    : "⚠Les notifications d'anniversaire sont désactivées. Vous ne recevrez pas de message ni de rôle.")
            );

            await interaction.editReply({embeds: [successEmbed]});

            // Logger la commande
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand("🎂 Anniversaire défini", undefined, [
                {name: "👤 Utilisateur", value: username, inline: true},
                {name: "📅 Date", value: dateStr, inline: true},
                {name: "🔔 Notifications", value: notify ? "Activées" : "Désactivées", inline: true}
            ], undefined, channelName, interaction.user.displayAvatarURL());
        } catch (error) {
            console.error("[SetBirthday] Error executing command:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                "Une erreur s'est produite lors de l'enregistrement de votre date d'anniversaire."
            );
            await interaction.editReply({embeds: [errorEmbed]});
        }
    },
};
