import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Affiche le profil d'un utilisateur")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("L'utilisateur dont afficher le profil (optionnel, par défaut vous-même)")
                .setRequired(false)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ephemeral: true});

        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const profile = UserProfileService.getProfile(targetUser.id);

            if (!profile) {
                await interaction.editReply({
                    content: `Aucun profil trouvé pour **${targetUser.username}**. L'IA n'a pas encore appris d'informations sur cet utilisateur.`,
                });
                return;
            }

            // Construire l'affichage du profil
            let profileText = `📋 **Profil de ${profile.username}**\n\n`;

            // Personnalité
            if (profile.personality.traits.length > 0) {
                profileText += `🎭 **Traits de personnalité:**\n`;
                profile.personality.traits.forEach((trait) => {
                    profileText += `- ${trait}\n`;
                });
                profileText += "\n";
            }

            if (profile.personality.communicationStyle) {
                profileText += `💬 **Style de communication:** ${profile.personality.communicationStyle}\n\n`;
            }

            // Intérêts
            if (profile.personality.interests.length > 0) {
                profileText += `💡 **Centres d'intérêt:**\n`;
                profile.personality.interests.forEach((interest) => {
                    profileText += `- ${interest}\n`;
                });
                profileText += "\n";
            }

            // Faits
            if (profile.facts.length > 0) {
                profileText += `📝 **Faits enregistrés (${profile.facts.length}):**\n`;
                const recentFacts = profile.facts
                    .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
                    .slice(0, 10);

                recentFacts.forEach((fact) => {
                    const date = new Date(fact.lastUpdated).toLocaleDateString("fr-FR");
                    profileText += `- ${fact.content} *(${date})*\n`;
                });

                if (profile.facts.length > 10) {
                    profileText += `\n... et ${profile.facts.length - 10} autre(s) fait(s)\n`;
                }
            }

            if (
                profile.personality.traits.length === 0 &&
                profile.personality.interests.length === 0 &&
                !profile.personality.communicationStyle &&
                profile.facts.length === 0
            ) {
                profileText += `ℹ️ Le profil existe mais est vide pour le moment.`;
            }

            profileText += `\n\n🕐 **Dernière interaction:** ${new Date(profile.lastInteraction).toLocaleString("fr-FR")}`;

            await interaction.editReply({content: profileText});
        } catch (error) {
            console.error("[Profile Command] Error:", error);
            await interaction.editReply({
                content: "❌ Une erreur s'est produite lors de la récupération du profil.",
            });
        }
    },
};
