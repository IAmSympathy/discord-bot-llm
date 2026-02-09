import {CategoryChannel, ChannelType, Client, Guild, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, PermissionFlagsBits, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {loadEventsData, saveEventsData} from "./eventsDataManager";

const logger = createLogger("EventChannelManager");

/**
 * Trouve ou crée la catégorie d'événements
 */
async function getOrCreateEventsCategory(guild: Guild): Promise<string | null> {
    try {
        // Chercher une catégorie existante
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory &&
                c.name.toLowerCase() === "🔴 événement"
        );

        // Si elle existe déjà
        if (category) {
            logger.info(`Events category found: ${category.name} (ID: ${category.id})`);

            // Toujours la remettre en position 0
            try {
                const categoryChannel = category as CategoryChannel;
                await categoryChannel.setPosition(0);
                logger.info("Events category positioned at top");
            } catch (posError) {
                logger.error("Error positioning events category:", posError);
            }

            return category.id;
        }

        // Si elle n'existe pas, la créer
        logger.info("Creating new events category...");

        category = await guild.channels.create({
            name: "🔴 ÉVÉNEMENT",
            type: ChannelType.GuildCategory,
            position: 0, // Créer directement en position 0
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    allow: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: guild.members.me!.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        });

        logger.info(`Events category created: ${category.name} (ID: ${category.id})`);

        // Double vérification du positionnement
        try {
            const categoryChannel = category as CategoryChannel;
            await categoryChannel.setPosition(0);
            logger.info("Events category positioned at top (double check)");
        } catch (posError) {
            logger.warn("Could not reposition category:", posError);
        }

        return category.id;

    } catch (error) {
        logger.error("Error in getOrCreateEventsCategory:", error);
        return null;
    }
}

/**
 * Crée un canal d'événement
 * @param guild - Le serveur Discord
 * @param name - Le nom du canal (sans emoji)
 * @param emoji - L'emoji à afficher avant le nom
 * @param allowMessages - Si true, les utilisateurs peuvent envoyer des messages (pour les boss)
 */
