import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {GameStats, getStatsFooter, getWinstreakDisplay, initializeStats, updateStatsOnDraw, updateStatsOnWin} from "../common/gameStats";
import {canJoinGame, COLLECTOR_CONFIG, createBackToMenuButton, createCancelButton, createJoinButton, createRematchButton, createWaitingEmbed, handleGameCancellation} from "../common/gameUtils";
import {NETRICSA_GAME_ID, recordDraw, recordLoss, recordWin} from "../common/globalStats";

interface GameState {
    player1: string;
    player2: string | null;
    isAI: boolean;
    board: (string | null)[];
    currentTurn: string;
    player1Symbol: string;
    player2Symbol: string;
    stats: GameStats;
    player1WantsRematch?: boolean;
    player2WantsRematch?: boolean;
    originalUserId?: string; // Celui qui a lancé /games
    originalInteraction?: any; // Pour éditer les messages en contexte UserApp
    lastInteraction?: any; // Dernière interaction utilisée pour les mises à jour
}

const activeGames = new Map<string, GameState>();
const GAME_TITLE = "Tic-Tac-Toe";
const GAME_PREFIX = "ttt";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tictactoe")
        .setDescription("Joue au Tic-Tac-Toe")
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
                await startGameAgainstAI(interaction, player1Id, gameId, player1Id);
            } else {
                await waitForPlayer(interaction, player1Id, gameId, player1Id);
            }
        } catch (error: any) {
            await handleInteractionError(interaction, error, "TicTacToe");
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
        .setTitle("❌ Tic-Tac-Toe ⭕")
        .setDescription("Choisis ton mode de jeu :")
        .setTimestamp();

    const playerButton = new ButtonBuilder()
        .setCustomId("ttt_mode_player")
        .setLabel("Contre un joueur")
        .setStyle(ButtonStyle.Success)
        .setEmoji("👤");

    const aiButton = new ButtonBuilder()
        .setCustomId("ttt_mode_ai")
        .setLabel("Contre Netricsa")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("<:zzzRole_NetricsaModule:1466997072564584631>");

    const backButton = createBackToMenuButton();

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

        const mode = i.customId === "ttt_mode_ai" ? "ai" : "player";
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
        isAI: false,
        board: Array(9).fill(null),
        currentTurn: player1Id,
        player1Symbol: "❌",
        player2Symbol: "⭕",
        stats: initializeStats(),
        originalUserId: originalUserId,
        originalInteraction: interaction // Stocker pour les timeouts
    };

    activeGames.set(gameId, gameState);

    const embed = createWaitingEmbed(player1Id, GAME_TITLE);
    const joinButton = createJoinButton(gameId, GAME_PREFIX);
    const cancelButton = createCancelButton(gameId, GAME_PREFIX);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, cancelButton);

    // Toujours utiliser update() pour éditer le message existant
    const message = await interaction.update({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_CONFIG.WAITING_TIME
    });

    collector.on("collect", async (i: any) => {
        try {
            if (i.customId === `${GAME_PREFIX}_cancel_${gameId}`) {
                const cancelled = await handleGameCancellation(i, player1Id, activeGames, gameId, GAME_TITLE,
                    async (interaction, userId) => await showModeSelection(interaction, userId));
                if (cancelled) collector.stop("cancelled");
                return;
            }

            if (i.customId === `${GAME_PREFIX}_join_${gameId}`) {
                const {canJoin, error} = canJoinGame(i.user.id, player1Id);
                if (!canJoin) {
                    await i.reply({content: error, ephemeral: true});
                    return;
                }

                gameState.player2 = i.user.id;
                collector.stop("joined");
                await startPvPGame(i, gameState, gameId, message);
            }
        } catch (error) {
            console.error(`[${GAME_TITLE}] Error handling button:`, error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            activeGames.delete(gameId);

            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("❌⭕ Tic-Tac-Toe")
                .setDescription("⏱️ Aucun joueur n'a rejoint. La partie a été annulée.")
                .setTimestamp();

            try {
                await interaction.editReply({embeds: [timeoutEmbed], components: []});
            } catch (error: any) {
                console.log("[TTT] Cannot edit timeout message. Error:", error.code);
            }
        }
    });
}

async function startGameAgainstAI(interaction: any, playerId: string, gameId: string, originalUserId: string) {
    const gameState: GameState = {
        player1: playerId,
        player2: "AI",
        isAI: true,
        board: Array(9).fill(null),
        currentTurn: playerId,
        player1Symbol: "❌",
        player2Symbol: "⭕",
        stats: initializeStats(),
        originalUserId: originalUserId,
        originalInteraction: interaction // Stocker pour les timeouts
    };

    activeGames.set(gameId, gameState);

    const embed = createGameEmbed(gameState);
    const buttons = createBoardButtons(gameState, gameId);

    // Toujours utiliser update() pour éditer le message existant
    const message = await interaction.update({
        embeds: [embed],
        components: buttons,
        fetchReply: true
    });

    setupGameCollector(message, gameState, gameId);
}

