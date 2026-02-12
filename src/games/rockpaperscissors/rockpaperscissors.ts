import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {createBackToMenuButton} from "../common/gameUtils";
import {NETRICSA_GAME_ID, recordDraw, recordLoss, recordWin} from "../common/globalStats";

interface GameState {
    player1: string;
    player2: string | null;
    player1Choice: string | null;
    player2Choice: string | null;
    isAI: boolean;
    player1WantsRematch?: boolean;
    player2WantsRematch?: boolean;
    player1Winstreak: number;
    player2Winstreak: number;
    player1TotalWins: number;
    player2TotalWins: number;
    player1HighestWinstreak: number;
    player2HighestWinstreak: number;
    draws: number;
    originalUserId?: string; // Celui qui a lancé /games
    originalInteraction?: any; // Pour éditer les messages en contexte UserApp
}

const activeGames = new Map<string, GameState>();

const choices = {
    rock: {emoji: "🪨", beats: "scissors"},
    paper: {emoji: "📄", beats: "rock"},
    scissors: {emoji: "✂️", beats: "paper"}
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rockpaperscissors")
        .setDescription("Joue à roche-papier-ciseaux")
        .addStringOption(option =>
            option
                .setName("mode")
                .setDescription("Jouer contre un autre joueur ou contre Netricsa")
                .setRequired(true)
                .addChoices(
                    {name: "👤 Contre un joueur", value: "player"},
                    {name: "🤖 Contre Netricsa", value: "ai"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const mode = interaction.options.getString("mode", true);
            const player1Id = interaction.user.id;
            const gameId = interaction.channelId + "_" + Date.now();

            if (mode === "ai") {
                // Mode IA : démarrer directement
                await startGameAgainstAI(interaction, player1Id, gameId, player1Id);
            } else {
                // Mode joueur : attendre un adversaire
                await waitForPlayer(interaction, player1Id, gameId, player1Id);
            }
        } catch (error: any) {
            await handleInteractionError(interaction, error, "RockPaperScissors");
        }
    },

    // Exporter les fonctions pour le menu principal
    startGameAgainstAI,
    waitForPlayer,
    showModeSelection
};

async function showModeSelection(interaction: any, originalUserId: string) {
    const embed = new EmbedBuilder()
        .setColor(0x14171A)
        .setTitle("🎮 Roche-Papier-Ciseaux")
        .setDescription("Choisis ton mode de jeu :")
        .setTimestamp();

    const playerButton = new ButtonBuilder()
        .setCustomId("rps_mode_player")
        .setLabel("Contre un joueur")
        .setStyle(ButtonStyle.Success)
        .setEmoji("👤");

    const aiButton = new ButtonBuilder()
        .setCustomId("rps_mode_ai")
        .setLabel("Contre Netricsa")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("<:zzzRole_NetricsaModule:1466997072564584631>");

    const backButton = new ButtonBuilder()
        .setCustomId(`game_back_to_menu_${Date.now()}`)
        .setLabel("Retour au menu")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playerButton, aiButton, backButton);

    await interaction.update({embeds: [embed], components: [row]});

    const collector = interaction.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on("collect", async (i: any) => {
        if (i.user.id !== originalUserId) {
            await i.reply({content: "Ce n'est pas ton menu !", ephemeral: true});
            return;
        }

        collector.stop();

        if (i.customId.startsWith("game_back_to_menu")) {
            const {showGameMenu} = require("../../commands/games/games");
            await showGameMenu(i, originalUserId);
            return;
        }

        const mode = i.customId === "rps_mode_ai" ? "ai" : "player";
        const playerId = i.user.id;
        const gameId = i.channelId + "_" + Date.now();

        if (mode === "ai") {
            await startGameAgainstAI(i, playerId, gameId, originalUserId);
        } else {
            await waitForPlayer(i, playerId, gameId, originalUserId);
        }
    });
}

