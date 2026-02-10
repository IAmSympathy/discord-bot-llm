import {AttachmentBuilder, Client, EmbedBuilder, Guild} from "discord.js";
import {createLogger} from "../../utils/logger";
import * as path from "path";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";

const logger = createLogger("MysteryBox");

/**
 * ÉVÉNEMENT : COLIS MYSTÈRE
 * Un utilisateur aléatoire actif reçoit un colis mystère avec de l'XP bonus
 */
export async function startMysteryBox(client: Client, guild: Guild, testUserId?: string, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Récupérer tous les utilisateurs actifs
        const {getAllStats} = require("../userStatsService");
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

                return true;
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
                        ? `Tu as reçu un **colis mystère** ! 🎁\n\n` +
                        `**Contenu :** 🖕\n\n` +
                        `Dommage ! Ce colis était vide... ou pire ! 😈\n\n` +
                        `Retente ta chance la prochaine fois !` +
                        (isTest ? "\n\n⚠️ *Ceci est un TEST. Aucun XP ne serait réellement perdu.*" : "")
                        : `Tu as reçu un **colis mystère** ! 🎁\n\n` +
                        `**Contenu :** ${xpAmount} XP 💫\n\n` +
                        `Ce colis a été livré aléatoirement parmi les utilisateurs actifs du serveur.\n\n` +
                        `🍀 C'est ton jour de chance !` +
                        (isTest ? "\n\n⚠️ *Ceci est un événement de TEST. Les récompenses réelles ne seront pas distribuées.*" : "")
                )
                .setThumbnail("attachment://parcel_badge.png")
                .setFooter({text: "Tu peux désactiver les colis mystère avec /event-preferences"})
                .setTimestamp();

            await user.send({embeds: [mysteryBoxEmbed], files: [badgeAttachment]});
            logger.info(`Mystery box sent to ${selectedUser.username} (${isTroll ? '🖕' : xpAmount + ' XP'})${isTest ? ' [TEST MODE]' : ''}`);

            // Donner l'XP (sauf si c'est un test ou un troll)
            // Utiliser skipMultiplier=true pour les mystery box (récompense fixe)
            if (!isTest && !isTroll) {
                const {addXP} = require("../xpSystem");
                await addXP(selectedUser.userId, selectedUser.username, xpAmount, undefined, false, true);

                // Ajouter à l'historique
                eventsData.history.push({
                    eventId: `mysterybox_${Date.now()}`,
                    type: EventType.MYSTERY_BOX,
                    timestamp: Date.now(),
                    participants: [selectedUser.userId],
                    winners: [selectedUser.userId]
                });
                saveEventsData(eventsData);
            } else if (isTest) {
                logger.info("Test mode: XP reward skipped");
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
 * NOTE: Cette fonction n'est plus utilisée, utilisez startMysteryBox avec isTest=true à la place
 */
/*
export async function testMysteryBoxEmbed(client: Client, userId: string): Promise<void> {
    // Cette fonction est deprecated, utilisez startMysteryBox(client, guild, userId, true) à la place
}
*/

