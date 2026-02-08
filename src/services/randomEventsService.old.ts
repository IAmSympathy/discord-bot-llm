import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, Guild, PermissionFlagsBits, TextChannel} from "discord.js";
import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";
import {DATA_DIR} from "../utils/constants";
import {addXP} from "./xpSystem";

const logger = createLogger("RandomEvents");
const EVENTS_FILE = path.join(DATA_DIR, "random_events.json");

/**
 * Types d'événements disponibles
 */
export enum EventType {
    COUNTER_CHALLENGE = "counter_challenge",
    MINI_BOSS = "mini_boss",
    MEGA_BOSS = "mega_boss",
    MYSTERY_BOX = "mystery_box",
    SERVER_BIRTHDAY = "server_birthday",
    HOLIDAY = "holiday",
    SECRET_WORD = "secret_word",
    IMPOSTOR = "impostor"
}

/**
 * Structure d'un événement actif
 */
export interface ActiveEvent {
    id: string;
    type: EventType;
    channelId: string;
    startTime: number;
    endTime: number;
    data: any; // Données spécifiques à l'événement
}

/**
 * Structure des données d'événements
 */
interface EventsData {
    activeEvents: ActiveEvent[];
    history: {
        eventId: string;
        type: EventType;
        timestamp: number;
        participants: string[];
        winners?: string[];
    }[];
    userPreferences: {
        [userId: string]: {
            disableMysteryBox: boolean;
            disableImpostor: boolean;
        };
    };
    impostorGuesses: {
        [eventId: string]: {
            [userId: string]: boolean; // true si déjà guess
        };
    };
}

/**
 * Charge les données des événements
 */
function loadEventsData(): EventsData {
    try {
        if (fs.existsSync(EVENTS_FILE)) {
            const data = fs.readFileSync(EVENTS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading events data:", error);
    }
    return {
        activeEvents: [],
        history: [],
        userPreferences: {},
        impostorGuesses: {}
    };
}

/**
 * Sauvegarde les données des événements
 */
function saveEventsData(data: EventsData): void {
    try {
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving events data:", error);
    }
}

/**
 * Trouve ou crée la catégorie "ÉVÉNEMENTS"
 */
async function getOrCreateEventsCategory(guild: Guild): Promise<string> {
    try {
        // Chercher une catégorie existante nommée "ÉVÉNEMENTS" ou "EVENTS"
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory &&
                (c.name.toLowerCase() === "événements" || c.name.toLowerCase() === "events")
        );

        // Si elle n'existe pas, la créer
        if (!category) {
            category = await guild.channels.create({
                name: "🔴 ÉVÉNEMENTS",
                type: ChannelType.GuildCategory,
                position: 0 // En haut du serveur
            });
            logger.info(`Events category created: ${category.id}`);
        }

        return category.id;
    } catch (error) {
        logger.error("Error getting/creating events category:", error);
        throw error;
    }
}

/**
 * Crée un canal d'événement dans la catégorie ÉVÉNEMENTS
 */
async function createEventChannel(guild: Guild, eventName: string, eventEmoji: string): Promise<TextChannel | null> {
    try {
        // Obtenir ou créer la catégorie d'événements
        const categoryId = await getOrCreateEventsCategory(guild);

        // Créer le canal dans la catégorie
        const channel = await guild.channels.create({
            name: `${eventEmoji}-${eventName}`,
            type: ChannelType.GuildText,
            parent: categoryId,
            position: 0,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    deny: [PermissionFlagsBits.SendMessages] // Lecture seule par défaut
                }
            ]
        });

        logger.info(`Event channel created: ${channel.name} (${channel.id})`);
        return channel;
    } catch (error) {
        logger.error("Error creating event channel:", error);
        return null;
    }
}

/**
 * Supprime un canal d'événement
 */
