import {Client, EmbedBuilder, Guild, Message, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {endEvent, startEvent} from "./eventChannelManager";
import {checkSequenceAnswer, Sequence} from "./sequenceData";
import {generateOrFallbackSequence} from "./sequenceLLMGenerator";

const logger = createLogger("SequenceEvent");

const SEQUENCE_DURATION = 12 * 60 * 60 * 1000; // 12 heures (8h → 20h)
const HINT_DELAY = 4 * 60 * 60 * 1000; // Indice après 4 heures (à midi)
const CHANNEL_CLOSE_DELAY = 60 * 60 * 1000; // 1 heure après la fin pour fermer le salon

/**
 * Crée l'embed d'annonce de la suite logique
 */
function createSequenceAnnouncementEmbed(sequence: Sequence, endTime: number, isTest: boolean): EmbedBuilder {
    const difficultyEmoji = {
        'facile': '🟢',
        'moyen': '🟡',
        'difficile': '🔴'
    };

    return new EmbedBuilder()
        .setColor(0x3498DB) // Bleu
        .setTitle("🔢 SUITE LOGIQUE !")
        .setDescription(
            `Une suite logique est apparue ! Trouve le prochain élément pour gagner de l'XP !\n\n` +
            `**${sequence.sequence}**\n\n`
        )
        .addFields(
            {
                name: "💡 Comment jouer",
                value: "Utilise `/answer` pour soumettre ta réponse ! \nLes premiers à trouver gagnent le plus d'XP !",
                inline: false
            },
            {
                name: "📊 Difficulté",
                value: `${difficultyEmoji[sequence.difficulty]} ${sequence.difficulty.charAt(0).toUpperCase() + sequence.difficulty.slice(1)}`,
                inline: true
            },
            {
                name: "🏆 Récompenses",
                value: `🥇 1er: **${sequence.xpReward} XP**\n🥈 2ème: **${Math.floor(sequence.xpReward * 0.7)} XP**\n🥉 3ème: **${Math.floor(sequence.xpReward * 0.5)} XP**\n🎖️ Suivants: **${Math.floor(sequence.xpReward * 0.3)} XP**`,
                inline: true
            },
            {
                name: "⏰ Fin",
                value: `<t:${Math.floor(endTime / 1000)}:R>`,
                inline: true
            }
        )
        .setFooter({text: `Catégorie: ${sequence.category}${isTest ? ' • MODE TEST' : ''}`})
        .setTimestamp();
}

/**
 * Crée l'embed d'échec (temps écoulé)
 */
function createSequenceFailureEmbed(sequence: Sequence, leaderboard: Array<{ userId: string, time: number }>): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // Rouge
        .setTitle("⏰ ÉVÉNEMENT TERMINÉ !")
        .setDescription(
            `La suite logique du jour est maintenant terminée !\n\n` +
            `**La réponse était :** ${sequence.answer}`
        );

    // Ajouter le leaderboard si des gens ont répondu
    if (leaderboard.length > 0) {
        const sortedLeaderboard = leaderboard.sort((a, b) => a.time - b.time);

        let leaderboardText = `Félicitations aux ${leaderboard.length} participant(s) ! 🎉\n\n### 🏆 Leaderboard\n`;

        sortedLeaderboard.forEach((entry, index) => {
            const position = index + 1;
            const positionEmojis: { [key: number]: string } = {1: "🥇", 2: "🥈", 3: "🥉"};
            const emoji = positionEmojis[position] || `${position}.`;

            const minutes = Math.floor(entry.time / 60000);
            const seconds = Math.floor((entry.time % 60000) / 1000);
            const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            leaderboardText += `${emoji} <@${entry.userId}> - ${timeString}\n`;
        });

        embed.addFields({
            name: "📊 Classement Final",
            value: leaderboardText,
            inline: false
        });
    } else {
        embed.addFields({
            name: "📊 Résultat",
            value: "Personne n'a trouvé la réponse cette fois-ci. Mieux la prochaine fois !",
            inline: false
        });
    }

    return embed;
}

/**
 * Crée l'embed d'indice
 */
function createHintEmbed(hint: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xF39C12) // Orange
        .setTitle("💡 INDICE")
        .setDescription(hint)
        .setTimestamp();
}

/**
 * ÉVÉNEMENT : SUITE LOGIQUE
 * Une suite logique est proposée et les joueurs qui trouvent la réponse gagnent de l'XP (leaderboard)
 */
