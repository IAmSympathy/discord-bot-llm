import {ChannelType, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {CommandPermissions, hasOwnerPermission} from "../../utils/permissions";
import {loadEventsData, saveEventsData} from "../../services/events/eventsDataManager";
import {deleteEventChannel} from "../../services/events/eventChannelManager";
import {replyWithError} from "../../utils/interactionUtils";

const logger = createLogger("StopEventCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop-event")
        .setDescription("[TAH-UM] 🛑 Arrête l'événement aléatoire en cours")
        .setDefaultMemberPermissions(CommandPermissions.OWNER_ONLY),

    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member instanceof GuildMember ? interaction.member : null;
        if (!hasOwnerPermission(member)) {
            await replyWithError(interaction, "Permission refusée", "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*", true);
            return;
        }

        const eventsData = loadEventsData();

        if (eventsData.activeEvents.length === 0) {
            await interaction.reply({content: "ℹ️ Aucun événement actif en ce moment.", ephemeral: true});
            return;
        }

        const event = eventsData.activeEvents[0];
        const eventId = event.id;
        const eventType = event.type;

        if (event.channelId && interaction.guild) {
            await deleteEventChannel(interaction.guild, event.channelId);
        }

        if (event.data?.scheduledEventId && interaction.guild) {
            try {
                const scheduledEvent = await interaction.guild.scheduledEvents.fetch(event.data.scheduledEventId);
                if (scheduledEvent) {
                    await scheduledEvent.delete("Event ended");
                    logger.info(`Discord scheduled event ${event.data.scheduledEventId} deleted`);
                }
            } catch (error) {
                logger.error("Error deleting Discord scheduled event:", error);
            }
        }

        eventsData.activeEvents = [];

        if (event.type === "impostor" && eventsData.impostorGuesses && eventsData.impostorGuesses[eventId]) {
            delete eventsData.impostorGuesses[eventId];
        }

        if (!eventsData.history) {
            eventsData.history = [];
        }
        eventsData.history.push({
            ...event,
            endedAt: Date.now(),
            endReason: "Manual stop"
        } as any);

        saveEventsData(eventsData);

        if (interaction.guild) {
            try {
                const category = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "🔴 événement");
                if (category) {
                    await category.delete();
                    logger.info(`Events category deleted`);
                }
            } catch (error) {
                logger.error("Error deleting events category:", error);
            }
        }

        logger.info(`Event ${eventId} (${eventType}) stopped by owner ${interaction.user.username}`);

        await interaction.reply({
            content: `✅ L'événement **${eventType}** a été arrêté avec succès.\nLe canal et la catégorie ont été supprimés.`,
            ephemeral: true
        });
    }
};