async function deleteEventChannel(guild: Guild, channelId: string): Promise<void> {
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

/**
 * ÉVÉNEMENT 1 : COMPTEUR CHALLENGE
 * Les utilisateurs doivent atteindre un nombre spécifique dans le compteur avant la fin du temps
 */
export async function startCounterChallenge(client: Client, guild: Guild): Promise<void> {
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
                `*Cet événement se terminera automatiquement dans 30 minutes ou dès que l'objectif est atteint.*`
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
                winnerId: null
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

                // Donner l'XP au gagnant
                const counterChannel = guild.channels.cache.get(require("../utils/envConfig").EnvConfig.COUNTER_CHANNEL_ID);
                if (counterChannel && (counterChannel instanceof TextChannel)) {
                    await addXP(userId, username, 500, counterChannel, false);
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

/**
 * ÉVÉNEMENT 2 : COLIS MYSTÈRE
 * Un utilisateur aléatoire actif reçoit un colis mystère avec de l'XP bonus
 */
export async function startMysteryBox(client: Client, guild: Guild, testUserId?: string): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Récupérer tous les utilisateurs actifs (ont envoyé un message dans les dernières 24h)
        const {getAllStats} = require("./userStatsService");
        const allStats = getAllStats();

        // Filtrer les utilisateurs actifs récemment et qui n'ont pas désactivé les colis
        let eligibleUsers = Object.entries(allStats)
            .filter(([userId, stats]: [string, any]) => {
                // Exclure les bots
                if (stats.username?.toLowerCase().includes('bot')) return false;

                // Exclure Netricsa
                if (userId === '1462959115528835092') return false;

                // Vérifier les préférences
                if (eventsData.userPreferences[userId]?.disableMysteryBox) return false;

            })
            .map(([userId, stats]: [string, any]) => ({
                userId,
                username: stats.username
            }));

        if (eligibleUsers.length === 0) {
            logger.info("No eligible users for mystery box event");
            return;
        }

        // Choisir un utilisateur aléatoire (ou utiliser testUserId pour les tests)
        let selectedUser;
        if (testUserId) {
            selectedUser = eligibleUsers.find(u => u.userId === testUserId) || eligibleUsers[0];
        } else {
            selectedUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
        }

        // Générer un montant d'XP aléatoire (50-200 XP) OU 🖕 (1% de chance)
        const isTroll = Math.random() < 0.01; // 1% de chance
        const xpAmount = Math.floor(Math.random() * 151) + 50; // 50 à 200

        // Envoyer un DM à l'utilisateur
        try {
            const user = await client.users.fetch(selectedUser.userId);

            // Créer l'attachment pour l'image
            const badgePath = path.join(process.cwd(), "assets", "parcel_badge.png");
            const badgeAttachment = new AttachmentBuilder(badgePath, {name: "parcel_badge.png"});

            const mysteryBoxEmbed = new EmbedBuilder()
                .setColor(0xF6AD55)
                .setTitle("📦 COLIS MYSTÈRE REÇU !")
                .setDescription(
                    isTroll
                        ? `Tu as reçu un **colis mystère** !\n\n` +
                        `**Contenu :** 🖕\n\n` +
                        `Dommage ! Ce colis était vide... ou pire ! 😈\n` +
                        `Ce colis a été livré aléatoirement parmi les utilisateurs du serveur\n` +
                        `<#1158184382679498832>>.`
                        : `Tu as reçu un **colis mystère** !\n\n` +
                        `**Contenu :** ${xpAmount} XP 💫\n\n` +
                        `Ce colis a été livré aléatoirement parmi les utilisateurs du serveur\n` +
                        `<#1158184382679498832>.`
                )
                .setThumbnail("attachment://parcel_badge.png")
                .setFooter({text: "Tu peux désactiver les colis mystère avec /event-preferences"})
                .setTimestamp();

            await user.send({embeds: [mysteryBoxEmbed], files: [badgeAttachment]});
            logger.info(`Mystery box sent to ${selectedUser.username} (${isTroll ? '🖕' : xpAmount + ' XP'})`);

            // Donner l'XP (sauf si c'est un test ou un troll)
            if (!testUserId && !isTroll) {
                // Trouver un canal pour donner l'XP (utiliser le salon général)
                const generalChannelId = require("../utils/envConfig").EnvConfig.WELCOME_CHANNEL_ID;
                if (generalChannelId) {
                    const generalChannel = guild.channels.cache.get(generalChannelId) as TextChannel;
                    if (generalChannel) {
                        await addXP(selectedUser.userId, selectedUser.username, xpAmount, generalChannel, false);
                    }
                }

                // Ajouter à l'historique
                eventsData.history.push({
                    eventId: `mysterybox_${Date.now()}`,
                    type: EventType.MYSTERY_BOX,
                    timestamp: Date.now(),
                    participants: [selectedUser.userId],
                    winners: [selectedUser.userId]
                });
                saveEventsData(eventsData);
            }

        } catch (error: any) {
            if (error.code === 50007) {
                logger.warn(`Cannot send mystery box to ${selectedUser.username} (DMs closed)`);
            } else {
                logger.error(`Error sending mystery box to ${selectedUser.username}:`, error);
            }
        }

    } catch (error) {
        logger.error("Error starting mystery box event:", error);
    }
}

/**
 * Fonction de test pour l'événement Colis Mystère
 * Envoie juste l'embed sans donner d'XP
 */
export async function testMysteryBoxEmbed(client: Client, userId: string): Promise<void> {
    try {
        const user = await client.users.fetch(userId);

        // 1% de chance d'obtenir 🖕
        const isTroll = Math.random() < 0.01;
        const xpAmount = Math.floor(Math.random() * 151) + 50;

        // Créer l'attachment pour l'image
        const badgePath = path.join(process.cwd(), "assets", "parcel_badge.png");
        const badgeAttachment = new AttachmentBuilder(badgePath, {name: "parcel_badge.png"});

        const mysteryBoxEmbed = new EmbedBuilder()
            .setColor(0xF6AD55)
            .setTitle("📦 COLIS MYSTÈRE REÇU !")
            .setDescription(
                isTroll
                    ? `Tu as reçu un **colis mystère** !\n\n` +
                    `**Contenu :** 🖕\n\n` +
                    `Dommage ! Ce colis était vide... ou pire ! 😈\n` +
                    `Ce colis a été livré aléatoirement parmi les utilisateurs du serveur\n` +
                    `<#1158184382679498832>>.`
                    : `Tu as reçu un **colis mystère** !\n\n` +
                    `**Contenu :** ${xpAmount} XP 💫\n\n` +
                    `Ce colis a été livré aléatoirement parmi les utilisateurs du serveur\n` +
                    `<#1158184382679498832>.`
            )
            .setThumbnail("attachment://parcel_badge.png")
            .setFooter({text: "Tu peux désactiver les colis mystère avec /event-preferences"})
            .setTimestamp();

        await user.send({embeds: [mysteryBoxEmbed], files: [badgeAttachment]});
        logger.info(`Mystery box test embed sent to user ${userId} (${isTroll ? '🖕' : xpAmount + ' XP'} - NO XP GIVEN)`);

    } catch (error: any) {
        // ...existing error handling...
    }
}

/**
 * ÉVÉNEMENT 3 : IMPOSTEUR
 * Un utilisateur doit accomplir 3 missions secrètes sans se faire remarquer
 */
export async function startImpostorEvent(client: Client, guild: Guild, testUserId?: string): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Vérifier qu'il n'y a pas déjà un événement imposteur actif
        if (eventsData.activeEvents.some(e => e.type === EventType.IMPOSTOR)) {
            logger.info("Impostor event already active, skipping");
            return;
        }

        // Récupérer tous les utilisateurs actifs (ont envoyé un message dans les dernières 24h)
        const {getAllStats} = require("./userStatsService");
        const allStats = getAllStats();

        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // Filtrer les utilisateurs actifs récemment
        let eligibleUsers = Object.entries(allStats)
            .filter(([userId, stats]: [string, any]) => {
                // Exclure les bots
                if (stats.username?.toLowerCase().includes('bot')) return false;

                // Exclure Netricsa
                if (userId === '1462959115528835092') return false;

                // Vérifier les préférences
                if (eventsData.userPreferences[userId]?.disableImpostor) return false;

                // Vérifier l'activité récente
                return stats.lastUpdate && stats.lastUpdate > oneDayAgo;
            })
            .map(([userId, stats]: [string, any]) => ({
                userId,
                username: stats.username
            }));

        if (eligibleUsers.length === 0) {
            logger.info("No eligible users for impostor event");
            return;
        }

        // Choisir un utilisateur aléatoire (ou utiliser testUserId pour les tests)
        let selectedUser;
        if (testUserId) {
            selectedUser = {userId: testUserId, username: allStats[testUserId]?.username || "Test User"};
        } else {
            selectedUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
        }

        // Générer 3 missions secrètes aléatoires
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

        // Mélanger et prendre 3 missions
        const shuffled = [...allMissions].sort(() => Math.random() - 0.5);
        const missions = shuffled.slice(0, 3);

        // Durée : 2 heures
        const duration = 2 * 60 * 60 * 1000;
        const endTime = Date.now() + duration;

        // Créer le canal de chasse à l'imposteur (sauf si c'est un test)
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
                .setColor(0xED4245) // Rouge
                .setTitle("🕵️ MISSION IMPOSTEUR !")
                .setDescription(
                    `Tu as été secrètement choisi comme **IMPOSTEUR** ! 🎭\n\n` +
                    `**Ta mission :** Accomplir les 3 tâches suivantes **discrètement** dans les **2 prochaines heures** :\n\n` +
                    `1️⃣ ${missions[0]}\n` +
                    `2️⃣ ${missions[1]}\n` +
                    `3️⃣ ${missions[2]}\n\n` +
                    `⚠️ **Règles :**\n` +
                    `• Agis **naturellement** - Ne te fais pas remarquer !\n` +
                    `• Personne d'autre ne sait que tu es l'imposteur\n` +
                    `• Tu as jusqu'à <t:${Math.floor(endTime / 1000)}:t> pour compléter\n\n` +
                    `**Récompense :** 400 XP 💎\n\n` +
                    `⏰ Temps limite : <t:${Math.floor(endTime / 1000)}:R>`
                )
                .setFooter({text: "Tu peux désactiver les missions imposteur avec /event-preferences"})
                .setTimestamp();

            await user.send({embeds: [impostorEmbed]});
            logger.info(`Impostor mission sent to ${selectedUser.username}`);

            // Enregistrer l'événement
            const eventId = `impostor_${Date.now()}`;
            eventsData.activeEvents.push({
                id: eventId,
                type: EventType.IMPOSTOR,
                channelId: huntChannel?.id || "", // ID du canal de chasse (vide si test)
                startTime: Date.now(),
                endTime: endTime,
                data: {
                    impostorId: selectedUser.userId,
                    impostorUsername: selectedUser.username,
                    missions: missions,
                    completed: false,
                    discovered: false,
                    discoveredBy: null,
                    isTest: !!testUserId
                }
            });

            // Initialiser le tracking des guess pour cet événement
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
            // L'imposteur a été découvert - déjà géré dans handleImpostorGuess
            logger.info(`Impostor ${impostorUsername} was discovered, no rewards`);
        } else if (completed) {
            // Mission complétée
            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287) // Vert
                .setTitle("🎉 MISSION IMPOSTEUR RÉUSSIE !")
                .setDescription(
                    `Félicitations ! Tu as accompli toutes tes missions secrètes sans te faire remarquer ! 🕵️\n\n` +
                    `**Récompense :** 400 XP 💎\n\n` +
                    `Tu es un véritable maître de la discrétion ! 😎`
                )
                .setTimestamp();

            await user.send({embeds: [successEmbed]});

            // Donner l'XP (sauf si c'est un test)
            if (!isTest) {
                const generalChannelId = require("../utils/envConfig").EnvConfig.WELCOME_CHANNEL_ID;
                if (generalChannelId) {
                    const generalChannel = guild.channels.cache.get(generalChannelId) as TextChannel;
                    if (generalChannel) {
                        await addXP(impostorId, impostorUsername, 400, generalChannel, false);
                    }
                }

                // Ajouter à l'historique
                eventsData.history.push({
                    eventId: eventId,
                    type: EventType.IMPOSTOR,
                    timestamp: Date.now(),
                    participants: [impostorId],
                    winners: [impostorId]
                });
            }

        } else {
            // Mission échouée (temps écoulé)
            const failedEmbed = new EmbedBuilder()
                .setColor(0xED4245) // Rouge
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

    // Retirer de la liste des événements actifs
    eventsData.activeEvents.splice(eventIndex, 1);

    // Nettoyer le tracking des guess pour cet événement
    if (eventsData.impostorGuesses && eventsData.impostorGuesses[eventId]) {
        delete eventsData.impostorGuesses[eventId];
    }

    saveEventsData(eventsData);

    // Supprimer le canal de chasse après 1 minute (si non découvert) ou immédiatement (si découvert)
    if (event.channelId) {
        const delay = discovered ? 0 : 60000; // Immédiat si découvert, 1 min sinon
        setTimeout(async () => {
            await deleteEventChannel(guild, event.channelId);
        }, delay);
    }

    logger.info(`Impostor event ${eventId} ended (${discovered ? 'discovered' : completed ? 'completed' : 'failed'})`);
}

