/**
 * Formate un temps en secondes en format "Xm Ys" ou "Xs"
 * @param seconds Temps en secondes
 * @returns String formaté (ex: "1m 23s" ou "45s")
 */
export function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
}

/**
 * Formate un temps en millisecondes en format "Xm Ys" ou "Xs"
 * @param milliseconds Temps en millisecondes
 * @returns String formaté (ex: "1m 23s" ou "45s")
 */
export function formatTimeFromMs(milliseconds: number): string {
    return formatTime(milliseconds / 1000);
}