async function waitForPlayer(interaction: any, player1Id: string, gameId: string, originalUserId: string) {
    const gameState: GameState = {
        player1: player1Id,
        player2: null,
        player1Choice: null,
        player2Choice: null,
        isAI: false,
        player1Winstreak: 0,
        player2Winstreak: 0,
        player1TotalWins: 0,
        player2TotalWins: 0,
        player1HighestWinstreak: 0,
        player2HighestWinstreak: 0,
        draws: 0,
        originalUserId: originalUserId,
        originalInteraction: interaction // Stocker l'interaction pour les timeouts
    };

    activeGames.set(gameId, gameState);

    const embed = new EmbedBuilder()
        .setColor(0x14171A)
        .setTitle("🎮 Roche-Papier-Ciseaux")
        .setDescription(`<@${player1Id}> cherche un adversaire !\n\nClique sur le bouton pour rejoindre la partie.`)
        .setTimestamp();

    const joinButton = new ButtonBuilder()
        .setCustomId(`rps_join_${gameId}`)
        .setLabel("Rejoindre la partie")
        .setStyle(ButtonStyle.Success)
        .setEmoji("⚔️");

    const cancelButton = new ButtonBuilder()
        .setCustomId(`rps_cancel_${gameId}`)
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, cancelButton);

    // Toujours utiliser update() pour éditer le message existant
    const message = await interaction.update({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minute
    });

    collector.on("collect", async (i: any) => {
        try {
            if (i.customId === `rps_cancel_${gameId}`) {
                // Seul le créateur peut annuler
                if (i.user.id !== player1Id) {
                    await i.reply({content: "❌ Seul le créateur peut annuler la partie.", ephemeral: true});
                    return;
                }

                activeGames.delete(gameId);
                collector.stop("cancelled");

                await showModeSelection(i, originalUserId);
                return;
            }

            if (i.customId === `rps_join_${gameId}`) {
                // Ne peut pas jouer contre soi-même
                if (i.user.id === player1Id) {
                    await i.reply({content: "❌ Tu ne peux pas jouer contre toi-même !", ephemeral: true});
                    return;
                }

                gameState.player2 = i.user.id;
                collector.stop("joined");

                await startPvPGame(i, gameState, gameId);
            }
        } catch (error) {
            console.error("[RPS] Error handling button:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            activeGames.delete(gameId);

            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Roche-Papier-Ciseaux")
                .setDescription("⏱️ Aucun joueur n'a rejoint. La partie a été annulée.")
                .setTimestamp();

            try {
                await interaction.editReply({embeds: [timeoutEmbed], components: []});
            } catch (error: any) {
                console.log("[RPS] Cannot edit timeout message. Error:", error.code);
            }
        }
    });
}

async function startGameAgainstAI(interaction: any, playerId: string, gameId: string, originalUserId: string) {
    const gameState: GameState = {
        player1: playerId,
        player2: "AI",
        player1Choice: null,
        player2Choice: null,
        isAI: true,
        player1Winstreak: 0,
        player2Winstreak: 0,
        player1TotalWins: 0,
        player2TotalWins: 0,
        player1HighestWinstreak: 0,
        player2HighestWinstreak: 0,
        draws: 0,
        originalUserId: originalUserId,
        originalInteraction: interaction // Stocker l'interaction pour les timeouts
    };

    activeGames.set(gameId, gameState);

    const embed = new EmbedBuilder()
        .setColor(0x14171A)
        .setTitle("🎮 Roche-Papier-Ciseaux vs <:zzzRole_NetricsaModule:1466997072564584631> Netricsa")
        .setDescription("Fais ton choix !")
        .setTimestamp();

    const buttons = createChoiceButtons(gameId, playerId);

    // Toujours utiliser update() pour éditer le message existant
    const message = await interaction.update({
        embeds: [embed],
        components: [buttons],
        fetchReply: true
    });

    setupGameCollector(message, gameState, gameId);
}

async function startPvPGame(interaction: any, gameState: GameState, gameId: string) {
    const embed = new EmbedBuilder()
        .setColor(0x14171A)
        .setTitle("🎮 Roche-Papier-Ciseaux")
        .setDescription(`⚔️ <@${gameState.player1}> vs <@${gameState.player2}>\n\nFaites vos choix ! (invisible pour l'adversaire)`)
        .setTimestamp();

    // Créer les boutons pour les deux joueurs
    const buttons = createChoiceButtons(gameId, "both");

    // Mettre à jour le message existant avec les boutons
    const message = await interaction.update({
        embeds: [embed],
        components: [buttons],
        fetchReply: true
    });

    setupGameCollector(message, gameState, gameId);
}

