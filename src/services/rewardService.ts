import {createLogger} from "../utils/logger";
import {addItemToInventory, getCurrentSeasonItems, getRandomSeasonalItem, InventoryItemType} from "./userInventoryService";

const logger = createLogger("RewardService");

// Garder en mémoire le dernier item reçu par utilisateur (pour les notifications)
const lastRewardedItems: Map<string, InventoryItemType> = new Map();

/**
 * Récupère le dernier item reçu par un utilisateur
 */
export function getLastRewardedItem(userId: string): InventoryItemType | undefined {
    return lastRewardedItems.get(userId);
}

/**
 * Récompense un utilisateur avec un objet saisonnier
 */
export function rewardSeasonalItem(
    userId: string,
    username: string,
    reason: "achievement" | "game_win" | "daily_streak" | "fire_contribution" | "netricsa_use" | "random",
    specificItem?: InventoryItemType
): void {
    // Choisir l'objet selon la raison si non spécifié
    let rewardType = specificItem;

    if (!rewardType) {
        const seasonItems = getCurrentSeasonItems();

        switch (reason) {
            case "achievement":
                // Achievement = item rare ou moyen (30% rare, 70% medium)
                rewardType = Math.random() < 0.3 ? seasonItems.large : seasonItems.medium;
                break;
            case "game_win":
                // Victoire = item common seulement (car on peut spam vs bot)
                rewardType = seasonItems.small;
                break;
            case "daily_streak":
                // Streak quotidien = item medium
                rewardType = seasonItems.medium;
                break;
            case "fire_contribution":
                // Contribution au feu = item small
                rewardType = seasonItems.small;
                break;
            case "netricsa_use":
                // Utilisation Netricsa = item aléatoire
                rewardType = getRandomSeasonalItem();
                break;
            case "random":
                // Complètement aléatoire avec pondération
                rewardType = getRandomSeasonalItem();
                break;
        }
    }

    addItemToInventory(userId, username, rewardType, 1);
    lastRewardedItems.set(userId, rewardType);
    logger.info(`Rewarded ${username} with ${rewardType} for ${reason}`);
}

/**
 * Système de récompense aléatoire pour encourager l'activité
 * Retourne true si une récompense a été donnée
 */
export function tryRandomSeasonalReward(
    userId: string,
    username: string,
    activity: "message" | "voice" | "reaction" | "command" | "netricsa_command"
): boolean {
    // Chances de récompense ajustées selon l'usage réel
    const chances: Record<string, number> = {
        message: 0.01,           // 0.01% par message (1/5000) - peu utilisé
        voice: 0.01,              // 0.8% par tranche de temps vocal (1/125) - très utilisé
        reaction: 0.01,          // 0.03% par réaction (1/3333) - peu utilisé
        command: 0.01,             // 1% par commande (1/100) - utilisé régulièrement<
        game_win: 0.02,             // 20% par victoire (1/5) - encourager les jeux
        netricsa_command: 0.03     // 3% par commande Netricsa (/imagine, etc.) (1/33) - utilisé souvent
    };

    const random = Math.random();

    if (random < chances[activity]) {
        const rewardItem = getRandomSeasonalItem();
        addItemToInventory(userId, username, rewardItem, 1);
        lastRewardedItems.set(userId, rewardItem);
        logger.info(`Random seasonal reward: ${username} received ${rewardItem} from ${activity}`);
        return true;
    }

    return false;
}

// Alias pour rétrocompatibilité
export const rewardFireProtection = rewardSeasonalItem;
export const tryRandomFireProtectionReward = tryRandomSeasonalReward;