/**
 * Marque la mission imposteur comme complétée
 */
export async function completeImpostorMission(client: Client, userId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR && e.data.impostorId === userId && !e.data.completed
    );

    if (impostorEvent) {
        impostorEvent.data.completed = true;
        saveEventsData(eventsData);
        logger.info(`Impostor mission marked as completed for user ${userId}`);

        // Terminer l'événement immédiatement
        await endImpostorEvent(client, impostorEvent.id, guild);
    }
}

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

    // Trouver l'événement imposteur actif
    const impostorEvent = eventsData.activeEvents.find(e => e.type === EventType.IMPOSTOR);

    if (!impostorEvent) {
        return {success: false, message: "Il n'y a pas d'imposteur actif en ce moment."};
    }

    // Vérifier si l'utilisateur a déjà guess
    if (!eventsData.impostorGuesses) {
        eventsData.impostorGuesses = {};
    }
    if (!eventsData.impostorGuesses[impostorEvent.id]) {
        eventsData.impostorGuesses[impostorEvent.id] = {};
    }

    if (eventsData.impostorGuesses[impostorEvent.id][userId]) {
        return {success: false, message: "Tu as déjà dénoncé quelqu'un ! Une seule tentative par événement."};
    }

    // Vérifier le cooldown de 5 minutes
    const timeElapsed = Date.now() - impostorEvent.startTime;
    const cooldownTime = 5 * 60 * 1000; // 5 minutes

    if (timeElapsed < cooldownTime) {
        const remainingMinutes = Math.ceil((cooldownTime - timeElapsed) / 60000);
        return {
            success: false,
            message: `Tu dois attendre encore ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} avant de pouvoir dénoncer quelqu'un.`
        };
    }

    // Marquer que l'utilisateur a guess
    eventsData.impostorGuesses[impostorEvent.id][userId] = true;
    saveEventsData(eventsData);

    const generalChannelId = require("../utils/envConfig").EnvConfig.WELCOME_CHANNEL_ID;
    const generalChannel = guild.channels.cache.get(generalChannelId) as TextChannel;

    // Vérifier si c'est le bon imposteur
    if (suspectId === impostorEvent.data.impostorId) {
        // BON GUESS !
        logger.info(`${username} discovered the impostor ${impostorEvent.data.impostorUsername}!`);

        // Marquer l'événement comme découvert
        impostorEvent.data.discovered = true;
        impostorEvent.data.discoveredBy = userId;
        saveEventsData(eventsData);

        // Donner 200 XP au détective
        if (generalChannel) {
            await addXP(userId, username, 200, generalChannel, false);
        }

        // Envoyer un message dans le canal de chasse
        if (impostorEvent.channelId) {
            const huntChannel = guild.channels.cache.get(impostorEvent.channelId) as TextChannel;
            if (huntChannel) {
                const discoveryEmbed = new EmbedBuilder()
                    .setColor(0x57F287) // Vert
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

        // Notifier l'imposteur de son échec
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
        }, 60000); // 1 minute

        return {
            success: true,
            message: "🎉 Félicitations ! Tu as démasqué l'imposteur ! Tu gagnes 200 XP ! 💎"
        };

    } else {
        // MAUVAIS GUESS
        logger.info(`${username} made a wrong guess (suspected ${suspectId})`);

        // Retirer 50 XP
        if (generalChannel) {
            await addXP(userId, username, -50, generalChannel, false);
        }

        return {
            success: false,
            message: `❌ Ce n'était pas l'imposteur ! Tu perds 50 XP pour fausse accusation. 💔`
        };
    }
}

