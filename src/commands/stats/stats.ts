import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, User} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {getPlayerStats} from "../../games/common/globalStats";
import {getNetricsaStats, getServerStats, getUserStats} from "../../services/userStatsService";

type StatsCategory = "jeux" | "discord" | "netricsa" | "serveur";

/**
 * Crée l'embed pour les statistiques de jeux
 */
function createGameStatsEmbed(targetUser: User, gameType: string): EmbedBuilder {
    // Si c'est le bot, afficher ses vraies stats de jeux
    const isBot = targetUser.bot;
    const stats = isBot ? getPlayerStats("NETRICSA_BOT") : getPlayerStats(targetUser.id);

    let description = "";
    let title = isBot ? `📊 Mes Statistiques de Jeux (Netricsa)` : `📊 Statistiques de ${targetUser.displayName}`;

    if (gameType === "global") {
        title += " - Jeux (Global)";
        const globalStats = stats.global;
        const totalGames = globalStats.wins + globalStats.losses + globalStats.draws;

        if (totalGames === 0) {
            if (isBot) {
                description = "Aucune partie jouée pour le moment. Je suis prête à affronter les joueurs ! 🎮";
            } else {
                description = "Aucune partie jouée pour le moment.";
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
                description = `Je ne joue pas au Pendu (c'est un jeu solo), mais je compte les scores ! 🎮`;
            } else if (isBot) {
                description = `Aucune partie de ${gameNames[gameType]} jouée pour le moment. Viens m'affronter ! 🎮`;
            } else {
                description = `Aucune partie de ${gameNames[gameType]} jouée pour le moment.`;
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

    return new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();
}

/**
 * Crée l'embed pour les statistiques Discord
 */
function createDiscordStatsEmbed(targetUser: User): EmbedBuilder {
    // Si c'est le bot lui-même, afficher les stats de Netricsa
    const isBot = targetUser.bot;
    const userStats = isBot ? getNetricsaStats() : getUserStats(targetUser.id);

    let description = "";
    if (!userStats) {
        if (isBot) {
            description = "Aucune statistique Discord enregistrée pour le moment. Je commence tout juste à compter mes actions ! 🤖";
        } else {
            description = "Aucune statistique Discord enregistrée pour le moment.";
        }
    } else {
        description += `📨 **Messages envoyés :** ${userStats.discord.messagesEnvoyes}\n`;
        description += `👍 **Réactions ajoutées :** ${userStats.discord.reactionsAjoutees}\n`;
        description += `❤️ **Réactions reçues :** ${userStats.discord.reactionsRecues}\n`;
        description += `⚡ **Commandes utilisées :** ${userStats.discord.commandesUtilisees}\n`;
        description += `📢 **Mentions reçues :** ${userStats.discord.mentionsRecues}\n`;
        description += `💬 **Réponses reçues :** ${userStats.discord.repliesRecues}\n`;

        if (isBot) {
            description += `\n✨ Toutes mes interactions Discord comptées !`;
        }
    }

    const title = isBot
        ? `📊 Mes Statistiques Discord (Netricsa)`
        : `📊 Statistiques Discord de ${targetUser.displayName}`;

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();
}

/**
 * Crée l'embed pour les statistiques Netricsa
 */
function createNetricsaStatsEmbed(targetUser: User): EmbedBuilder {
    // Si c'est le bot lui-même, afficher les stats de Netricsa
    const isBot = targetUser.bot;
    const userStats = isBot ? getNetricsaStats() : getUserStats(targetUser.id);

    let description = "";
    if (!userStats) {
        if (isBot) {
            description = "Aucune statistique Netricsa enregistrée pour le moment. Je commence tout juste à compter mes actions ! 🤖";
        } else {
            description = "Aucune statistique Netricsa enregistrée pour le moment.";
        }
    } else {
        description += `🎨 **Images générées :** ${userStats.netricsa.imagesGenerees}\n`;
        description += `🖼️ **Images réimaginées :** ${userStats.netricsa.imagesReimaginee}\n`;
        description += `🔍 **Images upscalées :** ${userStats.netricsa.imagesUpscalee}\n`;
        description += `🌐 **Recherches web :** ${userStats.netricsa.recherchesWeb}\n`;
        description += `💬 **Conversations IA :** ${userStats.netricsa.conversationsIA}\n`;

        const totalImages = userStats.netricsa.imagesGenerees + userStats.netricsa.imagesReimaginee;
        description += `\n📊 **Total d'images créées :** ${totalImages}`;

        // Si c'est Netricsa, ajouter un message personnalisé
        if (isBot) {
            description += `\n\n✨ Voilà toutes mes actions depuis que j'ai commencé à les compter !`;
        }
    }

    const title = isBot
        ? `📊 Mes Statistiques (Netricsa)`
        : `📊 Statistiques Netricsa de ${targetUser.displayName}`;

    return new EmbedBuilder()
        .setColor(0x397D86)
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();
}

/**
 * Crée l'embed pour les statistiques du serveur
 */
function createServerStatsEmbed(): EmbedBuilder {
    const serverStats = getServerStats();

    let description = "";
    description += `👥 **Utilisateurs actifs :** ${serverStats.totalUsers}\n\n`;
    description += `**📱 Statistiques Discord**\n`;
    description += `📨 Messages envoyés : ${serverStats.totalMessages}\n`;
    description += `👍 Réactions ajoutées : ${serverStats.totalReactions}\n`;
    description += `⚡ Commandes utilisées : ${serverStats.totalCommands}\n\n`;
    description += `**🤖 Statistiques Netricsa**\n`;
    description += `🎨 Images créées : ${serverStats.totalImages}\n`;
    description += `🔍 Images upscalées : ${serverStats.totalUpscales}\n`;
    description += `🌐 Recherches web : ${serverStats.totalSearches}\n`;
    description += `💬 Conversations IA : ${serverStats.totalConversations}`;

    return new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle("📊 Statistiques du serveur")
        .setDescription(description)
        .setTimestamp();
}

/**
 * Crée les boutons de navigation
 */
function createNavigationButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("stats_discord")
            .setLabel("Discord")
            .setEmoji("📱")
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
                .setName("utilisateur")
                .setDescription("Voir les stats d'un autre utilisateur")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const targetUser = interaction.options.getUser("utilisateur") || interaction.user;
            let currentCategory: StatsCategory = "discord";
            let currentGameType = "global";

            // Créer l'embed initial (Discord)
            let embed = createDiscordStatsEmbed(targetUser);
            const navigationButtons = createNavigationButtons();
            const gameSelectMenu = createGameSelectMenu();

            const message = await interaction.reply({
                embeds: [embed],
                components: [navigationButtons], // Pas de gameSelectMenu par défaut car on affiche Discord
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
                    embed = createServerStatsEmbed();
                    await buttonInteraction.update({
                        embeds: [embed],
                        components: [navigationButtons]
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
                    components: [navigationButtons, gameSelectMenu]
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

        // Détecter si l'interaction a déjà été répondue/différée (cas du bouton)
        const isAlreadyReplied = interaction.replied || interaction.deferred;

        let message;
        if (isAlreadyReplied) {
            // Pour les interactions déjà répondues (boutons), utiliser followUp
            message = await interaction.followUp({
                embeds: [embed],
                components: [navigationButtons], // Pas de gameSelectMenu par défaut
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });
        } else {
            // Pour les nouvelles interactions (commandes slash), utiliser reply
            message = await interaction.reply({
                embeds: [embed],
                components: [navigationButtons], // Pas de gameSelectMenu par défaut
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
                embed = createServerStatsEmbed();
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
                if (isAlreadyReplied) {
                    // Pour les interactions déjà répondues, éditer le message directement
                    await message.edit({
                        components: []
                    });
                } else {
                    // Pour les commandes slash, utiliser editReply
                    await interaction.editReply({
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

