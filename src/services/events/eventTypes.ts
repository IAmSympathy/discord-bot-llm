/**
 * Types d'événements disponibles
 */
export enum EventType {
    COUNTER_CHALLENGE = "counter_challenge",
    MINI_BOSS = "mini_boss",
    BOSS = "boss",
    MYSTERY_BOX = "mystery_box",
    SERVER_BIRTHDAY = "server_birthday",
    HOLIDAY = "holiday",
    SECRET_WORD = "secret_word",
    IMPOSTOR = "impostor"
}

/**
 * Structure d'un événement actif
 */
export interface ActiveEvent {
    id: string;
    type: EventType;
    channelId: string;
    startTime: number;
    endTime: number;
    data: any; // Données spécifiques à l'événement
}

/**
 * Structure des données d'événements
 */
export interface EventsData {
    activeEvents: ActiveEvent[];
    history: {
        eventId: string;
        type: EventType;
        timestamp: number;
        participants: string[];
        winners?: string[];
    }[];
    userPreferences: {
        [userId: string]: {
            disableMysteryBox: boolean;
            disableImpostor: boolean;
        };
    };
    impostorGuesses: {
        [eventId: string]: {
            [userId: string]: boolean;
        };
    };
}
