import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";
import {createErrorEmbed, createSuccessEmbed, logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-note")
        .setDescription("Ajoute une note sur le profil d'un utilisateur")
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
        .addStringOption((option) => option.setName("content").setDescription("Contenu de la note").setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ephemeral: true});

        try {
            const targetUser = interaction.options.getUser("user", true);
            const noteType = interaction.options.getString("type", true);
            const content = interaction.options.getString("content", true);

            const userId = targetUser.id;
            const username = targetUser.username;

            let successEmbed;
            let typeLabel = "";

            switch (noteType) {
                case "fact":
                    UserProfileService.addFact(userId, username, content);
                    typeLabel = "Fait";
                    successEmbed = createSuccessEmbed(
                        "Fait ajouté au profil",
                        `✅ Un **fait** a été ajouté au profil de Netricsa concernant **${username}** :\n\n` +
                        `💡 "${content}"`
                    );
                    break;

                case "alias":
                    UserProfileService.addAlias(userId, username, content);
                    typeLabel = "Alias";
                    successEmbed = createSuccessEmbed(
                        "Alias ajouté au profil",
                        `✅ Un **alias** a été ajouté au profil de Netricsa concernant **${username}** :\n\n` +
                        `🏷️ "${content}"`
                    );
                    break;

                case "interest":
                    UserProfileService.addInterest(userId, username, content);
                    typeLabel = "Intérêt";
                    successEmbed = createSuccessEmbed(
                        "Intérêt ajouté au profil",
                        `✅ Un **centre d'intérêt** a été ajouté au profil de Netricsa concernant **${username}** :\n\n` +
                        `❤️ "${content}"`
                    );
                    break;
            }

            await interaction.editReply({
                embeds: [successEmbed!]
            });

            console.log(`[Note Command] ${interaction.user.username} added ${noteType} to ${username}: "${content}"`);

            await logCommand(`📝 Note ajoutée`, undefined, [
                {name: "👤 Par", value: interaction.user.username, inline: true},
                {name: "👥 Utilisateur", value: username, inline: true},
                {name: "🏷️ Type", value: typeLabel, inline: true},
                {name: "📄 Contenu", value: content.length > 100 ? content.substring(0, 100) + "..." : content, inline: false}
            ]);
        } catch (error) {
            console.error("[Note Command] Error:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                "❌ Une erreur s'est produite lors de l'ajout de la note au profil de Netricsa."
            );
            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    },
};
