import fs from "fs";
import path from "path";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {DATA_DIR} from "../../utils/constants";
import {createLogger} from "../../utils/logger";
import {recordGamePlayedStats} from "../../services/statsRecorder";

const STATS_FILE = path.join(DATA_DIR, "game_stats.json");
const logger = createLogger("GameStats");

// ID de Netricsa pour ses statistiques de jeux
export const NETRICSA_GAME_ID = "NETRICSA_BOT";
export const NETRICSA_GAME_NAME = "Netricsa";

export interface PlayerGameStats {
    wins: number;
    losses: number;
    draws: number;
    currentStreak: number;
    highestStreak: number;
}

export interface PlayerStats {
    userId: string;
    global: PlayerGameStats;
    rockpaperscissors: PlayerGameStats;
    tictactoe: PlayerGameStats;
    hangman: PlayerGameStats;
    connect4: PlayerGameStats;
}

interface StatsDatabase {
    [userId: string]: Omit<PlayerStats, 'userId'>;
}

/**
 * Charge les stats depuis le fichier JSON
 */
function loadStats(): StatsDatabase {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = fs.readFileSync(STATS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("[GameStats] Error loading stats:", error);
    }
    return {};
}

/**
 * Sauvegarde les stats dans le fichier JSON
 */
function saveStats(stats: StatsDatabase): void {
    try {
        const dir = path.dirname(STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
    } catch (error) {
        console.error("[GameStats] Error saving stats:", error);
    }
}

/**
 * Initialise les stats par défaut pour un jeu
 */
function initGameStats(): PlayerGameStats {
    return {
        wins: 0,
        losses: 0,
        draws: 0,
        currentStreak: 0,
        highestStreak: 0
    };
}

/**
 * Récupère les stats d'un joueur
 */
export function getPlayerStats(userId: string): PlayerStats {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats(),
            connect4: initGameStats()
        };
        saveStats(allStats);
    }

    return {
        userId,
        ...allStats[userId]
    };
}

/**
 * Met à jour les stats après une victoire
 * @param userId ID de l'utilisateur
 * @param game Nom du jeu
 * @param isVsAI true si c'est contre Netricsa, false si contre un joueur
 * @param channel Canal où envoyer la notification de level up (optionnel)
 */
export async function recordWin(userId: string, game: 'rockpaperscissors' | 'tictactoe' | 'hangman' | 'connect4', isVsAI: boolean = false, channel?: any): Promise<void> {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats(),
            connect4: initGameStats()
        };
    }

    // Mettre à jour les stats du jeu spécifique
    allStats[userId][game].wins++;
    allStats[userId][game].currentStreak++;
    if (allStats[userId][game].currentStreak > allStats[userId][game].highestStreak) {
        allStats[userId][game].highestStreak = allStats[userId][game].currentStreak;
    }

    // Mettre à jour les stats globales
    allStats[userId].global.wins++;
    allStats[userId].global.currentStreak++;
    if (allStats[userId].global.currentStreak > allStats[userId].global.highestStreak) {
        allStats[userId].global.highestStreak = allStats[userId].global.currentStreak;
    }

    saveStats(allStats);

    // Enregistrer dans les stats quotidiennes (pour tous, y compris Netricsa)
    const username = userId === NETRICSA_GAME_ID ? NETRICSA_GAME_NAME : "Player";
    recordGamePlayedStats(userId, username, true);

    // Ajouter XP (seulement pour les vrais joueurs, pas pour Netricsa)
    if (userId !== NETRICSA_GAME_ID) {
        // Déterminer le montant d'XP selon le jeu et le type d'adversaire
        let xpAmount = 0;

        if (isVsAI) {
            // Contre Netricsa (PvE)
            switch (game) {
                case 'rockpaperscissors':
                    xpAmount = XP_REWARDS.rpsVictoireVsIA;
                    break;
                case 'tictactoe':
                    xpAmount = XP_REWARDS.tttVictoireVsIA;
                    break;
                case 'connect4':
                    xpAmount = XP_REWARDS.c4VictoireVsIA;
                    break;
                case 'hangman':
                    xpAmount = XP_REWARDS.hangmanVictoire;
                    break;
            }
        } else {
            // Contre joueur (PvP)
            switch (game) {
                case 'rockpaperscissors':
                    xpAmount = XP_REWARDS.rpsVictoireVsJoueur;
                    break;
                case 'tictactoe':
                    xpAmount = XP_REWARDS.tttVictoireVsJoueur;
                    break;
                case 'connect4':
                    xpAmount = XP_REWARDS.c4VictoireVsJoueur;
                    break;
                case 'hangman':
                    xpAmount = XP_REWARDS.hangmanVictoire; // Hangman est toujours vs IA
                    break;
            }
        }

        addXP(userId, "Player", xpAmount, channel);

        // Tracker la victoire pour achievements avancés
        const {trackWin, trackGamePlayed} = require("../../services/gameTracker");
        trackWin(userId, game, isVsAI);
        trackGamePlayed(userId, game);

        // Vérifier les achievements de jeux
        if (channel) {
            const {checkGameAchievements, checkGameTimeAchievements, checkGameSessionAchievements, checkGameDailyAchievements} = require("../../services/gameAchievementChecker");
            await checkGameAchievements(userId, "Player", channel.client, channel.id);
            await checkGameTimeAchievements(userId, "Player", channel.client, channel.id);
            await checkGameSessionAchievements(userId, "Player", channel.client, channel.id);
            await checkGameDailyAchievements(userId, "Player", channel.client, channel.id);
        }
    }
}

