import {AttachmentBuilder, Client, EmbedBuilder, Guild, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {endEvent, startEvent} from "./eventChannelManager";
import {EnvConfig} from "../../utils/envConfig";
import * as path from "path";

const logger = createLogger("CounterChallenge");

// ========== CONSTANTES ==========

/**
 * Durée de l'événement en millisecondes (30 minutes)
 */
const EVENT_DURATION = 30 * 60 * 1000;

/**
 * Récompense XP pour le gagnant (réduit de 500 à 350 pour équilibrage)
 */
const WINNER_XP_REWARD = 350;

/**
 * Objectif minimum à ajouter au compteur actuel
 */
const MIN_TARGET_ADDITION = 50;

/**
 * Objectif maximum à ajouter au compteur actuel
 */
const MAX_TARGET_ADDITION = 125;

// ========== FONCTIONS UTILITAIRES ==========

/**
 * Crée l'embed d'annonce pour le salon d'événement
 */
function createEventAnnouncementEmbed(targetCount: number, currentCount: number, endTime: number, isTest: boolean): EmbedBuilder {
    // Calculer la fourchette (±5 autour de la cible)
    const rangeMin = Math.max(currentCount + 1, targetCount - 5);
    const rangeMax = targetCount + 5;

    return new EmbedBuilder()
        .setColor(0xF6AD55)
        .setTitle("🎯 DÉFI DU COMPTEUR !")
        .setThumbnail("attachment://event_count_badge.png")
        .setDescription(
            `Un événement mystérieux vient d'apparaître !\n\n` +
            `**Objectif :** Atteindre un nombre **secret** dans le compteur !\n` +
            `**Cible :** Le nombre est entre **${rangeMin}** et **${rangeMax}** 🤫\n` +
            `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n` +
            `**Récompense :** Le premier à atteindre le nombre secret gagne **${WINNER_XP_REWARD} XP** 💫 !\n\n` +
            `**État actuel :** Le compteur est à **${currentCount}**\n\n` +
            `🏃 Rendez-vous dans <#${EnvConfig.COUNTER_CHANNEL_ID}> et commencez à compter !\n\n` +
            (isTest ? "\n⚠️ *Ceci est un événement de TEST. Les récompenses réelles ne seront pas distribuées.*" : "")
        )
        .setFooter({text: "Bonne chance ! 🍀"})
        .setTimestamp();
}


/**
 * Crée l'embed de victoire
 */
function createVictoryEmbed(userId: string, targetCount: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x57F287) // Vert
        .setTitle("🏆 DÉFI COMPLÉTÉ !")
        .setDescription(
            `🎉 **<@${userId}>** a atteint l'objectif de **${targetCount}** !\n\n` +
            `**Récompense :** ${WINNER_XP_REWARD} XP 💫`
        )
        .setFooter({text: "Le salon se fermera dans 5 minutes..."})
        .setTimestamp();

}

