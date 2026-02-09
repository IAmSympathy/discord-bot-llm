import {AttachmentBuilder, Client, EmbedBuilder, Guild, Message, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {endEvent, sendGeneralAnnouncement, startEvent} from "./eventChannelManager";
import {BossData, getRandomBoss} from "./bossData";
import * as path from "path";
import * as fs from "fs";

const logger = createLogger("BossEvent");

// ========== CONSTANTES ==========

/**
 * Délai ENTRE les suppressions de messages (en millisecondes)
 */
const MESSAGE_DELETE_DELAY = 800;

/**
 * File d'attente pour espacer les suppressions de messages
 */
let deletionQueue: NodeJS.Timeout | null = null;
let pendingDeletions: Message[] = [];

/**
 * Ajoute un message à la file d'attente de suppression
 */
function queueMessageDeletion(message: Message): void {
    pendingDeletions.push(message);

    // Si aucune suppression n'est en cours, démarrer le traitement
    if (!deletionQueue) {
        processNextDeletion();
    }
}

/**
 * Traite la prochaine suppression dans la file
 */
async function processNextDeletion(): Promise<void> {
    if (pendingDeletions.length === 0) {
        deletionQueue = null;
        return;
    }

    const message = pendingDeletions.shift()!;

    try {
        await message.delete();
    } catch (error) {
        // Ignorer les erreurs de suppression (message déjà supprimé, etc.)
    }

    // Attendre le délai avant de traiter le prochain message
    deletionQueue = setTimeout(() => {
        processNextDeletion();
    }, MESSAGE_DELETE_DELAY);
}

// ========== FONCTIONS UTILITAIRES ==========

/**
 * Crée l'embed d'annonce du boss
 */
function createBossAnnouncementEmbed(boss: BossData, currentHp: number, endTime: number, isTest: boolean): EmbedBuilder {
    const hpPercentage = (currentHp / boss.hp) * 100;
    const hpBar = createHpBar(currentHp, boss.hp);


    return new EmbedBuilder()
        .setColor(0x9B59B6) // Violet/Pourpre
        .setTitle(`👑 ${boss.name.toUpperCase()} 👑`)
        .setThumbnail("attachment://event_boss_badge.png")
        .setImage(`attachment://${path.basename(boss.imagePath)}`)
        .setDescription(
            `${boss.description}\n\n` +
            `**Points de Vie :** ${currentHp}/${boss.hp} HP\n` +
            `${hpBar}\n\n` +
            `**Dégâts par message :** ${boss.damagePerMessage} HP\n` +
            `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
            `**Récompenses/Pénalités :**\n` +
            `🏆 XP partagé : **${boss.sharedXP}** 💫 entre tous les participants\n` +
            `⭐ Bonus coup final : **+${boss.finalBlowXP} XP** 💫\n` +
            `💔 Échec : **${boss.failurePenalty} XP** 💫 pour TOUS les membres !\n\n` +
            `⚔️ Envoyez des messages ici pour attaquer !\n` +
            (isTest ? "\n⚠️ *Mode TEST - Aucun XP ne sera distribué/perdu.*" : "")
        )
        .setFooter({text: "Chaque message inflige des dégâts !"})
        .setTimestamp();
}

/**
 * Crée une barre de vie visuelle
 */
function createHpBar(currentHp: number, maxHp: number): string {
    const percentage = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
    const filledBlocks = Math.floor(percentage / 10); // 10 blocs max
    const emptyBlocks = 10 - filledBlocks;

    const filled = "🟥".repeat(filledBlocks);
    const empty = "⬛".repeat(emptyBlocks);

    return `${filled}${empty}`;
}

/**
 * Crée l'embed d'annonce pour le salon général
 */
function createGeneralAnnouncementEmbed(boss: BossData, endTime: number, eventChannelId: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("👑 Nouvel Événement : Combat de Boss Épique !")
        .setDescription(
            `Un **${boss.name}** menace le serveur !\n\n` +
            `**Boss :** ${boss.name}\n` +
            `**Points de Vie :** ${boss.hp} HP\n` +
            `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
            `**Récompenses :**\n` +
            `• ${boss.sharedXP} XP partagés 💫\n` +
            `• +${boss.finalBlowXP} XP pour le coup final 🏆\n` +
            `**Pénalité :** ${boss.failurePenalty} XP si échec\n\n` +
            `⚔️ Participez dans <#${eventChannelId}>\n` +
            `🤝 Unissez vos forces pour vaincre ce boss !`
        )
        .setTimestamp();
}

/**
 * Crée l'embed de victoire
 */
function createVictoryEmbed(finalBlowUserId: string, boss: BossData, totalMessages: number, participantCount: number, sharedXp: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x57F287) // Vert
        .setTitle("🏆 BOSS VAINCU !")
        .setDescription(
            `Le **${boss.name}** a été terrassé ! ⚔️\n\n` +
            `**Coup final porté par :** <@${finalBlowUserId}>\n` +
            `**Messages envoyés :** ${totalMessages}\n` +
            `**Participants :** ${participantCount}\n\n` +
            `**Récompenses distribuées :**\n` +
            `• ${sharedXp} XP pour chaque participant 💫\n` +
            `• +${boss.finalBlowXP} XP bonus pour <@${finalBlowUserId}> 🏆\n\n` +
            `Félicitations à tous pour cette victoire épique !`
        )
        .setFooter({text: "Le salon se fermera dans 5 minutes..."})
        .setTimestamp();
}

