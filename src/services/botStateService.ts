/**
 * Service pour gérer le mode Low Power du bot
 * En mode Low Power, Netricsa ne fait pas d'appels LLM coûteux
 */

let lowPowerMode = false;

export function isLowPowerMode(): boolean {
    return lowPowerMode;
}

export function toggleLowPowerMode(): boolean {
    lowPowerMode = !lowPowerMode;
    console.log(`[BotState] ${lowPowerMode ? '🔋' : '⚡'} Low Power Mode ${lowPowerMode ? 'ENABLED' : 'DISABLED'}`);
    return lowPowerMode;
}

export function enableLowPowerMode(): void {
    lowPowerMode = true;
    console.log(`[BotState] 🔋 Low Power Mode ENABLED`);
}

export function disableLowPowerMode(): void {
    lowPowerMode = false;
    console.log(`[BotState] ⚡ Low Power Mode DISABLED`);
}
