import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";

const logger = createLogger("UserInventory");
const INVENTORY_FILE = path.join(DATA_DIR, "user_inventory.json");

/**
 * Saison actuelle du bot
 */
export enum Season {
    WINTER = "winter",
    SPRING = "spring",
    SUMMER = "summer",
    FALL = "fall"
}

/**
 * Types d'objets disponibles dans l'inventaire (format saisonnier)
 */
export enum InventoryItemType {
    // Items d'hiver (protection du feu)
    WINTER_SMALL = "winter_handwarmer",
    WINTER_MEDIUM = "winter_thermal_blanket",
    WINTER_LARGE = "winter_heating_stone",

    // Items de printemps (à définir plus tard)
    SPRING_SMALL = "spring_small",
    SPRING_MEDIUM = "spring_medium",
    SPRING_LARGE = "spring_large",

    // Items d'été (à définir plus tard)
    SUMMER_SMALL = "summer_small",
    SUMMER_MEDIUM = "summer_medium",
    SUMMER_LARGE = "summer_large",

    // Items d'automne (à définir plus tard)
    FALL_SMALL = "fall_small",
    FALL_MEDIUM = "fall_medium",
    FALL_LARGE = "fall_large",

    // Bûche pour le feu (limite 1 par utilisateur)
    FIREWOOD_LOG = "firewood_log"
}

/**
 * Informations sur un type d'objet
 */
export interface ItemInfo {
    name: string;
    description: string;
    emoji: string;
    season: Season;
    duration?: number; // Durée en millisecondes pour les effets
    rarity: "common" | "uncommon" | "rare"; // Rareté de l'objet
}

/**
 * Obtient la saison actuelle (basé sur le mois)
 */
export function getCurrentSeason(): Season {
    const month = new Date().getMonth(); // 0-11

    // Décembre (11), Janvier (0), Février (1) = Hiver
    if (month === 11 || month === 0 || month === 1) {
        return Season.WINTER;
    }
    // Mars (2), Avril (3), Mai (4) = Printemps
    else if (month >= 2 && month <= 4) {
        return Season.SPRING;
    }
    // Juin (5), Juillet (6), Août (7) = Été
    else if (month >= 5 && month <= 7) {
        return Season.SUMMER;
    }
    // Septembre (8), Octobre (9), Novembre (10) = Automne
    else {
        return Season.FALL;
    }
}

/**
 * Catalogue des objets disponibles
 */