/**
 * Crée l'embed d'expiration
 */
function createExpirationEmbed(boss: BossData, currentHp: number, totalMessages: number, memberCount: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xED4245) // Rouge
        .setTitle("⏰ TEMPS ÉCOULÉ !")
        .setDescription(
            `Le temps est écoulé ! **${boss.name}** a fait un ravage et s'est enfui...\n\n` +
            `**HP restants :** ${currentHp}/${boss.hp}\n` +
            `**Messages envoyés :** ${totalMessages}\n\n` +
            `**💔 Pénalité : ${boss.failurePenalty} XP pour TOUS les ${memberCount} membres du serveur !**\n\n` +
            `Vous étiez si proches ! Réessayez la prochaine fois !`
        )
        .setFooter({text: "Le salon se fermera dans 5 minutes..."})
        .setTimestamp();
}

// ========== FONCTIONS PRINCIPALES ==========

/**
 * ÉVÉNEMENT : BOSS
 * Les joueurs doivent vaincre un boss en envoyant des messages
 * XP partagé entre tous + bonus pour le coup final
 */
export async function startBossEvent(client: Client, guild: Guild, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Vérifier qu'il n'y a pas déjà un événement boss actif
        if (eventsData.activeEvents.some(e => e.type === EventType.BOSS)) {
            logger.info("Boss event already active, skipping");
            return;
        }

        // Sélectionner un boss aléatoire
        const boss = getRandomBoss();

        // Créer et enregistrer l'événement via l'event manager
        const result = await startEvent(
            client,
            guild,
            EventType.BOSS,
            "combat-boss",
            "👑",
            boss.duration, // Utiliser la durée du boss
            {
                bossId: boss.id,
                bossName: boss.name,
                bossDescription: boss.description,
                bossImagePath: boss.imagePath,
                maxHp: boss.hp,
                currentHp: boss.hp,
                damagePerMessage: boss.damagePerMessage,
                finalBlowXP: boss.finalBlowXP,
                sharedXP: boss.sharedXP,
                failurePenalty: boss.failurePenalty,
                winnerId: null,
                participants: [] as string[],
                messageCount: 0,
                isTest: isTest
            },
            true // allowMessages = true pour permettre aux joueurs d'attaquer
        );

        if (!result) {
            logger.error("Failed to start boss event");
            return;
        }

        const {eventId, channel} = result;
        const endTime = Date.now() + boss.duration;

        // Créer les attachments pour les images
        const attachments: AttachmentBuilder[] = [];

        // 1. Badge de l'événement (thumbnail)
        const badgePath = path.join(process.cwd(), "assets", "event_boss_badge.png");
        if (fs.existsSync(badgePath)) {
            attachments.push(new AttachmentBuilder(badgePath, {name: "event_boss_badge.png"}));
        }

        // 2. Image du boss (si elle existe)
        const bossImagePath = path.join(process.cwd(), "assets", boss.imagePath);
        if (fs.existsSync(bossImagePath)) {
            attachments.push(new AttachmentBuilder(bossImagePath, {name: path.basename(boss.imagePath)}));
        }

        // Envoyer l'annonce dans le canal d'événement avec tous les attachments
        const bossEmbed = createBossAnnouncementEmbed(boss, boss.hp, endTime, isTest);
        const announcementMessage = await channel.send({
            embeds: [bossEmbed],
            files: attachments.length > 0 ? attachments : undefined
        });

        // Sauvegarder l'ID du message d'annonce pour les mises à jour
        const updatedEventsData = loadEventsData();
        const eventToUpdate = updatedEventsData.activeEvents.find(e => e.id === eventId);
        if (eventToUpdate) {
            eventToUpdate.data.announcementMessageId = announcementMessage.id;
            saveEventsData(updatedEventsData);
        }

        // Programmer les mises à jour de la barre de vie toutes les 3 secondes
        const updateInterval = setInterval(async () => {
            try {
                const currentEventsData = loadEventsData();
                const currentEvent = currentEventsData.activeEvents.find(e => e.id === eventId);

                if (!currentEvent || currentEvent.data.winnerId) {
                    // Événement terminé, arrêter les mises à jour
                    clearInterval(updateInterval);
                    return;
                }

                const updatedEmbed = createBossAnnouncementEmbed(
                    boss,
                    currentEvent.data.currentHp,
                    endTime,
                    isTest
                );

                await announcementMessage.edit({embeds: [updatedEmbed]});
            } catch (error) {
                logger.error("Error updating boss HP display:", error);
                clearInterval(updateInterval);
            }
        }, 3000); // 3 secondes

        // Envoyer une annonce dans le salon général (sauf si test)
        const generalEmbed = createGeneralAnnouncementEmbed(boss, endTime, channel.id);
        await sendGeneralAnnouncement(guild, generalEmbed, isTest);

        logger.info(`Boss event started! Boss: ${boss.name}, HP: ${boss.hp}, Duration: ${boss.duration / 60000} minutes`);

        // Programmer la fin automatique après expiration
        setTimeout(async () => {
            clearInterval(updateInterval); // Arrêter les mises à jour
            await endBossEvent(client, eventId, guild);
        }, boss.duration);

    } catch (error) {
        logger.error("Error starting boss event:", error);
    }
}

