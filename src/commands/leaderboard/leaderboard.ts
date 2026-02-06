import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
import {getAllXP} from "../../services/xpSystem";
import {getAllStats} from "../../services/userStatsService";
import {getGlobalLeaderboard} from "../../games/common/globalStats";

type LeaderboardCategory = "xp" | "messages" | "vocal" | "images" | "jeux";

/**
 * Crée l'embed du leaderboard pour une catégorie donnée
 */
function createLeaderboardEmbed(
    category: LeaderboardCategory,
    interaction: ChatInputCommandInteraction
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0x397d86)
        .setTimestamp()
        .setFooter({text: "Leaderboard depuis le 5 février 2026"});

    let description = "";
    let title = "";

    switch (category) {
        case "xp": {
            title = "🏆 Classement par Niveau & XP";
            const allXP = getAllXP();
            const sortedXP = Object.values(allXP)
                .sort((a, b) => b.totalXP - a.totalXP)
                .slice(0, 10);

            if (sortedXP.length === 0) {
                description = "Aucune donnée XP disponible.";
            } else {
                sortedXP.forEach((data, index) => {
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
                    description += `${medal} **${data.username}** - Niveau ${data.level} (${data.totalXP.toLocaleString()} XP)\n`;
                });
            }
            break;
        }

        case "messages": {
            title = "📨 Classement par Messages Envoyés";
            const allStats = getAllStats();
            const sortedStats = Object.values(allStats)
                .sort((a, b) => b.discord.messagesEnvoyes - a.discord.messagesEnvoyes)
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "Aucune donnée disponible.";
            } else {
                sortedStats.forEach((data, index) => {
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
                    description += `${medal} **${data.username}** - ${data.discord.messagesEnvoyes.toLocaleString()} messages\n`;
                });
            }
            break;
        }

        case "vocal": {
            title = "🎤 Classement par Temps Vocal";
            const allStats = getAllStats();
            const sortedStats = Object.values(allStats)
                .filter(s => s.discord.tempsVocalMinutes > 0)
                .sort((a, b) => b.discord.tempsVocalMinutes - a.discord.tempsVocalMinutes)
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "Aucune donnée disponible.";
            } else {
                sortedStats.forEach((data, index) => {
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
                    const hours = Math.floor(data.discord.tempsVocalMinutes / 60);
                    const mins = data.discord.tempsVocalMinutes % 60;
                    const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;
                    description += `${medal} **${data.username}** - ${timeStr}\n`;
                });
            }
            break;
        }

        case "images": {
            title = "🎨 Classement par Images Créées";
            const allStats = getAllStats();
            const sortedStats = Object.values(allStats)
                .map(s => ({
                    ...s,
                    totalImages: s.netricsa.imagesGenerees + s.netricsa.imagesReimaginee
                }))
                .filter(s => s.totalImages > 0)
                .sort((a, b) => b.totalImages - a.totalImages)
                .slice(0, 10);

            if (sortedStats.length === 0) {
                description = "Aucune donnée disponible.";
            } else {
                sortedStats.forEach((data, index) => {
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
                    description += `${medal} **${data.username}** - ${data.totalImages} images\n`;
                });
            }
            break;
        }

        case "jeux": {
            title = "🎮 Classement par Taux de Victoire";
            const leaderboard = getGlobalLeaderboard(10);

            if (leaderboard.length === 0) {
                description = "Aucune donnée de jeux disponible.";
            } else {
                leaderboard.forEach((entry, index) => {
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
                    const totalGames = entry.wins + entry.losses + entry.draws;
                    const winRate = ((entry.wins / totalGames) * 100).toFixed(1);
                    description += `${medal} **${entry.username}** - ${winRate}% (${entry.wins}V/${entry.losses}D/${totalGames}P)\n`;
                });
            }
            break;
        }
    }

    embed.setTitle(title);
    embed.setDescription(description || "Aucune donnée disponible.");

    return embed;
}

/**
 * Crée les boutons de navigation pour le leaderboard
 */
function createLeaderboardButtons(currentCategory: LeaderboardCategory): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("leaderboard_xp")
            .setLabel("XP")
            .setEmoji("🏆")
            .setStyle(currentCategory === "xp" ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentCategory === "xp"),
        new ButtonBuilder()
            .setCustomId("leaderboard_messages")
            .setLabel("Messages")
            .setEmoji("📨")
            .setStyle(currentCategory === "messages" ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentCategory === "messages"),
        new ButtonBuilder()
            .setCustomId("leaderboard_vocal")
            .setLabel("Vocal")
            .setEmoji("🎤")
            .setStyle(currentCategory === "vocal" ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentCategory === "vocal"),
        new ButtonBuilder()
            .setCustomId("leaderboard_images")
            .setLabel("Images")
            .setEmoji("🎨")
            .setStyle(currentCategory === "images" ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentCategory === "images"),
        new ButtonBuilder()
            .setCustomId("leaderboard_jeux")
            .setLabel("Jeux")
            .setEmoji("🎮")
            .setStyle(currentCategory === "jeux" ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentCategory === "jeux")
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Affiche le classement des utilisateurs")
        .addStringOption(option =>
            option
                .setName("categorie")
                .setDescription("Catégorie du classement")
                .setRequired(false)
                .addChoices(
                    {name: "🏆 XP & Niveau", value: "xp"},
                    {name: "📨 Messages", value: "messages"},
                    {name: "🎤 Temps Vocal", value: "vocal"},
                    {name: "🎨 Images Créées", value: "images"},
                    {name: "🎮 Jeux", value: "jeux"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            let currentCategory = (interaction.options.getString("categorie") as LeaderboardCategory) || "xp";

            // Créer l'embed initial
            let embed = createLeaderboardEmbed(currentCategory, interaction);
            const buttons = createLeaderboardButtons(currentCategory);

            const message = await interaction.reply({
                embeds: [embed],
                components: [buttons],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });

            // Créer un collector pour les boutons
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on("collect", async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: "❌ Ces boutons ne sont pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const buttonId = buttonInteraction.customId;

                if (buttonId.startsWith("leaderboard_")) {
                    currentCategory = buttonId.replace("leaderboard_", "") as LeaderboardCategory;
                    embed = createLeaderboardEmbed(currentCategory, interaction);
                    const newButtons = createLeaderboardButtons(currentCategory);

                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [newButtons]
                    });
                }
            });

            collector.on("end", async () => {
                try {
                    // Désactiver tous les boutons après expiration
                    const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId("leaderboard_xp")
                            .setLabel("XP")
                            .setEmoji("🏆")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_messages")
                            .setLabel("Messages")
                            .setEmoji("📨")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_vocal")
                            .setLabel("Vocal")
                            .setEmoji("🎤")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_images")
                            .setLabel("Images")
                            .setEmoji("🎨")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId("leaderboard_jeux")
                            .setLabel("Jeux")
                            .setEmoji("🎮")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );

                    await interaction.editReply({
                        components: [disabledButtons]
                    });
                } catch (error) {
                    // Ignorer les erreurs si le message a été supprimé
                }
            });
        } catch (error) {
            console.error("[Leaderboard] Error:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("❌ Erreur")
                .setDescription("Une erreur s'est produite lors de l'affichage du leaderboard.");

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            }
        }
    }
};