export const ITEM_CATALOG: Record<InventoryItemType, ItemInfo> = {
    // === ITEMS D'HIVER ===
    [InventoryItemType.WINTER_SMALL]: {
        name: "Chauffe-Mains Magique",
        description: "Des petites poches chauffantes qui gardent le feu au chaud pendant 30 minutes",
        emoji: "🧤",
        season: Season.WINTER,
        duration: 30 * 60 * 1000,
        rarity: "common"
    },
    [InventoryItemType.WINTER_MEDIUM]: {
        name: "Couverture Thermique",
        description: "Une grande couverture en laine enchantée qui isole le feu du froid pendant 1 heure",
        emoji: "🧣",
        season: Season.WINTER,
        duration: 60 * 60 * 1000,
        rarity: "uncommon"
    },
    [InventoryItemType.WINTER_LARGE]: {
        name: "Pierre Chauffante Runique",
        description: "Une pierre ancienne gravée de runes qui rayonne une chaleur intense pendant 2 heures",
        emoji: "🔥",
        season: Season.WINTER,
        duration: 2 * 60 * 60 * 1000,
        rarity: "rare"
    },

    // === ITEMS DE PRINTEMPS (placeholders) ===
    [InventoryItemType.SPRING_SMALL]: {
        name: "Item Printemps Petit",
        description: "À définir pour la saison du printemps",
        emoji: "🌸",
        season: Season.SPRING,
        duration: 30 * 60 * 1000,
        rarity: "common"
    },
    [InventoryItemType.SPRING_MEDIUM]: {
        name: "Item Printemps Moyen",
        description: "À définir pour la saison du printemps",
        emoji: "🌷",
        season: Season.SPRING,
        duration: 60 * 60 * 1000,
        rarity: "uncommon"
    },
    [InventoryItemType.SPRING_LARGE]: {
        name: "Item Printemps Grand",
        description: "À définir pour la saison du printemps",
        emoji: "🌺",
        season: Season.SPRING,
        duration: 2 * 60 * 60 * 1000,
        rarity: "rare"
    },

    // === ITEMS D'ÉTÉ (placeholders) ===
    [InventoryItemType.SUMMER_SMALL]: {
        name: "Item Été Petit",
        description: "À définir pour la saison de l'été",
        emoji: "☀️",
        season: Season.SUMMER,
        duration: 30 * 60 * 1000,
        rarity: "common"
    },
    [InventoryItemType.SUMMER_MEDIUM]: {
        name: "Item Été Moyen",
        description: "À définir pour la saison de l'été",
        emoji: "🌊",
        season: Season.SUMMER,
        duration: 60 * 60 * 1000,
        rarity: "uncommon"
    },
    [InventoryItemType.SUMMER_LARGE]: {
        name: "Item Été Grand",
        description: "À définir pour la saison de l'été",
        emoji: "🏖️",
        season: Season.SUMMER,
        duration: 2 * 60 * 60 * 1000,
        rarity: "rare"
    },

    // === ITEMS D'AUTOMNE (placeholders) ===
    [InventoryItemType.FALL_SMALL]: {
        name: "Item Automne Petit",
        description: "À définir pour la saison de l'automne",
        emoji: "🍂",
        season: Season.FALL,
        duration: 30 * 60 * 1000,
        rarity: "common"
    },
    [InventoryItemType.FALL_MEDIUM]: {
        name: "Item Automne Moyen",
        description: "À définir pour la saison de l'automne",
        emoji: "🍁",
        season: Season.FALL,
        duration: 60 * 60 * 1000,
        rarity: "uncommon"
    },
    [InventoryItemType.FALL_LARGE]: {
        name: "Item Automne Grand",
        description: "À définir pour la saison de l'automne",
        emoji: "🎃",
        season: Season.FALL,
        duration: 2 * 60 * 60 * 1000,
        rarity: "rare"
    },

    // === BÛCHE POUR LE FEU ===
    [InventoryItemType.FIREWOOD_LOG]: {
        name: "Bûche de Bois",
        description: "Une bûche pour alimenter le feu de foyer",
        emoji: "🪵",
        season: Season.WINTER, // Disponible toute l'année mais thématique hiver
        rarity: "common"
    }
};

/**
 * Inventaire d'un utilisateur
 */
export interface UserInventory {
    userId: string;
    username: string;
    items: {
        [key in InventoryItemType]?: number; // Type d'objet -> quantité
    };
    lastUpdate: number;
}

/**
 * Base de données des inventaires
 */
interface InventoryDatabase {
    [userId: string]: UserInventory;
}

/**
 * Charge les inventaires depuis le fichier JSON
 */
function loadInventories(): InventoryDatabase {
    try {
        if (!fs.existsSync(INVENTORY_FILE)) {
            return {};
        }
        const data = fs.readFileSync(INVENTORY_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        logger.error("Error loading inventories:", error);
        return {};
    }
}

/**
 * Sauvegarde les inventaires dans le fichier JSON
 */
function saveInventories(inventories: InventoryDatabase): void {
    try {
        const dir = path.dirname(INVENTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventories, null, 2));
    } catch (error) {
        logger.error("Error saving inventories:", error);
    }
}

/**
 * Initialise l'inventaire d'un utilisateur
 */
function initUserInventory(userId: string, username: string): UserInventory {
    return {
        userId,
        username,
        items: {},
        lastUpdate: Date.now()
    };
}

/**
 * Récupère l'inventaire d'un utilisateur
 */
export function getUserInventory(userId: string, username?: string): UserInventory {
    const inventories = loadInventories();

    if (!inventories[userId]) {
        inventories[userId] = initUserInventory(userId, username || "Unknown");
        saveInventories(inventories);
    } else if (username && inventories[userId].username !== username) {
        inventories[userId].username = username;
        inventories[userId].lastUpdate = Date.now();
        saveInventories(inventories);
    }

    return inventories[userId];
}

/**
 * Ajoute un objet à l'inventaire d'un utilisateur
 */
