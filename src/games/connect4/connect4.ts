import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {GameStats, getStatsDescription, getStatsFooter, getWinstreakDisplay, initializeStats, updateStatsOnDraw, updateStatsOnWin} from "../common/gameStats";
import {canJoinGame, COLLECTOR_CONFIG, createBackToMenuButton, createCancelButton, createJoinButton, createRematchButton, createTimeoutEmbed, createWaitingEmbed, handleGameCancellation} from "../common/gameUtils";
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
    originalUserId?: string;
}

const activeGames = new Map<string, GameState>();
const GAME_TITLE = "Connect 4";
const GAME_PREFIX = "c4";
const ROWS = 6;
const COLS = 7;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("connect4")
        .setDescription("Joue au Connect 4 (Puissance 4)")
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
            await handleInteractionError(interaction, error, "Connect4");
        }
    },

    startGameAgainstAI,
    waitForPlayer,
    showModeSelection
};

async function showModeSelection(interaction: any, originalUserId: string) {
    const embed = new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle("🔴 Connect 4 🟡")
        .setDescription("Choisis ton mode de jeu :")
        .setTimestamp();

    const playerButton = new ButtonBuilder()
        .setCustomId("c4_mode_player")
        .setLabel("Contre un joueur")
        .setStyle(ButtonStyle.Success)
        .setEmoji("👤");

    const aiButton = new ButtonBuilder()
        .setCustomId("c4_mode_ai")
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

        const mode = i.customId === "c4_mode_ai" ? "ai" : "player";
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
        board: Array(ROWS * COLS).fill(null),
        currentTurn: player1Id,
        player1Symbol: "🔴",
        player2Symbol: "🟡",
        stats: initializeStats(),
        originalUserId: originalUserId
    };

    activeGames.set(gameId, gameState);

    const embed = createWaitingEmbed(player1Id, GAME_TITLE);
    const joinButton = createJoinButton(gameId, GAME_PREFIX);
    const cancelButton = createCancelButton(gameId, GAME_PREFIX);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, cancelButton);

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
                const canJoin = canJoinGame(i.user.id, player1Id);
                if (!canJoin.canJoin) {
                    await i.reply({content: canJoin.error, ephemeral: true});
                    return;
                }

                gameState.player2 = i.user.id;
                collector.stop("player_joined");
                await startGame(i, gameId);
            }
        } catch (error) {
            console.error("[Connect4] Error in waiting collector:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const timeoutEmbed = createTimeoutEmbed(GAME_TITLE);
            await interaction.editReply({embeds: [timeoutEmbed], components: []});
            activeGames.delete(gameId);
        }
    });
}

async function startGameAgainstAI(interaction: any, player1Id: string, gameId: string, originalUserId: string) {
    const gameState: GameState = {
        player1: player1Id,
        player2: NETRICSA_GAME_ID,
        isAI: true,
        board: Array(ROWS * COLS).fill(null),
        currentTurn: player1Id,
        player1Symbol: "🔴",
        player2Symbol: "🟡",
        stats: initializeStats(),
        originalUserId: originalUserId
    };

    activeGames.set(gameId, gameState);
    await startGame(interaction, gameId);
}

async function startGame(interaction: any, gameId: string) {
    const gameState = activeGames.get(gameId);
    if (!gameState) return;

    const message = await updateGameDisplay(interaction, gameId);

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_CONFIG.GAME_TIME
    });

    collector.on("collect", async (i: any) => {
        try {
            if (!i.customId.startsWith(`${GAME_PREFIX}_col_`)) return;

            const col = parseInt(i.customId.split("_")[2]);
            const gameState = activeGames.get(gameId);
            if (!gameState) return;

            if (i.user.id !== gameState.currentTurn) {
                await i.reply({content: "❌ Ce n'est pas ton tour !", ephemeral: true});
                return;
            }

            const row = dropPiece(gameState.board, col);
            if (row === -1) {
                await i.reply({content: "❌ Cette colonne est pleine !", ephemeral: true});
                return;
            }

            const index = row * COLS + col;
            gameState.board[index] = gameState.currentTurn === gameState.player1 ? gameState.player1Symbol : gameState.player2Symbol;

            const winner = checkWinner(gameState.board);
            if (winner) {
                await handleGameEnd(i, gameId, winner, collector);
                return;
            }

            if (isBoardFull(gameState.board)) {
                await handleGameEnd(i, gameId, "draw", collector);
                return;
            }

            gameState.currentTurn = gameState.currentTurn === gameState.player1 ? gameState.player2! : gameState.player1;

            if (gameState.isAI && gameState.currentTurn === NETRICSA_GAME_ID) {
                await makeAIMove(gameState, gameId, i, collector);
            } else {
                await updateGameDisplay(i, gameId);
            }
        } catch (error) {
            console.error("[Connect4] Error in game collector:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const timeoutEmbed = createTimeoutEmbed(GAME_TITLE);
            await interaction.editReply({embeds: [timeoutEmbed], components: []});
            activeGames.delete(gameId);
        }
    });
}

