import {Client, EmbedBuilder, Guild, Message, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {endEvent, startEvent} from "./eventChannelManager";
import {checkAnswer, Riddle} from "./riddleData";
import {generateOrFallbackRiddle} from "./riddleLLMGenerator";

const logger = createLogger("RiddleEvent");

const RIDDLE_DURATION = 12 * 60 * 60 * 1000; // 12 heures (8h → 20h)
const HINT_DELAY = 4 * 60 * 60 * 1000; // Indice après 4 heures (à midi)
const CHANNEL_CLOSE_DELAY = 60 * 60 * 1000; // 1 heure après la fin pour fermer le salon

/**
 * Crée l'embed d'annonce de l'énigme
 */
function createRiddleAnnouncementEmbed(riddle: Riddle, endTime: number, isTest: boolean): EmbedBuilder {
    const difficultyEmoji = {
        'facile': '🟢',
        'moyen': '🟡',
        'difficile': '🔴'
    };

    return new EmbedBuilder()
        .setColor(0x73A955) // vert
        .setTitle("🧩 ÉNIGME DU JOUR !")
        .setDescription(
            `Une énigme est apparue ! Trouvez la réponse pour gagner de l'XP !\n\n` +
            `**${riddle.question}**\n\n`
        )
        .addFields(
            {
                name: "💡 Comment jouer",
                value: "Utilise `/answer` pour soumettre ta réponse ! \nLes premiers à trouver gagnent le plus d'XP !",
                inline: false
            },
            {
                name: "📊 Difficulté",
                value: `${difficultyEmoji[riddle.difficulty]} ${riddle.difficulty.charAt(0).toUpperCase() + riddle.difficulty.slice(1)}`,
                inline: true
            },
            {
                name: "🏆 Récompenses",
                value: `🥇 1er: **${riddle.xpReward} XP**\n🥈 2ème: **${Math.floor(riddle.xpReward * 0.7)} XP**\n🥉 3ème: **${Math.floor(riddle.xpReward * 0.5)} XP**\n🎖️ Suivants: **${Math.floor(riddle.xpReward * 0.3)} XP**`,
                inline: true
            },
            {
                name: "⏰ Fin",
                value: `<t:${Math.floor(endTime / 1000)}:R>`,
                inline: true
            }
        )
        .setFooter({text: `Catégorie: ${riddle.category}${isTest ? ' • MODE TEST' : ''}`})
        .setTimestamp();
}

/**
 * Crée l'embed de victoire
 */
function createRiddleVictoryEmbed(riddle: Riddle, winner: string, position: number, xpEarned: number, timeTaken: number, isTest: boolean): EmbedBuilder {
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

    return new EmbedBuilder()
        .setColor(position === 1 ? 0xFFD700 : position === 2 ? 0xC0C0C0 : position === 3 ? 0xCD7F32 : 0x2ECC71)
        .setTitle(`${positionEmoji} BONNE RÉPONSE !`)
        .setDescription(
            `<@${winner}> a trouvé la réponse en **${timeString}** !\n\n` +
            `**Position :** ${positionText}\n` +
            `💫 **+${xpEarned} XP**` +
            (isTest ? '\n\n⚠️ *Mode test - Aucun XP distribué*' : '')
        )
        .setTimestamp();
}

/**
 * Crée l'embed d'échec (temps écoulé)
 */
function createRiddleFailureEmbed(riddle: Riddle, leaderboard: Array<{ userId: string, time: number }>): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // Rouge
        .setTitle("⏰ ÉVÉNEMENT TERMINÉ !")
        .setDescription(
            `L'énigme du jour est maintenant terminée !\n\n` +
            `**La réponse était :** ${riddle.answer}`
        );

    // Ajouter le leaderboard si des gens ont répondu
    if (leaderboard.length > 0) {
        const leaderboardText = leaderboard.slice(0, 10).map((entry, index) => {
            const positionEmojis: { [key: number]: string } = {
                0: "🥇",
                1: "🥈",
                2: "🥉"
            };
            const emoji = positionEmojis[index] || `${index + 1}.`;
            const minutes = Math.floor(entry.time / 60000);
            const seconds = Math.floor((entry.time % 60000) / 1000);
            const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            return `${emoji} <@${entry.userId}> - ${timeString}`;
        }).join('\n');

        embed.addFields({
            name: "🏆 Leaderboard",
            value: leaderboardText,
            inline: false
        });

        embed.setDescription(
            `L'énigme du jour est maintenant terminée !\n\n` +
            `**La réponse était :** ${riddle.answer}\n\n` +
            `Félicitations aux ${leaderboard.length} participant(s) ! 🎉`
        );
    } else {
        embed.setDescription(
            `L'énigme du jour est maintenant terminée...\n\n` +
            `**La réponse était :** ${riddle.answer}\n\n` +
            `Personne n'a trouvé la réponse cette fois ! 😢\nMeilleure chance la prochaine fois !`
        );
    }

    embed.setTimestamp();
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
 * ÉVÉNEMENT : ÉNIGME
 * Une énigme est posée et les joueurs qui trouvent la réponse gagnent de l'XP (leaderboard)
 */
export async function startRiddleEvent(client: Client, guild: Guild, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Vérifier qu'il n'y a pas déjà un événement riddle actif
        if (eventsData.activeEvents.some(e => e.type === EventType.RIDDLE)) {
            logger.info("Riddle event already active, skipping");
            return;
        }

        // Générer une énigme avec le LLM (ou fallback sur la base de données)
        logger.info("Generating riddle...");
        const riddle = await generateOrFallbackRiddle();

        if (!riddle) {
            logger.error("Failed to generate or get a riddle");
            return;
        }

        // Créer et enregistrer l'événement
        const result = await startEvent(
            client,
            guild,
            EventType.RIDDLE,
            "🧩 Énigme du jour",
            "enigme-du-jour",
            "🧩",
            RIDDLE_DURATION,
            {
                riddleId: riddle.id,
                question: riddle.question,
                answer: riddle.answer,
                alternativeAnswers: riddle.alternativeAnswers || [],
                hint: riddle.hint,
                difficulty: riddle.difficulty,
                category: riddle.category,
                xpReward: riddle.xpReward,
                leaderboard: [] as Array<{ userId: string, username: string, time: number }>, // Liste ordonnée des gagnants
                attempts: [] as string[], // Liste des userId qui ont tenté
                isTest: isTest,
                hintShown: false
            },
            false, // allowMessages = false (pas besoin de permissions spéciales)
            `🧩 L'énigme du jour est apparue ! Tout le monde peut participer et gagner de l'XP. Plus vous répondez vite, plus vous gagnez !`
        );

        if (!result) {
            logger.error("Failed to start riddle event");
            return;
        }

        const {eventId, channel} = result;
        const endTime = Date.now() + RIDDLE_DURATION;

        // Envoyer l'énigme
        const riddleEmbed = createRiddleAnnouncementEmbed(riddle, endTime, isTest);
        await channel.send({embeds: [riddleEmbed]});

        logger.info(`Riddle event started! Question: "${riddle.question}", Answer: "${riddle.answer}", Duration: ${RIDDLE_DURATION / 3600000} hours`);

        // Programmer l'indice après 2 heures
        setTimeout(async () => {
            try {
                const currentEventsData = loadEventsData();
                const currentEvent = currentEventsData.activeEvents.find(e => e.id === eventId);

                // Vérifier que l'événement existe toujours et que l'indice n'a pas été montré
                if (currentEvent && !currentEvent.data.hintShown) {
                    const hintEmbed = createHintEmbed(riddle.hint);
                    await channel.send({embeds: [hintEmbed]});

                    // Marquer l'indice comme affiché
                    currentEvent.data.hintShown = true;
                    saveEventsData(currentEventsData);

                    logger.info(`Hint shown for riddle event ${eventId}`);
                }
            } catch (error) {
                logger.error("Error showing hint:", error);
            }
        }, HINT_DELAY);

        // Programmer la fin automatique après expiration
        setTimeout(async () => {
            await endRiddleEvent(client, eventId, guild);
        }, RIDDLE_DURATION);

    } catch (error) {
        logger.error("Error starting riddle event:", error);
    }
}