export async function createEventChannel(guild: Guild, name: string, emoji: string, allowMessages: boolean = false): Promise<TextChannel | null> {
    try {
        // Obtenir l'ID de la catégorie
        const categoryId = await getOrCreateEventsCategory(guild);

        if (!categoryId) {
            logger.error("Could not get or create events category!");
            return null;
        }

        logger.info(`Creating event channel "${name}" in category ${categoryId}...`);

        // Forcer le refresh de la catégorie depuis Discord
        let category = await guild.channels.fetch(categoryId, {force: true}) as CategoryChannel;
        if (!category) {
            logger.error(`Category ${categoryId} not found!`);
            return null;
        }

        logger.info(`Category found: ${category.name} (ID: ${category.id}, Type: ${category.type})`);

        // Vérifier que le bot a les permissions nécessaires sur la catégorie
        const botMember = guild.members.me;
        if (botMember) {
            const permissions = category.permissionsFor(botMember);
            const hasManageChannels = permissions?.has(PermissionFlagsBits.ManageChannels);
            const hasViewChannel = permissions?.has(PermissionFlagsBits.ViewChannel);
            logger.info(`Bot permissions on category - ManageChannels: ${hasManageChannels}, ViewChannel: ${hasViewChannel}`);

            if (!hasManageChannels) {
                logger.error(`❌ Bot does NOT have ManageChannels permission on category!`);
            }
        }

        // MÉTHODE 1: Créer avec guild.channels.create et parent explicite
        logger.info("Attempting to create channel with parent parameter...");
        const channel = await guild.channels.create({
            name: `${emoji}┃${name}`,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    allow: allowMessages
                        ? [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        : [PermissionFlagsBits.ViewChannel],
                    deny: allowMessages
                        ? []
                        : [PermissionFlagsBits.SendMessages]
                },
                {
                    id: guild.members.me!.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.AddReactions,
                        PermissionFlagsBits.UseExternalEmojis,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        }) as TextChannel;

        logger.info(`Channel created: ${channel.name} (ID: ${channel.id})`);

        // Attendre un peu pour Discord
        await new Promise(resolve => setTimeout(resolve, 500));

        // Forcer un refresh du canal
        const refreshedChannel = await guild.channels.fetch(channel.id, {force: true}) as TextChannel;
        logger.info(`After refresh - Parent ID: ${refreshedChannel.parentId} (expected: ${categoryId})`);

        // Si le parent n'est toujours pas correct, forcer avec setParent
        if (refreshedChannel.parentId !== categoryId) {
            logger.warn(`⚠️ Parent not set correctly! Attempting to force with setParent...`);
            try {
                await refreshedChannel.setParent(categoryId, {lockPermissions: false});
                logger.info(`setParent called successfully`);

                // Attendre et re-vérifier
                await new Promise(resolve => setTimeout(resolve, 300));
                const finalCheck = await guild.channels.fetch(channel.id, {force: true}) as TextChannel;

                if (finalCheck.parentId === categoryId) {
                    logger.info(`✅ SUCCESS: Channel is now inside category! Parent: ${finalCheck.parentId}`);
                } else {
                    logger.error(`❌ FAILED: Channel parent still incorrect! Expected: ${categoryId}, Got: ${finalCheck.parentId}`);
                    logger.error(`❌ This is likely a Discord API issue or bot permission problem`);
                }
            } catch (error) {
                logger.error(`❌ setParent failed:`, error);
            }
        } else {
            logger.info(`✅ SUCCESS: Channel created inside category! Parent: ${refreshedChannel.parentId}`);
        }

        return refreshedChannel;
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
 * Programme la suppression d'un canal d'événement et de la catégorie si nécessaire
 * @param guild - Le serveur Discord
 * @param channelId - L'ID du canal à supprimer
 * @param delayMs - Délai en millisecondes avant la suppression (défaut: 300000 = 5 minutes)
 */
export async function scheduleEventChannelDeletion(guild: Guild, channelId: string, delayMs: number = 300000): Promise<void> {
    setTimeout(async () => {
        await deleteEventChannel(guild, channelId);

        // Recharger les données pour vérifier s'il reste des événements actifs
        const eventsData = loadEventsData();
        const hasRemainingEvents = eventsData.activeEvents.length > 0;

        // Si c'était le dernier événement, supprimer aussi la catégorie
        if (!hasRemainingEvents) {
            try {
                const category = guild.channels.cache.find(
                    c => c.type === ChannelType.GuildCategory &&
                        c.name.toLowerCase() === "🔴 événement"
                );

                if (category) {
                    await category.delete();
                    logger.info(`Events category deleted (no more active events)`);
                }
            } catch (error) {
                logger.error("Error deleting events category:", error);
            }
        }
    }, delayMs);

    logger.info(`Event channel ${channelId} scheduled for deletion in ${delayMs}ms`);
}

/**
 * Démarre un nouvel événement en créant le salon et en l'enregistrant
 * @param client - Le client Discord
 * @param guild - Le serveur Discord
 * @param eventType - Le type d'événement
 * @param eventName - Le nom de l'événement
 * @param channelName - Le nom du canal (sans emoji)
 * @param channelEmoji - L'emoji du canal
 * @param duration - La durée de l'événement en millisecondes
 * @param eventData - Les données spécifiques à l'événement
 * @param allowMessages - Si true, les utilisateurs peuvent envoyer des messages (pour les boss)
 * @param eventDescription - Description personnalisée pour l'événement Discord programmé
 * @returns L'ID de l'événement et le canal créé, ou null si échec
 */
export async function startEvent(
    client: Client,
    guild: Guild,
    eventType: string,
    eventName: string,
    channelName: string,
    channelEmoji: string,
    duration: number,
    eventData: any,
    allowMessages: boolean = false,
    eventDescription?: string
): Promise<{ eventId: string; channel: TextChannel; scheduledEvent?: any } | null> {
    try {
        // Créer le canal d'événement
        const channel = await createEventChannel(guild, channelName, channelEmoji, allowMessages);
        if (!channel) {
            logger.error(`Failed to create event channel for ${eventType}`);
            return null;
        }

        // Calculer les temps
        // Ajouter 10 secondes à la date de début pour éviter l'erreur Discord "événement dans le passé"
        const startTime = new Date(Date.now() + 10000); // +10 secondes
        const endTime = new Date(Date.now() + duration);
        const eventId = `${eventType}_${Date.now()}`;

        // Créer un événement Discord programmé
        let scheduledEvent;
        try {
            const eventName = `${channelEmoji} ${channelName.charAt(0).toUpperCase() + channelName.slice(1)}`;
            const description = eventDescription || `Événement aléatoire : ${eventName}`;

            scheduledEvent = await guild.scheduledEvents.create({
                name: eventName,
                description: description,
                scheduledStartTime: startTime,
                scheduledEndTime: endTime,
                privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                entityType: GuildScheduledEventEntityType.External,
                entityMetadata: {
                    location: `<#${channel.id}>`
                }
            });

            logger.info(`Discord scheduled event created: ${scheduledEvent.id}`);
        } catch (eventError) {
            logger.error("Error creating Discord scheduled event (non-critical):", eventError);
            // Continuer même si la création de l'événement Discord échoue
        }

        // Enregistrer l'événement dans notre système
        const eventsData = loadEventsData();
        eventsData.activeEvents.push({
            id: eventId,
            type: eventType as any,
            channelId: channel.id,
            startTime: Date.now(),
            endTime: endTime.getTime(),
            data: {
                ...eventData,
                scheduledEventId: scheduledEvent?.id
            }
        });
        saveEventsData(eventsData);

        logger.info(`Event ${eventType} started with ID ${eventId}, duration: ${duration / 60000} minutes`);

        return {eventId, channel, scheduledEvent};
    } catch (error) {
        logger.error(`Error starting event ${eventType}:`, error);
        return null;
    }
}

/**
 * Termine un événement
 * @param client - Le client Discord
 * @param eventId - L'ID de l'événement à terminer
 * @param guild - Le serveur Discord où l'événement a lieu
 * @param reason - La raison de la fin ("expired" ou "completed")
 * @param channelCloseDelayMs - Délai avant fermeture du salon en ms (défaut: 300000 = 5 minutes)
 */
export async function endEvent(
    client: Client,
    eventId: string,
    guild: Guild,
    reason: "expired" | "completed" = "expired",
    channelCloseDelayMs: number = 300000
): Promise<void> {
    const eventsData = loadEventsData();
    const eventIndex = eventsData.activeEvents.findIndex(e => e.id === eventId);

    if (eventIndex === -1) {
        logger.warn(`Event ${eventId} not found`);
        return;
    }

    const event = eventsData.activeEvents[eventIndex];

    // Supprimer l'événement Discord programmé s'il existe
    if (event.data?.scheduledEventId) {
        try {
            const scheduledEvent = await guild.scheduledEvents.fetch(event.data.scheduledEventId);
            if (scheduledEvent) {
                await scheduledEvent.delete("Event ended");
                logger.info(`Discord scheduled event ${event.data.scheduledEventId} deleted`);
            }
        } catch (error) {
            logger.error("Error deleting Discord scheduled event:", error);
            // Continuer même si la suppression échoue
        }
    }

    // Retirer de la liste des événements actifs
    eventsData.activeEvents.splice(eventIndex, 1);
    const hasRemainingEvents = eventsData.activeEvents.length > 0;
    saveEventsData(eventsData);

    // Supprimer le canal après le délai spécifié
    setTimeout(async () => {
        await deleteEventChannel(guild, event.channelId);

        // Si c'était le dernier événement, supprimer aussi la catégorie
        if (!hasRemainingEvents) {
            try {
                const category = guild.channels.cache.find(
                    c => c.type === ChannelType.GuildCategory &&
                        c.name.toLowerCase() === "🔴 événement"
                );

                if (category) {
                    await category.delete();
                    logger.info(`Events category deleted (no more active events)`);
                }
            } catch (error) {
                logger.error("Error deleting events category:", error);
            }
        }
        logger.info(`Event ${eventId} channel deleted after ${channelCloseDelayMs}ms delay`);
    }, channelCloseDelayMs);

    logger.info(`Event ${eventId} ended (${reason}) - channel will close in ${channelCloseDelayMs}ms`);
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

            // Trouver le guild où l'événement a lieu
            for (const guild of client.guilds.cache.values()) {
                const channel = guild.channels.cache.get(event.channelId);
                if (channel) {
                    await endEvent(client, event.id, guild);
                    break;
                }
            }
        }
    }
}
