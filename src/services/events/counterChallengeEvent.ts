import {Client, EmbedBuilder, Guild, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {createEventChannel, endEvent} from "./eventChannelManager";

const logger = createLogger("CounterChallenge");

/**
 * ÉVÉNEMENT : COMPTEUR CHALLENGE
 * Les utilisateurs doivent atteindre un nombre spécifique dans le compteur avant la fin du temps
 */
export async function startCounterChallenge(client: Client, guild: Guild, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Vérifier qu'il n'y a pas déjà un événement compteur actif
        if (eventsData.activeEvents.some(e => e.type === EventType.COUNTER_CHALLENGE)) {
            logger.info("Counter challenge already active, skipping");
            return;
        }

        // Générer un objectif aléatoire (entre 100 et 250 au-dessus du compteur actuel)
        const {getCurrentCount} = require("./counterService");
        const currentCount = getCurrentCount();
        const targetCount = currentCount + Math.floor(Math.random() * 151) + 100; // +100 à +250

        // Durée : 30 minutes
        const duration = 30 * 60 * 1000;
        const endTime = Date.now() + duration;

        // Créer le canal d'événement
        const channel = await createEventChannel(guild, "défi-compteur", "🎯");
        if (!channel) {
            logger.error("Failed to create counter challenge channel");
            return;
        }

        // Créer l'embed des règles
        const rulesEmbed = new EmbedBuilder()
            .setColor(0xF6AD55)
            .setTitle("🎯 DÉFI DU COMPTEUR !")
            .setDescription(
                `Un défi temporaire vient d'apparaître !\n\n` +
                `**Objectif :** Atteindre **${targetCount}** dans le compteur !\n` +
                `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n` +
                `**Récompense :** Le premier à atteindre exactement ${targetCount} gagne **500 XP** 💫 !\n\n` +
                `**État actuel :** Le compteur est à **${currentCount}**\n` +
                `**Progression :** 0/${targetCount - currentCount} nombres restants\n\n` +
                `🏃 Rendez-vous dans <#${require("../utils/envConfig").EnvConfig.COUNTER_CHANNEL_ID}> et commencez à compter !\n\n` +
                `*Cet événement se terminera automatiquement dans 30 minutes ou dès que l'objectif est atteint.*` +
                (isTest ? "\n\n⚠️ *Ceci est un événement de TEST. Les récompenses réelles ne seront pas distribuées.*" : "")
            )
            .setFooter({text: "Bonne chance ! 🍀"})
            .setTimestamp();

        // Envoyer les règles dans le canal d'événement (sans ping)
        await channel.send({embeds: [rulesEmbed]});

        // Envoyer une annonce dans le salon général
        const generalChannelId = require("../utils/envConfig").EnvConfig.WELCOME_CHANNEL_ID;
        if (generalChannelId) {
            try {
                const generalChannel = guild.channels.cache.get(generalChannelId) as TextChannel;
                if (generalChannel) {
                    const announcementEmbed = new EmbedBuilder()
                        .setColor(0xF6AD55)
                        .setTitle("🎯 Nouvel Événement : Défi du Compteur !")
                        .setDescription(
                            `Un événement temporaire vient d'apparaître !\n\n` +
                            `**Objectif :** Atteindre **${targetCount}** dans le compteur\n` +
                            `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n` +
                            `**Récompense :** 500 XP pour le gagnant 💎\n\n` +
                            `📋 Consultez les détails dans <#${channel.id}>\n` +
                            `🏃 Participez dans <#${require("../utils/envConfig").EnvConfig.COUNTER_CHANNEL_ID}>`
                        )
                        .setTimestamp();

                    await generalChannel.send({embeds: [announcementEmbed]});
                    logger.info("Event announcement sent to general channel");
                }
            } catch (error) {
                logger.error("Error sending event announcement:", error);
            }
        }

        // Enregistrer l'événement
        const eventId = `counter_${Date.now()}`;
        eventsData.activeEvents.push({
            id: eventId,
            type: EventType.COUNTER_CHALLENGE,
            channelId: channel.id,
            startTime: Date.now(),
            endTime: endTime,
            data: {
                targetCount: targetCount,
                startCount: currentCount,
                winnerId: null,
                isTest: isTest // Marquer si c'est un test
            }
        });
        saveEventsData(eventsData);

        logger.info(`Counter challenge started! Target: ${targetCount}, Duration: 30 minutes`);

        // Programmer la fin automatique après 30 minutes
        setTimeout(async () => {
            await endEvent(client, eventId, "expired");
        }, duration);

    } catch (error) {
        logger.error("Error starting counter challenge:", error);
    }
}

/**
 * Vérifie si le compteur a atteint l'objectif du défi
 */
export async function checkCounterChallengeProgress(
    client: Client,
    userId: string,
    username: string,
    newCount: number
): Promise<void> {
    const eventsData = loadEventsData();
    const counterEvent = eventsData.activeEvents.find(e => e.type === EventType.COUNTER_CHALLENGE);

    if (!counterEvent || counterEvent.data.winnerId) {
        return; // Pas d'événement actif ou déjà gagné
    }

    // Vérifier si l'objectif est atteint
    if (newCount === counterEvent.data.targetCount) {
        logger.info(`Counter challenge completed by ${username} at ${newCount}!`);

        // Marquer le gagnant
        counterEvent.data.winnerId = userId;
        saveEventsData(eventsData);

        // Trouver le canal de l'événement
        for (const guild of client.guilds.cache.values()) {
            const channel = guild.channels.cache.get(counterEvent.channelId) as TextChannel;
            if (channel) {
                // Annoncer le gagnant
                const winEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle("🏆 DÉFI COMPLÉTÉ !")
                    .setDescription(
                        `🎉 **<@${userId}>** a atteint l'objectif de **${counterEvent.data.targetCount}** !\n\n` +
                        `**Récompense :** 500 XP 💎\n\n` +
                        `*Le salon se fermera dans 1 minute...*`
                    )
                    .setTimestamp();

                await channel.send({embeds: [winEmbed]});

                // Donner l'XP au gagnant (sauf si c'est un test)
                if (!counterEvent.data.isTest) {
                    const counterChannel = guild.channels.cache.get(require("../utils/envConfig").EnvConfig.COUNTER_CHANNEL_ID);
                    if (counterChannel && (counterChannel instanceof TextChannel)) {
                        await addXP(userId, username, 500, counterChannel, false);
                    }
                } else {
                    logger.info("Test mode: XP reward skipped");
                }

                // Ajouter à l'historique
                eventsData.history.push({
                    eventId: counterEvent.id,
                    type: EventType.COUNTER_CHALLENGE,
                    timestamp: Date.now(),
                    participants: [userId],
                    winners: [userId]
                });
                saveEventsData(eventsData);

                // Fermer l'événement après 60 secondes (complété avec succès)
                setTimeout(async () => {
                    await endEvent(client, counterEvent.id, "completed");
                }, 60000);

                break;
            }
        }
    }
}