function createChoiceButtons(gameId: string, playerId: string | "both"): ActionRowBuilder<ButtonBuilder> {
    // Si playerId est "both", ne pas l'inclure dans le customId - le collector gérera la validation
    const idSuffix = playerId === "both" ? "" : `_${playerId}`;

    const rockButton = new ButtonBuilder()
        .setCustomId(`rps_choice_${gameId}${idSuffix}_rock`)
        .setLabel("Roche")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🪨");

    const paperButton = new ButtonBuilder()
        .setCustomId(`rps_choice_${gameId}${idSuffix}_paper`)
        .setLabel("Papier")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📄");

    const scissorsButton = new ButtonBuilder()
        .setCustomId(`rps_choice_${gameId}${idSuffix}_scissors`)
        .setLabel("Ciseaux")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✂️");

    return new ActionRowBuilder<ButtonBuilder>().addComponents(rockButton, paperButton, scissorsButton);
}

function getStatsDescription(gameState: GameState): string {
    const totalGames = gameState.player1TotalWins + gameState.player2TotalWins + gameState.draws;
    if (totalGames === 0) return "";
    if (gameState.player1HighestWinstreak <= 1 && gameState.player2HighestWinstreak <= 1 && gameState.draws === 0) {
        return ``;
    }

    let stats = `\n\n**Statistiques:**\n`;

    if (gameState.player1HighestWinstreak > 1 || gameState.player2HighestWinstreak > 1) {
        stats += `🔥 Meilleures séries : \n`;
        if (gameState.player1HighestWinstreak > 1) {
            stats += `<@${gameState.player1}>: **${gameState.player1HighestWinstreak}**\n`;
        }
        if (gameState.player2HighestWinstreak > 1) {
            if (gameState.player1HighestWinstreak > 1) stats += " | ";
            stats += `<@${gameState.player2}>: **${gameState.player2HighestWinstreak}**\n`;
        }
    }

    if (gameState.draws > 0) {
        stats += `🤝 Égalités : **${gameState.draws}**`;
    }

    return stats;
}

function getStatsFooter(gameState: GameState): string {
    const totalGames = gameState.player1TotalWins + gameState.player2TotalWins + gameState.draws;
    if (totalGames === 0) return "";

    return `Score : ${gameState.player1TotalWins} - ${gameState.player2TotalWins} (${gameState.draws} égalités)`;
}