async function startPvPGame(interaction: any, gameState: GameState, gameId: string, message: any) {
    const embed = createGameEmbed(gameState);
    const buttons = createBoardButtons(gameState, gameId);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });

    setupGameCollector(message, gameState, gameId);
}

function createGameEmbed(gameState: GameState): EmbedBuilder {
    const vsText = gameState.isAI ? "<@1462959115528835092>" : `<@${gameState.player2}>`;

    let description = `<@${gameState.player1}> ${gameState.player1Symbol} vs ${gameState.player2Symbol} ${vsText}\n\n`;

    if (gameState.currentTurn === gameState.player1) {
        description += `**Tour de <@${gameState.player1}>** ${gameState.player1Symbol}`;
    } else {
        description += `**Tour de ${gameState.isAI ? "<@1462959115528835092>" : `<@${gameState.player2}>`}** ${gameState.player2Symbol}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x14171A)
        .setTitle(`🎮 ${GAME_TITLE}`)
        .setDescription(description)
        .setTimestamp();

    const footerText = getStatsFooter(gameState.stats);
    if (footerText) {
        embed.setFooter({text: footerText});
    }

    return embed;
}

function createBoardButtons(gameState: GameState, gameId: string): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let row = 0; row < 3; row++) {
        const buttonRow = new ActionRowBuilder<ButtonBuilder>();

        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            const cellValue = gameState.board[index];

            const button = new ButtonBuilder()
                .setCustomId(`ttt_move_${gameId}_${index}`)
                .setLabel(cellValue || "\u200b")
                .setStyle(cellValue ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(cellValue !== null);

            buttonRow.addComponents(button);
        }

        rows.push(buttonRow);
    }

    return rows;
}

function setupGameCollector(message: any, gameState: GameState, gameId: string) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
    });

    collector.on("collect", async (i: any) => {
        try {
            if (!i.customId.startsWith(`ttt_move_${gameId}`)) return;

            const clickerId = i.user.id;

            // Vérifier que c'est le tour du joueur
            if (clickerId !== gameState.currentTurn) {
                return;
            }

            // Extraire l'index de la case
            const parts = i.customId.split("_");
            const moveIndex = parseInt(parts[parts.length - 1]);

            // Vérifier que la case est vide
            if (gameState.board[moveIndex] !== null) {
                await i.deferUpdate();
                return;
            }

            // Placer le symbole
            const symbol = clickerId === gameState.player1 ? gameState.player1Symbol : gameState.player2Symbol;
            gameState.board[moveIndex] = symbol;

            // Vérifier victoire ou égalité
            const winner = checkWinner(gameState);

            if (winner || gameState.board.every(cell => cell !== null)) {
                // Partie terminée
                collector.stop("completed");
                await displayResult(message, gameState, winner);
                activeGames.delete(gameId);
                return;
            }

            // Changer de tour
            if (gameState.isAI) {
                gameState.currentTurn = gameState.player2!;

                // Mettre à jour l'affichage et stocker l'interaction
                const embed = createGameEmbed(gameState);
                const buttons = createBoardButtons(gameState, gameId);
                await i.update({embeds: [embed], components: buttons});
                gameState.lastInteraction = i; // Stocker pour les mises à jour suivantes

                // IA joue après un court délai
                setTimeout(async () => {
                    try {
                        const aiMove = getAIMove(gameState);
                        if (aiMove !== -1) {
                            gameState.board[aiMove] = gameState.player2Symbol;

                            const winner = checkWinner(gameState);
                            if (winner || gameState.board.every(cell => cell !== null)) {
                                collector.stop("completed");
                                await displayResult(message, gameState, winner);
                                activeGames.delete(gameId);
                                return;
                            }

                            gameState.currentTurn = gameState.player1;
                            const embed = createGameEmbed(gameState);
                            const buttons = createBoardButtons(gameState, gameId);

                            try {
                                // Utiliser editReply au lieu de message.edit pour UserApp
                                if (gameState.lastInteraction) {
                                    await gameState.lastInteraction.editReply({embeds: [embed], components: buttons});
                                } else {
                                    await message.edit({embeds: [embed], components: buttons});
                                }
                            } catch (error: any) {
                                console.log("[TicTacToe] Cannot edit message after AI move. Error:", error.code);
                                // En contexte UserApp, on ne peut pas envoyer de nouveau message
                                // Le jeu s'arrête malheureusement
                            }
                        }
                    } catch (error) {
                        console.error("[TicTacToe] Error in AI move timeout:", error);
                    }
                }, 800);
            } else {
                // PvP : alterner les tours
                gameState.currentTurn = gameState.currentTurn === gameState.player1 ? gameState.player2! : gameState.player1;

                const embed = createGameEmbed(gameState);
                const buttons = createBoardButtons(gameState, gameId);
                await i.update({embeds: [embed], components: buttons});
                gameState.lastInteraction = i; // Stocker pour les mises à jour suivantes
            }
        } catch (error) {
            console.error("[TicTacToe] Error handling move:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            activeGames.delete(gameId);

            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("❌⭕ Tic-Tac-Toe")
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
                console.log("[TicTacToe] Cannot edit timeout message. Error:", error.code);
            }
        }
    });
}

function checkWinner(gameState: GameState): string | null {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
        [0, 4, 8], [2, 4, 6] // Diagonales
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (gameState.board[a] && gameState.board[a] === gameState.board[b] && gameState.board[a] === gameState.board[c]) {
            return gameState.board[a] === gameState.player1Symbol ? gameState.player1 : gameState.player2!;
        }
    }

    return null;
}

function getAIMove(gameState: GameState): number {
    // Algorithme Minimax avec une petite chance d'erreur (5%)
    // Rend l'IA très difficile à battre mais pas imbattable

    const makeError = Math.random() < 0.05; // 5% de chance d'erreur

    if (makeError) {
        // L'IA fait une erreur : joue un coup sous-optimal
        const availableMoves = gameState.board
            .map((cell, index) => cell === null ? index : -1)
            .filter(index => index !== -1);

        if (availableMoves.length > 0) {
            // Jouer un coup aléatoire parmi les disponibles
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
    }

    // Jouer de manière optimale avec Minimax
    let bestScore = -Infinity;
    let bestMove = -1;

    // Essayer chaque case vide
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === null) {
            // Simuler le coup
            gameState.board[i] = gameState.player2Symbol;

            // Calculer le score avec minimax
            const score = minimax(gameState, 0, false);

            // Annuler le coup
            gameState.board[i] = null;

            // Garder le meilleur coup
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }

    return bestMove;
}

function minimax(gameState: GameState, depth: number, isMaximizing: boolean): number {
    // Vérifier si quelqu'un a gagné
    const winner = checkWinner(gameState);

    if (winner === gameState.player2) {
        return 10 - depth; // L'IA gagne (préférence pour victoire rapide)
    }
    if (winner === gameState.player1) {
        return depth - 10; // Le joueur gagne
    }

    // Vérifier l'égalité
    if (gameState.board.every(cell => cell !== null)) {
        return 0; // Match nul
    }

    if (isMaximizing) {
        // Tour de l'IA : maximiser le score
        let bestScore = -Infinity;

        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === null) {
                gameState.board[i] = gameState.player2Symbol;
                const score = minimax(gameState, depth + 1, false);
                gameState.board[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }

        return bestScore;
    } else {
        // Tour du joueur : minimiser le score
        let bestScore = Infinity;

        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === null) {
                gameState.board[i] = gameState.player1Symbol;
                const score = minimax(gameState, depth + 1, true);
                gameState.board[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }

        return bestScore;
    }
}

async function displayResult(message: any, gameState: GameState, winner: string | null) {
    let result: string;
    let color: number;

    if (winner === null) {
        result = "🤝 Égalité !";
        color = 0xFEE75C;
        updateStatsOnDraw(gameState.stats);
        // Enregistrer dans stats globales
        recordDraw(gameState.player1, 'tictactoe', gameState.isAI, message.channel);
        if (gameState.player2 && !gameState.isAI) {
            recordDraw(gameState.player2, 'tictactoe', false, message.channel);
        } else if (gameState.isAI) {
            // Netricsa fait égalité aussi
            recordDraw(NETRICSA_GAME_ID, 'tictactoe', true, message.channel);
        }
    } else if (winner === gameState.player1) {
        result = `🎉 <@${gameState.player1}> gagne !\n`;
        color = 0x57F287;
        updateStatsOnWin(gameState.stats, 'player1');
        // Enregistrer dans stats globales
        recordWin(gameState.player1, 'tictactoe', gameState.isAI, message.channel);
        if (gameState.player2 && !gameState.isAI) {
            recordLoss(gameState.player2, 'tictactoe', false, message.channel);
        } else if (gameState.isAI) {
            // Netricsa perd
            recordLoss(NETRICSA_GAME_ID, 'tictactoe', true, message.channel);
        }
    } else {
        if (gameState.isAI) {
            result = `<@1462959115528835092> gagne !\n`;
            color = 0xED4245;
        } else {
            result = `🎉 <@${gameState.player2}> gagne !\n`;
            color = 0xFEE75C;
        }
        updateStatsOnWin(gameState.stats, 'player2');
        // Enregistrer dans stats globales
        recordLoss(gameState.player1, 'tictactoe', gameState.isAI, message.channel);
        if (gameState.player2 && !gameState.isAI) {
            recordWin(gameState.player2, 'tictactoe', false, message.channel);
        } else if (gameState.isAI) {
            // Netricsa gagne
            recordWin(NETRICSA_GAME_ID, 'tictactoe', true, message.channel);
        }
    }

    // Construire la description avec les winstreaks


    // Afficher la grille finale
    let description = "Grille finale:\n";
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            description += gameState.board[index] || "⬜";
            if (col < 2) description += " ";
        }
        description += "\n";
    }

    description += `**${result}**\n`;
    description += getWinstreakDisplay(gameState.stats, gameState.player1, gameState.player2, gameState.isAI);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🎮 Résultat - ${GAME_TITLE}`)
        .setDescription(description)
        .setTimestamp();

    const footerText = getStatsFooter(gameState.stats);
    if (footerText) {
        embed.setFooter({text: footerText});
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const rematchButton = createRematchButton(message.channelId, GAME_PREFIX);
    const backButton = createBackToMenuButton();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

    try {
        // Utiliser l'interaction si disponible pour UserApp
        if (gameState.lastInteraction) {
            await gameState.lastInteraction.editReply({embeds: [embed], components: [row]});
        } else {
            await message.edit({embeds: [embed], components: [row]});
        }
    } catch (error: any) {
        console.log("[TicTacToe] Cannot edit result message. Error:", error.code);
        // En contexte UserApp, on ne peut pas envoyer de nouveau message
        // Le joueur ne verra pas le résultat final, mais les stats seront enregistrées
    }

    gameState.player1WantsRematch = false;
    gameState.player2WantsRematch = false;

    setupRematchCollector(message, gameState, embed);
}


function setupRematchCollector(message: any, gameState: GameState, originalEmbed: EmbedBuilder) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
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

            if (!i.customId.startsWith("ttt_rematch_")) return;

            const clickerId = i.user.id;

            if (clickerId !== gameState.player1 && clickerId !== gameState.player2) {
                await i.reply({content: "❌ Tu n'étais pas dans cette partie !", ephemeral: true});
                return;
            }

            if (clickerId === gameState.player1) {
                gameState.player1WantsRematch = true;
            } else if (clickerId === gameState.player2) {
                gameState.player2WantsRematch = true;
            }

            // Mode IA : rematch instantané
            if (gameState.isAI) {
                collector.stop("rematch");

                gameState.board = Array(9).fill(null);
                gameState.currentTurn = gameState.player1;

                const newGameId = i.customId.split("_")[2] + "_" + Date.now();
                const embed = createGameEmbed(gameState);
                const buttons = createBoardButtons(gameState, newGameId);

                await i.update({embeds: [embed], components: buttons});
                setupGameCollector(message, gameState, newGameId);
                return;
            }

            // Mode PvP
            if (gameState.player1WantsRematch && gameState.player2WantsRematch) {
                collector.stop("rematch");

                gameState.board = Array(9).fill(null);
                gameState.currentTurn = gameState.player1;

                const embed = createGameEmbed(gameState);
                const newGameId = i.customId.split("_")[2] + "_" + Date.now();
                const buttons = createBoardButtons(gameState, newGameId);

                await i.update({embeds: [embed], components: buttons});
                setupGameCollector(message, gameState, newGameId);
            } else {
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

                const baseDesc = currentDesc.split("\n\n**Rematch:**")[0];
                updatedEmbed.setDescription(baseDesc + rematchStatus);

                const rematchButton = new ButtonBuilder()
                    .setCustomId(`ttt_rematch_${message.channelId}_${Date.now()}`)
                    .setLabel("Rematch")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("🔄");

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton);

                await i.update({embeds: [updatedEmbed], components: [row]});
            }
        } catch (error) {
            console.error("[TicTacToe] Error handling rematch:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("❌⭕ Tic-Tac-Toe")
                .setDescription("⏱️ Le temps pour rejouer est écoulé.")
                .setTimestamp();

            try {
                await message.edit({embeds: [timeoutEmbed], components: []});
            } catch (error: any) {
                console.log("[TicTacToe] Cannot edit rematch timeout message. Error:", error.code);
            }
        }
    });
}
