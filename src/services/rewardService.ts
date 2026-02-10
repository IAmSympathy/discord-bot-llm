import {createLogger} from "../utils/logger";
import {addItemToInventory, getCurrentSeasonItems, getRandomSeasonalItem, InventoryItemType} from "./userInventoryService";

const logger = createLogger("RewardService");

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
        message: 0.0002,           // 0.02% par message (1/5000) - peu utilisé
        voice: 0.008,              // 0.8% par tranche de temps vocal (1/125) - très utilisé
        reaction: 0.0003,          // 0.03% par réaction (1/3333) - peu utilisé
        command: 0.01,             // 1% par commande (1/100) - utilisé régulièrement
        netricsa_command: 0.03     // 3% par commande Netricsa (/imagine, etc.) (1/33) - utilisé souvent
    };

    const random = Math.random();

    if (random < chances[activity]) {
        const rewardItem = getRandomSeasonalItem();
        addItemToInventory(userId, username, rewardItem, 1);
        logger.info(`Random seasonal reward: ${username} received ${rewardItem} from ${activity}`);
        return true;
    }

    return false;
}

// Alias pour rétrocompatibilité
export const rewardFireProtection = rewardSeasonalItem;
export const tryRandomFireProtectionReward = tryRandomSeasonalReward;

/**
 * Donne une bûche à un utilisateur
 */
export function giveFirewoodLog(
    userId: string,
    username: string
): boolean {
    const {addItemToInventory, InventoryItemType} = require("./userInventoryService");

    const success = addItemToInventory(userId, username, InventoryItemType.FIREWOOD_LOG, 1);

    if (success) {
        logger.info(`Gave firewood log to ${username}`);
    }

    return success;
}

/**
 * Système de récompense aléatoire pour les bûches
 * Plus généreux que les objets saisonniers pour encourager l'activité
 */
export function tryRandomFirewoodReward(
    userId: string,
    username: string,
    activity: "message" | "voice" | "reaction" | "command" | "daily" | "game_win"
): boolean {
    // Chances beaucoup plus élevées pour les bûches (car elles sont consommées rapidement)
    const chances: Record<string, number> = {
        message: 0.02,     // 2% par message (1/50) - encourager à parler
        voice: 0.05,       // 5% par tranche vocal (1/10) - récompenser le temps vocal
        reaction: 0.05,    // 5% par réaction (1/20) - encourager les interactions
        command: 0.10,     // 15% par commande (1/7) - récompenser l'utilisation
        daily: 1.0,        // 100% sur le daily (garanti)
        game_win: 0.2      // 20% par victoire (1/3) - encourager les jeux !
    };

    const random = Math.random();

    if (random < chances[activity]) {
        const success = giveFirewoodLog(userId, username);
        if (success) {
            logger.info(`Random firewood reward: ${username} received firewood from ${activity}`);
            return true;
        }
    }

    return false;
}