function dropPiece(board: (string | null)[], col: number): number {
    for (let row = ROWS - 1; row >= 0; row--) {
        const index = row * COLS + col;
        if (board[index] === null) {
            return row;
        }
    }
    return -1;
}

function checkWinner(board: (string | null)[]): string | null {
    // Vérifier horizontal
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            const index = row * COLS + col;
            if (board[index] &&
                board[index] === board[index + 1] &&
                board[index] === board[index + 2] &&
                board[index] === board[index + 3]) {
                return board[index];
            }
        }
    }

    // Vérifier vertical
    for (let row = 0; row <= ROWS - 4; row++) {
        for (let col = 0; col < COLS; col++) {
            const index = row * COLS + col;
            if (board[index] &&
                board[index] === board[index + COLS] &&
                board[index] === board[index + COLS * 2] &&
                board[index] === board[index + COLS * 3]) {
                return board[index];
            }
        }
    }

    // Vérifier diagonale (bas-gauche vers haut-droite)
    for (let row = 3; row < ROWS; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            const index = row * COLS + col;
            if (board[index] &&
                board[index] === board[index - COLS + 1] &&
                board[index] === board[index - COLS * 2 + 2] &&
                board[index] === board[index - COLS * 3 + 3]) {
                return board[index];
            }
        }
    }

    // Vérifier diagonale (haut-gauche vers bas-droite)
    for (let row = 0; row <= ROWS - 4; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            const index = row * COLS + col;
            if (board[index] &&
                board[index] === board[index + COLS + 1] &&
                board[index] === board[index + COLS * 2 + 2] &&
                board[index] === board[index + COLS * 3 + 3]) {
                return board[index];
            }
        }
    }

    return null;
}

function isBoardFull(board: (string | null)[]): boolean {
    return board.every(cell => cell !== null);
}

async function makeAIMove(gameState: GameState, gameId: string, interaction: any, collector: any) {
    const aiSymbol = gameState.player2Symbol;
    const playerSymbol = gameState.player1Symbol;

    // Trouver le meilleur coup avec Minimax
    const bestCol = findBestMove(gameState.board, aiSymbol, playerSymbol);

    if (bestCol !== -1) {
        const row = dropPiece(gameState.board, bestCol);
        if (row !== -1) {
            const index = row * COLS + bestCol;
            gameState.board[index] = aiSymbol;
            gameState.currentTurn = gameState.player1;

            const winner = checkWinner(gameState.board);
            if (winner) {
                await handleGameEnd(interaction, gameId, winner, collector);
                return;
            }

            if (isBoardFull(gameState.board)) {
                await handleGameEnd(interaction, gameId, "draw", collector);
                return;
            }

            await updateGameDisplay(interaction, gameId);
        }
    }
}

function findBestMove(board: (string | null)[], aiSymbol: string, playerSymbol: string): number {
    let bestScore = -Infinity;
    let bestCol = -1;

    // Ordre de colonnes privilégiant le centre
    const colOrder = [3, 2, 4, 1, 5, 0, 6];

    for (const col of colOrder) {
        const row = dropPiece(board, col);
        if (row !== -1) {
            const index = row * COLS + col;
            board[index] = aiSymbol;

            // Profondeur 4 pour un bon équilibre performance/intelligence
            const score = minimax(board, 4, false, aiSymbol, playerSymbol, -Infinity, Infinity);

            board[index] = null;

            if (score > bestScore) {
                bestScore = score;
                bestCol = col;
            }
        }
    }

    return bestCol;
}

