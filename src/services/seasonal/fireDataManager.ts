import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../../utils/logger";
import {FIRE_CONFIG, FireCooldowns, FireData} from "./fireData";

const logger = createLogger("FireDataManager");

const FIRE_DATA_FILE = path.join(process.cwd(), "data", "seasonal_fire.json");
const FIRE_COOLDOWNS_FILE = path.join(process.cwd(), "data", "fire_cooldowns.json");

/**
 * Structure complète des données
 */
interface FireDataStorage {
    fire: FireData;
    cooldowns: FireCooldowns;
}

/**
 * Charge les données du feu depuis le fichier JSON
 */
export function loadFireData(): FireData {
    try {
        if (!fs.existsSync(FIRE_DATA_FILE)) {
            logger.info("Fire data file not found, creating default");
            const defaultData: FireData = {
                intensity: 60, // Commence à moyen
                lastUpdate: Date.now(),
                messageId: null,
                channelId: null,
                voiceChannelId: null,
                logs: [], // Aucune bûche au départ
                weatherProtection: {
                    active: false,
                    endsAt: null,
                    activatedBy: null
                },
                stats: {
                    logsToday: 0,
                    lastLog: null,
                    totalLogs: 0
                }
            };
            saveFireData(defaultData);
            return defaultData;
        }

        const data = JSON.parse(fs.readFileSync(FIRE_DATA_FILE, "utf-8"));

        // Migration: ajouter le champ logs s'il n'existe pas
        if (!data.logs) {
            data.logs = [];
            saveFireData(data);
        }

        // Migration: ajouter le champ weatherProtection s'il n'existe pas
        if (!data.weatherProtection) {
            data.weatherProtection = {
                active: false,
                endsAt: null,
                activatedBy: null
            };
            saveFireData(data);
        }

        // Migration: ajouter effectiveAge et lastUpdate aux bûches existantes
        if (data.logs && data.logs.length > 0) {
            let needsSave = false;
            const now = Date.now();

            for (const log of data.logs) {
                if (log.effectiveAge === undefined || log.lastUpdate === undefined) {
                    // Pour les anciennes bûches, calculer un effectiveAge basé sur leur âge réel
                    const logAge = now - log.addedAt;
                    log.effectiveAge = Math.min(logAge, FIRE_CONFIG.LOG_BURN_TIME); // Plafonner au temps max
                    log.lastUpdate = now;
                    needsSave = true;
                }
            }

            if (needsSave) {
                logger.info(`Migrated ${data.logs.length} log(s) to new effectiveAge system`);
                saveFireData(data);
            }
        }

        return data;
    } catch (error) {
        logger.error("Error loading fire data:", error);
        // Retourner des données par défaut en cas d'erreur
        return {
            intensity: 60,
            lastUpdate: Date.now(),
            messageId: null,
            channelId: null,
            voiceChannelId: null,
            logs: [],
            weatherProtection: {
                active: false,
                endsAt: null,
                activatedBy: null
            },
            stats: {
                logsToday: 0,
                lastLog: null,
                totalLogs: 0
            }
        };
    }
}

/**
 * Sauvegarde les données du feu
 */
export function saveFireData(data: FireData): void {
    try {
        const dataDir = path.dirname(FIRE_DATA_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {recursive: true});
        }
        fs.writeFileSync(FIRE_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving fire data:", error);
    }
}

/**
 * Charge les cooldowns des utilisateurs
 */
export function loadFireCooldowns(): FireCooldowns {
    try {
        if (!fs.existsSync(FIRE_COOLDOWNS_FILE)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(FIRE_COOLDOWNS_FILE, "utf-8"));
    } catch (error) {
        logger.error("Error loading fire cooldowns:", error);
        return {};
    }
}

/**
 * Sauvegarde les cooldowns des utilisateurs
 */
