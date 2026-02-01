import {Activity, ActivityType, Client} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {createLogger} from "../utils/logger";

const logger = createLogger("ActivityService");

/**
 * Met à jour l'activité d'un utilisateur à partir de ses activités Discord
 */
export function updateUserActivity(userId: string, username: string, activities: Activity[]) {
    // Chercher une activité de type jeu
    const gameActivity = activities.find(activity =>
        activity.type === ActivityType.Playing ||
        activity.type === ActivityType.Streaming ||
        activity.type === ActivityType.Competing
    );

    if (gameActivity) {
        UserProfileService.updateActivity(
            userId,
            username,
            gameActivity.name,
            gameActivity.details || undefined
        );
    } else {
        // Pas de jeu actif, supprimer l'activité
        UserProfileService.updateActivity(userId, username, null);
    }
}

/**
 * Met à jour l'activité d'un utilisateur spécifique en récupérant sa présence actuelle
 * Utilisé pour les mises à jour à la demande (commande /profile, messages à Netricsa, etc.)
 */
export async function updateUserActivityFromPresence(client: Client, userId: string): Promise<void> {
    try {
        // Parcourir les guilds pour trouver le membre
        for (const guild of client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch(userId);
                if (member && member.presence?.activities) {
                    updateUserActivity(
                        member.user.id,
                        member.user.username,
                        member.presence.activities
                    );
                    return; // Trouvé et mis à jour
                }
            } catch (error) {
                // Membre pas dans ce guild, continuer avec le prochain
            }
        }
    } catch (error) {
        logger.error(`Error updating activity for user ${userId}:`, error);
    }
}
