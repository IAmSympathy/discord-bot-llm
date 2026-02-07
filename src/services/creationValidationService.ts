import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, TextChannel} from "discord.js";
import {EnvConfig} from "../utils/envConfig";
import {OWNER_ID} from "./botStateService";
import {addXP, XP_REWARDS} from "./xpSystem";

const logger = createLogger("CreationValidation");
const VALIDATION_FILE = path.join(DATA_DIR, "pending_creations.json");

/**
 * Validation en attente pour un post de création
 */
interface PendingCreation {
    userId: string;
    username: string;
    threadId: string;
    threadName: string;
    messageId: string;
    timestamp: number;
    validated: boolean;
}

/**
 * Base de données des validations en attente
 */
interface ValidationDatabase {
    [threadId: string]: PendingCreation;
}

/**
 * Charge les validations en attente depuis le fichier
 */
function loadPendingCreations(): ValidationDatabase {
    try {
        if (fs.existsSync(VALIDATION_FILE)) {
            const data = fs.readFileSync(VALIDATION_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading pending creations:", error);
    }
    return {};
}

/**
 * Sauvegarde les validations en attente dans le fichier
 */
function savePendingCreations(data: ValidationDatabase): void {
    try {
        const dir = path.dirname(VALIDATION_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(VALIDATION_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving pending creations:", error);
    }
}

/**
 * Envoie une demande de validation pour un post de création
 */
export async function requestCreationValidation(
    client: Client,
    userId: string,
    username: string,
    threadId: string,
    threadName: string
): Promise<void> {
    try {
        const LOG_CHANNEL_ID = EnvConfig.LOG_CHANNEL_ID;
        if (!LOG_CHANNEL_ID) {
            logger.error("LOG_CHANNEL_ID not configured");
            return;
        }

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID) as TextChannel;
        if (!logChannel) {
            logger.error("Log channel not found");
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange
            .setTitle("🎨 Nouvelle Création à Valider")
            .setDescription(
                `**Utilisateur:** <@${userId}>\n` +
                `**Thread:** [${threadName}](https://discord.com/channels/${logChannel.guild.id}/${threadId})\n` +
                `**Date:** <t:${Math.floor(Date.now() / 1000)}:R>\n\n` +
                `⚠️ En attente de validation pour attribution de **${XP_REWARDS.postCreation} XP**`
            )
            .setFooter({text: `Thread ID: ${threadId}`})
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`validate_creation_${threadId}`)
                    .setLabel("✅ Valider")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_creation_${threadId}`)
                    .setLabel("❌ Rejeter")
                    .setStyle(ButtonStyle.Danger)
            );

        const message = await logChannel.send({
            content: `<@${OWNER_ID}>`,
            embeds: [embed],
            components: [row]
        });

        // Sauvegarder la validation en attente
        const data = loadPendingCreations();
        data[threadId] = {
            userId,
            username,
            threadId,
            threadName,
            messageId: message.id,
            timestamp: Date.now(),
            validated: false
        };
        savePendingCreations(data);

        logger.info(`Validation request sent for creation by ${username} in thread ${threadId}`);
    } catch (error) {
        logger.error("Error sending validation request:", error);
    }
}

/**
 * Valide une création et donne l'XP
 */
export async function validateCreation(
    client: Client,
    threadId: string,
    validatorId: string
): Promise<{ success: boolean; message: string }> {
    const data = loadPendingCreations();
    const pending = data[threadId];

    if (!pending) {
        return {success: false, message: "Validation introuvable"};
    }

    if (pending.validated) {
        return {success: false, message: "Déjà validée"};
    }

    try {
        // Récupérer le thread pour envoyer l'XP
        const thread = await client.channels.fetch(threadId) as TextChannel;
        if (!thread) {
            return {success: false, message: "Thread introuvable"};
        }

        // Donner l'XP
        await addXP(pending.userId, pending.username, XP_REWARDS.postCreation, thread, false);

        // Marquer comme validée
        pending.validated = true;
        savePendingCreations(data);

        logger.info(`Creation validated by ${validatorId} for user ${pending.username} (${XP_REWARDS.postCreation} XP awarded)`);

        return {
            success: true,
            message: `✅ Création validée ! ${XP_REWARDS.postCreation} XP attribués à <@${pending.userId}>`
        };
    } catch (error) {
        logger.error("Error validating creation:", error);
        return {success: false, message: `Erreur: ${error}`};
    }
}

/**
 * Rejette une création (pas d'XP)
 */
export async function rejectCreation(
    threadId: string,
    validatorId: string
): Promise<{ success: boolean; message: string }> {
    const data = loadPendingCreations();
    const pending = data[threadId];

    if (!pending) {
        return {success: false, message: "Validation introuvable"};
    }

    if (pending.validated) {
        return {success: false, message: "Déjà traitée"};
    }

    // Marquer comme validée (mais sans XP)
    pending.validated = true;
    savePendingCreations(data);

    logger.info(`Creation rejected by ${validatorId} for user ${pending.username} (no XP awarded)`);

    return {
        success: true,
        message: `❌ Création rejetée - Aucun XP attribué`
    };
}

/**
 * Vérifie si une création est déjà validée
 */
export function isCreationValidated(threadId: string): boolean {
    const data = loadPendingCreations();
    const pending = data[threadId];
    return pending?.validated ?? false;
}
