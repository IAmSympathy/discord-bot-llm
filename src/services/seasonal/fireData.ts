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
        EXTINGUISHED: 0.33, // 0-20%
        LOW: 0.66,          // 21-40%
        MEDIUM: 1.0,        // 41-60%
        HIGH: 1.15,         // 61-80%
        INTENSE: 1.33       // 81-100%
    },

    // Seuils pour les notifications
    ALERT_THRESHOLDS: {
        LOW: 30,      // Alerte à 30%
        CRITICAL: 15  // Alerte critique à 15%
    }
};

/**
 * États du feu
 */
export enum FireState {
    EXTINGUISHED = "EXTINGUISHED", // 0-20%
    LOW = "LOW",                   // 21-40%
    MEDIUM = "MEDIUM",             // 41-60%
    HIGH = "HIGH",                 // 61-80%
    INTENSE = "INTENSE"            // 81-100%
}

/**
 * Emojis selon l'état du feu
 */
export const FIRE_EMOJIS = {
    [FireState.EXTINGUISHED]: "🪵",
    [FireState.LOW]: "💨",
    [FireState.MEDIUM]: "💥",
    [FireState.HIGH]: "♨️",
    [FireState.INTENSE]: "🔥"
};

/**
 * Noms selon l'état du feu
 */
export const FIRE_NAMES = {
    [FireState.EXTINGUISHED]: "Éteint",
    [FireState.LOW]: "Faible",
    [FireState.MEDIUM]: "Moyen",
    [FireState.HIGH]: "Fort",
    [FireState.INTENSE]: "Intense"
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
    if (intensity <= 20) return FireState.EXTINGUISHED;
    if (intensity <= 40) return FireState.LOW;
    if (intensity <= 60) return FireState.MEDIUM;
    if (intensity <= 80) return FireState.HIGH;
    return FireState.INTENSE;
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