/**
 * Gère une réponse à l'énigme via la commande /repondre
 * Retourne les informations sur le résultat de la réponse
 */
export async function handleRiddleAnswer(
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
        const riddleEvent = eventsData.activeEvents.find(e => e.type === EventType.RIDDLE);

        if (!riddleEvent) {
            return null; // Pas d'événement riddle actif
        }

        // Vérifier si l'utilisateur a déjà trouvé la réponse
        if (riddleEvent.data.leaderboard.some((entry: any) => entry.userId === userId)) {
            return {
                correct: false,
                alreadySolved: true
            };
        }

        // Ajouter l'utilisateur aux tentatives s'il n'y est pas déjà
        if (!riddleEvent.data.attempts.includes(userId)) {
            riddleEvent.data.attempts.push(userId);
        }

        // Reconstituer l'objet Riddle
        const riddle: Riddle = {
            id: riddleEvent.data.riddleId,
            question: riddleEvent.data.question,
            answer: riddleEvent.data.answer,
            alternativeAnswers: riddleEvent.data.alternativeAnswers,
            hint: riddleEvent.data.hint,
            difficulty: riddleEvent.data.difficulty,
            category: riddleEvent.data.category,
            xpReward: riddleEvent.data.xpReward
        };

        // Vérifier la réponse
        const isCorrect = checkAnswer(riddle, answer);

        if (isCorrect) {
            // BONNE RÉPONSE !
            const timeTaken = Date.now() - riddleEvent.startTime;
            const position = riddleEvent.data.leaderboard.length + 1;

            // Ajouter au leaderboard
            riddleEvent.data.leaderboard.push({
                userId,
                username,
                time: timeTaken
            });

            saveEventsData(eventsData);

            // Calculer l'XP basé sur la position
            let xpMultiplier: number;
            if (position === 1) xpMultiplier = 1.0; // 100%
            else if (position === 2) xpMultiplier = 0.7; // 70%
            else if (position === 3) xpMultiplier = 0.5; // 50%
            else xpMultiplier = 0.3; // 30% pour les suivants

            const xpEarned = Math.floor(riddle.xpReward * xpMultiplier);

            // Calculer les infos pour l'affichage
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

            // Afficher dans le salon de manière permanente que quelqu'un a trouvé
            try {
                const channel = await client.channels.fetch(riddleEvent.channelId) as TextChannel;
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

            // Donner l'XP (sauf si c'est un test)
            if (!riddleEvent.data.isTest) {
                const channel = await client.channels.fetch(riddleEvent.channelId) as TextChannel;
                await addXP(userId, username, xpEarned, channel, false);
            }

            logger.info(`Riddle solved by ${username} (${userId}) in ${timeTaken}ms - Position: ${position}, XP: ${xpEarned}`);

            return {
                correct: true,
                alreadySolved: false,
                position,
                positionText,
                positionEmoji,
                xpEarned,
                timeString,
                isTest: riddleEvent.data.isTest
            };

        } else {
            // Mauvaise réponse
            saveEventsData(eventsData);
            return {
                correct: false,
                alreadySolved: false
            };
        }

    } catch (error) {
        logger.error("Error handling riddle answer:", error);
        return null;
    }
}

