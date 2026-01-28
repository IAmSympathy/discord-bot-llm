import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {UserProfileService} from "../../services/userProfileService";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("note")
        .setDescription("Ajoute une note sur un utilisateur dans le profil")
        .addUserOption((option) => option.setName("user").setDescription("L'utilisateur concerné").setRequired(true))
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type de note")
                .setRequired(true)
                .addChoices(
                    {name: "Fait", value: "fact"},
                    {name: "Trait de personnalité", value: "trait"},
                    {name: "Centre d'intérêt", value: "interest"},
                    {name: "Style de communication", value: "style"}
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

            switch (noteType) {
                case "fact":
                    UserProfileService.addFact(userId, username, content, `Ajouté manuellement par ${interaction.user.username}`, 1.0);
                    await interaction.editReply({
                        content: `Fait ajouté au profil de **${username}**: "${content}"`,
                    });
                    break;

                case "trait":
                    UserProfileService.addPersonalityTrait(userId, username, content);
                    await interaction.editReply({
                        content: `Trait de personnalité ajouté au profil de **${username}**: "${content}"`,
                    });
                    break;

                case "interest":
                    UserProfileService.addInterest(userId, username, content);
                    await interaction.editReply({
                        content: `Centre d'intérêt ajouté au profil de **${username}**: "${content}"`,
                    });
                    break;

                case "style":
                    UserProfileService.setCommunicationStyle(userId, username, content);
                    await interaction.editReply({
                        content: `Style de communication défini pour **${username}**: "${content}"`,
                    });
                    break;
            }

            console.log(`[Note Command] ${interaction.user.username} added ${noteType} to ${username}: "${content}"`);
        } catch (error) {
            console.error("[Note Command] Error:", error);
            await interaction.editReply({
                content: "Une erreur s'est produite lors de l'ajout de la note.",
            });
        }
    },
};
