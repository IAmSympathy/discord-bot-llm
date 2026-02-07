import * as fs from "fs";
import * as path from "path";
import {DATA_DIR} from "../utils/constants";
import {createLogger} from "../utils/logger";

const logger = createLogger("GameTracker");
const TRACKING_FILE = path.join(DATA_DIR, "game_tracking.json");

/**
 * Données de tracking pour les achievements spéciaux
 */
interface GameTracking {
    [userId: string]: {
        // RPS - Choix uniques
        rpsOnlyRockWins: number; // Victoires en ne jouant que Roche
        rpsOnlyPaperWins: number; // Victoires en ne jouant que Papier
        rpsOnlyScissorsWins: number; // Victoires en ne jouant que Ciseaux
        rpsLastChoice: 'rock' | 'paper' | 'scissors' | null; // Dernier choix
        rpsRockUsed: boolean; // A utilisé Roche
        rpsPaperUsed: boolean; // A utilisé Papier
        rpsScissorsUsed: boolean; // A utilisé Ciseaux

        // PvP vs PvE
        rpsWinsPvP: number; // Victoires RPS vs joueurs
        rpsWinsPvE: number; // Victoires RPS vs Netricsa
        tttWinsPvP: number; // Victoires TTT vs joueurs
        tttWinsPvE: number; // Victoires TTT vs Netricsa
        c4WinsPvP: number; // Victoires C4 vs joueurs
        c4WinsPvE: number; // Victoires C4 vs Netricsa

        // Streaks négatifs
        currentLossStreak: number; // Série de défaites actuelle
        longestLossStreak: number; // Plus longue série de défaites

        // Victoires vs Netricsa (tous jeux)
        totalWinsVsNetricsa: number;
        consecutiveWinsVsNetricsa: number; // Série de victoires vs Netricsa sans défaite

        // Pendu - Perfections
        hangmanPerfectWins: number; // Victoires sans erreur

        // Session tracking
        gamesPlayedInSession: number;
        sessionStartTime: number;

        // Daily tracking
        lastPlayDate: string; // Format: YYYY-MM-DD
        gamesPlayedToday: string[]; // ["rockpaperscissors", "tictactoe", etc.]

        // Premiers jeux (pour "L'Apprentissage")
        firstGamesResults: ('win' | 'loss' | 'draw')[]; // Résultats des 10 premières parties
    };
}

/**
 * Charge les données de tracking
 */
