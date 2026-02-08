import {createLogger} from "../../utils/logger";
import * as fs from "fs";
import * as path from "path";
import {DATA_DIR} from "../../utils/constants";
import {EventsData} from "./eventTypes";

const logger = createLogger("EventsDataManager");
const EVENTS_FILE = path.join(DATA_DIR, "random_events.json");

/**
 * Charge les données des événements
 */
export function loadEventsData(): EventsData {
    if (!fs.existsSync(EVENTS_FILE)) {
        const defaultData: EventsData = {
            activeEvents: [],
            history: [],
            userPreferences: {},
            impostorGuesses: {}
        };
        saveEventsData(defaultData);
        return defaultData;
    }

    try {
        const data = fs.readFileSync(EVENTS_FILE, "utf-8");
        const parsed = JSON.parse(data);

        // S'assurer que toutes les propriétés existent
        if (!parsed.impostorGuesses) {
            parsed.impostorGuesses = {};
        }

        return parsed;
    } catch (error) {
        logger.error("Error loading events data:", error);
        return {
            activeEvents: [],
            history: [],
            userPreferences: {},
            impostorGuesses: {}
        };
    }
}

/**
 * Sauvegarde les données des événements
 */
export function saveEventsData(data: EventsData): void {
    try {
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving events data:", error);
    }
}
