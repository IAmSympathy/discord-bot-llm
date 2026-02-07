import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";
import {createBackToMenuButton} from "../common/gameUtils";
import {recordLoss, recordWin} from "../common/globalStats";

interface GameState {
    player: string;
    word: string;
    guessedLetters: Set<string>;
    wrongGuesses: number;
    maxWrongGuesses: number;
    wins: number;
    losses: number;
    currentStreak: number;
    highestStreak: number;
    isCompleted: boolean;
    selectedLetter?: string;
    originalUserId?: string; // Celui qui a lancé /games
}

const activeGames = new Map<string, GameState>();

/**
 * Normalise une lettre en enlevant les accents
 * É, È, Ê, Ë → E
 * À, Â → A
 * etc.
 */
function normalizeLetterForComparison(letter: string): string {
    return letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Liste de mots français de secours (si l'API échoue)
const FALLBACK_WORDS = [
    "ORDINATEUR", "TÉLÉPHONE", "VOITURE", "MAISON", "JARDIN", "SOLEIL", "MONTAGNE",
    "RIVIÈRE", "ÉLÉPHANT", "PAPILLON", "CHOCOLAT", "MUSIQUE", "BIBLIOTHÈQUE",
    "RESTAURANT", "AVENTURE", "MYSTÈRE", "CHAMPION", "VILLAGE", "CHÂTEAU", "DRAGON",
    "PRINCESSE", "CHEVALIER", "MAGICIEN", "TRÉSOR", "PIRATE", "NAVIRE", "ÉTOILE",
    "GALAXIE", "PLANÈTE", "UNIVERS", "SCIENCE", "HISTOIRE", "GÉOGRAPHIE", "MATHÉMATIQUE",
    "LITTÉRATURE", "PHILOSOPHIE", "PSYCHOLOGIE", "BIOLOGIE", "CHIMIE", "PHYSIQUE",
    "TECHNOLOGIE", "INTERNET", "RÉSEAU", "SATELLITE", "MISSILE", "FUSÉE", "AVION",
    "HÉLICOPTÈRE", "BATEAU", "TRAIN", "MÉTRO", "AUTOBUS", "CAMION", "MOTO",
    "VÉLO", "TROTTINETTE", "SKATEBOARD", "PATINS", "SKI", "SNOWBOARD", "SURF"
];

/**
 * Récupère un mot aléatoire depuis une API
 * API utilisée : Random Word API (liste de mots français)
 */
async function fetchRandomWord(): Promise<string> {
    const maxAttempts = 10; // Limite pour éviter une boucle infinie

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            // Essayer d'abord l'API de mots français aléatoires
            const response = await fetch('https://trouve-mot.fr/api/random');

            if (response.ok) {
                const data = await response.json();
                // L'API retourne un tableau d'objets avec une propriété 'name'
                if (data && data[0] && data[0].name) {
                    const word = data[0].name.toUpperCase();
                    // Vérifier que le mot ne contient que des lettres (avec accents autorisés) et pas de W
                    if (/^[A-ZÀ-ÿ]+$/.test(word) && word.length >= 4 && word.length <= 12 && !word.includes('W')) {
                        console.log(`[Hangman] Word fetched from API: ${word} (attempt ${attempt + 1})`);
                        return word;
                    } else if (word.includes('W')) {
                        console.log(`[Hangman] Word "${word}" contains W, refetching... (attempt ${attempt + 1})`);
                        // Refetch si le mot contient un W
                    }
                }
            }
        } catch (error) {
            console.error(`[Hangman] Error fetching word from API (attempt ${attempt + 1}):`, error);
        }
    }

    // Fallback : utiliser la liste locale (sans mots contenant W)
    const wordsWithoutW = FALLBACK_WORDS.filter(word => !word.includes('W'));
    const word = wordsWithoutW[Math.floor(Math.random() * wordsWithoutW.length)];
    console.log(`[Hangman] Using fallback word: ${word}`);
    return word;
}