function loadTracking(): GameTracking {
    try {
        if (fs.existsSync(TRACKING_FILE)) {
            const data = fs.readFileSync(TRACKING_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading game tracking:", error);
    }
    return {};
}

/**
 * Sauvegarde les données de tracking
 */
function saveTracking(data: GameTracking): void {
    try {
        fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving game tracking:", error);
    }
}

/**
 * Initialise le tracking pour un nouvel utilisateur
 */
function initUserTracking(userId: string): GameTracking[string] {
    return {
        rpsOnlyRockWins: 0,
        rpsOnlyPaperWins: 0,
        rpsOnlyScissorsWins: 0,
        rpsLastChoice: null,
        rpsRockUsed: false,
        rpsPaperUsed: false,
        rpsScissorsUsed: false,
        rpsWinsPvP: 0,
        rpsWinsPvE: 0,
        tttWinsPvP: 0,
        tttWinsPvE: 0,
        c4WinsPvP: 0,
        c4WinsPvE: 0,
        currentLossStreak: 0,
        longestLossStreak: 0,
        totalWinsVsNetricsa: 0,
        consecutiveWinsVsNetricsa: 0,
        hangmanPerfectWins: 0,
        gamesPlayedInSession: 0,
        sessionStartTime: Date.now(),
        lastPlayDate: new Date().toISOString().split('T')[0],
        gamesPlayedToday: [],
        firstGamesResults: []
    };
}

/**
 * Enregistre un choix RPS et vérifie les achievements "Only Rock/Paper/Scissors"
 */
export function trackRPSChoice(
    userId: string,
    choice: 'rock' | 'paper' | 'scissors',
    won: boolean
): void {
    const tracking = loadTracking();
    if (!tracking[userId]) {
        tracking[userId] = initUserTracking(userId);
    }

    const user = tracking[userId];

    // Marquer les choix utilisés pour "Triple Menace"
    if (choice === 'rock') user.rpsRockUsed = true;
    if (choice === 'paper') user.rpsPaperUsed = true;
    if (choice === 'scissors') user.rpsScissorsUsed = true;

    // Si victoire et même choix que la dernière fois, incrémenter le compteur
    if (won) {
        if (user.rpsLastChoice === choice || user.rpsLastChoice === null) {
            if (choice === 'rock') user.rpsOnlyRockWins++;
            if (choice === 'paper') user.rpsOnlyPaperWins++;
            if (choice === 'scissors') user.rpsOnlyScissorsWins++;
        } else {
            // Changement de choix, réinitialiser
            user.rpsOnlyRockWins = choice === 'rock' ? 1 : 0;
            user.rpsOnlyPaperWins = choice === 'paper' ? 1 : 0;
            user.rpsOnlyScissorsWins = choice === 'scissors' ? 1 : 0;
        }
        user.rpsLastChoice = choice;
    } else {
        // Défaite, réinitialiser
        user.rpsOnlyRockWins = 0;
        user.rpsOnlyPaperWins = 0;
        user.rpsOnlyScissorsWins = 0;
        user.rpsLastChoice = null;
    }

    saveTracking(tracking);
}

/**
 * Enregistre une victoire PvP ou PvE
 */
export function trackWin(
    userId: string,
    game: 'rockpaperscissors' | 'tictactoe' | 'connect4' | 'hangman',
    isVsAI: boolean
): void {
    const tracking = loadTracking();
    if (!tracking[userId]) {
        tracking[userId] = initUserTracking(userId);
    }

    const user = tracking[userId];

    // PvP vs PvE
    if (isVsAI) {
        if (game === 'rockpaperscissors') user.rpsWinsPvE++;
        if (game === 'tictactoe') user.tttWinsPvE++;
        if (game === 'connect4') user.c4WinsPvE++;

        user.totalWinsVsNetricsa++;
        user.consecutiveWinsVsNetricsa++;
    } else {
        if (game === 'rockpaperscissors') user.rpsWinsPvP++;
        if (game === 'tictactoe') user.tttWinsPvP++;
        if (game === 'connect4') user.c4WinsPvP++;
    }

    // Reset loss streak
    user.currentLossStreak = 0;

    // Enregistrer résultat pour premiers jeux
    if (user.firstGamesResults.length < 10) {
        user.firstGamesResults.push('win');
    }

    saveTracking(tracking);
}

/**
 * Enregistre une défaite
 */
export function trackLoss(userId: string, isVsAI: boolean): void {
    const tracking = loadTracking();
    if (!tracking[userId]) {
        tracking[userId] = initUserTracking(userId);
    }

    const user = tracking[userId];

    // Incrémenter loss streak
    user.currentLossStreak++;
    if (user.currentLossStreak > user.longestLossStreak) {
        user.longestLossStreak = user.currentLossStreak;
    }

    // Reset consecutive wins vs Netricsa
    if (isVsAI) {
        user.consecutiveWinsVsNetricsa = 0;
    }

    // Enregistrer résultat pour premiers jeux
    if (user.firstGamesResults.length < 10) {
        user.firstGamesResults.push('loss');
    }

    saveTracking(tracking);
}

/**
 * Enregistre une égalité
 */
export function trackDraw(userId: string): void {
    const tracking = loadTracking();
    if (!tracking[userId]) {
        tracking[userId] = initUserTracking(userId);
    }

    const user = tracking[userId];

    // Reset loss streak
    user.currentLossStreak = 0;

    // Enregistrer résultat pour premiers jeux
    if (user.firstGamesResults.length < 10) {
        user.firstGamesResults.push('draw');
    }

    saveTracking(tracking);
}

/**
 * Enregistre une victoire parfaite au Pendu
 */
export function trackHangmanPerfect(userId: string): void {
    const tracking = loadTracking();
    if (!tracking[userId]) {
        tracking[userId] = initUserTracking(userId);
    }

    tracking[userId].hangmanPerfectWins++;
    saveTracking(tracking);
}

/**
 * Enregistre qu'un jeu a été joué (pour tracking session et daily)
 */
export function trackGamePlayed(
    userId: string,
    game: 'rockpaperscissors' | 'tictactoe' | 'connect4' | 'hangman'
): void {
    const tracking = loadTracking();
    if (!tracking[userId]) {
        tracking[userId] = initUserTracking(userId);
    }

    const user = tracking[userId];
    const today = new Date().toISOString().split('T')[0];

    // Reset session si plus de 30 minutes d'inactivité
    if (Date.now() - user.sessionStartTime > 30 * 60 * 1000) {
        user.gamesPlayedInSession = 0;
        user.sessionStartTime = Date.now();
    }

    user.gamesPlayedInSession++;

    // Reset daily si nouveau jour
    if (user.lastPlayDate !== today) {
        user.lastPlayDate = today;
        user.gamesPlayedToday = [];
    }

    // Ajouter le jeu à la liste du jour s'il n'y est pas déjà
    if (!user.gamesPlayedToday.includes(game)) {
        user.gamesPlayedToday.push(game);
    }

    saveTracking(tracking);
}

/**
 * Récupère les données de tracking d'un utilisateur
 */
export function getUserTracking(userId: string): GameTracking[string] | null {
    const tracking = loadTracking();
    return tracking[userId] || null;
}
