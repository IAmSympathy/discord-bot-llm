import {ChannelType, Client, EmbedBuilder, Guild, PermissionFlagsBits, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {loadEventsData, saveEventsData} from "./eventsDataManager";

const logger = createLogger("EventChannelManager");

/**
 * Trouve ou crée la catégorie d'événements
 */
async function getOrCreateEventsCategory(guild: Guild): Promise<string> {
    // Chercher une catégorie existante nommée "ÉVÉNEMENTS" ou "EVENTS"
    let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory &&
            (c.name.toLowerCase() === "🎉┃événements" ||
                c.name.toLowerCase().includes("événements") ||
                c.name.toLowerCase().includes("events"))
    );

    // Si elle n'existe pas, la créer
    if (!category) {
        try {
            category = await guild.channels.create({
                name: "🎉┃ÉVÉNEMENTS",
                type: ChannelType.GuildCategory,
                position: 0 // En haut du serveur
            });
            logger.info("Events category created");
        } catch (error) {
            logger.error("Error creating events category:", error);
            return ""; // Retourner vide en cas d'erreur
        }
    }

    return category.id;
}

/**
 * Crée un canal d'événement
 */
export async function createEventChannel(guild: Guild, name: string, emoji: string): Promise<TextChannel | null> {
    try {
        // Obtenir l'ID de la catégorie
        const categoryId = await getOrCreateEventsCategory(guild);

        // Créer le canal
        const channel = await guild.channels.create({
            name: `${emoji}┃${name}`,
            type: ChannelType.GuildText,
            parent: categoryId || undefined, // Si pas de catégorie, undefined
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.SendMessages] // Lecture seule
                }
            ]
        });

        logger.info(`Event channel created: ${channel.name}`);
        return channel;
    } catch (error) {
        logger.error("Error creating event channel:", error);
        return null;
    }
}

/**
 * Supprime un canal d'événement
 */
export async function deleteEventChannel(guild: Guild, channelId: string): Promise<void> {
    try {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
            await channel.delete();
            logger.info(`Event channel deleted: ${channelId}`);
        }
    } catch (error) {
        logger.error("Error deleting event channel:", error);
    }
}

/**
 * Termine un événement
 */
export async function endEvent(client: Client, eventId: string, reason: "expired" | "completed" = "expired"): Promise<void> {
    const eventsData = loadEventsData();
    const eventIndex = eventsData.activeEvents.findIndex(e => e.id === eventId);

    if (eventIndex === -1) {
        logger.warn(`Event ${eventId} not found`);
        return;
    }

    const event = eventsData.activeEvents[eventIndex];

    // Si l'événement expire (pas complété), envoyer un message
    if (reason === "expired") {
        for (const guild of client.guilds.cache.values()) {
            const channel = guild.channels.cache.get(event.channelId) as TextChannel;
            if (channel) {
                const expiredEmbed = new EmbedBuilder()
                    .setColor(0xED4245) // Rouge
                    .setTitle("⏰ ÉVÉNEMENT TERMINÉ")
                    .setDescription(
                        `Le temps est écoulé ! L'événement est terminé.\n\n` +
                        `Personne n'a atteint l'objectif à temps. 😔\n\n` +
                        `*Ce canal sera supprimé dans 1 minute...*`
                    )
                    .setTimestamp();

                await channel.send({embeds: [expiredEmbed]}).catch(() => {
                });
                logger.info(`Event ${eventId} expired, notification sent`);
            }
        }
    }

    // Retirer de la liste des événements actifs
    eventsData.activeEvents.splice(eventIndex, 1);
    const hasRemainingEvents = eventsData.activeEvents.length > 0;
    saveEventsData(eventsData);

    // Supprimer le canal après 1 minute (60 secondes)
    setTimeout(async () => {
        for (const guild of client.guilds.cache.values()) {
            await deleteEventChannel(guild, event.channelId);

            // Si c'était le dernier événement, supprimer aussi la catégorie
            if (!hasRemainingEvents) {
                try {
                    const category = guild.channels.cache.find(
                        c => c.type === ChannelType.GuildCategory &&
                            (c.name.toLowerCase() === "🎉┃événements" || c.name.toLowerCase().includes("événements") || c.name.toLowerCase().includes("events"))
                    );

                    if (category) {
                        await category.delete();
                        logger.info(`Events category deleted (no more active events)`);
                    }
                } catch (error) {
                    logger.error("Error deleting events category:", error);
                }
            }
        }
        logger.info(`Event ${eventId} channel deleted after delay`);
    }, 60000); // 1 minute

    logger.info(`Event ${eventId} ended (${reason})`);
}

/**
 * Vérifie et termine les événements expirés
 */
export async function checkExpiredEvents(client: Client): Promise<void> {
    const eventsData = loadEventsData();
    const now = Date.now();

    for (const event of eventsData.activeEvents) {
        if (now >= event.endTime) {
            logger.info(`Event ${event.id} expired, ending...`);
            await endEvent(client, event.id);
        }
    }
}
