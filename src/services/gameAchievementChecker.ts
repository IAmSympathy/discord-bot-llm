import {createLogger} from "../utils/logger";
import {unlockAchievement} from "./achievementService";
import {getPlayerStats} from "../games/common/globalStats";
import {getUserTracking} from "./gameTracker";

const logger = createLogger("GameAchievementChecker");

/**
 * Vérifie et débloque les achievements de jeux pour un utilisateur
 */
export async function checkGameAchievements(
    userId: string,
    username: string,
    client: any,
    channelId: string
): Promise<void> {
    try {
        const stats = getPlayerStats(userId);
        if (!stats) return;

        const tracking = getUserTracking(userId);

        // Calcul des stats globales
        const totalGames = stats.global.wins + stats.global.losses + stats.global.draws;
        const totalWins = stats.global.wins;
        const totalLosses = stats.global.losses;
        const currentStreak = stats.global.currentStreak;
        const highestStreak = stats.global.highestStreak;

        // === ACHIEVEMENTS GÉNÉRAUX ===

        // Première partie
        if (totalGames >= 1) {
            await unlockAchievement(userId, username, "game_first", client, channelId);
        }

        // Parties jouées
        if (totalGames >= 50) {
            await unlockAchievement(userId, username, "game_played_50", client, channelId);
        }
        if (totalGames >= 200) {
            await unlockAchievement(userId, username, "game_played_200", client, channelId);
        }

        // Polyvalent (joué à tous les jeux)
        if (stats.rockpaperscissors && stats.tictactoe && stats.connect4 && stats.hangman) {
            if ((stats.rockpaperscissors.wins + stats.rockpaperscissors.losses + stats.rockpaperscissors.draws) >= 1 &&
                (stats.tictactoe.wins + stats.tictactoe.losses + stats.tictactoe.draws) >= 1 &&
                (stats.connect4.wins + stats.connect4.losses + stats.connect4.draws) >= 1 &&
                (stats.hangman.wins + stats.hangman.losses) >= 1) {
                await unlockAchievement(userId, username, "game_polyvalent", client, channelId);
            }
        }

        // Victoires
        if (totalWins >= 1) {
            await unlockAchievement(userId, username, "game_first_win", client, channelId);
        }
        if (totalWins >= 25) {
            await unlockAchievement(userId, username, "game_win_25", client, channelId);
        }
        if (totalWins >= 100) {
            await unlockAchievement(userId, username, "game_win_100", client, channelId);
        }
        if (totalWins >= 500) {
            await unlockAchievement(userId, username, "game_win_500", client, channelId);
        }

        // Séries de victoires
        if (highestStreak >= 3) {
            await unlockAchievement(userId, username, "game_streak_3", client, channelId);
        }
        if (highestStreak >= 5) {
            await unlockAchievement(userId, username, "game_streak_5", client, channelId);
        }
        if (highestStreak >= 10) {
            await unlockAchievement(userId, username, "game_streak_10", client, channelId);
        }
        if (highestStreak >= 20) {
            await unlockAchievement(userId, username, "game_streak_20", client, channelId);
        }

        // Défaites (persévérance)
        if (totalLosses >= 10) {
            await unlockAchievement(userId, username, "game_loss_10", client, channelId);
        }
        if (totalLosses >= 50) {
            await unlockAchievement(userId, username, "game_loss_50", client, channelId);
        }
        if (totalLosses >= 100) {
            await unlockAchievement(userId, username, "game_loss_100", client, channelId);
        }

        // === ROCHE-PAPIER-CISEAUX ===
        if (stats.rockpaperscissors) {
            const rpsWins = stats.rockpaperscissors.wins;

            if (rpsWins >= 10) {
                await unlockAchievement(userId, username, "rps_win_10", client, channelId);
            }
            if (rpsWins >= 50) {
                await unlockAchievement(userId, username, "rps_win_50", client, channelId);
            }
            if (rpsWins >= 200) {
                await unlockAchievement(userId, username, "rps_win_200", client, channelId);
            }

            // Streak RPS
            if (stats.rockpaperscissors.highestStreak >= 5) {
                await unlockAchievement(userId, username, "rps_streak_5", client, channelId);
            }
        }

        // === TIC-TAC-TOE ===
        if (stats.tictactoe) {
            const tttWins = stats.tictactoe.wins;
            const tttDraws = stats.tictactoe.draws;

            if (tttWins >= 10) {
                await unlockAchievement(userId, username, "ttt_win_10", client, channelId);
            }
            if (tttWins >= 50) {
                await unlockAchievement(userId, username, "ttt_win_50", client, channelId);
            }
            if (tttWins >= 200) {
                await unlockAchievement(userId, username, "ttt_win_200", client, channelId);
            }

            // Le Mur (égalités)
            if (tttDraws >= 20) {
                await unlockAchievement(userId, username, "ttt_draw_20", client, channelId);
            }
        }

        // === CONNECT 4 ===
        if (stats.connect4) {
            const c4Wins = stats.connect4.wins;

            if (c4Wins >= 10) {
                await unlockAchievement(userId, username, "c4_win_10", client, channelId);
            }
            if (c4Wins >= 50) {
                await unlockAchievement(userId, username, "c4_win_50", client, channelId);
            }
            if (c4Wins >= 200) {
                await unlockAchievement(userId, username, "c4_win_200", client, channelId);
            }
        }

        // === PENDU ===
        if (stats.hangman) {
            const hangmanWins = stats.hangman.wins;

            if (hangmanWins >= 10) {
                await unlockAchievement(userId, username, "hangman_win_10", client, channelId);
            }
            if (hangmanWins >= 50) {
                await unlockAchievement(userId, username, "hangman_win_50", client, channelId);
            }
            if (hangmanWins >= 200) {
                await unlockAchievement(userId, username, "hangman_win_200", client, channelId);
            }

            // Streak Pendu
            if (stats.hangman.highestStreak >= 5) {
                await unlockAchievement(userId, username, "hangman_streak_5", client, channelId);
            }
        }

        // === ACHIEVEMENTS BASÉS SUR LE TRACKING ===
        if (tracking) {
            // RPS - Choix uniques
            if (tracking.rpsOnlyRockWins >= 10) {
                await unlockAchievement(userId, username, "rps_only_rock", client, channelId);
            }
            if (tracking.rpsOnlyPaperWins >= 10) {
                await unlockAchievement(userId, username, "rps_only_paper", client, channelId);
            }
            if (tracking.rpsOnlyScissorsWins >= 10) {
                await unlockAchievement(userId, username, "rps_only_scissors", client, channelId);
            }

            // Triple Menace (gagné avec chaque choix)
            if (tracking.rpsRockUsed && tracking.rpsPaperUsed && tracking.rpsScissorsUsed) {
                await unlockAchievement(userId, username, "rps_triple", client, channelId);
            }

            // PvP spécifiques
            if (tracking.rpsWinsPvP >= 25) {
                await unlockAchievement(userId, username, "rps_pvp_25", client, channelId);
            }
            if (tracking.rpsWinsPvP >= 100) {
                await unlockAchievement(userId, username, "rps_pvp_100", client, channelId);
            }
            if (tracking.tttWinsPvP >= 25) {
                await unlockAchievement(userId, username, "ttt_pvp_25", client, channelId);
            }
            if (tracking.tttWinsPvP >= 100) {
                await unlockAchievement(userId, username, "ttt_pvp_100", client, channelId);
            }
            if (tracking.c4WinsPvP >= 25) {
                await unlockAchievement(userId, username, "c4_pvp_25", client, channelId);
            }
            if (tracking.c4WinsPvP >= 100) {
                await unlockAchievement(userId, username, "c4_pvp_100", client, channelId);
            }

            // PvE spécifiques
            if (tracking.rpsWinsPvE >= 50) {
                await unlockAchievement(userId, username, "rps_pve_50", client, channelId);
            }
            if (tracking.rpsWinsPvE >= 200) {
                await unlockAchievement(userId, username, "rps_pve_200", client, channelId);
            }
            if (tracking.tttWinsPvE >= 50) {
                await unlockAchievement(userId, username, "ttt_pve_50", client, channelId);
            }
            if (tracking.tttWinsPvE >= 200) {
                await unlockAchievement(userId, username, "ttt_pve_200", client, channelId);
            }
            if (tracking.c4WinsPvE >= 50) {
                await unlockAchievement(userId, username, "c4_pve_50", client, channelId);
            }
            if (tracking.c4WinsPvE >= 200) {
                await unlockAchievement(userId, username, "c4_pve_200", client, channelId);
            }

            // Victoires vs Netricsa
            if (tracking.consecutiveWinsVsNetricsa >= 10) {
                await unlockAchievement(userId, username, "game_easy", client, channelId);
            }
            if (tracking.totalWinsVsNetricsa >= 100) {
                await unlockAchievement(userId, username, "game_beat_netricsa_100", client, channelId);
            }

            // Séries de défaites (achievements secrets fun)
            if (tracking.currentLossStreak >= 10) {
                await unlockAchievement(userId, username, "game_bad_day", client, channelId);
            }

            // Premiers jeux perdus
            if (tracking.firstGamesResults.length >= 10) {
                const allLosses = tracking.firstGamesResults.slice(0, 10).every(r => r === 'loss');
                if (allLosses) {
                    await unlockAchievement(userId, username, "game_first_10_loss", client, channelId);
                }
            }

            // Pendu perfect
            if (tracking.hangmanPerfectWins >= 10) {
                await unlockAchievement(userId, username, "hangman_perfect_10", client, channelId);
            }
        }

        // === ACHIEVEMENTS SECRETS & FUN ===

        // Touche-à-tout (vérifié lors de la partie jouée - voir checkGameAchievementsDaily)
        // Insomniac Gamer (vérifié lors de la partie jouée - voir checkGameAchievementsTime)
        // Marathon (vérifié dans le système de session)
        // Bad day (vérifié avec le streak négatif)

    } catch (error) {
        logger.error(`Error checking game achievements for user ${userId}:`, error);
    }
}

