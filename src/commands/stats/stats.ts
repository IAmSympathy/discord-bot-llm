import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, User} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {getPlayerStats} from "../../games/common/globalStats";
import {createDiscordStatsEmbed, createNetricsaStatsEmbed, createProfileEmbed, createServerStatsEmbed, getLevelText, StatsCategory} from "../../utils/statsEmbedBuilder";

/**
 * Crée le bouton "Voir les statistiques" pour le profil
 */
function createViewStatsButton(userId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`profile_view_stats_${userId}`)
            .setLabel("Voir les statistiques")
            .setEmoji("📊")
            .setStyle(ButtonStyle.Primary)
    );
}

/**
 * Crée l'embed pour les statistiques de jeux avec choix de type de jeu
 */
function createGameStatsEmbed(targetUser: User, gameType: string): EmbedBuilder {
    // Si c'est le bot, afficher ses vraies stats de jeux
    const isBot = targetUser.bot;
    const stats = isBot ? getPlayerStats("NETRICSA_BOT") : getPlayerStats(targetUser.id);

    let description = "";
    let title = isBot ? `📊 Mes Statistiques de Jeux (Netricsa)` : `📊 Statistiques de ${targetUser.displayName}`;

    // Ajouter le niveau en haut (sauf pour Netricsa)
    if (!isBot) {
        description += getLevelText(targetUser.id);
    }

    if (gameType === "global") {
        title += " - Jeux (Global)";
        const globalStats = stats.global;
        const totalGames = globalStats.wins + globalStats.losses + globalStats.draws;

        if (totalGames === 0) {
            if (isBot) {
                description += "Aucune partie jouée pour le moment. Je suis prête à affronter les joueurs ! 🎮";
            } else {
                description += "Aucune partie jouée pour le moment.";
            }
        } else {
            description += `**Total de parties :** ${totalGames}\n\n`;
            description += `🏆 **Victoires :** ${globalStats.wins}\n`;
            description += `💀 **Défaites :** ${globalStats.losses}\n`;
            if (globalStats.draws > 0) {
                description += `🤝 **Égalités :** ${globalStats.draws}\n`;
            }
            description += `\n`;
            if (globalStats.currentStreak > 0) {
                description += `🔥 **Série actuelle :** ${globalStats.currentStreak}\n`;
            }
            if (globalStats.highestStreak > 0) {
                description += `⭐ **Meilleure série :** ${globalStats.highestStreak}\n`;
            }

            const winRate = ((globalStats.wins / totalGames) * 100).toFixed(1);
            description += `\n📈 **Taux de victoire :** ${winRate}%`;

            if (isBot) {
                description += `\n\n✨ Voilà mes performances contre tous les joueurs !`;
            }
        }
    } else {
        const gameNames: Record<string, string> = {
            rockpaperscissors: "Roche-Papier-Ciseaux",
            tictactoe: "Tic-Tac-Toe",
            hangman: "Pendu"
        };

        title += ` - Jeux (${gameNames[gameType]})`;
        const gameStats = stats[gameType as 'rockpaperscissors' | 'tictactoe' | 'hangman'];
        const totalGames = gameStats.wins + gameStats.losses + gameStats.draws;

        if (totalGames === 0) {
            if (isBot && gameType === "hangman") {
                description += `Je ne joue pas au Pendu (c'est un jeu solo), mais je compte les scores ! 🎮`;
            } else if (isBot) {
                description += `Aucune partie de ${gameNames[gameType]} jouée pour le moment. Viens m'affronter ! 🎮`;
            } else {
                description += `Aucune partie de ${gameNames[gameType]} jouée pour le moment.`;
            }
        } else {
            description += `**Total de parties :** ${totalGames}\n\n`;
            description += `🏆 **Victoires :** ${gameStats.wins}\n`;
            description += `💀 **Défaites :** ${gameStats.losses}\n`;
            if (gameStats.draws > 0) {
                description += `🤝 **Égalités :** ${gameStats.draws}\n`;
            }
            description += `\n`;
            if (gameStats.currentStreak > 0) {
                description += `🔥 **Série actuelle :** ${gameStats.currentStreak}\n`;
            }
            if (gameStats.highestStreak > 0) {
                description += `⭐ **Meilleure série :** ${gameStats.highestStreak}\n`;
            }

            const winRate = ((gameStats.wins / totalGames) * 100).toFixed(1);
            description += `\n📈 **Taux de victoire :** ${winRate}%`;

            if (isBot) {
                description += `\n\n✨ Mes performances à ${gameNames[gameType]} !`;
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0x397d86)
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({text: "Stats depuis le 5 février 2026"})
        .setTimestamp();


    return embed;
}

/**
 * Crée les boutons de navigation
 */
function createNavigationButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("stats_discord")
            .setLabel("Discord")
            .setEmoji("📨")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("stats_netricsa")
            .setLabel("Netricsa")
            .setEmoji("🤖")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("stats_jeux")
            .setLabel("Jeux")
            .setEmoji("🎮")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("stats_serveur")
            .setLabel("Serveur")
            .setEmoji("🌐")
            .setStyle(ButtonStyle.Secondary)
    );
}