/**
 * Gère un message dans le salon d'énigme
 * Les messages des utilisateurs sont supprimés pour garder le salon propre
 * Les réponses doivent être soumises via /answer
 */
export async function handleRiddleMessage(client: Client, message: Message): Promise<void> {
    try {
        const eventsData = loadEventsData();
        const riddleEvent = eventsData.activeEvents.find(e => e.type === EventType.RIDDLE);

        if (!riddleEvent || riddleEvent.channelId !== message.channelId) {
            return; // Pas d'événement riddle actif dans ce salon
        }

        // Ignorer les messages du bot (pour ne pas supprimer les annonces)
        if (message.author.bot) {
            return;
        }

        // Supprimer tous les messages des utilisateurs pour garder le salon propre
        try {
            await message.delete();
            logger.debug(`Deleted message from ${message.author.username} in riddle channel`);
        } catch (error) {
            logger.warn("Could not delete message in riddle channel:", error);
        }

    } catch (error) {
        logger.error("Error handling riddle message:", error);
    }
}

/**
 * Termine l'événement Riddle
 */
async function endRiddleEvent(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const event = eventsData.activeEvents.find(e => e.id === eventId);

    if (!event) {
        logger.warn(`Riddle event ${eventId} not found`);
        return;
    }

    const leaderboard = event.data.leaderboard || [];

    // Envoyer le message de fin avec le leaderboard
    if (event.channelId) {
        try {
            const channel = guild.channels.cache.get(event.channelId) as TextChannel;
            if (channel) {
                const riddle: Riddle = {
                    id: event.data.riddleId,
                    question: event.data.question,
                    answer: event.data.answer,
                    alternativeAnswers: event.data.alternativeAnswers,
                    hint: event.data.hint,
                    difficulty: event.data.difficulty,
                    category: event.data.category,
                    xpReward: event.data.xpReward
                };

                const failureEmbed = createRiddleFailureEmbed(riddle, leaderboard);
                await channel.send({embeds: [failureEmbed]});

                // Ajouter un message indiquant que le salon va se fermer
                const closingEmbed = new EmbedBuilder()
                    .setColor(0x95A5A6)
                    .setTitle("⏰ Fermeture du salon")
                    .setDescription(`Ce salon sera fermé dans 1 heure.\n\nProfitez-en pour consulter les résultats !`)
                    .setTimestamp();
                await channel.send({embeds: [closingEmbed]});

                // Programmer la fermeture du salon après 1 heure
                setTimeout(async () => {
                    logger.info(`Closing riddle channel ${event.channelId} after 1 hour delay`);
                    await endEvent(client, eventId, guild);
                }, CHANNEL_CLOSE_DELAY);

                logger.info(`Riddle event ${eventId} results posted. Channel will close in 1 hour.`);
                return; // Ne pas terminer l'événement tout de suite
            }
        } catch (error) {
            logger.error("Error sending end message:", error);
        }
    }

    // Si on arrive ici, terminer l'événement immédiatement (erreur ou pas de canal)
    await endEvent(client, eventId, guild);
    logger.info(`Riddle event ${eventId} ended. Participants: ${leaderboard.length}, Attempts: ${event.data.attempts.length}`);
}























