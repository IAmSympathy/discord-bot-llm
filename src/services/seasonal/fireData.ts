/**
 * Interface pour une bûche individuelle
 */
export interface Log {
    addedAt: number; // Timestamp d'ajout
    userId: string;
    username: string;
    initialContribution: number; // Contribution initiale en % (normalement 8%)
}

/**
 * Interface pour les données du Feu de Foyer
 */
export interface FireData {
    intensity: number; // 0-100
    lastUpdate: number; // Timestamp de la dernière mise à jour
    messageId: string | null; // ID du message embed permanent
    channelId: string | null; // ID du salon textuel
    voiceChannelId: string | null; // ID du salon vocal
    logs: Log[]; // Bûches actives dans le feu (max 5)
    weatherProtection: {
        active: boolean;
        endsAt: number | null; // Timestamp de fin de protection
        activatedBy: {
            userId: string;
            username: string;
        } | null;
    };
    stats: {
        logsToday: number; // Nombre de bûches ajoutées aujourd'hui
        lastLog: {
            userId: string;
            username: string;
            timestamp: number;
        } | null;
        totalLogs: number; // Total depuis le début de la saison
    };
}

/**
 * Interface pour les cooldowns des utilisateurs
 */
export interface FireCooldowns {
    [userId: string]: number; // Timestamp du dernier ajout de bûche
}

/**
 * Configuration du système de feu
 */
export const FIRE_CONFIG = {
    // Décroissance
    DECAY_RATE: 1.5, // -1% toutes les 30 minutes
    DECAY_INTERVAL: 30 * 60 * 1000, // 30 minutes

    // Bûches
    LOG_BONUS: 8, // +10% par bûche
    LOG_BURN_TIME: 3 * 60 * 60 * 1000, // Durée de vie d'une bûche : 3 heures
    MAX_LOGS: 5, // Maximum de bûches dans le feu
    USER_COOLDOWN: 6 * 60 * 60 * 1000, // 4 heures

    // Limites
    MIN_INTENSITY: 0,
    MAX_INTENSITY: 100,

    // Mise à jour de l'interface
    UPDATE_INTERVAL: 5 * 60 * 1000, // 5 minutes

    // Multiplicateurs XP
    MULTIPLIERS: {
        EXTINGUISHED: 0.5,  // 0-5% - Vraiment éteint
        LOW: 0.75,          // 6-30% - Faible
        MEDIUM: 1.0,        // 31-60% - Moyen (neutre)
        HIGH: 1.25,         // 61-85% - Fort
        INTENSE: 1.5        // 86-100% - Intense
    },

    // Seuils pour les notifications
    ALERT_THRESHOLDS: {
        LOW: 30,      // Alerte à 30%
        CRITICAL: 10  // Alerte critique à 10%
    }
};

/**
 * États du feu
 */
export enum FireState {
    EXTINGUISHED = "EXTINGUISHED", // 0-5% - Presque éteint
    LOW = "LOW",                   // 6-30% - Faible
    MEDIUM = "MEDIUM",             // 31-60% - Moyen
    HIGH = "HIGH",                 // 61-85% - Fort
    INTENSE = "INTENSE"            // 86-100% - Intense
}

/**
 * Emojis selon l'état du feu
 */
export const FIRE_EMOJIS = {
    [FireState.EXTINGUISHED]: "💀",  // Mort/éteint
    [FireState.LOW]: "💨",            // Faible fumée
    [FireState.MEDIUM]: "🔥",         // Feu normal
    [FireState.HIGH]: "♨️",           // Chaud/vapeur
    [FireState.INTENSE]: "🌋"         // Très intense
};

/**
 * Noms selon l'état du feu
 */
export const FIRE_NAMES = {
    [FireState.EXTINGUISHED]: "Éteint",
    [FireState.LOW]: "Braises",
    [FireState.MEDIUM]: "Stable",
    [FireState.HIGH]: "Vigoureux",
    [FireState.INTENSE]: "Ardent"
};

/**
 * Couleurs selon l'état du feu
 */
export const FIRE_COLORS = {
    [FireState.EXTINGUISHED]: 0x95A5A6, // Gris
    [FireState.LOW]: 0xE67E22,          // Orange foncé
    [FireState.MEDIUM]: 0xF39C12,       // Orange
    [FireState.HIGH]: 0xE74C3C,         // Rouge
    [FireState.INTENSE]: 0xFF4500       // Rouge vif
};

/**
 * Détermine l'état du feu selon l'intensité
 */
export function getFireState(intensity: number): FireState {
    if (intensity <= 5) return FireState.EXTINGUISHED;   // 0-5%: Vraiment éteint
    if (intensity <= 30) return FireState.LOW;            // 6-30%: Braises
    if (intensity <= 60) return FireState.MEDIUM;         // 31-60%: Stable
    if (intensity <= 85) return FireState.HIGH;           // 61-85%: Vigoureux
    return FireState.INTENSE;                             // 86-100%: Ardent
}

/**
 * Calcule le multiplicateur XP selon l'intensité
 */
export function getFireMultiplier(intensity: number): number {
    const state = getFireState(intensity);
    switch (state) {
        case FireState.EXTINGUISHED:
            return FIRE_CONFIG.MULTIPLIERS.EXTINGUISHED;
        case FireState.LOW:
            return FIRE_CONFIG.MULTIPLIERS.LOW;
        case FireState.MEDIUM:
            return FIRE_CONFIG.MULTIPLIERS.MEDIUM;
        case FireState.HIGH:
            return FIRE_CONFIG.MULTIPLIERS.HIGH;
        case FireState.INTENSE:
            return FIRE_CONFIG.MULTIPLIERS.INTENSE;
    }
}

