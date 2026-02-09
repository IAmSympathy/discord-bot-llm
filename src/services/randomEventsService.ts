/**
 * Service centralisé pour les événements aléatoires
 *
 * Ce fichier réexporte toutes les fonctionnalités des événements
 * pour maintenir la compatibilité avec le code existant.
 */

import {Client} from "discord.js";
import {createLogger} from "../utils/logger";
import {checkExpiredEvents} from "./events/eventChannelManager";

const logger = createLogger("RandomEventsService");

// ========== EXPORTS DES TYPES ==========
export {EventType, ActiveEvent, EventsData} from "./events/eventTypes";

// ========== EXPORTS DES GESTIONNAIRES DE DONNÉES ==========
export {loadEventsData, saveEventsData} from "./events/eventsDataManager";

// ========== EXPORTS DES GESTIONNAIRES DE CANAUX ==========
export {
    createEventChannel,
    deleteEventChannel,
    endEvent,
    checkExpiredEvents
} from "./events/eventChannelManager";

// ========== EXPORTS DES ÉVÉNEMENTS ==========

// Défi du Compteur
export {
    startCounterChallenge,
    checkCounterChallengeProgress
} from "./events/counterChallengeEvent";

// Mini Boss
export {
    startMiniBossEvent as startMiniBoss,
    handleMiniBossMessage
} from "./events/miniBossEvent";

// Boss
export {
    startBossEvent as startBoss,
    handleBossMessage
} from "./events/bossEvent";

// Colis Mystère
export {
    startMysteryBox
} from "./events/mysteryBoxEvent";

// Imposteur
export {
    startImpostorEvent,
    handleImpostorGuess
} from "./events/impostorEvent";

// Énigme
export {
    startRiddleEvent as startRiddle,
    handleRiddleMessage
} from "./events/riddleEvent";

// Suite logique
export {
    startSequenceEvent as startSequence,
    handleSequenceMessage
} from "./events/sequenceEvent";

// ========== INITIALISATION ==========

/**
 * Initialise le service d'événements aléatoires
 */
export function initializeRandomEventsService(client: Client): void {
    logger.info("Random Events Service initialized");

    // Vérifier les événements expirés toutes les minutes
    setInterval(async () => {
        await checkExpiredEvents(client);
    }, 60000); // 1 minute

    logger.info("Random Events Service started - checking for expired events every minute");
}
