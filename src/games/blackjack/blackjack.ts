import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {createBackToMenuButton} from "../common/gameUtils";
import {NETRICSA_GAME_ID, recordDraw, recordLoss, recordWin} from "../common/globalStats";

interface Card {
    suit: string;
    value: string;
    numericValue: number;
}

interface GameState {
    player: string;
    playerHand: Card[];
    dealerHand: Card[];
    deck: Card[];
    playerScore: number;
    dealerScore: number;
    gameOver: boolean;
    playerWins: number;
    dealerWins: number;
    draws: number;
    currentStreak: number;
    highestStreak: number;
    originalUserId?: string;
    originalInteraction?: any; // Pour éditer les messages en contexte UserApp
}

const activeGames = new Map<string, GameState>();

const SUITS = ["♠️", "♥️", "♦️", "♣️"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/**
 * Crée un deck de 52 cartes
 */
function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            let numericValue = 0;
            if (value === "A") {
                numericValue = 11; // L'As vaut 11 par défaut
            } else if (["J", "Q", "K"].includes(value)) {
                numericValue = 10;
            } else {
                numericValue = parseInt(value);
            }
            deck.push({suit, value, numericValue});
        }
    }
    return deck;
}

/**
 * Mélange le deck
 */
function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Pioche une carte du deck
 */
function drawCard(deck: Card[]): Card {
    return deck.pop()!;
}

/**
 * Calcule le score d'une main en gérant les As intelligemment
 */
function calculateScore(hand: Card[]): number {
    let score = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.value === "A") {
            aces++;
            score += 11;
        } else {
            score += card.numericValue;
        }
    }

    // Ajuster les As si nécessaire (de 11 à 1)
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }

    return score;
}

/**
 * Formate une main de cartes
 */
function formatHand(hand: Card[], hideFirstCard: boolean = false): string {
    if (hideFirstCard && hand.length > 0) {
        return `🂠 ${hand.slice(1).map(c => `${c.value}${c.suit}`).join(" ")}`;
    }
    return hand.map(c => `${c.value}${c.suit}`).join(" ");
}

/**
 * Crée l'embed du jeu
 */
function createGameEmbed(gameState: GameState, hideDealer: boolean = false): EmbedBuilder {
    const playerScore = calculateScore(gameState.playerHand);
    const dealerScore = hideDealer ? "?" : calculateScore(gameState.dealerHand).toString();

    let description = `**Dealer** (${dealerScore})\n${formatHand(gameState.dealerHand, hideDealer)}\n\n`;
    description += `**<@${gameState.player}>** (${playerScore})\n${formatHand(gameState.playerHand)}`;

    const embed = new EmbedBuilder()
        .setColor(0x14171A)
        .setTitle("🃏 Blackjack")
        .setDescription(description)
        .setTimestamp();

    if (gameState.playerWins > 0 || gameState.dealerWins > 0 || gameState.draws > 0) {
        embed.setFooter({
            text: `Victoires: ${gameState.playerWins} | Défaites: ${gameState.dealerWins} | Égalités: ${gameState.draws}${gameState.currentStreak > 1 ? ` | 🔥 ${gameState.currentStreak}` : ""}`
        });
    }

    return embed;
}

/**
 * Crée les boutons de jeu
 */
function createGameButtons(disabled: boolean = false): ActionRowBuilder<ButtonBuilder> {
    const hitButton = new ButtonBuilder()
        .setCustomId("blackjack_hit")
        .setLabel("Piger")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎴")
        .setDisabled(disabled);

    const standButton = new ButtonBuilder()
        .setCustomId("blackjack_stand")
        .setLabel("Rester")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✋")
        .setDisabled(disabled);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(hitButton, standButton);
}

/**
 * Le dealer joue automatiquement
 */
function dealerPlay(gameState: GameState): void {
    // Le dealer doit piger jusqu'à 17 minimum
    while (calculateScore(gameState.dealerHand) < 17) {
        gameState.dealerHand.push(drawCard(gameState.deck));
    }
}

/**
 * Détermine le gagnant
 */
