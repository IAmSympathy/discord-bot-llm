import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";

interface GameState {
    player1: string;
    player2: string | null;
    isAI: boolean;
    board: (string | null)[];
    currentTurn: string;
    player1Symbol: string;
    player2Symbol: string;
    player1Wins: number;
    player2Wins: number;
    draws: number;
    player1WantsRematch?: boolean;
    player2WantsRematch?: boolean;
    player1Winstreak: number;
    player2Winstreak: number;
    player1HighestWinstreak: number;
    player2HighestWinstreak: number;
}

const activeGames = new Map<string, GameState>();

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
                await startGameAgainstAI(interaction, player1Id, gameId);
            } else {
                await waitForPlayer(interaction, player1Id, gameId);
            }
        } catch (error: any) {
            await handleInteractionError(interaction, error, "TicTacToe");
        }
    },
};

async function waitForPlayer(interaction: ChatInputCommandInteraction, player1Id: string, gameId: string) {
    const gameState: GameState = {
        player1: player1Id,
        player2: null,
        isAI: false,
        board: Array(9).fill(null),
        currentTurn: player1Id,
        player1Symbol: "❌",
        player2Symbol: "⭕",
        player1Wins: 0,
        player2Wins: 0,
        draws: 0,
        player1Winstreak: 0,
        player2Winstreak: 0,
        player1HighestWinstreak: 0,
        player2HighestWinstreak: 0
    };

    activeGames.set(gameId, gameState);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎮 Tic-Tac-Toe")
        .setDescription(`<@${player1Id}> cherche un adversaire !\n\nClique sur le bouton pour rejoindre la partie.`)
        .setTimestamp();

    const joinButton = new ButtonBuilder()
        .setCustomId(`ttt_join_${gameId}`)
        .setLabel("Rejoindre la partie")
        .setStyle(ButtonStyle.Success)
        .setEmoji("⚔️");

    const cancelButton = new ButtonBuilder()
        .setCustomId(`ttt_cancel_${gameId}`)
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, cancelButton);

    const message = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on("collect", async (i: any) => {
        try {
            if (i.customId === `ttt_cancel_${gameId}`) {
                if (i.user.id !== player1Id) {
                    await i.reply({content: "❌ Seul le créateur peut annuler la partie.", ephemeral: true});
                    return;
                }

                activeGames.delete(gameId);
                collector.stop("cancelled");

                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("🎮 Tic-Tac-Toe")
                    .setDescription("❌ Partie annulée.")
                    .setTimestamp();

                await i.update({embeds: [cancelEmbed], components: []});
                return;
            }

            if (i.customId === `ttt_join_${gameId}`) {
                if (i.user.id === player1Id) {
                    await i.reply({content: "❌ Tu ne peux pas jouer contre toi-même !", ephemeral: true});
                    return;
                }

                gameState.player2 = i.user.id;
                collector.stop("joined");

                await startPvPGame(i, gameState, gameId, message);
            }
        } catch (error) {
            console.error("[TicTacToe] Error handling button:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            activeGames.delete(gameId);

            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Tic-Tac-Toe")
                .setDescription("⏱️ Temps écoulé ! Aucun joueur n'a rejoint.")
                .setTimestamp();

            await interaction.editReply({embeds: [timeoutEmbed], components: []});
        }
    });
}