/**
 * Gère un message dans le salon de combat de boss
 */
export async function handleBossMessage(client: Client, message: Message): Promise<void> {
    try {
        const eventsData = loadEventsData();
        const bossEvent = eventsData.activeEvents.find(e => e.type === EventType.BOSS);

        if (!bossEvent || bossEvent.channelId !== message.channelId) {
            return; // Pas d'événement boss actif dans ce salon
        }

        const userId = message.author.id;
        const username = message.author.username;

        // Ajouter le participant s'il n'est pas déjà dans la liste
        if (!bossEvent.data.participants.includes(userId)) {
            bossEvent.data.participants.push(userId);
        }

        // Incrémenter le compteur de messages
        bossEvent.data.messageCount++;

        // Infliger des dégâts
        const damage = bossEvent.data.damagePerMessage;
        bossEvent.data.currentHp = Math.max(0, bossEvent.data.currentHp - damage);

        logger.info(`${username} attacked boss for ${damage} damage. HP: ${bossEvent.data.currentHp}/${bossEvent.data.maxHp}`);

        // Ajouter le message à la file d'attente de suppression
        queueMessageDeletion(message);

        // Vérifier si le boss est vaincu
        if (bossEvent.data.currentHp <= 0) {
            logger.info(`Boss defeated by ${username}!`);

            // Marquer le gagnant (coup final)
            bossEvent.data.winnerId = userId;
            saveEventsData(eventsData);

            const channel = message.channel as TextChannel;

            // Mettre à jour l'embed immédiatement pour afficher 0 HP
            if (bossEvent.data.announcementMessageId) {
                try {
                    const announcementMessage = await channel.messages.fetch(bossEvent.data.announcementMessageId);
                    const boss: BossData = {
                        id: bossEvent.data.bossId,
                        name: bossEvent.data.bossName,
                        description: bossEvent.data.bossDescription,
                        imagePath: bossEvent.data.bossImagePath,
                        hp: bossEvent.data.maxHp,
                        damagePerMessage: bossEvent.data.damagePerMessage,
                        duration: 0,
                        finalBlowXP: bossEvent.data.finalBlowXP,
                        sharedXP: bossEvent.data.sharedXP,
                        failurePenalty: bossEvent.data.failurePenalty
                    };
                    const finalEmbed = createBossAnnouncementEmbed(
                        boss,
                        0, // HP = 0 pour montrer que le boss est mort
                        Date.now() + bossEvent.data.duration,
                        bossEvent.data.isTest
                    );
                    await announcementMessage.edit({embeds: [finalEmbed]});
                } catch (error) {
                    logger.error("Error updating boss HP to 0:", error);
                }
            }

            // VERROUILLER LE SALON immédiatement pour empêcher les messages supplémentaires
            try {
                await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                    SendMessages: false
                });
                logger.info(`Channel ${channel.name} locked after victory`);
            } catch (error) {
                logger.error("Error locking channel:", error);
            }

            // Calculer l'XP partagé par participant
            const participantCount = bossEvent.data.participants.length;
            const sharedXpPerParticipant = Math.floor(bossEvent.data.sharedXP / participantCount);

            // Donner l'XP à tous les participants (sauf si test)
            if (!bossEvent.data.isTest) {
                for (const participantId of bossEvent.data.participants) {
                    try {
                        const member = await message.guild!.members.fetch(participantId);
                        const xpAmount = participantId === userId
                            ? sharedXpPerParticipant + bossEvent.data.finalBlowXP  // Bonus pour le coup final
                            : sharedXpPerParticipant;

                        await addXP(participantId, member.user.username, xpAmount, channel, false);
                        logger.info(`${member.user.username} gained ${xpAmount} XP from boss defeat`);
                    } catch (error) {
                        logger.error(`Error giving XP to participant ${participantId}:`, error);
                    }
                }
            } else {
                logger.info("Test mode: XP rewards skipped");
            }

            // Annoncer la victoire avec ping de tous les participants
            const boss: BossData = {
                id: bossEvent.data.bossId,
                name: bossEvent.data.bossName,
                description: bossEvent.data.bossDescription,
                imagePath: bossEvent.data.bossImagePath,
                hp: bossEvent.data.maxHp,
                damagePerMessage: bossEvent.data.damagePerMessage,
                duration: 0, // Pas utilisé ici
                finalBlowXP: bossEvent.data.finalBlowXP,
                sharedXP: bossEvent.data.sharedXP,
                failurePenalty: bossEvent.data.failurePenalty
            };

            const winEmbed = createVictoryEmbed(
                userId,
                boss,
                bossEvent.data.messageCount,
                participantCount,
                sharedXpPerParticipant
            );

            const participantPings = bossEvent.data.participants.map((id: string) => `<@${id}>`).join(' ');
            await channel.send({
                content: participantPings,
                embeds: [winEmbed]
            });

            // Terminer l'événement après 1 seconde
            setTimeout(async () => {
                await endEvent(client, bossEvent.id, message.guild!, "completed", 300000);
            }, 1000);

        } else {
            // Sauvegarder les données mises à jour
            saveEventsData(eventsData);
        }

    } catch (error) {
        logger.error("Error handling boss message:", error);
    }
}

