import {Client, Events} from "discord.js";
import {disableLowPowerModeAuto, enableLowPowerModeAuto, isGameBlacklisted, isManualMode, OWNER_ID} from "./botStateService";
import {setLowPowerStatus, setNormalStatus} from "./statusService";
import {createLogger} from "../utils/logger";

const logger = createLogger("ActivityMonitor");

/**
 * Service pour surveiller l'activité de l'owner et gérer automatiquement le Low Power Mode
 * Active le Low Power Mode quand l'owner joue à un jeu (sauf si blacklisté)
 * Désactive quand l'owner arrête de jouer
 */

let currentGameName: string | null = null;

/**
 * Vérifie si l'owner est en train de jouer à un jeu
 * Exportée pour permettre une vérification manuelle
 */
export async function checkOwnerActivity(client: Client): Promise<void> {
    if (!OWNER_ID) return;

    // Ne pas changer le statut si le bot est en Standby Mode (priorité absolue)
    const {isStandbyMode} = require('./standbyModeService');
    if (isStandbyMode()) {
        return;
    }

    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        try {
            const owner = await guild.members.fetch(OWNER_ID);
            const presence = owner.presence;

            if (!presence) {
                // Pas de présence = pas de jeu
                if (currentGameName) {
                    logger.info(`Owner stopped playing "${currentGameName}"`);
                    currentGameName = null;

                    // Si mode automatique et pas de jeu, désactiver Low Power
                    if (!isManualMode()) {
                        await disableLowPowerModeAuto();
                        await setNormalStatus(client);
                        logger.info(`⚡ Disabled Low Power Mode (Owner stopped gaming)`);
                    }
                }
                return;
            }

            // Chercher une activité de type "PLAYING"
            const gameActivity = presence.activities.find(activity => activity.type === 0); // 0 = PLAYING

            if (gameActivity) {
                const gameName = gameActivity.name;

                // Si c'est un nouveau jeu
                if (gameName !== currentGameName) {
                    logger.info(`Owner is playing "${gameName}"`);

                    // Vérifier si le jeu est blacklisté
                    if (isGameBlacklisted(gameName)) {
                        logger.info(`⚠️ "${gameName}" is blacklisted, NOT enabling Low Power Mode`);
                    } else {
                        currentGameName = gameName;

                        // Activer le Low Power Mode automatiquement (si pas en mode manuel)
                        if (!isManualMode()) {
                            const enabled = enableLowPowerModeAuto(client);
                            if (enabled) {
                                await setLowPowerStatus(client);
                                logger.info(`🎮 Enabled Low Power Mode (Owner playing "${gameName}")`);
                            } else {
                                logger.info(`🎮 Owner playing "${gameName}" but Low Power Mode is in manual mode`);
                            }
                        }
                    }
                }
            } else {
                // Plus de jeu en cours
                if (currentGameName) {
                    logger.info(`Owner stopped playing "${currentGameName}"`);
                    currentGameName = null;

                    const disabled = disableLowPowerModeAuto(client);
                    if (disabled) {
                        await setNormalStatus(client);
                        logger.info(`⚡ Disabled Low Power Mode (Owner stopped gaming)`);
                    }
                }
            }
        } catch (error) {
            logger.error("Error fetching owner:", error);
        }
    } catch (error) {
        logger.error("Error checking owner activity:", error);
    }
}

/**
 * Initialise le monitoring de l'activité de l'owner
 */
export function initializeActivityMonitor(client: Client): void {
    logger.info("✅ Activity monitor initialized (Auto Low Power Mode enabled by default)");
    logger.info(`Watching owner: ${OWNER_ID}`);

    // Écouter les changements de présence
    client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
        if (newPresence.userId === OWNER_ID) {
            logger.info(`Owner presence updated`);
            await checkOwnerActivity(client);
        }
    });

    // Vérification initiale immédiate pour déterminer le statut de démarrage
    (async () => {
        try {
            logger.info("🔍 Initial activity check (determining startup status)...");

            // Vérifier si le bot est en Standby Mode (prioritaire)
            const {isStandbyMode} = require('./standbyModeService');
            if (isStandbyMode()) {
                logger.info("🌙 Bot is in Standby Mode, skipping activity monitor status change");
                return;
            }

            await checkOwnerActivity(client);

            // Si aucun jeu n'est détecté, s'assurer que le bot est en mode normal
            if (!currentGameName && !isManualMode()) {
                await setNormalStatus(client);
                logger.info("⚡ Bot started in Normal Mode (no game detected)");
            }
        } catch (error) {
            logger.error("Error in initial activity check:", error);

            // Vérifier le Standby Mode avant d'appliquer le statut normal par défaut
            const {isStandbyMode} = require('./standbyModeService');
            if (!isStandbyMode()) {
                await setNormalStatus(client);
            }
        }
    })();

    // Vérification périodique toutes les 5 minutes (au cas où)
    setInterval(() => {
        checkOwnerActivity(client);
    }, 5 * 60 * 1000);
}

/**
 * Récupère le nom du jeu actuellement joué par l'owner
 */
export function getCurrentGame(): string | null {
    return currentGameName;
}