function setupGameCollector(message: any, gameState: GameState, gameId: string) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minute
    });

    collector.on("collect", async (i: any) => {
        try {
            // Parser le customId pour extraire le choix
            // Format AI: rps_choice_${gameId}_${playerId}_${choice}
            // Format PvP: rps_choice_${gameId}_${choice}
            const parts = i.customId.split("_");
            const choice = parts[parts.length - 1]; // Toujours le dernier élément
            const clickerId = i.user.id;

            // Vérifier que le joueur a le droit de cliquer
            if (clickerId !== gameState.player1 && clickerId !== gameState.player2) {
                await i.reply({content: "❌ Tu n'es pas dans cette partie !", ephemeral: true});
                return;
            }

            // Vérifier si le joueur a déjà fait son choix (sans envoyer de message)
            if (clickerId === gameState.player1 && gameState.player1Choice) {
                await i.deferUpdate();
                return;
            }
            if (clickerId === gameState.player2 && gameState.player2Choice) {
                await i.deferUpdate();
                return;
            }

            // Enregistrer le choix
            if (clickerId === gameState.player1) {
                gameState.player1Choice = choice;
            } else if (clickerId === gameState.player2) {
                gameState.player2Choice = choice;
            }

            // Si c'est contre l'IA, faire le choix de l'IA immédiatement
            if (gameState.isAI && gameState.player1Choice) {
                const aiChoices = ["rock", "paper", "scissors"];
                gameState.player2Choice = aiChoices[Math.floor(Math.random() * aiChoices.length)];
            }

            // Si les deux joueurs ont fait leur choix, afficher le résultat directement
            // (utiliser l'interaction pour update)
            if (gameState.player1Choice && gameState.player2Choice) {
                collector.stop("completed");
                await displayResult(message, gameState, i);
                activeGames.delete(gameId);
                return;
            }

            // Sinon, mettre à jour l'embed pour afficher qui a choisi (seulement en PvP)
            if (!gameState.isAI) {
                const currentEmbed = message.embeds[0];
                const baseTitle = currentEmbed.title;
                const baseDesc = currentEmbed.description?.split("\n\n**Choix:**")[0] || currentEmbed.description;

                let choiceStatus = "\n\n**Choix:**\n";
                if (gameState.player1Choice) {
                    choiceStatus += `✅ <@${gameState.player1}> a fait son choix\n`;
                } else {
                    choiceStatus += `⏳ <@${gameState.player1}> n'a pas encore choisi\n`;
                }

                if (gameState.player2Choice) {
                    choiceStatus += `✅ <@${gameState.player2}> a fait son choix`;
                } else {
                    choiceStatus += `⏳ <@${gameState.player2}> n'a pas encore choisi`;
                }

                const updatedEmbed = new EmbedBuilder()
                    .setColor(currentEmbed.color || 0x14171A)
                    .setTitle(baseTitle)
                    .setDescription(baseDesc + choiceStatus)
                    .setTimestamp();

                await i.update({embeds: [updatedEmbed], components: message.components});
            } else {
                // En mode IA, juste defer l'update (pas besoin d'afficher les choix)
                await i.deferUpdate();
            }
        } catch (error) {
            console.error("[RPS] Error handling choice:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            activeGames.delete(gameId);

            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Roche-Papier-Ciseaux")
                .setDescription("⏱️ Le temps de jeu est écoulé. La partie a été annulée.")
                .setTimestamp();

            try {
                // Utiliser originalInteraction.editReply pour supporter UserApp
                if (gameState.originalInteraction) {
                    await gameState.originalInteraction.editReply({embeds: [timeoutEmbed], components: []});
                } else {
                    await message.edit({embeds: [timeoutEmbed], components: []});
                }
            } catch (error: any) {
                console.log("[RPS] Cannot edit timeout message. Error:", error.code);
            }
        }
    });
}

