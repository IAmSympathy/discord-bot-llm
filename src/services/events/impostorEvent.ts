import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Guild, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {createEventChannel, deleteEventChannel} from "./eventChannelManager";

const logger = createLogger("ImpostorEvent");

/**
 * ÉVÉNEMENT : IMPOSTEUR
 * Un utilisateur doit accomplir 3 missions secrètes sans se faire remarquer
 */
export async function startImpostorEvent(client: Client, guild: Guild, testUserId?: string, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Vérifier qu'il n'y a pas déjà un événement imposteur actif
        if (eventsData.activeEvents.some(e => e.type === EventType.IMPOSTOR)) {
            logger.info("Impostor event already active, skipping");
            return;
        }

        // Récupérer tous les utilisateurs actifs
        const {getAllStats} = require("../userStatsService");
        const allStats = getAllStats();

        const now = Date.now();
        const fiveDayAgo = now - (120 * 60 * 60 * 1000);

        // Filtrer les utilisateurs actifs récemment
        let eligibleUsers = Object.entries(allStats)
            .filter(([userId, stats]: [string, any]) => {
                if (stats.username?.toLowerCase().includes('bot')) return false;
                if (userId === '1462959115528835092') return false;
                if (eventsData.userPreferences[userId]?.disableImpostor) return false;
                return stats.lastUpdate && stats.lastUpdate > fiveDayAgo;
            })
            .map(([userId, stats]: [string, any]) => ({
                userId,
                username: stats.username
            }));

        if (eligibleUsers.length === 0) {
            logger.info("No eligible users for impostor event");
            return;
        }

        // Choisir un utilisateur
        let selectedUser;
        if (testUserId) {
            selectedUser = {userId: testUserId, username: allStats[testUserId]?.username || "Test User"};
        } else {
            selectedUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
        }

        // Générer 3 missions
        const allMissions = [
            "Envoyer 5 messages dans différents salons",
            "Réagir à 3 messages différents",
            "Utiliser une commande de Netricsa",
            "Envoyer un message contenant un emoji",
            "Répondre à un message de quelqu'un d'autre",
            "Envoyer un GIF ou une image",
            "Mentionner quelqu'un dans un message",
            "Rejoindre un salon vocal pendant 2 minutes",
            "Envoyer un message de plus de 50 caractères",
            "Utiliser /daily ou /challenges"
        ];

        const shuffled = [...allMissions].sort(() => Math.random() - 0.5);
        const missions = shuffled.slice(0, 3);

        // Durée : 2 heures
        const duration = 2 * 60 * 60 * 1000;
        const endTime = Date.now() + duration;

        // Créer le canal de chasse (sauf si test)
        let huntChannel: TextChannel | null = null;
        if (!testUserId) {
            huntChannel = await createEventChannel(guild, "chasse-imposteur", "🔍");
            if (huntChannel) {
                const huntEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("🔍 CHASSE À L'IMPOSTEUR !")
                    .setDescription(
                        `**Un imposteur se cache parmi vous...** 🕵️\n\n` +
                        `Quelqu'un a reçu une mission secrète et doit agir discrètement.\n` +
                        `Saurez-vous le démasquer ?\n\n` +
                        `⚠️ **Règles de dénonciation :**\n` +
                        `• Vous pouvez dénoncer **un suspect** en cliquant sur le bouton ci-dessous\n` +
                        `• **Bon guess** : +200 XP 💎 (l'imposteur échoue sa mission)\n` +
                        `• **Mauvais guess** : -50 XP 💔\n` +
                        `• Vous ne pouvez dénoncer qu'**une seule fois**\n` +
                        `• Attendez **5 minutes** avant de pouvoir dénoncer (laisser l'imposteur agir)\n\n` +
                        `**Fin de l'événement :** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
                        `🤫 Observez attentivement... Qui agit étrangement ?`
                    )
                    .setFooter({text: "Bonne chance, détectives !"})
                    .setTimestamp();

                const guessButton = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("impostor_guess")
                            .setLabel("🔍 Dénoncer un suspect")
                            .setStyle(ButtonStyle.Danger)
                    );

                await huntChannel.send({embeds: [huntEmbed], components: [guessButton]});
                logger.info("Impostor hunt channel created");
            }
        }

        // Envoyer un DM à l'imposteur
        try {
            const user = await client.users.fetch(selectedUser.userId);

            const impostorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`🕵️ MISSION IMPOSTEUR !${isTest ? " (TEST)" : ""}`)
                .setDescription(
                    `Tu as été secrètement choisi comme **IMPOSTEUR** ! 🎭\n\n` +
                    `**Ta mission :** Accomplir les 3 tâches suivantes **discrètement** dans les **2 prochaines heures** :\n\n` +
                    `1️⃣ ${missions[0]}\n` +
                    `2️⃣ ${missions[1]}\n` +
                    `3️⃣ ${missions[2]}\n\n` +
                    `⚠️ **Règles :**\n` +
                    `• Agis **naturellement** - Ne te fais pas remarquer !\n` +
                    `• Les autres joueurs peuvent essayer de te démasquer${huntChannel ? ` dans <#${huntChannel.id}>` : ""}\n` +
                    `• Ta mission se **complétera automatiquement** une fois que tu auras tout accompli\n` +
                    `• Tu as jusqu'à <t:${Math.floor(endTime / 1000)}:t> pour compléter\n\n` +
                    `**Récompense :** 400 XP 💎\n\n` +
                    `⏰ Temps limite : <t:${Math.floor(endTime / 1000)}:R>` +
                    (isTest ? "\n\n⚠️ *Ceci est un événement de TEST. Les récompenses réelles ne seront pas distribuées.*" : "")
                )
                .setFooter({text: "Tu peux désactiver les missions imposteur avec /event-preferences"})
                .setTimestamp();

            await user.send({embeds: [impostorEmbed]});
            logger.info(`Impostor mission sent to ${selectedUser.username}${isTest ? ' [TEST MODE]' : ''}`);

            // Enregistrer l'événement
            const eventId = `impostor_${Date.now()}`;
            eventsData.activeEvents.push({
                id: eventId,
                type: EventType.IMPOSTOR,
                channelId: huntChannel?.id || "",
                startTime: Date.now(),
                endTime: endTime,
                data: {
                    impostorId: selectedUser.userId,
                    impostorUsername: selectedUser.username,
                    missions: missions,
                    completed: false,
                    discovered: false,
                    discoveredBy: null,
                    isTest: isTest || !!testUserId // Marquer comme test si isTest ou testUserId
                }
            });

            // Initialiser le tracking des guess
            if (!eventsData.impostorGuesses) {
                eventsData.impostorGuesses = {};
            }
            eventsData.impostorGuesses[eventId] = {};

            saveEventsData(eventsData);

            logger.info(`Impostor event started! Impostor: ${selectedUser.username}, Duration: 2 hours`);

            // Programmer la fin automatique après 2 heures
            setTimeout(async () => {
                await endImpostorEvent(client, eventId, guild);
            }, duration);

        } catch (error: any) {
            if (error.code === 50007) {
                logger.warn(`Cannot send impostor mission to ${selectedUser.username} (DMs closed)`);
            } else {
                logger.error(`Error sending impostor mission to ${selectedUser.username}:`, error);
            }
        }

    } catch (error) {
        logger.error("Error starting impostor event:", error);
    }
}