function minimax(
    board: (string | null)[],
    depth: number,
    isMaximizing: boolean,
    aiSymbol: string,
    playerSymbol: string,
    alpha: number,
    beta: number
): number {
    const winner = checkWinner(board);

    // Conditions de terminaison
    if (winner === aiSymbol) return 10000;
    if (winner === playerSymbol) return -10000;
    if (isBoardFull(board) || depth === 0) {
        return evaluatePosition(board, aiSymbol, playerSymbol);
    }

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (let col = 0; col < COLS; col++) {
            const row = dropPiece(board, col);
            if (row !== -1) {
                const index = row * COLS + col;
                board[index] = aiSymbol;
                const score = minimax(board, depth - 1, false, aiSymbol, playerSymbol, alpha, beta);
                board[index] = null;
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (let col = 0; col < COLS; col++) {
            const row = dropPiece(board, col);
            if (row !== -1) {
                const index = row * COLS + col;
                board[index] = playerSymbol;
                const score = minimax(board, depth - 1, true, aiSymbol, playerSymbol, alpha, beta);
                board[index] = null;
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
        }
        return minScore;
    }
}

function evaluatePosition(board: (string | null)[], aiSymbol: string, playerSymbol: string): number {
    let score = 0;

    // Bonus pour le centre
    const centerCol = Math.floor(COLS / 2);
    for (let row = 0; row < ROWS; row++) {
        const index = row * COLS + centerCol;
        if (board[index] === aiSymbol) score += 3;
        if (board[index] === playerSymbol) score -= 3;
    }

    // Évaluer toutes les fenêtres de 4 cases
    // Horizontal
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            const window: (string | null)[] = [];
            for (let i = 0; i < 4; i++) {
                window.push(board[row * COLS + col + i]);
            }
            score += evaluateWindow(window, aiSymbol, playerSymbol);
        }
    }

    // Vertical
    for (let col = 0; col < COLS; col++) {
        for (let row = 0; row <= ROWS - 4; row++) {
            const window: (string | null)[] = [];
            for (let i = 0; i < 4; i++) {
                window.push(board[(row + i) * COLS + col]);
            }
            score += evaluateWindow(window, aiSymbol, playerSymbol);
        }
    }

    // Diagonale (bas-gauche vers haut-droite)
    for (let row = 3; row < ROWS; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            const window: (string | null)[] = [];
            for (let i = 0; i < 4; i++) {
                window.push(board[(row - i) * COLS + col + i]);
            }
            score += evaluateWindow(window, aiSymbol, playerSymbol);
        }
    }

    // Diagonale (haut-gauche vers bas-droite)
    for (let row = 0; row <= ROWS - 4; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            const window: (string | null)[] = [];
            for (let i = 0; i < 4; i++) {
                window.push(board[(row + i) * COLS + col + i]);
            }
            score += evaluateWindow(window, aiSymbol, playerSymbol);
        }
    }

    return score;
}

function evaluateWindow(window: (string | null)[], aiSymbol: string, playerSymbol: string): number {
    let score = 0;
    const aiCount = window.filter(cell => cell === aiSymbol).length;
    const playerCount = window.filter(cell => cell === playerSymbol).length;
    const emptyCount = window.filter(cell => cell === null).length;

    // Fenêtres de l'IA
    if (aiCount === 4) score += 100; // Victoire
    else if (aiCount === 3 && emptyCount === 1) score += 5; // 3 alignés avec un espace
    else if (aiCount === 2 && emptyCount === 2) score += 2; // 2 alignés avec 2 espaces

    // Fenêtres du joueur (négatif car on veut bloquer)
    if (playerCount === 3 && emptyCount === 1) score -= 4; // Bloquer le joueur en priorité
    else if (playerCount === 2 && emptyCount === 2) score -= 1;

    return score;
}

async function updateGameDisplay(interaction: any, gameId: string, useEditReply: boolean = false) {
    const gameState = activeGames.get(gameId);
    if (!gameState) return;

    const embed = createGameEmbed(gameState);
    const rows = createBoardButtons(gameState, gameId);

    if (useEditReply) {
        return await interaction.editReply({embeds: [embed], components: rows});
    } else {
        return await interaction.update({embeds: [embed], components: rows});
    }
}

function createGameEmbed(gameState: GameState): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle(`🔴 ${GAME_TITLE} 🟡`)
        .setDescription(getBoardDisplay(gameState))
        .setFooter({text: `${gameState.player1Symbol} vs ${gameState.player2Symbol}`})
        .setTimestamp();
}