/**
 * Met à jour les stats après une défaite/**
 * Met à jour les stats après une défaite
 * @param userId ID de l'utilisateur
 * @param game Nom du jeu
 * @param isVsAI true si c'est contre Netricsa, false si contre un joueur
 * @param channel Canal où envoyer la notification de level up (optionnel)
 */
export async function recordLoss(userId: string, game: 'rockpaperscissors' | 'tictactoe' | 'hangman' | 'connect4', isVsAI: boolean = false, channel?: any): Promise<void> {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats(),
            connect4: initGameStats()
        };
    }

    // Mettre à jour les stats du jeu spécifique
    allStats[userId][game].losses++;
    allStats[userId][game].currentStreak = 0;

    // Mettre à jour les stats globales
    allStats[userId].global.losses++;
    allStats[userId].global.currentStreak = 0;

    saveStats(allStats);

    // Enregistrer dans les stats quotidiennes (pour tous, y compris Netricsa)
    const username = userId === NETRICSA_GAME_ID ? NETRICSA_GAME_NAME : "Player";
    recordGamePlayedStats(userId, username, false);

    // Ajouter XP (seulement pour les vrais joueurs, pas pour Netricsa)
    if (userId !== NETRICSA_GAME_ID) {
        // Déterminer le montant d'XP selon le jeu et le type d'adversaire
        let xpAmount = 0;

        if (isVsAI) {
            // Contre Netricsa (PvE)
            switch (game) {
                case 'rockpaperscissors':
                    xpAmount = XP_REWARDS.rpsDefaiteVsIA;
                    break;
                case 'tictactoe':
                    xpAmount = XP_REWARDS.tttDefaiteVsIA;
                    break;
                case 'connect4':
                    xpAmount = XP_REWARDS.c4DefaiteVsIA;
                    break;
                case 'hangman':
                    xpAmount = XP_REWARDS.hangmanDefaite;
                    break;
            }
        } else {
            // Contre joueur (PvP)
            switch (game) {
                case 'rockpaperscissors':
                    xpAmount = XP_REWARDS.rpsDefaiteVsJoueur;
                    break;
                case 'tictactoe':
                    xpAmount = XP_REWARDS.tttDefaiteVsJoueur;
                    break;
                case 'connect4':
                    xpAmount = XP_REWARDS.c4DefaiteVsJoueur;
                    break;
                case 'hangman':
                    xpAmount = XP_REWARDS.hangmanDefaite; // Hangman est toujours vs IA
                    break;
            }
        }

        addXP(userId, "Player", xpAmount, channel);

        // Tracker la défaite pour achievements avancés
        const {trackLoss, trackGamePlayed} = require("../../services/gameTracker");
        trackLoss(userId, isVsAI);
        trackGamePlayed(userId, game);

        // Vérifier les achievements de jeux
        if (channel) {
            const {checkGameAchievements, checkGameTimeAchievements, checkGameSessionAchievements, checkGameDailyAchievements} = require("../../services/gameAchievementChecker");
            await checkGameAchievements(userId, "Player", channel.client, channel.id);
            await checkGameTimeAchievements(userId, "Player", channel.client, channel.id);
            await checkGameSessionAchievements(userId, "Player", channel.client, channel.id);
            await checkGameDailyAchievements(userId, "Player", channel.client, channel.id);
        }
    }
}

