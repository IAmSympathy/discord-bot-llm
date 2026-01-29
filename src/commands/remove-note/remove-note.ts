import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-note")
        .setDescription("Supprime une note du profil d'un utilisateur")
        .addUserOption((option) => option.setName("user").setDescription("L'utilisateur concerné").setRequired(true))
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type de note")
                .setRequired(true)
                .addChoices(
                    {name: "Fait", value: "fact"},
                    {name: "Alias (surnom)", value: "alias"},
                    {name: "Centre d'intérêt", value: "interest"}
                )
        )
        .addStringOption((option) => option.setName("content").setDescription("Contenu à supprimer (exact ou partiel)").setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.options.getUser("user", true);
            const removeType = interaction.options.getString("type", true);
            const content = interaction.options.getString("content", true);

            const userId = targetUser.id;
            const username = targetUser.username;

            let success = false;

            switch (removeType) {
                case "fact":
                    success = await UserProfileService.removeFact(userId, username, content);
                    if (success) {
                        await interaction.editReply({
                            content: `Fait supprimé du profil de **${username}**`,
                        });
                    } else {
                        await interaction.editReply({
                            content: `Fait non trouvé dans le profil de **${username}**. Essayez avec un texte plus court ou vérifiez le profil avec \`/profile\`.`,
                        });
                    }
                    break;

                case "alias":
                    success = await UserProfileService.removeAlias(userId, username, content);
                    if (success) {
                        await interaction.editReply({
                            content: `Alias supprimé du profil de **${username}**: "${content}"`,
                        });
                    } else {
                        await interaction.editReply({
                            content: `Alias non trouvé: "${content}"`,
                        });
                    }
                    break;

                case "interest":
                    success = await UserProfileService.removeInterest(userId, username, content);
                    if (success) {
                        await interaction.editReply({
                            content: `Centre d'intérêt supprimé du profil de **${username}**: "${content}"`,
                        });
                    } else {
                        await interaction.editReply({
                            content: `Centre d'intérêt non trouvé: "${content}"`,
                        });
                    }
                    break;
            }

            console.log(`[Remove Command] ${interaction.user.username} removed ${removeType} from ${username}: "${content}" (success: ${success})`);

            if (success) {
                await logCommand(`🗑️ Note supprimée`, undefined, [
                    {name: "👤 Par", value: interaction.user.username, inline: true},
                    {name: "👥 Utilisateur", value: username, inline: true},
                    {name: "🏷️ Type", value: removeType === "fact" ? "Fait" : removeType === "alias" ? "Alias" : "Intérêt", inline: true},
                    {name: "📄 Contenu", value: content.length > 100 ? content.substring(0, 100) + "..." : content, inline: false}
                ]);
            }
        } catch (error) {
            console.error("[Remove Command] Error:", error);
            await interaction.editReply({
                content: "Une erreur s'est produite lors de la suppression.",
            });
        }
    },
};