async function determineWinner(gameState: GameState, channel: any): Promise<string> {
    const playerScore = calculateScore(gameState.playerHand);
    const dealerScore = calculateScore(gameState.dealerHand);

    let result = "";
    let hasWon = false;
    let isNaturalBlackjack = false;
    let has21With5Cards = false;

    // Vérifier si c'est un 21 parfait avec 5 cartes ou plus
    if (playerScore === 21 && gameState.playerHand.length >= 5) {
        has21With5Cards = true;
    }

    if (playerScore > 21) {
        result = "💥 **Bust !** Tu as dépassé 21.";
        gameState.dealerWins++;
        gameState.currentStreak = 0;
        await recordLoss(gameState.player, 'blackjack', true, channel);
        await recordWin(NETRICSA_GAME_ID, 'blackjack', true, channel);
    } else if (dealerScore > 21) {
        result = "🎉 **Tu gagnes !** Le dealer a dépassé 21.";
        gameState.playerWins++;
        gameState.currentStreak++;
        if (gameState.currentStreak > gameState.highestStreak) {
            gameState.highestStreak = gameState.currentStreak;
        }
        hasWon = true;
        await recordWin(gameState.player, 'blackjack', true, channel);
        await recordLoss(NETRICSA_GAME_ID, 'blackjack', true, channel);
    } else if (playerScore === 21 && gameState.playerHand.length === 2) {
        result = "🎰 **BLACKJACK !** Tu as gagné !";
        gameState.playerWins++;
        gameState.currentStreak++;
        if (gameState.currentStreak > gameState.highestStreak) {
            gameState.highestStreak = gameState.currentStreak;
        }
        hasWon = true;
        isNaturalBlackjack = true;
        await recordWin(gameState.player, 'blackjack', true, channel);
        await recordLoss(NETRICSA_GAME_ID, 'blackjack', true, channel);
    } else if (playerScore > dealerScore) {
        result = "🎉 **Tu gagnes !** Ta main est meilleure.";
        gameState.playerWins++;
        gameState.currentStreak++;
        if (gameState.currentStreak > gameState.highestStreak) {
            gameState.highestStreak = gameState.currentStreak;
        }
        hasWon = true;
        await recordWin(gameState.player, 'blackjack', true, channel);
        await recordLoss(NETRICSA_GAME_ID, 'blackjack', true, channel);
    } else if (playerScore < dealerScore) {
        result = "😔 **Tu perds.** Le dealer a une meilleure main.";
        gameState.dealerWins++;
        gameState.currentStreak = 0;
        await recordLoss(gameState.player, 'blackjack', true, channel);
        await recordWin(NETRICSA_GAME_ID, 'blackjack', true, channel);
    } else {
        result = "🤝 **Égalité !** Vous avez le même score.";
        gameState.draws++;
        gameState.currentStreak = 0;
        await recordDraw(gameState.player, 'blackjack', true, channel);
        await recordDraw(NETRICSA_GAME_ID, 'blackjack', true, channel);
    }

    // Tracker les achievements Blackjack
    if (channel && channel.client) {
        const {trackBlackjackAchievements} = require("../../services/achievementService");
        await trackBlackjackAchievements(
            gameState.player,
            "Player",
            hasWon,
            isNaturalBlackjack,
            has21With5Cards,
            channel.client,
            channel.id
        );
    }

    return result;
}

/**
 * Démarre une nouvelle partie
 */
function startNewGame(playerId: string): GameState {
    const deck = shuffleDeck(createDeck());
    const playerHand = [drawCard(deck), drawCard(deck)];
    const dealerHand = [drawCard(deck), drawCard(deck)];

    const existingState = activeGames.get(playerId);

    return {
        player: playerId,
        playerHand,
        dealerHand,
        deck,
        playerScore: calculateScore(playerHand),
        dealerScore: calculateScore(dealerHand),
        gameOver: false,
        playerWins: existingState?.playerWins || 0,
        dealerWins: existingState?.dealerWins || 0,
        draws: existingState?.draws || 0,
        currentStreak: existingState?.currentStreak || 0,
        highestStreak: existingState?.highestStreak || 0,
        originalUserId: existingState?.originalUserId,
        originalInteraction: existingState?.originalInteraction // Conserver pour les timeouts
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blackjack")
        .setDescription("Joue au Blackjack contre Netricsa"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const playerId = interaction.user.id;
            await startBlackjackGame(interaction, playerId, false);
        } catch (error) {
            await handleInteractionError(interaction, error, "Blackjack");
        }
    },

    // Exporter pour utilisation depuis le menu des jeux
    startGame: async (interaction: any, originalUserId: string) => {
        await startBlackjackGame(interaction, interaction.user.id, true, originalUserId);
    }
};

/**
 * Démarre une partie de Blackjack
 * @param interaction L'interaction Discord
 * @param playerId L'ID du joueur
 * @param useUpdate Si true, utilise update() au lieu de reply() (quand appelé depuis le menu)
 * @param originalUserId L'ID de l'utilisateur qui a lancé /games
 */
async function startBlackjackGame(interaction: any, playerId: string, useUpdate: boolean = false, originalUserId?: string) {
    const gameState = startNewGame(playerId);
    gameState.originalUserId = originalUserId || playerId;
    gameState.originalInteraction = interaction; // Stocker l'interaction pour les timeouts
    activeGames.set(playerId, gameState);

    // Vérifier si le joueur a un Blackjack naturel
    const playerScore = calculateScore(gameState.playerHand);
    if (playerScore === 21) {
        gameState.gameOver = true;
        dealerPlay(gameState);
        const result = await determineWinner(gameState, interaction.channel);

        const finalEmbed = createGameEmbed(gameState, false);
        finalEmbed.setDescription(
            finalEmbed.data.description + `\n\n${result}`
        );

        const rematchButton = new ButtonBuilder()
            .setCustomId("blackjack_rematch")
            .setLabel("Rejouer")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🔄");

        const backButton = createBackToMenuButton();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

        const message = useUpdate
            ? await interaction.update({embeds: [finalEmbed], components: [row], fetchReply: true})
            : await interaction.reply({embeds: [finalEmbed], components: [row], fetchReply: true});

        setupRematchCollector(message, gameState);
        return;
    }

    const embed = createGameEmbed(gameState, true);
    const buttons = createGameButtons();

    const message = useUpdate
        ? await interaction.update({embeds: [embed], components: [buttons], fetchReply: true})
        : await interaction.reply({embeds: [embed], components: [buttons], fetchReply: true});

    setupGameCollector(message, gameState);
}