async function displayResult(message: any, gameState: GameState, lastInteraction?: any) {
    const p1Choice = gameState.player1Choice!;
    const p2Choice = gameState.player2Choice!;

    const p1Emoji = choices[p1Choice as keyof typeof choices].emoji;
    const p2Emoji = choices[p2Choice as keyof typeof choices].emoji;

    let result: string;
    let color: number;

    if (p1Choice === p2Choice) {
        result = "🤝 Égalité !";
        color = 0xFEE75C;
        // Égalité : reset des winstreaks et incrémenter draws
        gameState.player1Winstreak = 0;
        gameState.player2Winstreak = 0;
        gameState.draws++;
        // Enregistrer dans stats globales
        recordDraw(gameState.player1, 'rockpaperscissors', gameState.isAI, message.channel);
        if (gameState.player2 && !gameState.isAI) {
            recordDraw(gameState.player2, 'rockpaperscissors', false, message.channel);
        } else if (gameState.isAI) {
            // Netricsa fait égalité aussi
            recordDraw(NETRICSA_GAME_ID, 'rockpaperscissors', true, message.channel);
        }
    } else if (choices[p1Choice as keyof typeof choices].beats === p2Choice) {
        result = `🎉 <@${gameState.player1}> gagne !`;
        color = 0x57F287;
        // Joueur 1 gagne
        gameState.player1Winstreak++;
        gameState.player1TotalWins++;
        gameState.player2Winstreak = 0;
        // Enregistrer dans stats globales
        recordWin(gameState.player1, 'rockpaperscissors', gameState.isAI, message.channel);
        if (gameState.player2 && !gameState.isAI) {
            recordLoss(gameState.player2, 'rockpaperscissors', false, message.channel);
        } else if (gameState.isAI) {
            // Netricsa perd
            recordLoss(NETRICSA_GAME_ID, 'rockpaperscissors', true, message.channel);
        }

        // Mettre à jour la plus haute winstreak
        if (gameState.player1Winstreak > gameState.player1HighestWinstreak) {
            gameState.player1HighestWinstreak = gameState.player1Winstreak;
        }
    } else {
        if (gameState.isAI) {
            result = `<@1462959115528835092> gagne !`;
            color = 0xED4245;
        } else {
            result = `🎉 <@${gameState.player2}> gagne !`;
            color = 0xFEE75C; // Jaune pour PvP
        }
        // Joueur 2 gagne
        gameState.player1Winstreak = 0;
        gameState.player2Winstreak++;
        gameState.player2TotalWins++;
        // Enregistrer dans stats globales
        recordLoss(gameState.player1, 'rockpaperscissors', gameState.isAI, message.channel);
        if (gameState.player2 && !gameState.isAI) {
            recordWin(gameState.player2, 'rockpaperscissors', false, message.channel);
        } else if (gameState.isAI) {
            // Netricsa gagne
            recordWin(NETRICSA_GAME_ID, 'rockpaperscissors', true, message.channel);
        }

        // Mettre à jour la plus haute winstreak
        if (gameState.player2Winstreak > gameState.player2HighestWinstreak) {
            gameState.player2HighestWinstreak = gameState.player2Winstreak;
        }
    }

    // Construire la description avec les winstreaks
    let description = `<@${gameState.player1}> : ${p1Emoji}`;
    if (gameState.player1Winstreak > 1) {
        description += ` 🔥 **${gameState.player1Winstreak}**`;
    }
    description += `\n${gameState.isAI ? "<@1462959115528835092>" : `<@${gameState.player2}>`} : ${p2Emoji}`;
    if (gameState.player2Winstreak > 1) {
        description += ` 🔥 **${gameState.player2Winstreak}**`;
    }
    description += `\n\n**${result}**`;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🎮 Résultat - Roche-Papier-Ciseaux")
        .setDescription(description)
        .setTimestamp();

    // Ajouter le footer avec les total wins
    const footerText = getStatsFooter(gameState);
    if (footerText) {
        embed.setFooter({text: footerText});
    }

    // Créer les boutons Rematch et Retour au menu
    const rematchButton = new ButtonBuilder()
        .setCustomId(`rps_rematch_${message.channelId}_${Date.now()}`)
        .setLabel("Rematch")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄");

    const backButton = createBackToMenuButton();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

    // Toujours utiliser l'interaction si disponible (meilleure compatibilité DM)
    try {
        if (lastInteraction) {
            await lastInteraction.update({embeds: [embed], components: [row]});
        } else {
            await message.edit({embeds: [embed], components: [row]});
        }
    } catch (error: any) {
        // Fallback : envoyer un nouveau message si l'édition échoue
        console.log("[RPS] Cannot edit message, sending new one instead. Error:", error.code);
        await message.channel.send({embeds: [embed], components: [row]});
    }

    // Réinitialiser les états de rematch
    gameState.player1WantsRematch = false;
    gameState.player2WantsRematch = false;

    // Setup le collector pour le rematch
    setupRematchCollector(message, gameState, embed);
}