export function saveFireCooldowns(cooldowns: FireCooldowns): void {
    try {
        const dataDir = path.dirname(FIRE_COOLDOWNS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {recursive: true});
        }
        fs.writeFileSync(FIRE_COOLDOWNS_FILE, JSON.stringify(cooldowns, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving fire cooldowns:", error);
    }
}

/**
 * Vérifie si un utilisateur peut ajouter une bûche
 */
export function canAddLog(userId: string): { canAdd: boolean; cooldownEndTimestamp?: number } {
    const cooldowns = loadFireCooldowns();
    const lastAdd = cooldowns[userId];

    if (!lastAdd) {
        return {canAdd: true};
    }

    const timeSinceLastAdd = Date.now() - lastAdd;
    const cooldownRemaining = FIRE_CONFIG.USER_COOLDOWN - timeSinceLastAdd;

    if (cooldownRemaining <= 0) {
        return {canAdd: true};
    }

    return {
        canAdd: false,
        cooldownEndTimestamp: lastAdd + FIRE_CONFIG.USER_COOLDOWN
    };
}

/**
 * Enregistre qu'un utilisateur a ajouté une bûche
 */
export function recordLogAdd(userId: string): void {
    const cooldowns = loadFireCooldowns();
    cooldowns[userId] = Date.now();
    saveFireCooldowns(cooldowns);
}

/**
 * Réinitialise les statistiques quotidiennes (à appeler à minuit)
 */
export function resetDailyStats(): void {
    const fireData = loadFireData();
    fireData.stats.logsToday = 0;
    saveFireData(fireData);
    logger.info("Daily fire stats reset");
}

/**
 * Nettoie les cooldowns expirés (optionnel, pour optimiser)
 */
export function cleanExpiredCooldowns(): void {
    const cooldowns = loadFireCooldowns();
    const now = Date.now();
    let cleaned = 0;

    for (const userId in cooldowns) {
        if (now - cooldowns[userId] > FIRE_CONFIG.USER_COOLDOWN) {
            delete cooldowns[userId];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        saveFireCooldowns(cooldowns);
        logger.info(`Cleaned ${cleaned} expired cooldowns`);
    }
}

/**
 * Active la protection météo (ou ajoute du temps si déjà active)
 */
export function activateWeatherProtection(
    userId: string,
    username: string,
    duration: number
): void {
    const fireData = loadFireData();
    const now = Date.now();

    let newEndsAt: number;

    // Si une protection est déjà active, ajouter le temps
    if (fireData.weatherProtection.active && fireData.weatherProtection.endsAt && fireData.weatherProtection.endsAt > now) {
        // Stacker : ajouter le temps à la protection existante
        newEndsAt = fireData.weatherProtection.endsAt + duration;
        const totalMinutes = Math.ceil((newEndsAt - now) / 60000);
        logger.info(`Weather protection extended by ${username} for ${duration / 60000} minutes (total: ${totalMinutes} minutes)`);
    } else {
        // Nouvelle protection
        newEndsAt = now + duration;
        logger.info(`Weather protection activated by ${username} for ${duration / 60000} minutes`);
    }

    fireData.weatherProtection = {
        active: true,
        endsAt: newEndsAt,
        activatedBy: {
            userId,
            username
        }
    };

    saveFireData(fireData);
}

/**
 * Vérifie si la protection météo est active
 */
export function isWeatherProtectionActive(): boolean {
    const fireData = loadFireData();

    if (!fireData.weatherProtection.active) {
        return false;
    }

    const now = Date.now();

    // Vérifier si la protection a expiré
    if (fireData.weatherProtection.endsAt && now >= fireData.weatherProtection.endsAt) {
        // Désactiver la protection expirée
        fireData.weatherProtection = {
            active: false,
            endsAt: null,
            activatedBy: null
        };
        saveFireData(fireData);
        logger.info("Weather protection expired");
        return false;
    }

    return true;
}

/**
 * Récupère les informations de la protection météo active
 */
export function getWeatherProtectionInfo(): {
    active: boolean;
    endsAt: number | null;
    activatedBy: { userId: string; username: string } | null;
    remainingTime: number;
} {
    const fireData = loadFireData();
    const now = Date.now();

    if (!fireData.weatherProtection.active || !fireData.weatherProtection.endsAt) {
        return {
            active: false,
            endsAt: null,
            activatedBy: null,
            remainingTime: 0
        };
    }

    const remainingTime = Math.max(0, fireData.weatherProtection.endsAt - now);

    // Si le temps est écoulé, désactiver
    if (remainingTime === 0) {
        fireData.weatherProtection = {
            active: false,
            endsAt: null,
            activatedBy: null
        };
        saveFireData(fireData);

        return {
            active: false,
            endsAt: null,
            activatedBy: null,
            remainingTime: 0
        };
    }

    return {
        active: true,
        endsAt: fireData.weatherProtection.endsAt,
        activatedBy: fireData.weatherProtection.activatedBy,
        remainingTime
    };
}
