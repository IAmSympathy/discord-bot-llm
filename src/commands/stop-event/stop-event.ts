import {ChannelType, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {hasOwnerPermission} from "../../utils/permissions";
import {loadEventsData, saveEventsData} from "../../services/events/eventsDataManager";
import {deleteEventChannel} from "../../services/events/eventChannelManager";
import {replyWithError} from "../../utils/interactionUtils";

const logger = createLogger("StopEventCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop-event")
        .setDescription("[TAH-UM] 🛑 Arrête un événement aléatoire en cours")
        .addStringOption(option =>
            option
                .setName("event-id")
                .setDescription("ID de l'événement à arrêter (laisser vide pour voir la liste)")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // Vérifier que c'est l'owner
        const member = interaction.member instanceof GuildMember ? interaction.member : null;
        if (!hasOwnerPermission(member)) {
            await replyWithError(
                interaction,
                "Permission refusée",
                "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                true
            );
            return;
        }

        const eventId = interaction.options.getString("event-id");
        const eventsData = loadEventsData();

        // Si pas d'ID fourni, afficher la liste
        if (!eventId) {
            if (eventsData.activeEvents.length === 0) {
                await interaction.reply({
                    content: "ℹ️ Aucun événement actif en ce moment.",
                    ephemeral: true
                });
                return;
            }

            let eventList = "📋 **Événements actifs :**\n\n";
            eventsData.activeEvents.forEach(event => {
                const endTime = Math.floor(event.endTime / 1000);
                eventList += `• **${event.type}** (ID: \`${event.id}\`)\n`;
                eventList += `  Fin prévue: <t:${endTime}:R>\n`;
                if (event.channelId) {
                    eventList += `  Salon: <#${event.channelId}>\n`;
                }
                eventList += `\n`;
            });

            eventList += `\nUtilise \`/stop-event event-id:<ID>\` pour arrêter un événement.`;

            await interaction.reply({
                content: eventList,
                ephemeral: true
            });
            return;
        }

        // Trouver l'événement
        const eventIndex = eventsData.activeEvents.findIndex(e => e.id === eventId);

        if (eventIndex === -1) {
            await interaction.reply({
                content: `❌ Événement introuvable avec l'ID \`${eventId}\`.`,
                ephemeral: true
            });
            return;
        }

        const event = eventsData.activeEvents[eventIndex];

        // Supprimer le canal si existant
        if (event.channelId && interaction.guild) {
            await deleteEventChannel(interaction.guild, event.channelId);
        }

        // Supprimer l'événement Discord programmé s'il existe
        if (event.data?.scheduledEventId && interaction.guild) {
            try {
                const scheduledEvent = await interaction.guild.scheduledEvents.fetch(event.data.scheduledEventId);
                if (scheduledEvent) {
                    await scheduledEvent.delete("Event ended");
                    logger.info(`Discord scheduled event ${event.data.scheduledEventId} deleted`);
                }
            } catch (error) {
                logger.error("Error deleting Discord scheduled event:", error);
                // Continuer même si la suppression échoue
            }
        }


        // Retirer de la liste
        eventsData.activeEvents.splice(eventIndex, 1);

        // Vérifier s'il reste des événements actifs
        const hasRemainingEvents = eventsData.activeEvents.length > 0;

        // Nettoyer les données spécifiques selon le type
        if (event.type === "impostor" && eventsData.impostorGuesses && eventsData.impostorGuesses[eventId]) {
            delete eventsData.impostorGuesses[eventId];
        }

        saveEventsData(eventsData);

        // Si c'était le dernier événement, supprimer la catégorie
        if (!hasRemainingEvents && interaction.guild) {
            try {
                const category = interaction.guild.channels.cache.find(
                    c => c.type === ChannelType.GuildCategory &&
                        c.name.toLowerCase() === "🔴 événement");

                if (category) {
                    await category.delete();
                    logger.info(`Events category deleted (no more active events)`);
                }
            } catch (error) {
                logger.error("Error deleting events category:", error);
            }
        }

        logger.info(`Event ${eventId} (${event.type}) stopped by owner ${interaction.user.username}`);

        await interaction.reply({
            content: `✅ L'événement **${event.type}** (ID: \`${eventId}\`) a été arrêté avec succès.\n` +
                `Le canal a été supprimé.${!hasRemainingEvents ? "\nLa catégorie d'événements a également été supprimée." : ""}`,
            ephemeral: true
        });
    }
};