export async function startSequenceEvent(client: Client, guild: Guild, isTest: boolean = false): Promise<void> {
    try {
        // Générer une suite logique (LLM ou fallback)
        const sequence = await generateOrFallbackSequence();

        logger.info(`Starting sequence event with: "${sequence.sequence}" (Answer: ${sequence.answer})`);

        // Créer l'événement
        const result = await startEvent(
            client,
            guild,
            EventType.SEQUENCE,
            "🔢 Suite Logique",
            "suite-logique",
            "🔢",
            SEQUENCE_DURATION,
            {
                sequenceId: sequence.id,
                sequence: sequence.sequence,
                answer: sequence.answer,
                alternativeAnswers: sequence.alternativeAnswers || [],
                hint: sequence.hint,
                difficulty: sequence.difficulty,
                category: sequence.category,
                xpReward: sequence.xpReward,
                leaderboard: [] as Array<{ userId: string, username: string, time: number }>,
                attempts: [] as string[],
                isTest: isTest,
                hintShown: false
            },
            false,
            `🔢 Une suite logique est apparue ! Tout le monde peut participer et gagner de l'XP. Plus vous répondez vite, plus vous gagnez !`
        );

        if (!result) {
            logger.error("Failed to start sequence event");
            return;
        }

        const {eventId, channel} = result;
        const endTime = Date.now() + SEQUENCE_DURATION;

        // Envoyer la suite logique
        const sequenceEmbed = createSequenceAnnouncementEmbed(sequence, endTime, isTest);
        await channel.send({embeds: [sequenceEmbed]});

        logger.info(`Sequence event started! Sequence: "${sequence.sequence}", Answer: "${sequence.answer}", Duration: ${SEQUENCE_DURATION / 3600000} hours`);

        // Programmer l'indice après 4 heures
        setTimeout(async () => {
            try {
                const currentEventsData = loadEventsData();
                const currentEvent = currentEventsData.activeEvents.find(e => e.id === eventId);

                if (currentEvent && !currentEvent.data.hintShown) {
                    const hintEmbed = createHintEmbed(sequence.hint);
                    await channel.send({embeds: [hintEmbed]});

                    currentEvent.data.hintShown = true;
                    saveEventsData(currentEventsData);

                    logger.info(`Hint shown for sequence event ${eventId}`);
                }
            } catch (error) {
                logger.error("Error showing hint:", error);
            }
        }, HINT_DELAY);

        // Programmer la fin automatique après expiration
        setTimeout(async () => {
            await endSequenceEvent(client, eventId, guild);
        }, SEQUENCE_DURATION);

    } catch (error) {
        logger.error("Error starting sequence event:", error);
    }
}

/**
 * Gère une réponse à la suite logique via la commande /answer
 */
