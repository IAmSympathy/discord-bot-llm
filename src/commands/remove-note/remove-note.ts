import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {logCommand} from "../../utils/discordLogger";
import {createErrorEmbed, createSuccessEmbed, createWarningEmbed} from "../../utils/interactionUtils";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-note")
        .setDescription("🧹 Supprime une note du profil NETRICSA d'un utilisateur")
        .addUserOption((option) => option.setName("user").setDescription("L'utilisateur concerné").setRequired(true))
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type de note")
                .setRequired(true)
                .addChoices(
                    {name: "Fait", value: "fact"},
                    {name: "Surnom", value: "alias"},
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
            let typeLabel = "";

            switch (removeType) {
                case "fact":
                    success = await UserProfileService.removeFact(userId, username, content);
                    typeLabel = "Fait";
                    if (success) {
                        const successEmbed = createSuccessEmbed(
                            "Fait supprimé",
                            `Un **fait** a été supprimé du profil de Netricsa concernant **${username}**.`
                        );
                        await interaction.editReply({embeds: [successEmbed]});
                    } else {
                        const warningEmbed = createWarningEmbed(
                            "Fait non trouvé",
                            `Le fait spécifié n'a pas été trouvé dans le profil de Netricsa concernant **${username}**.\n\n` +
                            `Essayez avec un texte plus court ou vérifiez le profil avec \`/profile\`.`
                        );
                        await interaction.editReply({embeds: [warningEmbed]});
                    }
                    break;

                case "alias":
                    success = await UserProfileService.removeAlias(userId, username, content);
                    typeLabel = "Surnom";
                    if (success) {
                        const successEmbed = createSuccessEmbed(
                            "Surnom supprimé",
                            `Le **surnom** "${content}" a été supprimé du profil de Netricsa concernant **${username}**.`
                        );
                        await interaction.editReply({embeds: [successEmbed]});
                    } else {
                        const warningEmbed = createWarningEmbed(
                            "Surnom non trouvé",
                            `Le surnom "${content}" n'a pas été trouvé dans le profil de Netricsa.`
                        );
                        await interaction.editReply({embeds: [warningEmbed]});
                    }
                    break;

                case "interest":
                    success = await UserProfileService.removeInterest(userId, username, content);
                    typeLabel = "Intérêt";
                    if (success) {
                        const successEmbed = createSuccessEmbed(
                            "Intérêt supprimé",
                            `Le **centre d'intérêt** "${content}" a été supprimé du profil de Netricsa concernant **${username}**.`
                        );
                        await interaction.editReply({embeds: [successEmbed]});
                    } else {
                        const warningEmbed = createWarningEmbed(
                            "Intérêt non trouvé",
                            `Le centre d'intérêt "${content}" n'a pas été trouvé dans le profil de Netricsa.`
                        );
                        await interaction.editReply({embeds: [warningEmbed]});
                    }
                    break;
            }

            console.log(`[Remove Command] ${interaction.user.username} removed ${removeType} from ${username}: "${content}" (success: ${success})`);

            if (success) {
                const channelName = getChannelNameFromInteraction(interaction);
                await logCommand(`🗑️ Note supprimée`, undefined, [
                    {name: "👤 Par", value: interaction.user.username, inline: true},
                    {name: "👥 Utilisateur", value: username, inline: true},
                    {name: "🏷️ Type", value: typeLabel, inline: true},
                    {name: "📄 Contenu", value: content.length > 100 ? content.substring(0, 100) + "..." : content, inline: false}
                ], undefined, channelName, interaction.user.displayAvatarURL());
            }
        } catch (error) {
            console.error("[Remove Command] Error:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                "Une erreur s'est produite lors de la suppression de la note du profil de Netricsa."
            );
            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    },
};
