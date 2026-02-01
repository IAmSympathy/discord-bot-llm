import {Client, GuildMember, PartialGuildMember, TextChannel} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {LLMMessageService, LLMMessageType} from "./llmMessageService";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";

const logger = createLogger("WelcomeService");

/**
 * Génère et envoie un message de bienvenue personnalisé pour un nouveau membre
 */
export async function sendWelcomeMessage(member: GuildMember, client: Client): Promise<void> {
    try {
        const welcomeChannelId = EnvConfig.WATCH_CHANNEL_ID;
        if (!welcomeChannelId) {
            logger.warn("WATCH_CHANNEL_ID not configured");
            return;
        }

        const channel = await member.guild.channels.fetch(welcomeChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            logger.warn("Welcome channel not found or not a text channel");
            return;
        }

        // Vérifier si l'utilisateur a déjà un profil (c'est un retour)
        const existingProfile = UserProfileService.getProfile(member.user.id);
        const isReturning = existingProfile !== null;

        // Déterminer le type de message
        const messageType = isReturning ? LLMMessageType.WELCOME_BACK : LLMMessageType.WELCOME;

        // Générer et envoyer le message via LLMMessageService
        await LLMMessageService.generateMessage({
            type: messageType,
            userId: member.user.id,
            userName: member.user.username,
            channel,
            client,
            mentionUser: true
        });

    } catch (error) {
        logger.error("Error sending welcome message:", error);
    }
}

/**
 * Génère et envoie un message d'au revoir personnalisé pour un membre qui quitte
 */
export async function sendGoodbyeMessage(member: GuildMember | PartialGuildMember, client: Client): Promise<void> {
    try {
        const goodbyeChannelId = EnvConfig.WATCH_CHANNEL_ID;
        if (!goodbyeChannelId) {
            logger.warn("WATCH_CHANNEL_ID not configured");
            return;
        }

        const channel = await member.guild.channels.fetch(goodbyeChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            logger.warn("Goodbye channel not found or not a text channel");
            return;
        }

        // Ajouter un fait au profil de l'utilisateur pour indiquer qu'il a quitté le serveur
        try {
            const currentDate = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            await UserProfileService.addFact(
                member.user.id,
                member.user.username,
                `A quitté le serveur le ${currentDate}`
            );
            logger.info(`✅ Added departure fact to profile for ${member.user.username}`);
        } catch (error) {
            logger.error(`Error adding departure fact to profile:`, error);
        }

        // Générer et envoyer le message via LLMMessageService
        await LLMMessageService.generateMessage({
            type: LLMMessageType.GOODBYE,
            userId: member.user.id,
            userName: member.user.username,
            channel,
            client
        });

    } catch (error) {
        logger.error("Error sending goodbye message:", error);
    }
}
