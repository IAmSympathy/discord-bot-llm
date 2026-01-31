import {Client, Events} from "discord.js";
import {disableLowPowerModeAuto, enableLowPowerModeAuto, isGameBlacklisted, OWNER_ID} from "./botStateService";
import {setLowPowerStatus, setNormalStatus} from "./statusService";

/**
 * Service pour surveiller l'activité de l'owner et gérer automatiquement le Low Power Mode
 * Active le Low Power Mode quand l'owner joue à un jeu (sauf si blacklisté)
 * Désactive quand l'owner arrête de jouer
 */

let currentGameName: string | null = null;

/**
 * Vérifie si l'owner est en train de jouer à un jeu
 */
function checkOwnerActivity(client: Client): void {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        guild.members.fetch(OWNER_ID).then(async member => {
            const presence = member.presence;
            if (!presence) {
                // Pas de présence = pas de jeu
                if (currentGameName) {
                    console.log(`[ActivityMonitor] Owner stopped playing "${currentGameName}"`);
                    currentGameName = null;
                    const disabled = disableLowPowerModeAuto();
                    if (disabled) {
                        await setNormalStatus(client);
                        console.log(`[ActivityMonitor] ⚡ Disabled Low Power Mode (Owner stopped gaming)`);
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
                    console.log(`[ActivityMonitor] Owner started playing "${gameName}"`);

                    // Vérifier si le jeu est blacklisté
                    if (isGameBlacklisted(gameName)) {
                        console.log(`[ActivityMonitor] ⚠️ "${gameName}" is blacklisted, NOT enabling Low Power Mode`);
                        currentGameName = gameName;
                        return;
                    }

                    currentGameName = gameName;

                    // Activer le Low Power Mode automatiquement (si pas en mode manuel)
                    const enabled = enableLowPowerModeAuto();
                    if (enabled) {
                        await setLowPowerStatus(client);
                        console.log(`[ActivityMonitor] 🎮 Enabled Low Power Mode (Owner playing "${gameName}")`);
                    } else {
                        console.log(`[ActivityMonitor] 🎮 Owner playing "${gameName}" but Low Power Mode is in manual mode`);
                    }
                }
            } else {
                // Plus de jeu en cours
                if (currentGameName) {
                    console.log(`[ActivityMonitor] Owner stopped playing "${currentGameName}"`);
                    currentGameName = null;

                    const disabled = disableLowPowerModeAuto();
                    if (disabled) {
                        await setNormalStatus(client);
                        console.log(`[ActivityMonitor] ⚡ Disabled Low Power Mode (Owner stopped gaming)`);
                    }
                }
            }
        }).catch(error => {
            console.error("[ActivityMonitor] Error fetching owner:", error);
        });
    } catch (error) {
        console.error("[ActivityMonitor] Error checking owner activity:", error);
    }
}

/**
 * Initialise le monitoring de l'activité de l'owner
 */
export function initializeActivityMonitor(client: Client): void {
    console.log("[ActivityMonitor] ✅ Activity monitor initialized");
    console.log(`[ActivityMonitor] Watching owner: ${OWNER_ID}`);

    // Écouter les changements de présence
    client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
        // Vérifier uniquement les changements de l'owner
        if (newPresence.userId === OWNER_ID) {
            console.log(`[ActivityMonitor] Owner presence updated`);
            checkOwnerActivity(client);
        }
    });

    // Vérification initiale après 10 secondes
    setTimeout(() => {
        console.log("[ActivityMonitor] Initial activity check...");
        checkOwnerActivity(client);
    }, 10000);

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
