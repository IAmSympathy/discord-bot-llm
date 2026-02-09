/**
 * Interface commune pour l'état des stats d'un jeu
 */
export interface GameStats {
    player1Wins: number;
    player2Wins: number;
    draws: number;
    player1Winstreak: number;
    player2Winstreak: number;
    player1HighestWinstreak: number;
    player2HighestWinstreak: number;
}

/**
 * Interface de base pour l'état d'un jeu
 */
export interface BaseGameState {
    player1: string;
    player2: string | null;
    isAI: boolean;
    stats: GameStats;
}

/**
 * Initialise les stats d'un jeu
 */
export function initializeStats(): GameStats {
    return {
        player1Wins: 0,
        player2Wins: 0,
        draws: 0,
        player1Winstreak: 0,
        player2Winstreak: 0,
        player1HighestWinstreak: 0,
        player2HighestWinstreak: 0
    };
}

/**
 * Met à jour les stats après une victoire
 */
export function updateStatsOnWin(stats: GameStats, winner: 'player1' | 'player2'): void {
    if (winner === 'player1') {
        stats.player1Wins++;
        stats.player1Winstreak++;
        stats.player2Winstreak = 0;

        if (stats.player1Winstreak > stats.player1HighestWinstreak) {
            stats.player1HighestWinstreak = stats.player1Winstreak;
        }
    } else {
        stats.player2Wins++;
        stats.player2Winstreak++;
        stats.player1Winstreak = 0;

        if (stats.player2Winstreak > stats.player2HighestWinstreak) {
            stats.player2HighestWinstreak = stats.player2Winstreak;
        }
    }
}

/**
 * Met à jour les stats après une égalité
 */
export function updateStatsOnDraw(stats: GameStats): void {
    stats.draws++;
    stats.player1Winstreak = 0;
    stats.player2Winstreak = 0;
}

/**
 * Génère le texte du footer avec les stats
 */
export function getStatsFooter(stats: GameStats): string {
    const totalGames = stats.player1Wins + stats.player2Wins + stats.draws;
    if (totalGames === 0) return "";

    return `Score : ${stats.player1Wins} - ${stats.player2Wins} (${stats.draws} égalités)`;
}

/**
 * Génère la description des stats pour les messages de fin
 */
export function getStatsDescription(stats: GameStats, player1Id: string, player2Id: string | null, isAI: boolean): string {
    const totalGames = stats.player1Wins + stats.player2Wins + stats.draws;
    if (totalGames === 0) return "";

    if (stats.player1HighestWinstreak === 0 && stats.player2HighestWinstreak === 0 && stats.draws === 0) {
        return ``;
    }
    let description = `\n\n**Statistiques:**\n`;

    if (stats.player1HighestWinstreak > 1 || stats.player2HighestWinstreak > 1) {
        description += `🔥 Meilleures séries : `;
        if (stats.player1HighestWinstreak > 1) {
            description += `<@${player1Id}>: **${stats.player1HighestWinstreak}**`;
        }
        if (stats.player2HighestWinstreak > 1) {
            if (stats.player1HighestWinstreak > 1) description += " | ";
            description += `${isAI ? "<@1462959115528835092>" : `<@${player2Id}>`}: **${stats.player2HighestWinstreak}**`;
        }
        description += "\n";
    }

    if (stats.draws > 0) {
        description += `🤝 Égalités : **${stats.draws}**`;
    }

    return description;
}

/**
 * Génère l'affichage des winstreaks actuelles
 */
export function getWinstreakDisplay(stats: GameStats, player1Id: string, player2Id: string | null, isAI: boolean): string {
    let display = "\n\n";

    if (stats.player1Winstreak > 1) {
        display += `<@${player1Id}> 🔥 **${stats.player1Winstreak}**\n`;
    }
    if (stats.player2Winstreak > 1) {
        display += `${isAI ? "<@1462959115528835092>" : `<@${player2Id}>`} 🔥 **${stats.player2Winstreak}**\n`;
    }

    return display !== "\n\n" ? display : "";
}
