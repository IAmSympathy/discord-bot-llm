import {AttachmentBuilder, Client, EmbedBuilder, Guild, Message, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {endEvent, sendGeneralAnnouncement, startEvent} from "./eventChannelManager";
import {BossData, getRandomMiniBoss} from "./bossData";
import * as path from "path";
import * as fs from "fs";

const logger = createLogger("MiniBossEvent");

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
 * Crée l'embed d'annonce du mini boss
 */
function createBossAnnouncementEmbed(boss: BossData, currentHp: number, endTime: number, isTest: boolean): EmbedBuilder {
    const hpPercentage = (currentHp / boss.hp) * 100;
    const hpBar = createHpBar(currentHp, boss.hp);


    // Message spécial pour le Kamikaze
    if (boss.isSpecial) {
        return new EmbedBuilder()
            .setColor(0xFF0000) // Rouge vif pour urgence
            .setTitle(`💥 ALERTE URGENTE : ${boss.name.toUpperCase()} ! 💥`)
            .setThumbnail("attachment://event_boss_badge.png")
            .setImage(`attachment://${path.basename(boss.imagePath)}`)
            .setDescription(
                `${boss.description}\n\n` +
                `⏰ **TEMPS RESTANT :** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
                `**CONSÉQUENCES :**\n` +
                `💔 Si personne ne l'arrête : **${boss.failurePenalty} XP** 💫 pour TOUS les membres !\n` +
                `🦸 Le héros qui se sacrifie : **${boss.finalBlowXP} XP 💫** (mais sauve tout le monde)\n\n` +
                `⚡ **AGISSEZ VITE !** Un seul message suffit pour l'arrêter !` +
                (isTest ? "\n\n⚠️ *Mode TEST - Aucun XP ne sera perdu.*" : "")
            )
            .setFooter({text: "Un héros doit se sacrifier pour sauver le serveur !"})
            .setTimestamp();
    }

    return new EmbedBuilder()
        .setColor(0xFF6B6B) // Rouge
        .setTitle(`⚔️ ${boss.name.toUpperCase()}`)
        .setThumbnail("attachment://event_boss_badge.png")
        .setImage(`attachment://${path.basename(boss.imagePath)}`)
        .setDescription(
            `${boss.description}\n\n` +
            `**Points de Vie :** ${currentHp}/${boss.hp} HP\n` +
            `${hpBar}\n\n` +
            `**Dégâts par message :** ${boss.damagePerMessage} HP\n` +
            `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
            `**Récompenses/Pénalités :**\n` +
            `🏆 Coup final : **+${boss.finalBlowXP} XP** 💫\n` +
            `💔 Échec : **${boss.failurePenalty} XP** 💫 pour TOUS les membres !\n\n` +
            `⚔️ Envoyez des messages ici pour attaquer !\n` +
            (isTest ? "\n\n⚠️ *Mode TEST - Aucun XP ne sera distribué/perdu.*" : "")
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
        .setColor(boss.isSpecial ? 0xFF0000 : 0xFF6B6B)
        .setTitle(boss.isSpecial ? "💥 ALERTE : Kamikaze en approche !" : "⚔️ Nouvel Événement : Combat de Mini Boss !")
        .setDescription(
            boss.isSpecial
                ? `⚠️ **UN KAMIKAZE FONCE VERS LE SERVEUR !**\n\n` +
                `Il va exploser et faire perdre ${boss.failurePenalty} XP à tous !\n\n` +
                `**Quelqu'un doit se sacrifier pour l'arrêter !**\n` +
                `⏰ Temps limite : <t:${Math.floor(endTime / 1000)}:R>\n\n` +
                `⚡ Participez dans <#${eventChannelId}>`
                : `Un **${boss.name}** vient d'apparaître !\n\n` +
                `**Boss :** ${boss.name}\n` +
                `**Points de Vie :** ${boss.hp} HP\n` +
                `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n` +
                `**Récompense :** +${boss.finalBlowXP} XP pour le coup final 💫\n` +
                `**Pénalité :** ${boss.failurePenalty} XP si échec\n\n` +
                `⚔️ Participez dans <#${eventChannelId}>\n` +
                `🏆 Portez le coup final pour gagner !`
        )
        .setTimestamp();
}

/**
 * Crée l'embed de victoire
 */
function createVictoryEmbed(userId: string, boss: BossData, totalMessages: number): EmbedBuilder {
    // Message spécial pour le Kamikaze
    if (boss.isSpecial) {
        return new EmbedBuilder()
            .setColor(0xF39C12) // Orange pour héroïsme
            .setTitle("🦸 UN HÉROS SE SACRIFIE !")
            .setDescription(
                `**<@${userId}>** s'est sacrifié pour arrêter le ${boss.name} ! ⚡\n\n` +
                `Le héros perd **${boss.finalBlowXP} XP** mais sauve tout le serveur de **${boss.failurePenalty} XP** !\n\n` +
                `**Messages envoyés :** ${totalMessages}\n\n` +
                `🙏 Merci pour ton sacrifice, héros !`
            )
            .setFooter({text: "Le salon se fermera dans 5 minutes..."})
            .setTimestamp();
    }

    return new EmbedBuilder()
        .setColor(0x57F287) // Vert
        .setTitle("🏆 MINI BOSS VAINCU !")
        .setDescription(
            `**<@${userId}>** a porté le coup final et vaincu le **${boss.name}** ! ⚔️\n\n` +
            `**Récompense :** +${boss.finalBlowXP} XP 💫\n` +
            `**Messages envoyés :** ${totalMessages}\n\n` +
            `Félicitations pour cette victoire épique !`
        )
        .setFooter({text: "Le salon se fermera dans 5 minutes..."})
        .setTimestamp();
}

/**
 * Crée l'embed d'expiration
 */
function createExpirationEmbed(boss: BossData, currentHp: number, totalMessages: number, memberCount: number): EmbedBuilder {
    // Message spécial pour le Kamikaze
    if (boss.isSpecial) {
        return new EmbedBuilder()
            .setColor(0xED4245) // Rouge
            .setTitle("💥 LE KAMIKAZE A EXPLOSÉ !")
            .setDescription(
                `Personne n'a arrêté le kamikaze à temps...\n\n` +
                `**💔 Pénalité : ${boss.failurePenalty} XP pour TOUS les ${memberCount} membres du serveur !**\n\n` +
                `Il fallait se sacrifier pour sauver le serveur !`
            )
            .setFooter({text: "Le salon se fermera dans 5 minutes..."})
            .setTimestamp();
    }

    return new EmbedBuilder()
        .setColor(0xED4245) // Rouge
        .setTitle("⏰ TEMPS ÉCOULÉ !")
        .setDescription(
            `Le temps est écoulé ! Le **${boss.name}** s'est enfui...\n\n` +
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
 * ÉVÉNEMENT : MINI BOSS
 * Les joueurs doivent vaincre un mini boss en envoyant des messages
 */
export async function startMiniBossEvent(client: Client, guild: Guild, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();


        // Vérifier qu'il n'y a pas déjà un événement mini boss actif
        if (eventsData.activeEvents.some(e => e.type === EventType.MINI_BOSS)) {
            logger.info("Mini boss event already active, skipping");
            return;
        }

        // Sélectionner un mini boss aléatoire
        const boss = getRandomMiniBoss();

        // Créer et enregistrer l'événement via l'event manager
        const result = await startEvent(
            client,
            guild,
            EventType.MINI_BOSS,
            "combat-mini-boss",
            "⚔️",
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
                failurePenalty: boss.failurePenalty,
                isSpecial: boss.isSpecial,
                winnerId: null,
                participants: [] as string[],
                messageCount: 0,
                isTest: isTest
            },
            true // allowMessages = true pour permettre aux joueurs d'attaquer
        );

        if (!result) {
            logger.error("Failed to start mini boss event");
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

        // Envoyer l'annonce dans le canal d'événement
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
                logger.error("Error updating mini boss HP display:", error);
                clearInterval(updateInterval);
            }
        }, 3000); // 3 secondes

        // Envoyer une annonce dans le salon général (sauf si test)
        const generalEmbed = createGeneralAnnouncementEmbed(boss, endTime, channel.id);
        await sendGeneralAnnouncement(guild, generalEmbed, isTest);

        logger.info(`Mini boss event started! Boss: ${boss.name}, HP: ${boss.hp}, Duration: ${boss.duration / 60000} minutes`);

        // Programmer la fin automatique après expiration
        setTimeout(async () => {
            clearInterval(updateInterval); // Arrêter les mises à jour
            await endMiniBossEvent(client, eventId, guild);
        }, boss.duration);

    } catch (error) {
        logger.error("Error starting mini boss event:", error);
    }
}

