import {ChatInputCommandInteraction, ContainerBuilder, MessageFlags, SlashCommandBuilder, TextChannel, TextDisplayBuilder} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import figlet from "figlet";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

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
                    {name: "📝 Standard", value: "Standard"},
                    {name: "🎉 Banner", value: "Banner"},
                    {name: "🏋️‍♂️ Big", value: "Big"},
                    {name: "🧱 Block", value: "Block"},
                    {name: "💬 Bubble", value: "Bubble"},
                    {name: "💻 Digital", value: "Digital"},
                    {name: "🏃 Lean", value: "Lean"},
                    {name: "🐜 Mini", value: "Mini"},
                    {name: "✒️ Script", value: "Script"},
                    {name: "🌑 Shadow", value: "Shadow"},
                    {name: "🔻 Slant", value: "Slant"},
                    {name: "🔹 Small", value: "Small"}
                )
        ),


    async execute(interaction: ChatInputCommandInteraction) {
        try {
            let text = interaction.options.getString("text", true);
            const style = interaction.options.getString("style") || "Standard";

            // Limiter à 20 caractères
            if (text.length > 20) {
                await interaction.reply({
                    content: "❌ Le texte ne peut pas dépasser 20 caractères !",
                    ephemeral: true
                });
                return;
            }


            // Message d'animation
            await interaction.reply(`<a:namaste_coudasaille:1133160371612569650> *Création de l'art ASCII...*`);

            // Attendre un peu pour l'effet d'animation
            await new Promise(resolve => setTimeout(resolve, 1500));

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

                    // Construire le Container Components v2
                    const textContent = `### 🔤 Art ASCII\n📝 Texte : \`${text}\`⠀⠀🎨 Style : \`${style}\`\n\`\`\`\n${asciiArt}\n\`\`\`\n-# Créé par ${interaction.user.displayName}`;

                    const container = new ContainerBuilder()
                        .setAccentColor(0x357bb0)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));

                    await interaction.editReply({
                        content: "",
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });

                    // Logger la commande
                    const channelName = getChannelNameFromInteraction(interaction);
                    await logCommand(
                        "🎨 ASCII Art",
                        undefined,
                        [
                            {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                            {name: "📝 Texte", value: text, inline: true},
                            {name: "🎨 Style", value: style, inline: true}
                        ],
                        undefined,
                        channelName,
                        interaction.user.displayAvatarURL()
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
                    // Chance d'obtenir un objet saisonnier (3% - commande Netricsa)
                    const {tryRewardAndNotify} = require("../../services/rewardNotifier");
                    await tryRewardAndNotify(interaction, interaction.user.id, interaction.user.username, "command");

                    // Tracker les achievements de ascii
                    const {trackAsciiAchievements} = require("../../services/achievementService");
                    await trackAsciiAchievements(interaction.user.id, interaction.user.username, interaction.client, interaction.channelId);

                    // Enregistrer l'utilisation d'une commande fun (pour les défis quotidiens)
                    const {recordFunCommandStats} = require("../../services/statsRecorder");
                    recordFunCommandStats(interaction.user.id, interaction.user.username);
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