/**
 * Fonction de test pour l'événement Imposteur
 * Envoie juste l'embed sans donner d'XP et choisit toujours l'owner
 */
export async function testImpostorEmbed(client: Client, ownerId: string): Promise<void> {
    try {
        const user = await client.users.fetch(ownerId);

        // Générer 3 missions pour le test
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
        const endTime = Date.now() + (2 * 60 * 60 * 1000);

        const impostorEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🕵️ MISSION IMPOSTEUR !")
            .setDescription(
                `Tu as été secrètement choisi comme **IMPOSTEUR** ! 🎭\n\n` +
                `**Ta mission :** Accomplir les 3 tâches suivantes **discrètement** dans les **2 prochaines heures** :\n\n` +
                `1️⃣ ${missions[0]}\n` +
                `2️⃣ ${missions[1]}\n` +
                `3️⃣ ${missions[2]}\n\n` +
                `⚠️ **Règles :**\n` +
                `• Agis **naturellement** - Ne te fais pas remarquer !\n` +
                `• Personne d'autre ne sait que tu es l'imposteur\n` +
                `• Tu as jusqu'à <t:${Math.floor(endTime / 1000)}:t> pour compléter\n\n` +
                `**Récompense :** 400 XP 💎\n\n` +
                `⏰ Temps limite : <t:${Math.floor(endTime / 1000)}:R>`
            )
            .setFooter({text: "Tu peux désactiver les missions imposteur avec /event-preferences"})
            .setTimestamp();

        await user.send({embeds: [impostorEmbed]});
        logger.info(`Impostor test embed sent to owner ${ownerId} (NO EVENT CREATED - NO XP GIVEN)`);

    } catch (error: any) {
        if (error.code === 50007) {
            logger.warn(`Cannot send impostor test to owner ${ownerId} (DMs closed)`);
            throw new Error("L'owner a ses DMs fermés");
        } else {
            logger.error(`Error sending impostor test:`, error);
            throw error;
        }
    }
}

/**
 * Initialise le service d'événements aléatoires
 */
export function initializeRandomEventsService(client: Client): void {
    logger.info("Random Events Service initialized");

    // Vérifier les événements expirés toutes les minutes
    setInterval(async () => {
        await checkExpiredEvents(client);
    }, 60000);

    // TODO: Ajouter la planification aléatoire des événements
}