const HANGMAN_STAGES = [
    "```\n  ┌─────┐\n  │     │\n  │     \n  │     \n  │     \n  │     \n──┴──\n```",
    "```\n  ┌─────┐\n  │     │\n  │     <:cringesmile:1469540262849019955>\n  │     \n  │     \n  │     \n──┴──\n```",
    "```\n  ┌─────┐\n  │     │\n  │     <:cringesmile:1469540262849019955>\n  │     │\n  │     \n  │     \n──┴──\n```",
    "```\n  ┌─────┐\n  │     │\n  │     <:cringesmile:1469540262849019955>\n  │    ─│\n  │     \n  │     \n──┴──\n```",
    "```\n  ┌─────┐\n  │     │\n  │     <:cringesmile:1469540262849019955>\n  │    ─│─\n  │     \n  │     \n──┴──\n```",
    "```\n  ┌─────┐\n  │     │\n  │     <:cringesmile:1469540262849019955>\n  │    ─│─\n  │    ╱\n  │     \n──┴──\n```",
    "```\n  ┌─────┐\n  │     │\n  │     <:outraged_sam:1469527109050306570>\n  │    ─│─\n  │    ╱ ╲\n  │     \n──┴──\n```"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hangman")
        .setDescription("Joue au jeu du bonhomme pendu"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const playerId = interaction.user.id;
            const gameId = interaction.channelId + "_" + playerId + "_" + Date.now();

            await startGame(interaction, playerId, gameId);
        } catch (error: any) {
            await handleInteractionError(interaction, error, "Hangman");
        }
    },

    // Exporter la fonction pour le menu principal
    startGame
};

async function startGame(interaction: any, playerId: string, gameId: string) {
    const word = await fetchRandomWord();

    const gameState: GameState = {
        player: playerId,
        word: word,
        guessedLetters: new Set(),
        wrongGuesses: 0,
        maxWrongGuesses: 6,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        highestStreak: 0,
        isCompleted: false,
        selectedLetter: undefined
    };

    activeGames.set(gameId, gameState);

    const embed = createGameEmbed(gameState);
    const components = createLetterSelectMenu(gameState, gameId);

    // Toujours utiliser update() pour éditer le message existant
    const message = await interaction.update({
        embeds: [embed],
        components: components,
        fetchReply: true
    });

    setupGameCollector(message, gameState, gameId);
}

function createGameEmbed(gameState: GameState): EmbedBuilder {
    const hiddenWord = getHiddenWord(gameState);

    // Filtrer les lettres incorrectes en tenant compte de la normalisation
    const wrongLetters = Array.from(gameState.guessedLetters)
        .filter(letter => {
            // Vérifier si la lettre ou une version accentuée est dans le mot
            return !gameState.word.split("").some(wordLetter =>
                normalizeLetterForComparison(wordLetter) === letter
            );
        })
        .sort()
        .join(", ");

    // Toutes les lettres essayées (correctes et incorrectes)
    const triedLetters = Array.from(gameState.guessedLetters).sort().join(", ");

    let description = `${HANGMAN_STAGES[gameState.wrongGuesses]}\n\n`;
    description += `**Mot à deviner:**\n\`\`\`\n${hiddenWord}\n\`\`\`\n\n`;

    if (triedLetters.length > 0) {
        description += `**Lettres essayées:** ${triedLetters}\n`;
    }

    if (wrongLetters.length > 0) {
        description += `**Lettres incorrectes:** ${wrongLetters}\n`;
    }

    description += `\n**Erreurs:** ${gameState.wrongGuesses}/${gameState.maxWrongGuesses}`;

    const embed = new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle("🎮 Sam Pendu")
        .setDescription(description)
        .setTimestamp();

    // Ajouter le footer avec les stats
    const totalGames = gameState.wins + gameState.losses;
    if (totalGames > 0) {
        embed.setFooter({text: `Score : ${gameState.wins} - ${gameState.losses}`});
    }

    return embed;
}

function getHiddenWord(gameState: GameState): string {
    return gameState.word
        .split("")
        .map(letter => {
            // Vérifier si la lettre ou sa version normalisée a été devinée
            const normalizedLetter = normalizeLetterForComparison(letter);
            const isGuessed = gameState.guessedLetters.has(letter) ||
                gameState.guessedLetters.has(normalizedLetter);
            return isGuessed ? letter : "_";
        })
        .join(" ");
}

function createLetterSelectMenu(gameState: GameState, gameId: string): ActionRowBuilder<any>[] {
    // Discord limite à 25 options max, donc on enlève le W (peu utilisé en français)
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVXYZ".split("");

    // Filtrer les lettres non essayées
    const availableLetters = alphabet.filter(letter => !gameState.guessedLetters.has(letter));

    // Créer les options du menu déroulant uniquement pour les lettres disponibles
    const options = availableLetters.map(letter => {
        return new StringSelectMenuOptionBuilder()
            .setLabel(letter)
            .setValue(letter)
    });

    // Si aucune lettre disponible, ajouter une option désactivée
    if (options.length === 0) {
        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("Aucune lettre disponible")
                .setValue("none")
                .setDescription("Toutes les lettres ont été essayées")
        );
    }

    // Créer le menu déroulant
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`hangman_select_${gameId}`)
        .setPlaceholder(gameState.selectedLetter ? `Lettre sélectionnée: ${gameState.selectedLetter}` : "Choisis une lettre...")
        .addOptions(options)
        .setDisabled(options.length === 0 || (options.length === 1 && options[0].data.value === "none"));

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    // Créer le bouton de validation
    const validateButton = new ButtonBuilder()
        .setCustomId(`hangman_validate_${gameId}`)
        .setLabel(gameState.selectedLetter ? `Valider "${gameState.selectedLetter}"` : "Valider")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✔️")
        .setDisabled(!gameState.selectedLetter);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(validateButton);

    return [selectRow, buttonRow];
}