function setupRematchCollector(message: any, gameState: GameState, originalEmbed: EmbedBuilder) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 minutes
    });

    collector.on("collect", async (i: any) => {
        try {
            // Gestion du bouton Retour au menu
            if (i.customId.startsWith("game_back_to_menu_")) {
                if (gameState.originalUserId && i.user.id !== gameState.originalUserId) {
                    await i.reply({content: "❌ Seul celui qui a lancé le menu peut y retourner !", ephemeral: true});
                    return;
                }

                collector.stop("back_to_menu");
                const gamesModule = require("../../commands/games/games");
                await gamesModule.showGameMenu(i, gameState.originalUserId);
                return;
            }

            if (!i.customId.startsWith("rps_rematch_")) return;

            const clickerId = i.user.id;

            // Vérifier que c'est un des joueurs
            if (clickerId !== gameState.player1 && clickerId !== gameState.player2) {
                await i.reply({content: "❌ Tu n'étais pas dans cette partie !", ephemeral: true});
                return;
            }

            // Marquer que le joueur veut un rematch
            if (clickerId === gameState.player1) {
                gameState.player1WantsRematch = true;
            } else if (clickerId === gameState.player2) {
                gameState.player2WantsRematch = true;
            }

            // Mode IA : rematch instantané
            if (gameState.isAI) {
                collector.stop("rematch");

                // Réinitialiser les choix
                gameState.player1Choice = null;
                gameState.player2Choice = null;

                // Créer une nouvelle partie
                const embed = new EmbedBuilder()
                    .setColor(0x14171A)
                    .setTitle("🎮 Roche-Papier-Ciseaux vs <:zzzRole_NetricsaModule:1466997072564584631> Netricsa")
                    .setDescription("🔄 **Nouvelle partie !**\n\nFais ton choix !")
                    .setTimestamp();

                const buttons = createChoiceButtons(i.customId.split("_")[2] + "_" + Date.now(), gameState.player1);

                await i.update({embeds: [embed], components: [buttons]});
                setupGameCollector(message, gameState, i.customId.split("_")[2] + "_" + Date.now());
                return;
            }

            // Mode PvP : attendre que les deux joueurs acceptent
            if (gameState.player1WantsRematch && gameState.player2WantsRematch) {
                collector.stop("rematch");

                // Réinitialiser les choix
                gameState.player1Choice = null;
                gameState.player2Choice = null;

                // Mettre à jour l'embed pour indiquer que la partie recommence
                const embed = new EmbedBuilder()
                    .setColor(0x14171A)
                    .setTitle("🎮 Roche-Papier-Ciseaux")
                    .setDescription("🔄 **Les deux joueurs ont accepté ! Nouvelle partie !**\n\nFaites vos choix !")
                    .setTimestamp();

                const newGameId = i.customId.split("_")[2] + "_" + Date.now();
                const buttons = createChoiceButtons(newGameId, "both"); // Utiliser "both" pour PvP

                await i.update({embeds: [embed], components: [buttons]});

                setupGameCollector(message, gameState, newGameId);
            } else {
                // Un joueur a accepté, mettre à jour l'embed pour afficher qui attend
                const updatedEmbed = EmbedBuilder.from(originalEmbed);
                const currentDesc = updatedEmbed.data.description || "";

                let rematchStatus = "\n\n**Rematch:**\n";
                if (gameState.player1WantsRematch) {
                    rematchStatus += `✅ <@${gameState.player1}> veut un rematch\n`;
                } else {
                    rematchStatus += `⏳ <@${gameState.player1}> n'a pas encore accepté\n`;
                }
                if (gameState.player2WantsRematch) {
                    rematchStatus += `✅ <@${gameState.player2}> veut un rematch`;
                } else {
                    rematchStatus += `⏳ <@${gameState.player2}> n'a pas encore accepté`;
                }

                // Enlever l'ancien status de rematch s'il existe
                const baseDesc = currentDesc.split("\n\n**Rematch:**")[0];
                updatedEmbed.setDescription(baseDesc + rematchStatus);

                const rematchButton = new ButtonBuilder()
                    .setCustomId(`rps_rematch_${message.channelId}_${Date.now()}`)
                    .setLabel("Rematch")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("🔄");

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton);

                await i.update({embeds: [updatedEmbed], components: [row]});
            }
        } catch (error) {
            console.error("[RPS] Error handling rematch:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Roche-Papier-Ciseaux")
                .setDescription("⏱️ Le temps pour rejouer est écoulé.")
                .setTimestamp();

            try {
                await message.edit({embeds: [timeoutEmbed], components: []});
            } catch (error: any) {
                console.log("[RPS] Cannot edit rematch timeout message. Error:", error.code);
            }
        }
    });
}
