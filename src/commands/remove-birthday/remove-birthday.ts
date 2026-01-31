import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {createErrorEmbed, createSuccessEmbed, logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-birthday")
        .setDescription("Supprime votre date d'anniversaire"),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;

            const success = await UserProfileService.removeBirthday(userId);

            if (success) {
                const successEmbed = createSuccessEmbed(
                    "🎂 Anniversaire supprimé",
                    "Votre date d'anniversaire a été supprimée de votre profil."
                );
                await interaction.editReply({embeds: [successEmbed]});

                // Logger la commande
                await logCommand("🎂 Anniversaire supprimé", undefined, [
                    {name: "👤 Utilisateur", value: username, inline: true}
                ]);
            } else {
                const errorEmbed = createErrorEmbed(
                    "Aucun anniversaire",
                    "Vous n'avez pas d'anniversaire enregistré dans votre profil."
                );
                await interaction.editReply({embeds: [errorEmbed]});
            }
        } catch (error) {
            console.error("[RemoveBirthday] Error executing command:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                "Une erreur s'est produite lors de la suppression de votre date d'anniversaire."
            );
            await interaction.editReply({embeds: [errorEmbed]});
        }
    },
};
