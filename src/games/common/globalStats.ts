import fs from "fs";
import path from "path";

const STATS_FILE = path.join(__dirname, "../../data/game_stats.json");

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
            hangman: initGameStats()
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
 */
export function recordWin(userId: string, game: 'rockpaperscissors' | 'tictactoe' | 'hangman'): void {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats()
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
}

/**
 * Met à jour les stats après une défaite
 */
export function recordLoss(userId: string, game: 'rockpaperscissors' | 'tictactoe' | 'hangman'): void {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats()
        };
    }

    // Mettre à jour les stats du jeu spécifique
    allStats[userId][game].losses++;
    allStats[userId][game].currentStreak = 0;

    // Mettre à jour les stats globales
    allStats[userId].global.losses++;
    allStats[userId].global.currentStreak = 0;

    saveStats(allStats);
}

/**
 * Met à jour les stats après une égalité
 */
export function recordDraw(userId: string, game: 'rockpaperscissors' | 'tictactoe' | 'hangman'): void {
    const allStats = loadStats();

    if (!allStats[userId]) {
        allStats[userId] = {
            global: initGameStats(),
            rockpaperscissors: initGameStats(),
            tictactoe: initGameStats(),
            hangman: initGameStats()
        };
    }

    // Mettre à jour les stats du jeu spécifique
    allStats[userId][game].draws++;
    allStats[userId][game].currentStreak = 0;

    // Mettre à jour les stats globales
    allStats[userId].global.draws++;
    allStats[userId].global.currentStreak = 0;

    saveStats(allStats);
}

/**
 * Génère l'affichage des stats d'un joueur
 */
export function formatPlayerStats(userId: string, game?: 'rockpaperscissors' | 'tictactoe' | 'hangman'): string {
    const stats = getPlayerStats(userId);

    let output = `📊 **Statistiques de <@${userId}>**\n\n`;

    if (game) {
        // Afficher les stats d'un jeu spécifique
        const gameStats = stats[game];
        const gameName = game === 'rockpaperscissors' ? 'Roche-Papier-Ciseaux' :
            game === 'tictactoe' ? 'Tic-Tac-Toe' : 'Pendu';

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