/**
 * Configure le collector pour les actions du jeu
 */
function setupGameCollector(message: any, gameState: GameState): void {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
    });

    collector.on("collect", async (i: any) => {
        try {
            // Vérifier que c'est le bon joueur
            if (i.user.id !== gameState.player) {
                await i.reply({
                    content: "❌ Ce n'est pas ta partie !",
                    ephemeral: true
                });
                return;
            }

            if (i.customId === "blackjack_hit") {
                // Piger une carte
                gameState.playerHand.push(drawCard(gameState.deck));
                gameState.playerScore = calculateScore(gameState.playerHand);

                // Vérifier si le joueur a bust
                if (gameState.playerScore > 21) {
                    gameState.gameOver = true;
                    collector.stop("bust");
                    dealerPlay(gameState);
                    const result = await determineWinner(gameState, message.channel);

                    const finalEmbed = createGameEmbed(gameState, false);
                    finalEmbed.setDescription(
                        finalEmbed.data.description + `\n\n${result}`
                    );

                    const rematchButton = new ButtonBuilder()
                        .setCustomId("blackjack_rematch")
                        .setLabel("Rejouer")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji("🔄");

                    const backButton = createBackToMenuButton();
                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

                    await i.update({embeds: [finalEmbed], components: [row]});
                    setupRematchCollector(message, gameState);
                    return;
                }

                // Continuer la partie
                const embed = createGameEmbed(gameState, true);
                const buttons = createGameButtons();
                await i.update({embeds: [embed], components: [buttons]});

            } else if (i.customId === "blackjack_stand") {
                // Le joueur reste, le dealer joue
                gameState.gameOver = true;
                collector.stop("stand");
                dealerPlay(gameState);
                const result = await determineWinner(gameState, message.channel);

                const finalEmbed = createGameEmbed(gameState, false);
                finalEmbed.setDescription(
                    finalEmbed.data.description + `\n\n${result}`
                );

                const rematchButton = new ButtonBuilder()
                    .setCustomId("blackjack_rematch")
                    .setLabel("Rejouer")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("🔄");

                const backButton = createBackToMenuButton();
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

                await i.update({embeds: [finalEmbed], components: [row]});
                setupRematchCollector(message, gameState);
            }

        } catch (error) {
            console.error("[Blackjack] Error handling button:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time" && !gameState.gameOver) {
            activeGames.delete(gameState.player);

            try {
                // Utiliser originalInteraction.editReply pour supporter UserApp
                if (gameState.originalInteraction) {
                    await gameState.originalInteraction.editReply({components: []});
                } else {
                    await message.edit({components: []});
                }
            } catch (error: any) {
                console.log("[Blackjack] Cannot edit timeout message. Error:", error.code);
            }
        }
    });
}

/**
 * Configure le collector pour le rematch
 */
function setupRematchCollector(message: any, gameState: GameState): void {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 minutes
    });

    collector.on("collect", async (i: any) => {
        try {
            if (i.customId === "blackjack_rematch") {
                if (i.user.id !== gameState.player) {
                    await i.reply({
                        content: "❌ Ce n'est pas ta partie !",
                        ephemeral: true
                    });
                    return;
                }

                collector.stop("rematch");

                // Nouvelle partie
                const newGameState = startNewGame(gameState.player);
                newGameState.originalUserId = gameState.originalUserId;
                activeGames.set(gameState.player, newGameState);

                const embed = createGameEmbed(newGameState, true);
                const buttons = createGameButtons();

                await i.update({embeds: [embed], components: [buttons]});
                setupGameCollector(message, newGameState);
            } else if (i.customId === "back_to_menu") {
                activeGames.delete(gameState.player);
                collector.stop("menu");

                // Defer l'interaction avant de retourner au menu
                await i.deferUpdate();

                // Retour au menu des jeux
                const gamesModule = require("../../commands/games/games");
                await gamesModule.showGameMenu(i, gameState.originalUserId || gameState.player);
            }
        } catch (error) {
            console.error("[Blackjack] Error handling rematch:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            activeGames.delete(gameState.player);

            try {
                // Utiliser originalInteraction.editReply pour supporter UserApp
                if (gameState.originalInteraction) {
                    await gameState.originalInteraction.editReply({components: []});
                } else {
                    await message.edit({components: []});
                }
            } catch (error: any) {
                console.log("[Blackjack] Cannot edit rematch timeout message. Error:", error.code);
            }
        }
    });
}