/**
 * Met à jour les stats après une égalité/**
 * Met à jour les stats après une égalité
 * @param userId ID de l'utilisateur
 * @param game Nom du jeu
 * @param isVsAI true si c'est contre Netricsa, false si contre un joueur
 * @param channel Canal où envoyer la notification de level up (optionnel)
 */
export async function recordDraw(userId: string, game: 'rockpaperscissors' | 'tictactoe' | 'hangman' | 'connect4', isVsAI: boolean = false, channel?: any): Promise<void> {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats(),
            connect4: initGameStats()
        };
    }

    // Mettre à jour les stats du jeu spécifique
    allStats[userId][game].draws++;
    allStats[userId][game].currentStreak = 0;

    // Mettre à jour les stats globales
    allStats[userId].global.draws++;
    allStats[userId].global.currentStreak = 0;

    saveStats(allStats);

    // Enregistrer dans les stats quotidiennes (pour tous, y compris Netricsa)
    const username = userId === NETRICSA_GAME_ID ? NETRICSA_GAME_NAME : "Player";
    recordGamePlayedStats(userId, username, false); // Match nul = pas de victoire

    // Ajouter XP (seulement pour les vrais joueurs, pas pour Netricsa)
    if (userId !== NETRICSA_GAME_ID) {
        // Déterminer le montant d'XP selon le jeu et le type d'adversaire
        let xpAmount = 0;

        if (isVsAI) {
            // Contre Netricsa (PvE)
            switch (game) {
                case 'rockpaperscissors':
                    xpAmount = XP_REWARDS.rpsEgaliteVsIA;
                    break;
                case 'tictactoe':
                    xpAmount = XP_REWARDS.tttEgaliteVsIA;
                    break;
                case 'connect4':
                    xpAmount = XP_REWARDS.c4EgaliteVsIA;
                    break;
                case 'hangman':
                    xpAmount = 0; // Pas d'égalité au pendu
                    break;
            }
        } else {
            // Contre joueur (PvP)
            switch (game) {
                case 'rockpaperscissors':
                    xpAmount = XP_REWARDS.rpsEgaliteVsJoueur;
                    break;
                case 'tictactoe':
                    xpAmount = XP_REWARDS.tttEgaliteVsJoueur;
                    break;
                case 'connect4':
                    xpAmount = XP_REWARDS.c4EgaliteVsJoueur;
                    break;
                case 'hangman':
                    xpAmount = 0; // Pas d'égalité au pendu
                    break;
            }
        }

        if (xpAmount > 0) {
            addXP(userId, "Player", xpAmount, channel);
        }

        // Tracker l'égalité pour achievements avancés
        const {trackDraw, trackGamePlayed} = require("../../services/gameTracker");
        trackDraw(userId);
        trackGamePlayed(userId, game);

        // Vérifier les achievements de jeux
        if (channel) {
            const {checkGameAchievements, checkGameTimeAchievements, checkGameSessionAchievements, checkGameDailyAchievements} = require("../../services/gameAchievementChecker");
            await checkGameAchievements(userId, "Player", channel.client, channel.id);
            await checkGameTimeAchievements(userId, "Player", channel.client, channel.id);
            await checkGameSessionAchievements(userId, "Player", channel.client, channel.id);
            await checkGameDailyAchievements(userId, "Player", channel.client, channel.id);
        }
    }
}

/**
 * Génère l'affichage des stats d'un joueur
 */