/**
 * Gère un message dans le salon de combat de mini boss
 */
export async function handleMiniBossMessage(client: Client, message: Message): Promise<void> {
    try {
        const eventsData = loadEventsData();
        const miniBossEvent = eventsData.activeEvents.find(e => e.type === EventType.MINI_BOSS);

        if (!miniBossEvent || miniBossEvent.channelId !== message.channelId) {
            return; // Pas d'événement mini boss actif dans ce salon
        }

        const userId = message.author.id;
        const username = message.author.username;

        // Ajouter le participant s'il n'est pas déjà dans la liste
        if (!miniBossEvent.data.participants.includes(userId)) {
            miniBossEvent.data.participants.push(userId);
        }

        // Incrémenter le compteur de messages
        miniBossEvent.data.messageCount++;

        // Infliger des dégâts
        const damage = miniBossEvent.data.damagePerMessage;
        miniBossEvent.data.currentHp = Math.max(0, miniBossEvent.data.currentHp - damage);

        logger.info(`${username} attacked mini boss for ${damage} damage. HP: ${miniBossEvent.data.currentHp}/${miniBossEvent.data.maxHp}`);

        // Ajouter le message à la file d'attente de suppression
        queueMessageDeletion(message);

        // Vérifier si le boss est vaincu
        if (miniBossEvent.data.currentHp <= 0) {
            logger.info(`Mini boss defeated by ${username}!`);

            // Marquer le gagnant
            miniBossEvent.data.winnerId = userId;
            saveEventsData(eventsData);

            const channel = message.channel as TextChannel;

            // Mettre à jour l'embed immédiatement pour afficher 0 HP
            if (miniBossEvent.data.announcementMessageId) {
                try {
                    const announcementMessage = await channel.messages.fetch(miniBossEvent.data.announcementMessageId);
                    const boss: BossData = {
                        id: miniBossEvent.data.bossId,
                        name: miniBossEvent.data.bossName,
                        description: miniBossEvent.data.bossDescription,
                        imagePath: miniBossEvent.data.bossImagePath,
                        hp: miniBossEvent.data.maxHp,
                        damagePerMessage: miniBossEvent.data.damagePerMessage,
                        duration: 0,
                        finalBlowXP: miniBossEvent.data.finalBlowXP,
                        failurePenalty: miniBossEvent.data.failurePenalty,
                        isSpecial: miniBossEvent.data.isSpecial
                    };
                    const endTime = miniBossEvent.startTime + miniBossEvent.data.duration || Date.now();
                    const finalEmbed = createBossAnnouncementEmbed(
                        boss,
                        0, // HP = 0
                        endTime,
                        miniBossEvent.data.isTest
                    );
                    await announcementMessage.edit({embeds: [finalEmbed]});
                } catch (error) {
                    logger.error("Error updating mini boss HP to 0:", error);
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

            // Annoncer la victoire avec ping de tous les participants
            const boss: BossData = {
                id: miniBossEvent.data.bossId,
                name: miniBossEvent.data.bossName,
                description: miniBossEvent.data.bossDescription,
                imagePath: miniBossEvent.data.bossImagePath,
                hp: miniBossEvent.data.maxHp,
                damagePerMessage: miniBossEvent.data.damagePerMessage,
                duration: 0, // Pas utilisé ici
                finalBlowXP: miniBossEvent.data.finalBlowXP,
                failurePenalty: miniBossEvent.data.failurePenalty,
                isSpecial: miniBossEvent.data.isSpecial
            };

            const winEmbed = createVictoryEmbed(userId, boss, miniBossEvent.data.messageCount);

            const participantPings = miniBossEvent.data.participants.map((id: string) => `<@${id}>`).join(' ');
            await channel.send({
                content: participantPings,
                embeds: [winEmbed]
            });

            // Donner l'XP au gagnant (sauf si test)
            if (!miniBossEvent.data.isTest) {
                await addXP(userId, username, boss.finalBlowXP, channel, false);
                logger.info(`${username} ${boss.finalBlowXP > 0 ? 'gained' : 'lost'} ${Math.abs(boss.finalBlowXP)} XP for ${boss.isSpecial ? 'sacrificing themselves' : 'defeating the mini boss'}`);
            } else {
                logger.info("Test mode: XP reward skipped");
            }

            // Terminer l'événement après 5 minutes
            setTimeout(async () => {
                await endEvent(client, miniBossEvent.id, message.guild!, "completed", 300000);
            }, 1000);

        } else {
            // Sauvegarder les données mises à jour
            saveEventsData(eventsData);
        }

    } catch (error) {
        logger.error("Error handling mini boss message:", error);
    }
}

/**
 * Termine l'événement Mini Boss
 */
async function endMiniBossEvent(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const event = eventsData.activeEvents.find(e => e.id === eventId);

    if (!event) {
        logger.warn(`Mini boss event ${eventId} not found`);
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
                    failurePenalty: event.data.failurePenalty,
                    isSpecial: event.data.isSpecial
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