/**
 * Termine l'événement Imposteur
 */
async function endImpostorEvent(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const eventIndex = eventsData.activeEvents.findIndex(e => e.id === eventId);

    if (eventIndex === -1) {
        logger.warn(`Impostor event ${eventId} not found`);
        return;
    }

    const event = eventsData.activeEvents[eventIndex];
    const impostorId = event.data.impostorId;
    const impostorUsername = event.data.impostorUsername;
    const completed = event.data.completed;
    const discovered = event.data.discovered;
    const isTest = event.data.isTest;

    try {
        const user = await client.users.fetch(impostorId);

        if (discovered) {
            logger.info(`Impostor ${impostorUsername} was discovered, no rewards`);
        } else if (completed) {
            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🎉 MISSION IMPOSTEUR RÉUSSIE !")
                .setDescription(
                    `Félicitations ! Tu as accompli toutes tes missions secrètes sans te faire remarquer ! 🕵️\n\n` +
                    `**Récompense :** 400 XP 💫\n\n` +
                    `Tu es un véritable maître de la discrétion ! 😎`
                )
                .setTimestamp();

            await user.send({embeds: [successEmbed]});

            if (!isTest) {
                const generalChannelId = require("../../utils/envConfig").EnvConfig.WELCOME_CHANNEL_ID;
                if (generalChannelId) {
                    const generalChannel = guild.channels.cache.get(generalChannelId) as TextChannel;
                    if (generalChannel) {
                        await addXP(impostorId, impostorUsername, 400, generalChannel, false);
                    }
                }

                eventsData.history.push({
                    eventId: eventId,
                    type: EventType.IMPOSTOR,
                    timestamp: Date.now(),
                    participants: [impostorId],
                    winners: [impostorId]
                });
            }

        } else {
            const failedEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("⏰ MISSION IMPOSTEUR ÉCHOUÉE")
                .setDescription(
                    `Le temps est écoulé ! Tu n'as pas accompli toutes tes missions à temps. 😔\n\n` +
                    `Dommage ! Tu pourras réessayer lors d'une prochaine mission.\n\n` +
                    `Mieux vaut être plus rapide la prochaine fois ! 🏃`
                )
                .setTimestamp();

            await user.send({embeds: [failedEmbed]});
        }

    } catch (error: any) {
        if (error.code === 50007) {
            logger.warn(`Cannot send impostor end message to ${impostorUsername} (DMs closed)`);
        } else {
            logger.error(`Error sending impostor end message:`, error);
        }
    }

    // Retirer de la liste
    eventsData.activeEvents.splice(eventIndex, 1);

    // Nettoyer le tracking
    if (eventsData.impostorGuesses && eventsData.impostorGuesses[eventId]) {
        delete eventsData.impostorGuesses[eventId];
    }

    saveEventsData(eventsData);

    // Supprimer le canal
    if (event.channelId) {
        const delay = discovered ? 0 : 60000;
        setTimeout(async () => {
            await deleteEventChannel(guild, event.channelId);
        }, delay);
    }

    logger.info(`Impostor event ${eventId} ended (${discovered ? 'discovered' : completed ? 'completed' : 'failed'})`);
}

