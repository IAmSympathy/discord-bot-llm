import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import figlet from "figlet";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ascii")
        .setDescription("🔤 Convertit du texte en art ASCII")
        .addStringOption((option) =>
            option
                .setName("text")
                .setDescription("Le texte à convertir en ASCII (max 20 caractères)")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("style")
                .setDescription("Style de l'art ASCII")
                .setRequired(false)
                .addChoices(
                    {name: "Standard", value: "standard"},
                    {name: "Banner", value: "banner"},
                    {name: "Big", value: "big"},
                    {name: "Block", value: "block"},
                    {name: "Bubble", value: "bubble"},
                    {name: "Digital", value: "digital"},
                    {name: "Lean", value: "lean"},
                    {name: "Mini", value: "mini"},
                    {name: "Script", value: "script"},
                    {name: "Shadow", value: "shadow"},
                    {name: "Slant", value: "slant"},
                    {name: "Small", value: "small"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            let text = interaction.options.getString("text", true);
            const style = interaction.options.getString("style") || "standard";

            // Limiter à 20 caractères
            if (text.length > 20) {
                await interaction.reply({
                    content: "❌ Le texte ne peut pas dépasser 20 caractères !",
                    ephemeral: true
                });
                return;
            }

            // Répondre immédiatement pour éviter le timeout
            await interaction.deferReply();

            // Générer l'art ASCII
            figlet.text(
                text,
                {
                    font: style as any,
                    horizontalLayout: "default",
                    verticalLayout: "default",
                    width: 80,
                    whitespaceBreak: true
                },
                async (err, asciiArt) => {
                    if (err) {
                        console.error("Figlet error:", err);
                        await interaction.editReply({
                            content: "❌ Erreur lors de la génération de l'art ASCII."
                        });
                        return;
                    }

                    if (!asciiArt) {
                        await interaction.editReply({
                            content: "❌ Impossible de générer l'art ASCII."
                        });
                        return;
                    }

                    // Vérifier que le résultat n'est pas trop long pour Discord (2000 caractères)
                    if (asciiArt.length > 1900) {
                        await interaction.editReply({
                            content: "❌ Le résultat est trop long pour Discord. Essaie avec un texte plus court ou un autre style."
                        });
                        return;
                    }

                    // Créer l'embed
                    const embed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("🎨 Art ASCII")
                        .setDescription(`**Texte :** ${text}\n**Style :** ${style}`)
                        .setFooter({text: `Créé par ${interaction.user.displayName}`})
                        .setTimestamp();

                    // Envoyer l'art ASCII dans un bloc de code
                    await interaction.editReply({
                        embeds: [embed],
                        content: `\`\`\`\n${asciiArt}\n\`\`\``
                    });

                    // Logger la commande
                    await logCommand(
                        "🎨 ASCII Art",
                        undefined,
                        [
                            {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                            {name: "📝 Texte", value: text, inline: true},
                            {name: "🎨 Style", value: style, inline: true}
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
                }
            );

        } catch (error) {
            console.error("Error in ascii command:", error);
            if (interaction.deferred) {
                await interaction.editReply({
                    content: "Une erreur s'est produite lors de la génération de l'art ASCII."
                });
            } else {
                await interaction.reply({
                    content: "Une erreur s'est produite lors de la génération de l'art ASCII.",
                    ephemeral: true
                });
            }
        }
    },
};