export function addItemToInventory(
    userId: string,
    username: string,
    itemType: InventoryItemType,
    quantity: number = 1
): boolean {
    const inventories = loadInventories();

    if (!inventories[userId]) {
        inventories[userId] = initUserInventory(userId, username);
    }

    const currentQuantity = inventories[userId].items[itemType] || 0;
    inventories[userId].items[itemType] = currentQuantity + quantity;

    inventories[userId].username = username;
    inventories[userId].lastUpdate = Date.now();

    saveInventories(inventories);

    const itemInfo = ITEM_CATALOG[itemType];
    logger.info(`Added ${quantity}x ${itemInfo.name} to ${username}'s inventory (total: ${inventories[userId].items[itemType]})`);
    return true;
}

/**
 * Retire un objet de l'inventaire d'un utilisateur
 */
export function removeItemFromInventory(
    userId: string,
    itemType: InventoryItemType,
    quantity: number = 1
): boolean {
    const inventories = loadInventories();

    if (!inventories[userId]) {
        return false;
    }

    const currentQuantity = inventories[userId].items[itemType] || 0;

    if (currentQuantity < quantity) {
        return false;
    }

    inventories[userId].items[itemType] = currentQuantity - quantity;
    inventories[userId].lastUpdate = Date.now();

    // Supprimer l'entrée si la quantité tombe à 0
    if (inventories[userId].items[itemType] === 0) {
        delete inventories[userId].items[itemType];
    }

    saveInventories(inventories);

    const itemInfo = ITEM_CATALOG[itemType];
    logger.info(`Removed ${quantity}x ${itemInfo.name} from user ${userId}'s inventory (remaining: ${inventories[userId].items[itemType] || 0})`);

    return true;
}

/**
 * Vérifie si un utilisateur possède un objet
 */
export function hasItem(userId: string, itemType: InventoryItemType, quantity: number = 1): boolean {
    const inventory = getUserInventory(userId);
    const currentQuantity = inventory.items[itemType] || 0;
    return currentQuantity >= quantity;
}

/**
 * Récupère la quantité d'un objet dans l'inventaire
 */
export function getItemQuantity(userId: string, itemType: InventoryItemType): number {
    const inventory = getUserInventory(userId);
    return inventory.items[itemType] || 0;
}

/**
 * Récupère tous les objets de protection météo d'un utilisateur
 */
export function getFireProtectionItems(userId: string): Array<{ type: InventoryItemType, quantity: number, info: ItemInfo }> {
    const inventory = getUserInventory(userId);
    const items: Array<{ type: InventoryItemType, quantity: number, info: ItemInfo }> = [];

    for (const itemType of Object.values(InventoryItemType)) {
        const quantity = inventory.items[itemType] || 0;
        if (quantity > 0) {
            items.push({
                type: itemType,
                quantity,
                info: ITEM_CATALOG[itemType]
            });
        }
    }

    return items;
}

/**
 * Obtient les types d'items pour la saison actuelle
 */
export function getCurrentSeasonItems(): {
    small: InventoryItemType;
    medium: InventoryItemType;
    large: InventoryItemType;
} {
    const season = getCurrentSeason();

    switch (season) {
        case Season.WINTER:
            return {
                small: InventoryItemType.WINTER_SMALL,
                medium: InventoryItemType.WINTER_MEDIUM,
                large: InventoryItemType.WINTER_LARGE
            };
        case Season.SPRING:
            return {
                small: InventoryItemType.SPRING_SMALL,
                medium: InventoryItemType.SPRING_MEDIUM,
                large: InventoryItemType.SPRING_LARGE
            };
        case Season.SUMMER:
            return {
                small: InventoryItemType.SUMMER_SMALL,
                medium: InventoryItemType.SUMMER_MEDIUM,
                large: InventoryItemType.SUMMER_LARGE
            };
        case Season.FALL:
            return {
                small: InventoryItemType.FALL_SMALL,
                medium: InventoryItemType.FALL_MEDIUM,
                large: InventoryItemType.FALL_LARGE
            };
    }
}

/**
 * Obtient un item aléatoire de la saison actuelle avec pondération par rareté
 */
export function getRandomSeasonalItem(): InventoryItemType {
    const seasonItems = getCurrentSeasonItems();
    const random = Math.random();

    // Pondération: 60% common, 30% uncommon, 10% rare
    if (random < 0.6) {
        return seasonItems.small; // Common
    } else if (random < 0.9) {
        return seasonItems.medium; // Uncommon
    } else {
        return seasonItems.large; // Rare
    }
}