async function startGameAgainstAI(interaction: ChatInputCommandInteraction, playerId: string, gameId: string) {
    const gameState: GameState = {
        player1: playerId,
        player2: "AI",
        isAI: true,
        board: Array(9).fill(null),
        currentTurn: playerId,
        player1Symbol: "❌",
        player2Symbol: "⭕",
        player1Wins: 0,
        player2Wins: 0,
        draws: 0,
        player1Winstreak: 0,
        player2Winstreak: 0,
        player1HighestWinstreak: 0,
        player2HighestWinstreak: 0
    };

    activeGames.set(gameId, gameState);

    const embed = createGameEmbed(gameState);
    const buttons = createBoardButtons(gameState, gameId);

    const message = await interaction.reply({
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
        .setColor(0x5865F2)
        .setTitle("🎮 Tic-Tac-Toe")
        .setDescription(description)
        .setTimestamp();

    // Ajouter le footer avec les scores
    const totalGames = gameState.player1Wins + gameState.player2Wins + gameState.draws;
    if (totalGames > 0) {
        embed.setFooter({text: `Score : ${gameState.player1Wins} - ${gameState.player2Wins} (${gameState.draws} égalités)`});
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

                // Mettre à jour l'affichage
                const embed = createGameEmbed(gameState);
                const buttons = createBoardButtons(gameState, gameId);
                await i.update({embeds: [embed], components: buttons});

                // IA joue après un court délai
                setTimeout(async () => {
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
                        await message.edit({embeds: [embed], components: buttons});
                    }
                }, 800);
            } else {
                // PvP : alterner les tours
                gameState.currentTurn = gameState.currentTurn === gameState.player1 ? gameState.player2! : gameState.player1;

                const embed = createGameEmbed(gameState);
                const buttons = createBoardButtons(gameState, gameId);
                await i.update({embeds: [embed], components: buttons});
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
                .setTitle("🎮 Tic-Tac-Toe")
                .setDescription("⏱️ Temps écoulé ! La partie est annulée." + getStatsDescription(gameState))
                .setTimestamp();

            const footerText = getStatsFooter(gameState);
            if (footerText) {
                timeoutEmbed.setFooter({text: footerText});
            }

            await message.edit({embeds: [timeoutEmbed], components: []});
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
        gameState.draws++;
        // Égalité : reset des winstreaks
        gameState.player1Winstreak = 0;
        gameState.player2Winstreak = 0;
    } else if (winner === gameState.player1) {
        result = `🎉 <@${gameState.player1}> gagne !`;
        color = 0x57F287;
        gameState.player1Wins++;
        // Joueur 1 gagne
        gameState.player1Winstreak++;
        gameState.player2Winstreak = 0;

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
            color = 0xFEE75C;
        }
        gameState.player2Wins++;
        // Joueur 2 gagne
        gameState.player1Winstreak = 0;
        gameState.player2Winstreak++;

        // Mettre à jour la plus haute winstreak
        if (gameState.player2Winstreak > gameState.player2HighestWinstreak) {
            gameState.player2HighestWinstreak = gameState.player2Winstreak;
        }
    }

    // Construire la description avec les winstreaks
    let description = `**${result}**`;

    // Afficher les winstreaks si > 1
    let winstreakDisplay = "\n\n";
    if (gameState.player1Winstreak > 1) {
        winstreakDisplay += `<@${gameState.player1}> 🔥 **${gameState.player1Winstreak}**\n`;
    }
    if (gameState.player2Winstreak > 1) {
        winstreakDisplay += `${gameState.isAI ? "<@1462959115528835092>" : `<@${gameState.player2}>`} 🔥 **${gameState.player2Winstreak}**\n`;
    }

    if (winstreakDisplay !== "\n\n") {
        description += winstreakDisplay;
    }

    // Afficher la grille finale
    description += "\n**Grille finale:**\n";
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            description += gameState.board[index] || "⬜";
            if (col < 2) description += " ";
        }
        description += "\n";
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🎮 Résultat - Tic-Tac-Toe")
        .setDescription(description)
        .setTimestamp();

    const footerText = getStatsFooter(gameState);
    if (footerText) {
        embed.setFooter({text: footerText});
    }

    // Attendre un court instant pour que l'interaction précédente se termine
    await new Promise(resolve => setTimeout(resolve, 100));

    const rematchButton = new ButtonBuilder()
        .setCustomId(`ttt_rematch_${message.channelId}_${Date.now()}`)
        .setLabel("Rematch")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton);

    await message.edit({embeds: [embed], components: [row]});

    gameState.player1WantsRematch = false;
    gameState.player2WantsRematch = false;

    setupRematchCollector(message, gameState, embed);
}

function getStatsDescription(gameState: GameState): string {
    const totalGames = gameState.player1Wins + gameState.player2Wins + gameState.draws;
    if (totalGames === 0) return "";

    let stats = `\n\n**Statistiques:**\n`;

    if (gameState.player1HighestWinstreak > 1 || gameState.player2HighestWinstreak > 1) {
        stats += `🔥 Meilleures séries : `;
        if (gameState.player1HighestWinstreak > 1) {
            stats += `<@${gameState.player1}>: **${gameState.player1HighestWinstreak}**`;
        }
        if (gameState.player2HighestWinstreak > 1) {
            if (gameState.player1HighestWinstreak > 1) stats += " | ";
            stats += `${gameState.isAI ? "<@1462959115528835092>" : `<@${gameState.player2}>`}: **${gameState.player2HighestWinstreak}**`;
        }
        stats += "\n";
    }

    if (gameState.draws > 0) {
        stats += `🤝 Égalités : **${gameState.draws}**`;
    }

    return stats;
}

function getStatsFooter(gameState: GameState): string {
    const totalGames = gameState.player1Wins + gameState.player2Wins + gameState.draws;
    if (totalGames === 0) return "";

    return `Score : ${gameState.player1Wins} - ${gameState.player2Wins} (${gameState.draws} égalités)`;
}

function setupRematchCollector(message: any, gameState: GameState, originalEmbed: EmbedBuilder) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
    });

    collector.on("collect", async (i: any) => {
        try {
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
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Tic-Tac-Toe")
                .setDescription("⏱️ Le temps pour accepter un rematch est écoulé." + getStatsDescription(gameState))
                .setTimestamp();

            const footerText = getStatsFooter(gameState);
            if (footerText) {
                embed.setFooter({text: footerText});
            }

            await message.edit({embeds: [embed], components: []});
        }
    });
}
