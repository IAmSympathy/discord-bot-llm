import {ChatInputCommandInteraction, Message, TextChannel} from "discord.js";
import {createLogger} from "../utils/logger";

const logger = createLogger("RewardNotifier");

/**
 * Envoie une notification à l'utilisateur quand il reçoit un objet saisonnier
 * @param interaction L'interaction pour envoyer la notification (éphémère) si disponible
 * @param channel Le canal pour envoyer la notification si pas d'interaction
 * @param userId Le Id de l'utilisateur
 * @param itemType Le type d'item reçu
 */
export async function notifySeasonalReward(
    interaction: ChatInputCommandInteraction | null,
    channel: TextChannel | null,
    userId: string,
    itemType: any
): Promise<void> {
    try {
        const {ITEM_CATALOG} = require("./userInventoryService");
        const itemInfo = ITEM_CATALOG[itemType];

        const messageContent = interaction
            ? `Tu as trouvé ${itemInfo.emoji} **${itemInfo.name}** !\nVérifie ton inventaire (\`/profile\` → 🎒 Inventaire)`
            : `<@${userId}> a trouvé ${itemInfo.emoji} **${itemInfo.name}** !\nVérifie ton inventaire (\`/profile\` → 🎒 Inventaire)`;

        if (interaction) {
            // Si c'est une commande, envoyer un message éphémère
            await interaction.followUp({
                content: messageContent,
                ephemeral: true
            });
            logger.info(`Notified ${userId} about receiving ${itemInfo.name} via interaction`);
        } else if (channel) {
            // Sinon, envoyer dans le canal et supprimer après 10 secondes
            const sentMessage = await channel.send(messageContent) as Message;
            setTimeout(() => {
                sentMessage.delete().catch((err: any) =>
                    logger.error("Error deleting reward notification:", err)
                );
            }, 60000);
            logger.info(`Notified ${userId} about receiving ${itemInfo.name} via channel`);
        }
    } catch (error) {
        logger.error("Error sending reward notification:", error);
    }
}

/**

 * Tente de donner un objet saisonnier et notifie l'utilisateur si succès
 * @param interaction L'interaction pour envoyer la notification (peut être null)
 * @param channel Le canal pour envoyer la notification si pas d'interaction
 * @param userId ID de l'utilisateur
 * @param username Nom de l'utilisateur
 * @param activity Type d'activité (command ou netricsa_command)
 */
export async function tryRewardAndNotify(
    interaction: ChatInputCommandInteraction | null,
    channel: TextChannel | null,
    userId: string,
    username: string,
    activity: "command" | "netricsa_command"
): Promise<void> {
    try {
        const {tryRandomSeasonalReward, getLastRewardedItem} = require("./rewardService");
        const rewarded = tryRandomSeasonalReward(userId, username, activity);

        if (rewarded) {
            const itemType = getLastRewardedItem(userId);
            if (itemType) {
                await notifySeasonalReward(interaction, channel, userId, itemType);
            }
        }
    } catch (error) {
        logger.error("Error in tryRewardAndNotify:", error);
    }
}