/**
 * Crée le bouton "Retour au profil"
 */
function createBackToProfileButton(userId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`stats_back_to_profile_${userId}`)
            .setLabel("Retour au profil")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Danger)
    );
}

/**
 * Crée le menu de sélection des jeux
 */
function createGameSelectMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("stats_game_select")
            .setPlaceholder("Choisir un jeu")
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("Global")
                    .setDescription("Statistiques globales de tous les jeux")
                    .setValue("global")
                    .setEmoji("🌐"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Roche-Papier-Ciseaux")
                    .setDescription("Statistiques du jeu Roche-Papier-Ciseaux")
                    .setValue("rockpaperscissors")
                    .setEmoji("🪨"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Tic-Tac-Toe")
                    .setDescription("Statistiques du jeu Tic-Tac-Toe")
                    .setValue("tictactoe")
                    .setEmoji("❌"),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Pendu")
                    .setDescription("Statistiques du jeu Pendu")
                    .setValue("hangman")
                    .setEmoji("🔤")
            )
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Affiche tes statistiques")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Voir les stats d'un autre utilisateur")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            let currentCategory: StatsCategory = "discord";
            let currentGameType = "global";

            // Créer l'embed initial (Discord)
            let embed = createDiscordStatsEmbed(targetUser);
            const navigationButtons = createNavigationButtons();
            const backToProfileButton = createBackToProfileButton(targetUser.id);
            const gameSelectMenu = createGameSelectMenu();

            const message = await interaction.reply({
                embeds: [embed],
                components: [navigationButtons, backToProfileButton],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });

            // Créer un collector pour les interactions
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            const selectCollector = message.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 300000
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

                if (buttonId === "stats_jeux") {
                    currentCategory = "jeux";
                    embed = createGameStatsEmbed(targetUser, currentGameType);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, gameSelectMenu, backToProfileButton]
                    });
                } else if (buttonId === "stats_discord") {
                    currentCategory = "discord";
                    embed = createDiscordStatsEmbed(targetUser);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                } else if (buttonId === "stats_netricsa") {
                    currentCategory = "netricsa";
                    embed = createNetricsaStatsEmbed(targetUser);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                } else if (buttonId === "stats_serveur") {
                    currentCategory = "serveur";
                    embed = createServerStatsEmbed(interaction.guild);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                } else if (buttonId.startsWith("stats_back_to_profile_")) {
                    // Retour au profil
                    const profileEmbed = createProfileEmbed(targetUser);
                    const viewStatsButton = createViewStatsButton(targetUser.id);
                    await buttonInteraction.update({
                        embeds: [profileEmbed],
                        components: [viewStatsButton]
                    });
                } else if (buttonId.startsWith("profile_view_stats_")) {
                    // Retour aux stats depuis le profil
                    currentCategory = "discord";
                    embed = createDiscordStatsEmbed(targetUser);
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons, backToProfileButton]
                    });
                }
            });

            selectCollector.on("collect", async (selectInteraction) => {
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({
                        content: "❌ Ce menu n'est pas pour toi !",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                currentGameType = selectInteraction.values[0];
                embed = createGameStatsEmbed(targetUser, currentGameType);
                await selectInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons, gameSelectMenu, backToProfileButton]
                });
            });

            collector.on("end", async () => {
                // Désactiver les boutons après expiration
                try {
                    await interaction.editReply({
                        components: []
                    });
                } catch (error) {
                    // Ignorer les erreurs si le message a été supprimé
                }
            });

        } catch (error: any) {
            await handleInteractionError(interaction, error, "Stats");
        }
    },
};