/**
 * Termine l'événement Boss
 */
async function endBossEvent(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const event = eventsData.activeEvents.find(e => e.id === eventId);

    if (!event) {
        logger.warn(`Boss event ${eventId} not found`);
        return;
    }

    const isCompleted = !!event.data.winnerId;
    const participants = event.data.participants || [];

    // Si pas complété, envoyer un message d'expiration et appliquer les pénalités À TOUS
    if (!isCompleted && event.channelId) {
        try {
            const channel = guild.channels.cache.get(event.channelId) as TextChannel;
            if (channel) {
                const boss: BossData = {
                    id: event.data.bossId,
                    name: event.data.bossName,
                    description: event.data.bossDescription,
                    imagePath: event.data.bossImagePath,
                    hp: event.data.maxHp,
                    damagePerMessage: event.data.damagePerMessage,
                    duration: 0, // Pas utilisé ici
                    finalBlowXP: event.data.finalBlowXP,
                    sharedXP: event.data.sharedXP,
                    failurePenalty: event.data.failurePenalty
                };

                // Récupérer TOUS les membres du serveur (pas seulement les participants)
                const allMembers = await guild.members.fetch();
                const memberCount = allMembers.filter(m => !m.user.bot).size;

                const expiredEmbed = createExpirationEmbed(boss, event.data.currentHp, event.data.messageCount, memberCount);

                // Ping tous les participants s'il y en a
                const content = participants.length > 0
                    ? participants.map((id: string) => `<@${id}>`).join(' ')
                    : undefined;

                await channel.send({
                    content: content,
                    embeds: [expiredEmbed]
                });

                // Appliquer la pénalité XP à TOUS les membres du serveur (sauf bots et sauf si test)
                if (!event.data.isTest) {
                    for (const [memberId, member] of allMembers) {
                        // Ignorer les bots
                        if (member.user.bot) continue;

                        try {
                            await addXP(memberId, member.user.username, boss.failurePenalty, channel, false);
                            logger.info(`${member.user.username} lost ${Math.abs(boss.failurePenalty)} XP for failing to defeat ${boss.name}`);
                        } catch (error) {
                            logger.error(`Error applying penalty to member ${memberId}:`, error);
                        }
                    }
                    logger.info(`Applied ${boss.failurePenalty} XP penalty to all ${memberCount} server members`);
                } else {
                    logger.info("Test mode: XP penalties skipped");
                }
            }
        } catch (error) {
            logger.error("Error sending expiration message:", error);
        }
    }

    // Terminer l'événement via l'event manager
    await endEvent(client, eventId, guild, isCompleted ? "completed" : "expired");
}