// ========== FONCTIONS PRINCIPALES ==========

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

        // Générer un objectif aléatoire
        const {getCurrentCount} = require("../counterService");
        const currentCount = getCurrentCount();
        const targetCount = currentCount + Math.floor(Math.random() * (MAX_TARGET_ADDITION - MIN_TARGET_ADDITION + 1)) + MIN_TARGET_ADDITION;

        // Créer et enregistrer l'événement via l'event manager
        const result = await startEvent(
            client,
            guild,
            EventType.COUNTER_CHALLENGE,
            "🎯 Défi du Compteur",
            "défi-compteur",
            "🎯",
            EVENT_DURATION,
            {
                targetCount: targetCount,
                startCount: currentCount,
                winnerId: null,
                isTest: isTest
            },
            false,
            `Atteignez le nombre ${targetCount} dans le compteur avant la fin du temps ! Le premier à atteindre ce nombre gagnera de l'XP.`
        );

        if (!result) {
            logger.error("Failed to start counter challenge");
            return;
        }

        const {eventId, channel} = result;
        const endTime = Date.now() + EVENT_DURATION;

        // Créer l'attachment pour le badge
        const badgePath = path.join(process.cwd(), "assets", "event_count_badge.png");
        const badgeAttachment = new AttachmentBuilder(badgePath, {name: "event_count_badge.png"});

        // Envoyer les règles dans le canal d'événement avec le badge
        const rulesEmbed = createEventAnnouncementEmbed(targetCount, currentCount, endTime, isTest);
        await channel.send({embeds: [rulesEmbed], files: [badgeAttachment]});

        logger.info(`Counter challenge started! Target: ${targetCount}, Duration: ${EVENT_DURATION / 60000} minutes`);

        // Programmer la fin automatique après expiration
        setTimeout(async () => {
            await endCounterChallenge(client, eventId, guild);
        }, EVENT_DURATION);

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

    // Ajouter le participant à la liste (s'il n'y est pas déjà)
    if (!counterEvent.data.participants) {
        counterEvent.data.participants = [];
    }
    if (!counterEvent.data.participants.includes(userId)) {
        counterEvent.data.participants.push(userId);
        saveEventsData(eventsData);
    }

    // Vérifier si l'objectif est atteint
    if (newCount === counterEvent.data.targetCount) {
        logger.info(`Counter challenge completed by ${username} at ${newCount}!`);

        // Marquer le gagnant
        counterEvent.data.winnerId = userId;

        // Ajouter le participant à la liste (s'il n'y est pas déjà)
        if (!counterEvent.data.participants) {
            counterEvent.data.participants = [];
        }
        if (!counterEvent.data.participants.includes(userId)) {
            counterEvent.data.participants.push(userId);
        }

        saveEventsData(eventsData);

        // Trouver le canal de l'événement et annoncer le gagnant
        for (const guild of client.guilds.cache.values()) {
            const channel = guild.channels.cache.get(counterEvent.channelId) as TextChannel;
            if (channel) {
                // Annoncer le gagnant avec ping de tous les participants
                const winEmbed = createVictoryEmbed(userId, counterEvent.data.targetCount);
                const participantPings = counterEvent.data.participants.map((id: string) => `<@${id}>`).join(' ');
                await channel.send({
                    content: participantPings,
                    embeds: [winEmbed]
                });

                // Donner l'XP au gagnant (sauf si c'est un test)
                if (!counterEvent.data.isTest) {
                    if (EnvConfig.COUNTER_CHANNEL_ID) {
                        const counterChannel = guild.channels.cache.get(EnvConfig.COUNTER_CHANNEL_ID);
                        if (counterChannel && (counterChannel instanceof TextChannel)) {
                            await addXP(userId, username, WINNER_XP_REWARD, counterChannel, false);
                            logger.info(`${username} gained ${WINNER_XP_REWARD} XP for completing counter challenge`);
                        }
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

                // Terminer l'événement avec un délai de 5 minutes (géré par l'event manager)
                await endEvent(client, counterEvent.id, guild, "completed", 300000); // 5 minutes

                break;
            }
        }
    }
}

/**
 * Termine l'événement Counter Challenge
 * Envoie un message d'expiration si l'événement n'est pas complété
 */
async function endCounterChallenge(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const event = eventsData.activeEvents.find(e => e.id === eventId);

    if (!event) {
        logger.warn(`Counter challenge ${eventId} not found`);
        return;
    }

    const isCompleted = !!event.data.winnerId;

    // Si pas complété, envoyer un message d'expiration avant de terminer
    if (!isCompleted && event.channelId) {
        try {
            const channel = guild.channels.cache.get(event.channelId) as TextChannel;
            if (channel) {
                const expiredEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("⏰ TEMPS ÉCOULÉ !")
                    .setDescription(
                        `Le temps est écoulé ! Personne n'a atteint l'objectif de **${event.data.targetCount}**.\n\n` +
                        `Mieux vaut être plus rapide la prochaine fois ! 🏃`
                    )
                    .setFooter({text: "Le salon se fermera dans 5 minutes..."})
                    .setTimestamp();

                // Ping tous les participants s'il y en a
                const participants = event.data.participants || [];
                const content = participants.length > 0
                    ? participants.map((id: string) => `<@${id}>`).join(' ')
                    : undefined;

                await channel.send({
                    content: content,
                    embeds: [expiredEmbed]
                });
            }
        } catch (error) {
            logger.error("Error sending expiration message:", error);
        }
    }

    // Terminer l'événement via l'event manager (qui gère la fermeture du salon)
    await endEvent(client, eventId, guild, isCompleted ? "completed" : "expired");
}