function setupGameCollector(message: any, gameState: GameState, gameId: string) {
    const collector = message.createMessageComponentCollector({
        time: 600000 // 10 minutes
    });

    collector.on("collect", async (i: any) => {
        try {
            const clickerId = i.user.id;

            // Vérifier que c'est le bon joueur
            if (clickerId !== gameState.player) {
                await i.reply({content: "❌ Ce n'est pas ta partie !", ephemeral: true});
                return;
            }

            // Gestion du menu déroulant (sélection d'une lettre)
            if (i.customId === `hangman_select_${gameId}`) {
                const selectedLetter = i.values[0];
                gameState.selectedLetter = selectedLetter;

                // Mettre à jour l'affichage avec la lettre sélectionnée
                const embed = createGameEmbed(gameState);
                const components = createLetterSelectMenu(gameState, gameId);
                await i.update({embeds: [embed], components: components});
                return;
            }

            // Gestion du bouton de validation
            if (i.customId === `hangman_validate_${gameId}`) {
                if (!gameState.selectedLetter) {
                    await i.reply({content: "❌ Sélectionne d'abord une lettre !", ephemeral: true});
                    return;
                }

                const letter = gameState.selectedLetter;

                // Ajouter la lettre aux devinées
                gameState.guessedLetters.add(letter);
                gameState.selectedLetter = undefined; // Reset la sélection

                // Vérifier si la lettre (ou sa version accentuée) est dans le mot
                const isLetterInWord = gameState.word.split("").some(wordLetter =>
                    normalizeLetterForComparison(wordLetter) === letter
                );

                if (!isLetterInWord) {
                    gameState.wrongGuesses++;
                }

                // Vérifier si le jeu est terminé (toutes les lettres normalisées ont été devinées)
                const isWordGuessed = gameState.word.split("").every(letter => {
                    const normalizedLetter = normalizeLetterForComparison(letter);
                    return gameState.guessedLetters.has(letter) || gameState.guessedLetters.has(normalizedLetter);
                });
                const isGameLost = gameState.wrongGuesses >= gameState.maxWrongGuesses;

                if (isWordGuessed || isGameLost) {
                    gameState.isCompleted = true;
                    collector.stop("completed");
                    await displayResult(message, gameState, isWordGuessed, false);
                    activeGames.delete(gameId);
                    return;
                }

                // Mettre à jour l'affichage
                const embed = createGameEmbed(gameState);
                const components = createLetterSelectMenu(gameState, gameId);
                await i.update({embeds: [embed], components: components});
            }

            // Gestion du bouton Abandonner
            if (i.customId === `hangman_giveup_${gameId}`) {
                gameState.isCompleted = true;
                collector.stop("gave_up");

                // Enregistrer la défaite avec le canal pour la notification de level up
                recordLoss(gameState.player, 'hangman', true, message.channel);
                gameState.losses++;
                gameState.currentStreak = 0;

                await displayResult(message, gameState, false, true);
                activeGames.delete(gameId);
                return;
            }
        } catch (error) {
            console.error("[Hangman] Error handling guess:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time" && !gameState.isCompleted) {
            activeGames.delete(gameId);

            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Sam Pendu")
                .setDescription(`⏱️ Temps écoulé ! La partie est annulée.\n\n**Le mot était:** \`${gameState.word}\`` + getStatsDescription(gameState))
                .setTimestamp();

            const footerText = getStatsFooter(gameState);
            if (footerText) {
                timeoutEmbed.setFooter({text: footerText});
            }

            await message.edit({embeds: [timeoutEmbed], components: []});
        }
    });
}

async function displayResult(message: any, gameState: GameState, isWon: boolean, isAbandoned: boolean = false) {
    let result: string;
    let color: number;

    if (isWon) {
        result = `🎉 Victoire ! Tu as trouvé le mot !`;
        color = 0x57F287;
        gameState.wins++;
        gameState.currentStreak++;

        // Enregistrer dans les stats globales (Hangman est toujours vs IA)
        // Passer le message pour permettre la notification de level up
        recordWin(gameState.player, 'hangman', true, message.channel);

        // Vérifier l'achievement "Sans Faute"
        const {checkHangmanPerfectAchievement} = require("../../services/gameAchievementChecker");
        await checkHangmanPerfectAchievement(
            gameState.player,
            "Player",
            gameState.wrongGuesses,
            message.client,
            message.channel.id
        );

        // Mettre à jour la plus haute streak
        if (gameState.currentStreak > gameState.highestStreak) {
            gameState.highestStreak = gameState.currentStreak;
        }
    } else {
        if (isAbandoned) {
            result = `🏳️ Partie abandonnée...`;
            color = 0xFEE75C;
        } else {
            result = `💀 Perdu ! Sam a été pendu...`;
            color = 0xED4245;
            gameState.losses++;
            gameState.currentStreak = 0;

            // Enregistrer dans les stats globales (seulement si pas déjà enregistré lors de l'abandon)
            // Hangman est toujours vs IA
            // Passer le message pour permettre la notification de level up
            if (!isAbandoned) {
                recordLoss(gameState.player, 'hangman', true, message.channel);
            }
        }
    }

    let description = `${HANGMAN_STAGES[gameState.wrongGuesses]}\n\n`;
    description += `**${result}**\n\n`;
    description += `**Le mot était:** \`${gameState.word}\``;

    // Afficher la streak si > 1
    if (gameState.currentStreak > 1) {
        description += `\n\n<@${gameState.player}> 🔥 **${gameState.currentStreak}**`;
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🎮 Résultat - Sam Pendu")
        .setDescription(description)
        .setTimestamp();

    const footerText = getStatsFooter(gameState);
    if (footerText) {
        embed.setFooter({text: footerText});
    }

    // Attendre un court instant
    await new Promise(resolve => setTimeout(resolve, 100));

    const playAgainButton = new ButtonBuilder()
        .setCustomId(`hangman_restart_${message.channelId}_${Date.now()}`)
        .setLabel("Nouvelle partie")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄");

    const backButton = createBackToMenuButton();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playAgainButton, backButton);

    await message.edit({embeds: [embed], components: [row]});

    setupRestartCollector(message, gameState);
}

function getStatsDescription(gameState: GameState): string {
    const totalGames = gameState.wins + gameState.losses;
    if (totalGames === 0) return "";

    let stats = `\n\n**Statistiques:**\n`;

    if (gameState.highestStreak > 1) {
        stats += `🔥 Meilleure série : **${gameState.highestStreak}**`;
    }

    return stats;
}

function getStatsFooter(gameState: GameState): string {
    const totalGames = gameState.wins + gameState.losses;
    if (totalGames === 0) return "";

    return `Score : ${gameState.wins} - ${gameState.losses}`;
}

function setupRestartCollector(message: any, gameState: GameState) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
    });

    collector.on("collect", async (i: any) => {
        try {
            // Gestion du bouton Nouvelle partie
            if (i.customId.startsWith("hangman_restart_")) {
                const clickerId = i.user.id;

                if (clickerId !== gameState.player) {
                    await i.reply({content: "❌ Ce n'était pas ta partie !", ephemeral: true});
                    return;
                }

                collector.stop("restart");

                // Créer une nouvelle partie avec les stats conservées
                const newWord = await fetchRandomWord();
                const newGameId = i.customId.split("_")[2] + "_" + clickerId + "_" + Date.now();

                const newGameState: GameState = {
                    player: gameState.player,
                    word: newWord,
                    guessedLetters: new Set(),
                    wrongGuesses: 0,
                    maxWrongGuesses: 6,
                    wins: gameState.wins,
                    losses: gameState.losses,
                    currentStreak: gameState.currentStreak,
                    highestStreak: gameState.highestStreak,
                    isCompleted: false,
                    selectedLetter: undefined,
                    originalUserId: gameState.originalUserId
                };

                activeGames.set(newGameId, newGameState);

                const embed = createGameEmbed(newGameState);
                const components = createLetterSelectMenu(newGameState, newGameId);

                await i.update({embeds: [embed], components: components});
                setupGameCollector(message, newGameState, newGameId);
                return;
            }

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
        } catch (error) {
            console.error("[Hangman] Error handling restart:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Sam Pendu")
                .setDescription("⏱️ Le temps pour recommencer est écoulé." + getStatsDescription(gameState))
                .setTimestamp();

            const footerText = getStatsFooter(gameState);
            if (footerText) {
                embed.setFooter({text: footerText});
            }

            await message.edit({embeds: [embed], components: []});
        }
    });
}
