// Role IDs
export const OWNER_ROLES = ["1122751212299767929", "1129445913123880960"] as const;
export const MODERATOR_ROLES = ["829521404214640671"] as const;
export const ALLOWED_COMMAND_ROLES = [...OWNER_ROLES, ...MODERATOR_ROLES] as const;

// Memory Configuration - Sliding Window System
export const MEMORY_MAX_TURNS = 40; // Total turns to keep in memory
export const MEMORY_RECENT_TURNS = 20; // Always keep last N turns (recent context)
export const MEMORY_IMPORTANT_OLD_TURNS = 20; // Keep N "important" old turns (historical context)
export const MEMORY_IMPORTANCE_THRESHOLD = 2; // Minimum score to keep old turns
export const MEMORY_FILE_PATH = process.env.MEMORY_FILE || "./data/memory.json";

// Ollama Configuration
export const OLLAMA_API_URL = "http://localhost:11434";
export const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || "llama3.2";
export const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:7b";

// Discord limits
export const DISCORD_MESSAGE_LIMIT = 1900;
export const DISCORD_TYPING_UPDATE_INTERVAL = 2000;
export const IMAGE_ANALYSIS_ANIMATION_INTERVAL = 1500;

// Timeouts
export const BUTTON_CONFIRMATION_TIMEOUT = 10000;