/**
 * Vérifie les achievements basés sur la session de jeu
 */
export async function checkGameSessionAchievements(
    userId: string,
    username: string,
    client: any,
    channelId: string
): Promise<void> {
    try {
        const tracking = getUserTracking(userId);
        if (!tracking) return;

        // Marathonien (20 parties en une session)
        if (tracking.gamesPlayedInSession >= 20) {
            await unlockAchievement(userId, username, "game_marathon", client, channelId);
        }
    } catch (error) {
        logger.error(`Error checking game session achievements:`, error);
    }
}

/**
 * Vérifie les achievements basés sur l'heure
 */
export async function checkGameTimeAchievements(
    userId: string,
    username: string,
    client: any,
    channelId: string
): Promise<void> {
    try {
        const hour = new Date().getHours();

        // Insomniac Gamer (jouer entre 2h et 5h du matin)
        if (hour >= 2 && hour < 5) {
            await unlockAchievement(userId, username, "game_night_owl", client, channelId);
        }
    } catch (error) {
        logger.error(`Error checking game time achievements:`, error);
    }
}

/**
 * Vérifie les achievements basés sur les jeux joués aujourd'hui
 */
export async function checkGameDailyAchievements(
    userId: string,
    username: string,
    client: any,
    channelId: string
): Promise<void> {
    try {
        const tracking = getUserTracking(userId);
        if (!tracking) return;

        const gamesPlayedToday = tracking.gamesPlayedToday;

        // Touche-à-tout (jouer à tous les jeux dans la même journée)
        if (gamesPlayedToday.includes('rockpaperscissors') &&
            gamesPlayedToday.includes('tictactoe') &&
            gamesPlayedToday.includes('connect4') &&
            gamesPlayedToday.includes('hangman')) {
            await unlockAchievement(userId, username, "game_all_today", client, channelId);
        }
    } catch (error) {
        logger.error(`Error checking game daily achievements:`, error);
    }
}

/**
 * Vérifie les achievements de Pendu spéciaux (sans faute)
 */
export async function checkHangmanPerfectAchievement(
    userId: string,
    username: string,
    wrongGuesses: number,
    client: any,
    channelId: string
): Promise<void> {
    try {
        // Sans Faute (gagner sans erreur)
        if (wrongGuesses === 0) {
            await unlockAchievement(userId, username, "hangman_perfect", client, channelId);

            // Tracking pour "Perfection Absolue" (10 parties sans faute)
            const {trackHangmanPerfect} = require("./gameTracker");
            trackHangmanPerfect(userId);
        }
    } catch (error) {
        logger.error(`Error checking hangman perfect achievement:`, error);
    }
}