/**
 * Marque la mission imposteur comme complétée
 * NOTE: Cette fonction n'est plus utilisée car la complétion est maintenant automatique
 */

/*
export async function completeImpostorMission(client: Client, userId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR && e.data.impostorId === userId && !e.data.completed
    );

    if (impostorEvent) {
        impostorEvent.data.completed = true;
        saveEventsData(eventsData);
        logger.info(`Impostor mission marked as completed for user ${userId}`);

        await endImpostorEvent(client, impostorEvent.id, guild);
    }
}
*/

/**
 * Gère une tentative de guess d'imposteur
 */
export async function handleImpostorGuess(
    client: Client,
    userId: string,
    username: string,
    suspectId: string,
    guild: Guild
): Promise<{ success: boolean; message: string }> {
    const eventsData = loadEventsData();

    const impostorEvent = eventsData.activeEvents.find(e => e.type === EventType.IMPOSTOR);

    if (!impostorEvent) {
        return {success: false, message: "Il n'y a pas d'imposteur actif en ce moment."};
    }

    // Vérifier si déjà guess
    if (!eventsData.impostorGuesses) eventsData.impostorGuesses = {};
    if (!eventsData.impostorGuesses[impostorEvent.id]) eventsData.impostorGuesses[impostorEvent.id] = {};

    if (eventsData.impostorGuesses[impostorEvent.id][userId]) {
        return {success: false, message: "Tu as déjà dénoncé quelqu'un ! Une seule tentative par événement."};
    }

    // Vérifier cooldown (5 minutes)
    const timeElapsed = Date.now() - impostorEvent.startTime;
    const cooldownTime = 5 * 60 * 1000;

    if (timeElapsed < cooldownTime) {
        const remainingMinutes = Math.ceil((cooldownTime - timeElapsed) / 60000);
        return {
            success: false,
            message: `Tu dois attendre encore ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} avant de pouvoir dénoncer quelqu'un.`
        };
    }

    // Marquer le guess
    eventsData.impostorGuesses[impostorEvent.id][userId] = true;
    saveEventsData(eventsData);

    const generalChannelId = require("../../utils/envConfig").EnvConfig.WELCOME_CHANNEL_ID;
    const generalChannel = guild.channels.cache.get(generalChannelId) as TextChannel;

    // Vérifier si c'est le bon
    if (suspectId === impostorEvent.data.impostorId) {
        // BON GUESS
        logger.info(`${username} discovered the impostor ${impostorEvent.data.impostorUsername}!`);

        impostorEvent.data.discovered = true;
        impostorEvent.data.discoveredBy = userId;
        saveEventsData(eventsData);

        // Donner XP au détective (sauf si test)
        if (generalChannel && !impostorEvent.data.isTest) {
            await addXP(userId, username, 200, generalChannel, false);
        } else if (impostorEvent.data.isTest) {
            logger.info("Test mode: Detective XP reward skipped");
        }

        // Message dans le canal
        if (impostorEvent.channelId) {
            const huntChannel = guild.channels.cache.get(impostorEvent.channelId) as TextChannel;
            if (huntChannel) {
                const discoveryEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle("🎉 IMPOSTEUR DÉMASQUÉ !")
                    .setDescription(
                        `**<@${userId}>** a démasqué l'imposteur ! 🕵️\n\n` +
                        `L'imposteur était **<@${impostorEvent.data.impostorId}>** !\n\n` +
                        `**Récompense du détective :** 200 XP 💎\n` +
                        `**L'imposteur** a échoué sa mission et ne gagne rien. 💔\n\n` +
                        `*Le canal se fermera dans 1 minute...*`
                    )
                    .setTimestamp();

                await huntChannel.send({embeds: [discoveryEmbed]});
            }
        }

        // Notifier l'imposteur
        try {
            const impostor = await client.users.fetch(impostorEvent.data.impostorId);
            const failEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("😰 TU AS ÉTÉ DÉMASQUÉ !")
                .setDescription(
                    `**<@${userId}>** t'a démasqué ! 🔍\n\n` +
                    `Ta mission a échoué et tu ne gagnes aucune récompense.\n\n` +
                    `Sois plus discret la prochaine fois ! 🤫`
                )
                .setTimestamp();

            await impostor.send({embeds: [failEmbed]});
        } catch (error) {
            logger.error("Error notifying impostor of discovery:", error);
        }

        // Terminer l'événement
        setTimeout(async () => {
            await endImpostorEvent(client, impostorEvent.id, guild);
        }, 60000);

        return {
            success: true,
            message: "🎉 Félicitations ! Tu as démasqué l'imposteur ! Tu gagnes 200 XP ! 💎"
        };

    } else {
        // MAUVAIS GUESS
        logger.info(`${username} made a wrong guess (suspected ${suspectId})`);

        if (generalChannel && !impostorEvent.data.isTest) {
            await addXP(userId, username, -50, generalChannel, false);
        } else if (impostorEvent.data.isTest) {
            logger.info("Test mode: XP penalty skipped");
        }

        return {
            success: false,
            message: `❌ Ce n'était pas l'imposteur !${impostorEvent.data.isTest ? "" : " Tu perds 50 XP pour fausse accusation."} 💔`
        };
    }
}

/**
 * Test de l'embed imposteur (sans créer d'événement)
 * NOTE: Cette fonction n'est plus utilisée, utilisez startImpostorEvent avec isTest=true à la place
 */
/*
export async function testImpostorEmbed(client: Client, ownerId: string): Promise<void> {
    // Cette fonction est deprecated, utilisez startImpostorEvent(client, guild, ownerId, true) à la place
}
*/