function createBoardButtons(gameState: GameState, gameId: string): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Créer les boutons de colonnes (divisés en 2 lignes: 4 + 3)
    const colButtonsRow1: ButtonBuilder[] = [];
    const colButtonsRow2: ButtonBuilder[] = [];

    for (let col = 0; col < COLS; col++) {
        const colButton = new ButtonBuilder()
            .setCustomId(`${GAME_PREFIX}_col_${col}_${gameId}`)
            .setLabel(`${col + 1}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(dropPiece(gameState.board, col) === -1);

        if (col < 4) {
            colButtonsRow1.push(colButton);
        } else {
            colButtonsRow2.push(colButton);
        }
    }

    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(colButtonsRow1));
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(colButtonsRow2));

    return rows;
}


function getBoardDisplay(gameState: GameState, showTurn: boolean = true): string {
    let display = "";

    if (showTurn) {
        const currentPlayerSymbol = gameState.currentTurn === gameState.player1 ? gameState.player1Symbol : gameState.player2Symbol;
        const currentPlayerName = gameState.currentTurn === gameState.player1
            ? `<@${gameState.player1}>`
            : (gameState.isAI ? "Netricsa" : `<@${gameState.player2}>`);

        display += `**Tour de ${currentPlayerName} ${currentPlayerSymbol}**\n\n`;
    }

    // Numéros de colonnes
    display += "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n";

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const index = row * COLS + col;
            const cell = gameState.board[index];
            display += cell || "⚫";
        }
        display += "\n";
    }

    return display;
}

async function handleGameEnd(interaction: any, gameId: string, result: string | null, collector: any, useEditReply: boolean = false) {
    const gameState = activeGames.get(gameId);
    if (!gameState) return;

    collector.stop("game_ended");

    let resultText = "";
    let color = 0x2494DB;

    if (result === "draw") {
        resultText = "🤝 Égalité !";
        color = 0xFEE75C;

        updateStatsOnDraw(gameState.stats);
        recordDraw(gameState.player1, "connect4", gameState.isAI, interaction.channel);
        if (!gameState.isAI) {
            recordDraw(gameState.player2!, "connect4", false, interaction.channel);
        } else {
            recordDraw(NETRICSA_GAME_ID, "connect4", true, interaction.channel);
        }
    } else {
        const winnerSymbol = result;
        const winnerId = winnerSymbol === gameState.player1Symbol ? gameState.player1 : gameState.player2!;
        const loserId = winnerId === gameState.player1 ? gameState.player2! : gameState.player1;

        if (winnerId === NETRICSA_GAME_ID) {
            resultText = "<@1462959115528835092> gagne !";
            color = 0xED4245;
        } else {
            resultText = `🎉 <@${winnerId}> gagne !`;
            color = 0x57F287;
        }

        const winnerLabel = winnerId === gameState.player1 ? 'player1' : 'player2';
        updateStatsOnWin(gameState.stats, winnerLabel);
        recordWin(winnerId, "connect4", gameState.isAI, interaction.channel);
        recordLoss(loserId, "connect4", gameState.isAI, interaction.channel);
    }

    // Construire la description : grille finale + résultat + winstreaks
    let description = "Grille finale:\n";
    description += getBoardDisplay(gameState, false); // Ne pas afficher le tour
    description += `\n**${resultText}**\n`;
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

    const rematchButton = createRematchButton(gameId, GAME_PREFIX);
    const backButton = createBackToMenuButton();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

    if (useEditReply) {
        await interaction.editReply({embeds: [embed], components: [row]});
    } else {
        await interaction.update({embeds: [embed], components: [row]});
    }

    gameState.player1WantsRematch = false;
    gameState.player2WantsRematch = false;

    setupRematchCollector(interaction, gameId, embed);
}


function setupRematchCollector(interaction: any, gameId: string, originalEmbed: EmbedBuilder) {
    const gameState = activeGames.get(gameId);
    if (!gameState) return;

    const collector = interaction.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
    });

    collector.on("collect", async (i: any) => {
        try {
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

            if (!i.customId.startsWith(`${GAME_PREFIX}_rematch_`)) return;

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
                gameState.board = Array(ROWS * COLS).fill(null);
                gameState.currentTurn = gameState.player1;

                const newGameId = i.channelId + "_" + Date.now();
                activeGames.set(newGameId, gameState);
                activeGames.delete(gameId);

                await startGame(i, newGameId);
                return;
            }

            // Mode PvP
            if (gameState.player1WantsRematch && gameState.player2WantsRematch) {
                collector.stop("rematch");
                gameState.board = Array(ROWS * COLS).fill(null);
                gameState.currentTurn = gameState.player1;

                const newGameId = i.channelId + "_" + Date.now();
                activeGames.set(newGameId, gameState);
                activeGames.delete(gameId);

                await startGame(i, newGameId);
            } else {
                // Afficher l'état du rematch
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

                const rematchButton = createRematchButton(gameId, GAME_PREFIX);
                const backButton = createBackToMenuButton();
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

                await i.update({embeds: [updatedEmbed], components: [row]});
            }
        } catch (error) {
            console.error("[Connect4] Error in rematch collector:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const description = `⏱️ Le temps pour accepter un rematch est écoulé.${getStatsDescription(gameState.stats, gameState.player1, gameState.player2, gameState.isAI)}`;

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`🎮 ${GAME_TITLE}`)
                .setDescription(description)
                .setTimestamp();

            const footerText = getStatsFooter(gameState.stats);
            if (footerText) {
                embed.setFooter({text: footerText});
            }

            try {
                await interaction.message.edit({embeds: [embed], components: []});
            } catch (error: any) {
                console.log("[Connect4] Cannot edit rematch timeout message. Error:", error.code);
            }
        }
    });
}
