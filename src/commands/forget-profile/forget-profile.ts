import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("forget-profile")
        .setDescription("Supprime le profil d'un utilisateur")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("L'utilisateur dont supprimer le profil (optionnel, par défaut vous-même)")
                .setRequired(false)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ephemeral: true});

        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;

            // Vérifier que l'utilisateur a le droit de supprimer ce profil
            // Soit c'est son propre profil, soit il a les permissions d'administrateur
            const canDelete =
                targetUser.id === interaction.user.id ||
                (interaction.memberPermissions?.has("Administrator") ?? false);

            if (!canDelete) {
                await interaction.editReply({
                    content: "Vous ne pouvez supprimer que votre propre profil, sauf si vous êtes administrateur.",
                });
                return;
            }

            const deleted = UserProfileService.deleteProfile(targetUser.id);

            if (deleted) {
                await interaction.editReply({
                    content: `Le profil de **${targetUser.username}** a été supprimé. Toutes les informations ont été effacées.`,
                });
                console.log(`[Forget-Profile Command] Profile deleted for ${targetUser.username} (${targetUser.id}) by ${interaction.user.username}`);
            } else {
                await interaction.editReply({
                    content: `Aucun profil trouvé pour **${targetUser.username}**.`,
                });
            }
        } catch (error) {
            console.error("[Forget-Profile Command] Error:", error);
            await interaction.editReply({
                content: "Une erreur s'est produite lors de la suppression du profil.",
            });
        }
    },
};