export async function handleSequenceAnswer(
    client: Client,
    userId: string,
    username: string,
    answer: string,
    channelId: string
): Promise<{
    correct: boolean;
    alreadySolved: boolean;
    position?: number;
    positionText?: string;
    positionEmoji?: string;
    xpEarned?: number;
    timeString?: string;
    isTest?: boolean;
} | null> {
    try {
        const eventsData = loadEventsData();
        const sequenceEvent = eventsData.activeEvents.find(e => e.type === EventType.SEQUENCE);

        if (!sequenceEvent) {
            return null;
        }

        if (sequenceEvent.data.leaderboard.some((entry: any) => entry.userId === userId)) {
            return {
                correct: false,
                alreadySolved: true
            };
        }

        if (!sequenceEvent.data.attempts.includes(userId)) {
            sequenceEvent.data.attempts.push(userId);
        }

        const sequence: Sequence = {
            id: sequenceEvent.data.sequenceId,
            sequence: sequenceEvent.data.sequence,
            answer: sequenceEvent.data.answer,
            alternativeAnswers: sequenceEvent.data.alternativeAnswers,
            hint: sequenceEvent.data.hint,
            difficulty: sequenceEvent.data.difficulty,
            category: sequenceEvent.data.category,
            xpReward: sequenceEvent.data.xpReward
        };

        const isCorrect = checkSequenceAnswer(sequence, answer);

        if (isCorrect) {
            const timeTaken = Date.now() - sequenceEvent.startTime;
            const position = sequenceEvent.data.leaderboard.length + 1;

            sequenceEvent.data.leaderboard.push({
                userId,
                username,
                time: timeTaken
            });

            saveEventsData(eventsData);

            let xpMultiplier: number;
            if (position === 1) xpMultiplier = 1.0;
            else if (position === 2) xpMultiplier = 0.7;
            else if (position === 3) xpMultiplier = 0.5;
            else xpMultiplier = 0.3;

            const xpEarned = Math.floor(sequence.xpReward * xpMultiplier);

            const minutes = Math.floor(timeTaken / 60000);
            const seconds = Math.floor((timeTaken % 60000) / 1000);
            const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            const positionEmojis: { [key: number]: string } = {
                1: "🥇",
                2: "🥈",
                3: "🥉"
            };
            const positionEmoji = positionEmojis[position] || "🎖️";
            const positionText = position === 1 ? "1er" : position === 2 ? "2ème" : position === 3 ? "3ème" : `${position}ème`;

            try {
                const channel = await client.channels.fetch(sequenceEvent.channelId) as TextChannel;
                if (channel) {
                    const publicVictoryEmbed = new EmbedBuilder()
                        .setColor(position === 1 ? 0xFFD700 : position === 2 ? 0xC0C0C0 : position === 3 ? 0xCD7F32 : 0x2ECC71)
                        .setDescription(
                            `${positionEmoji} <@${userId}> a trouvé la réponse ! (**${positionText}** en ${timeString})`
                        )
                        .setTimestamp();
                    await channel.send({embeds: [publicVictoryEmbed]});
                }
            } catch (error) {
                logger.error("Could not send public victory message:", error);
            }

            if (!sequenceEvent.data.isTest) {
                const channel = await client.channels.fetch(sequenceEvent.channelId) as TextChannel;
                await addXP(userId, username, xpEarned, channel, false);
            }

            logger.info(`Sequence solved by ${username} (${userId}) in ${timeTaken}ms - Position: ${position}, XP: ${xpEarned}`);

            return {
                correct: true,
                alreadySolved: false,
                position,
                positionText,
                positionEmoji,
                xpEarned,
                timeString,
                isTest: sequenceEvent.data.isTest
            };

        } else {
            saveEventsData(eventsData);
            return {
                correct: false,
                alreadySolved: false
            };
        }

    } catch (error) {
        logger.error("Error handling sequence answer:", error);
        return null;
    }
}

/**
 * Gère un message dans le salon de suite logique
 */
export async function handleSequenceMessage(client: Client, message: Message): Promise<void> {
    try {
        const eventsData = loadEventsData();
        const sequenceEvent = eventsData.activeEvents.find(e => e.type === EventType.SEQUENCE);

        if (!sequenceEvent || sequenceEvent.channelId !== message.channelId) {
            return;
        }

        if (message.author.bot) {
            return;
        }

        try {
            await message.delete();
            logger.debug(`Deleted message from ${message.author.username} in sequence channel`);
        } catch (error) {
            logger.warn("Could not delete message in sequence channel:", error);
        }

    } catch (error) {
        logger.error("Error handling sequence message:", error);
    }
}

/**
 * Termine l'événement de suite logique
 */
async function endSequenceEvent(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const event = eventsData.activeEvents.find(e => e.id === eventId);

    if (!event) {
        logger.warn(`Sequence event ${eventId} not found`);
        return;
    }

    const leaderboard = event.data.leaderboard || [];

    if (event.channelId) {
        try {
            const channel = guild.channels.cache.get(event.channelId) as TextChannel;
            if (channel) {
                const sequence: Sequence = {
                    id: event.data.sequenceId,
                    sequence: event.data.sequence,
                    answer: event.data.answer,
                    alternativeAnswers: event.data.alternativeAnswers,
                    hint: event.data.hint,
                    difficulty: event.data.difficulty,
                    category: event.data.category,
                    xpReward: event.data.xpReward
                };

                const failureEmbed = createSequenceFailureEmbed(sequence, leaderboard);
                await channel.send({embeds: [failureEmbed]});

                const closingEmbed = new EmbedBuilder()
                    .setColor(0x95A5A6)
                    .setTitle("⏰ Fermeture du salon")
                    .setDescription(`Ce salon sera fermé dans 1 heure.\n\nProfitez-en pour consulter les résultats !`)
                    .setTimestamp();
                await channel.send({embeds: [closingEmbed]});

                setTimeout(async () => {
                    logger.info(`Closing sequence channel ${event.channelId} after 1 hour delay`);
                    await endEvent(client, eventId, guild);
                }, CHANNEL_CLOSE_DELAY);

                logger.info(`Sequence event ${eventId} results posted. Channel will close in 1 hour.`);
                return;
            }
        } catch (error) {
            logger.error("Error sending end message:", error);
        }
    }

    await endEvent(client, eventId, guild);
    logger.info(`Sequence event ${eventId} ended. Participants: ${leaderboard.length}, Attempts: ${event.data.attempts.length}`);
}