export function formatPlayerStats(userId: string, game?: 'rockpaperscissors' | 'tictactoe' | 'hangman' | 'connect4'): string {
    const stats = getPlayerStats(userId);

    let output = `📊 **Statistiques de <@${userId}>**\n\n`;

    if (game) {
        // Afficher les stats d'un jeu spécifique
        const gameStats = stats[game];
        const gameName = game === 'rockpaperscissors' ? 'Roche-Papier-Ciseaux' :
            game === 'tictactoe' ? 'Tic-Tac-Toe' :
                game === 'connect4' ? 'Connect 4' : 'Pendu';

        output += `**${gameName}**\n`;
        output += `🏆 Victoires : **${gameStats.wins}**\n`;
        output += `💀 Défaites : **${gameStats.losses}**\n`;
        if (gameStats.draws > 0) {
            output += `🤝 Égalités : **${gameStats.draws}**\n`;
        }
        if (gameStats.currentStreak > 0) {
            output += `🔥 Série actuelle : **${gameStats.currentStreak}**\n`;
        }
        if (gameStats.highestStreak > 0) {
            output += `⭐ Meilleure série : **${gameStats.highestStreak}**\n`;
        }
    } else {
        // Afficher les stats globales
        output += `**Global (tous les jeux)**\n`;
        output += `🏆 Victoires : **${stats.global.wins}**\n`;
        output += `💀 Défaites : **${stats.global.losses}**\n`;
        if (stats.global.draws > 0) {
            output += `🤝 Égalités : **${stats.global.draws}**\n`;
        }
        if (stats.global.currentStreak > 0) {
            output += `🔥 Série actuelle : **${stats.global.currentStreak}**\n`;
        }
        if (stats.global.highestStreak > 0) {
            output += `⭐ Meilleure série : **${stats.global.highestStreak}**\n`;
        }
    }

    return output;
}

/**
 * Récupère le leaderboard global des jeux
 * @param limit Nombre maximum de joueurs à retourner
 * @returns Liste triée des joueurs avec leurs stats
 */
export function getGlobalLeaderboard(limit: number = 10): Array<{
    userId: string;
    username: string;
    wins: number;
    losses: number;
    draws: number;
    currentStreak: number;
    highestStreak: number;
}> {
    const stats = loadStats();

    // Récupérer les noms d'utilisateurs depuis userStatsService si disponible
    let usernames: { [userId: string]: string } = {};
    try {
        const userStatsPath = path.join(DATA_DIR, "user_stats.json");
        if (fs.existsSync(userStatsPath)) {
            const userStatsData = JSON.parse(fs.readFileSync(userStatsPath, "utf-8"));
            Object.entries(userStatsData).forEach(([userId, data]: [string, any]) => {
                usernames[userId] = data.username || userId;
            });
        }
    } catch (error) {
        console.error("[GameStats] Error loading usernames:", error);
    }

    const leaderboard = Object.entries(stats)
        .map(([userId, playerStats]) => {
            const totalGames = playerStats.global.wins + playerStats.global.losses + playerStats.global.draws;
            return {
                userId,
                username: userId === NETRICSA_GAME_ID ? NETRICSA_GAME_NAME : (usernames[userId] || userId),
                wins: playerStats.global.wins,
                losses: playerStats.global.losses,
                draws: playerStats.global.draws,
                currentStreak: playerStats.global.currentStreak,
                highestStreak: playerStats.global.highestStreak,
                totalGames,
                winRate: totalGames > 0 ? playerStats.global.wins / totalGames : 0
            };
        })
        .filter(p => p.totalGames > 0) // Uniquement les joueurs avec au moins 1 partie
        .sort((a, b) => {
            // Trier par taux de victoire, puis par nombre de parties
            if (b.winRate !== a.winRate) {
                return b.winRate - a.winRate;
            }
            return b.totalGames - a.totalGames;
        })
        .slice(0, limit)
        .map(({userId, username, wins, losses, draws, currentStreak, highestStreak}) => ({
            userId,
            username,
            wins,
            losses,
            draws,
            currentStreak,
            highestStreak
        }));

    return leaderboard;
}

