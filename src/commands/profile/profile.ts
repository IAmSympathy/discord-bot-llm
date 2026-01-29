import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
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
        await interaction.deferReply({flags: MessageFlags.Ephemeral});

        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;

            // Mettre à jour les rôles Discord de l'utilisateur si possible
            if (interaction.guild) {
                try {
                    const member = await interaction.guild.members.fetch(targetUser.id);
                    if (member) {
                        const userRoles = member.roles.cache
                            .filter(role => role.name !== "@everyone")
                            .map(role => role.name);

                        if (userRoles.length > 0) {
                            await UserProfileService.updateRoles(targetUser.id, targetUser.username, userRoles);
                        }
                    }
                } catch (error) {
                    console.log(`[Profile Command] Could not fetch member roles for ${targetUser.username}`);
                }
            }

            const profile = UserProfileService.getProfile(targetUser.id);

            if (!profile) {
                const noProfileEmbed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("❌ Profil introuvable")
                    .setDescription(`Aucun profil trouvé pour **${targetUser.username}**.\nL'IA n'a pas encore appris d'informations sur cet utilisateur.`)
                    .setTimestamp();

                await interaction.editReply({embeds: [noProfileEmbed]});
                return;
            }

            // Créer l'embed avec une couleur dynamique
            const embed = new EmbedBuilder()
                .setColor(0x397d86)
                .setTitle(`📋 Profil de ${profile.username}`)
                .setThumbnail(targetUser.displayAvatarURL({size: 128}))
                .setTimestamp()
                .setFooter({text: `ID: ${targetUser.id}`});

            // Vérifier si le profil a du contenu
            const hasContent =
                profile.roles.length > 0 ||
                profile.aliases.length > 0 ||
                profile.interests.length > 0 ||
                profile.facts.length > 0;

            if (!hasContent) {
                embed.setDescription("ℹ️ Le profil existe mais est vide pour le moment.");
                await interaction.editReply({embeds: [embed]});
                return;
            }


            // Aliases (surnoms)
            if (profile.aliases.length > 0) {
                const aliasesText = profile.aliases.map(alias => `• ${alias}`).join("\n");
                embed.addFields({
                    name: "🏷️ Surnoms",
                    value: aliasesText,
                    inline: true
                });
            }

            // Rôles Discord
            if (profile.roles.length > 0) {
                const rolesText = profile.roles.map(role => `• ${role}`).join("\n");
                embed.addFields({
                    name: "👥 Rôles Discord",
                    value: rolesText,
                    inline: true
                });
            }

            // Intérêts
            if (profile.interests.length > 0) {
                const interestsText = profile.interests.map(interest => `• ${interest}`).join("\n");
                embed.addFields({
                    name: "💡 Centres d'intérêt",
                    value: interestsText,
                });
            }

            // Faits
            if (profile.facts.length > 0) {
                const recentFacts = profile.facts
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .slice(0, 10);

                const factsText = recentFacts.map(fact => {
                    const date = new Date(fact.timestamp).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                    });
                    return `• ${fact.content} *(${date})*`;
                }).join("\n");

                const factsTitle = profile.facts.length > 10
                    ? `📝 Faits enregistrés (${profile.facts.length} - affichage limité à 10)`
                    : `📝 Faits enregistrés (${profile.facts.length})`;

                embed.addFields({
                    name: factsTitle,
                    value: factsText,
                    inline: false
                });
            }

            await interaction.editReply({embeds: [embed]});
        } catch (error) {
            console.error("[Profile Command] Error:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("❌ Erreur")
                .setDescription("Une erreur s'est produite lors de la récupération du profil.")
                .setTimestamp();

            await interaction.editReply({embeds: [errorEmbed]});
        }
    },
};
