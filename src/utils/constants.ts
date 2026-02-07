import {EnvConfig} from "./envConfig";
import * as path from "path";

// Paths
export const DATA_DIR = path.join(process.cwd(), "data");

// Role IDs
export const OWNER_ROLES = ["1122751212299767929", "1129445913123880960"] as const;
export const MODERATOR_ROLES = ["829521404214640671"] as const;
export const ALLOWED_COMMAND_ROLES = [...OWNER_ROLES, ...MODERATOR_ROLES] as const;

// Default role for new members
export const DEFAULT_MEMBER_ROLE = "875495187491733524"; // Beheaded

// Level Roles (Prefix roles based on level)
export const LEVEL_ROLES = {
    HATCHLING: "1469149644293410866", // Niveau 1-9
    JUVENILE: "1469149867644293183",   // Niveau 10-19
    ADULT: "1469150100260524214",      // Niveau 20-34
    SOLDIER: "1469150762259976327",    // Niveau 35-54
    ELITE: "1469150566038114579",      // Niveau 55-79
    COMMANDO: "1469150429794402344"    // Niveau 80+
} as const;

export const LEVEL_THRESHOLDS = [
    {level: 1, role: "HATCHLING", name: "Hatchling"},
    {level: 10, role: "JUVENILE", name: "Juvenile"},
    {level: 20, role: "ADULT", name: "Adult"},
    {level: 35, role: "SOLDIER", name: "Soldier"},
    {level: 55, role: "ELITE", name: "Elite"},
    {level: 80, role: "COMMANDO", name: "Commando"}
] as const;

// Monthly Ranking Roles
export const MONTHLY_RANKING_ROLES = {
    GOLD: "1469592407149514814",        // À remplacer par l'ID réel
    SILVER: "1469593432233087008",    // À remplacer par l'ID réel
    BRONZE: "1469593737741992049",    // À remplacer par l'ID réel
    CELESTIAL: "1469594382834602097" // À remplacer par l'ID réel
} as const;

// Memory Configuration - Sliding Window System
export const MEMORY_MAX_TURNS = 28; // Total turns to keep in memory
export const MEMORY_RECENT_TURNS = 8; // Always keep last 8 turns (recent context) - SANS FILTRE
export const MEMORY_IMPORTANT_OLD_TURNS = 20; // Keep N "important" old turns (historical context)
export const MEMORY_IMPORTANCE_THRESHOLD = 2; // Minimum score to keep old turns
export const MEMORY_FILE_PATH = EnvConfig.MEMORY_FILE_PATH;

// Ollama Configuration
export const OLLAMA_API_URL = "http://localhost:11434";
export const OLLAMA_TEXT_MODEL = EnvConfig.OLLAMA_TEXT_MODEL;
export const OLLAMA_VISION_MODEL = EnvConfig.OLLAMA_VISION_MODEL;

// Discord limits
export const DISCORD_MESSAGE_LIMIT = 1900;
export const DISCORD_TYPING_UPDATE_INTERVAL = 800; // 500ms pour éditions plus réactives (était 2000ms)
export const TYPING_ANIMATION_INTERVAL = 800;

// Timeouts
export const BUTTON_CONFIRMATION_TIMEOUT = 10000;

// Filtres de mémoire et extraction - Regex réutilisables
export const FILTER_PATTERNS = {
    QUESTION: /\?/,
    FUTURE_PLAN: /\b(on va|nous allons|je vais|j'irai|nous irons|demain|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|ce weekend|la semaine prochaine|le mois prochain)\b/i,
    RECENT_EVENT: /\b(viens de|je viens|vient de|viennent de|venais de|venait de|à l'instant|tout juste|hier|ce matin|cet après-midi|ce soir|récemment)\b/i,
    TEMPORARY_OPINION: /\b(a l'air|avait l'air|semble|semblait|paraît|paraissait|il est|c'est|c'était|était)\b/i,
    SHORT_RESPONSE: /^(oui|ouais|ouep|yep|yeah|ye|ok|non|nope|nah|nan|ben\s+oui|ben\s+non|bien\s+sur|bien\s+sûr|certainement|évidemment|evidemment|absolument|carrément|carrement|grave|clair)\b/i,
    ACTIVITY: /^(je|j'|moi\s+je)\s+(mange|bois|joue|regarde|écoute|lis|dors|travaille|étudie|cours|code|dessine|cuisine)/i,
    NOTHING_RESPONSE: /^(rien|nothing|pas grand chose|pas grand-chose|r1|ryn)$/i,
    NUMERIC_ANSWER: /^\d+$/,
} as const;

// Channel restrictions for specific commands
export const COMMAND_CHANNEL_ID = EnvConfig.COMMAND_CHANNEL_ID;
export const GAMES_CHANNEL_ID = EnvConfig.GAMES_CHANNEL_ID;