/**
 * Export de la fonction pour l'appeler depuis d'autres fichiers (comme profile)
 */
export async function showStatsForUser(interaction: any, targetUser: User) {
    try {
        let currentCategory: StatsCategory = "discord";
        let currentGameType = "global";

        let embed = createDiscordStatsEmbed(targetUser);
        const navigationButtons = createNavigationButtons();
        const gameSelectMenu = createGameSelectMenu();

        // Détecter si l'interaction a été différée ou répondue
        const isDeferred = interaction.deferred && !interaction.replied;
        const isAlreadyReplied = interaction.replied;

        let message;
        if (isDeferred) {
            // Pour les interactions différées (deferReply), utiliser editReply
            message = await interaction.editReply({
                embeds: [embed],
                components: [navigationButtons],
                fetchReply: true
            });
        } else if (isAlreadyReplied) {
            // Pour les interactions déjà répondues, utiliser followUp
            message = await interaction.followUp({
                embeds: [embed],
                components: [navigationButtons],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });
        } else {
            // Pour les nouvelles interactions (commandes slash), utiliser reply
            message = await interaction.reply({
                embeds: [embed],
                components: [navigationButtons],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });
        }

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000
        });

        const selectCollector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 300000
        });

        collector.on("collect", async (buttonInteraction: any) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: "❌ Ces boutons ne sont pas pour toi !",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const buttonId = buttonInteraction.customId;

            if (buttonId === "stats_jeux") {
                currentCategory = "jeux";
                embed = createGameStatsEmbed(targetUser, currentGameType);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons, gameSelectMenu]
                });
            } else if (buttonId === "stats_discord") {
                currentCategory = "discord";
                embed = createDiscordStatsEmbed(targetUser);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons]
                });
            } else if (buttonId === "stats_netricsa") {
                currentCategory = "netricsa";
                embed = createNetricsaStatsEmbed(targetUser);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons]
                });
            } else if (buttonId === "stats_serveur") {
                currentCategory = "serveur";
                embed = createServerStatsEmbed(interaction.guild);
                await buttonInteraction.update({
                    embeds: [embed],
                    components: [navigationButtons]
                });
            }
        });

        selectCollector.on("collect", async (selectInteraction: any) => {
            if (selectInteraction.user.id !== interaction.user.id) {
                await selectInteraction.reply({
                    content: "❌ Ce menu n'est pas pour toi !",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            currentGameType = selectInteraction.values[0];
            embed = createGameStatsEmbed(targetUser, currentGameType);
            await selectInteraction.update({
                embeds: [embed],
                components: [navigationButtons, gameSelectMenu]
            });
        });

        collector.on("end", async () => {
            try {
                // Désactiver les composants du message des stats
                if (isDeferred || !isAlreadyReplied) {
                    // Pour les interactions différées ou les commandes slash, utiliser editReply
                    await interaction.editReply({
                        components: []
                    });
                } else {
                    // Pour les interactions déjà répondues (followUp), éditer le message directement
                    await message.edit({
                        components: []
                    });
                }
            } catch (error) {
                // Ignorer les erreurs
            }
        });
    } catch (error) {
        console.error("Error showing stats:", error);
    }
}

