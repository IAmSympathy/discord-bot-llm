import {Client, DMChannel, TextChannel} from "discord.js";
import {processLLMRequest} from "../queue/queue";
import {FileMemory} from "../memory/fileMemory";
import {isLowPowerMode} from "./botStateService";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";

const logger = createLogger("LLMMessageService");
const MEMORY_FILE_PATH = EnvConfig.MEMORY_FILE_PATH;
const memory = new FileMemory(MEMORY_FILE_PATH);
const MEMORY_MAX_TURNS = EnvConfig.MEMORY_MAX_TURNS;

/**
 * Type de message généré par le LLM
 */
export enum LLMMessageType {
    WELCOME = 'welcome',
    WELCOME_BACK = 'welcome_back',
    GOODBYE = 'goodbye',
    BIRTHDAY = 'birthday',
    BIRTHDAY_SPECIAL = 'birthday_special'
}

/**
 * Options pour la génération de message LLM
 */
export interface LLMMessageOptions {
    type: LLMMessageType;
    userId: string;
    userName: string;
    channel: TextChannel | DMChannel;
    client: Client;
    age?: number;
    mentionUser?: boolean;
}

/**
 * Messages fallback par type
 */
const FALLBACK_MESSAGES: Record<LLMMessageType, (userId: string, userName: string, age?: number) => string> = {
    [LLMMessageType.WELCOME]: (userId) =>
        `👋 Bienvenue sur le serveur, <@${userId}> ! Va jeter un œil à <#1158184382679498832> pour apprendre à naviguer ici. N'hésite pas à venir me parler dans <#1464063041950974125> ou en me mentionnant si tu veux discuter avec moi !`,

    [LLMMessageType.WELCOME_BACK]: (userId) =>
        `👋 Bon retour sur le serveur, <@${userId}> ! Content de te revoir. Passe par <#1158184382679498832> si besoin de te remettre à jour. N'hésite pas à venir me parler dans <#1464063041950974125> ou en me mentionnant si tu as besoin de moi !`,

    [LLMMessageType.GOODBYE]: (userId, userName) =>
        `👋 ${userName} a quitté le serveur. Bon courage pour la suite !`,

    [LLMMessageType.BIRTHDAY]: (userId, userName, age) =>
        age
            ? `🎉 Joyeux anniversaire <@${userId}> ! Tu as maintenant **${age} ans** ! Profite bien de ta journée ! 🎂`
            : `🎉 Joyeux anniversaire <@${userId}> ! Profite bien de ta journée ! 🎂`,

    [LLMMessageType.BIRTHDAY_SPECIAL]: (userId) =>
        `<@${userId}> Est-ce que vous aviez oublié ? 😏🎂`
};

/**
 * Prompts par type de message
 */
const MESSAGE_PROMPTS: Record<LLMMessageType, (userId: string, userName: string, age?: number) => string> = {
    [LLMMessageType.WELCOME]: (userId, userName) => `<@${userId}> (${userName}) vient de rejoindre le serveur !

Écris DIRECTEMENT ton message de bienvenue. Ton message DOIT ABSOLUMENT contenir la mention <@${userId}> puis le contenu de ton message.

Ton message DOIT contenir :
- La mention <@${userId}>
- Un accueil chaleureux
- Le salon <#1158184382679498832> pour apprendre à naviguer sur le serveur
- Une invitation à parler AVEC TOI dans <#1464063041950974125> ou en te mentionnant (ne te mentionne pas toi-même)

Réponds DIRECTEMENT avec ton message qui contient <@${userId}>, rien d'autre.`,

    [LLMMessageType.WELCOME_BACK]: (userId, userName) => `<@${userId}> (${userName}) revient sur le serveur !

Écris DIRECTEMENT ton message de bon retour. Ton message DOIT ABSOLUMENT contenir la mention <@${userId}> puis le contenu de ton message.

Ton message DOIT contenir :
- La mention <@${userId}>
- Un accueil "bon retour" chaleureux (tu le connais déjà !)
- Le salon <#1158184382679498832> pour se rappeler comment naviguer sur le serveur
- Une invitation à parler AVEC TOI dans <#1464063041950974125> ou en te mentionnant (ne te mentionne pas toi-même)

Réponds DIRECTEMENT avec ton message qui contient <@${userId}>, rien d'autre.`,

    [LLMMessageType.GOODBYE]: (userId, userName) => `${userName} vient de quitter le serveur.

Écris DIRECTEMENT ton message d'au revoir. RÈGLES IMPORTANTES:
1. Parle de ${userName} à la TROISIÈME PERSONNE  car cette personne N'EST PLUS sur le serveur
2. NE DIS PAS "tu" ou "te" - cette personne ne peut pas te lire
3. Parle de lui/elle aux autres membres restants
4. 2-3 phrases, respectueux et bienveillant

Exemple: "${userName} nous quitte... Il va nous manquer."

Réponds DIRECTEMENT avec ton message à la 3ème personne, rien d'autre.`,

    [LLMMessageType.BIRTHDAY]: (userId, userName, age) => {
        const ageInfo = age ? ` qui a maintenant ${age} ans` : '';
        return `C'est l'anniversaire de <@${userId}>${ageInfo} aujourd'hui !

Écris DIRECTEMENT ton message d'anniversaire. Ton message DOIT ABSOLUMENT contenir la mention <@${userId}>.

Ton message DOIT :
- Contenir la mention <@${userId}>
- Souhaiter un joyeux anniversaire
- Être chaleureux et enthousiaste
${age ? `- Mentionner l'âge (${age} ans)` : ''}
- Être court (2-3 phrases max)

Réponds DIRECTEMENT avec ton message qui contient <@${userId}>, rien d'autre.`;
    },

    [LLMMessageType.BIRTHDAY_SPECIAL]: (userId, userName, age) => {
        const ageInfo = age ? ` qui avait ${age} ans hier` : '';
        return `C'était l'anniversaire de <@${userId}> ${ageInfo} HIER !

Écris DIRECTEMENT ton message d'anniversaire décalé avec un ton taquin/sarcastique. Ton message DOIT ABSOLUMENT contenir la mention <@${userId}>.

Ton message DOIT :
- Contenir la mention <@${userId}>
- Commencer par "Est-ce que vous aviez oublié ?" ou une variante
- Avoir un ton taquin, sarcastique et drôle
- Mentionner que c'était HIER
- Être court (2-3 phrases max)

Réponds DIRECTEMENT avec ton message qui contient <@${userId}>, rien d'autre.`;
    }
};

/**
 * Contexte utilisateur pour la mémoire
 */
const MEMORY_CONTEXT: Record<LLMMessageType, (userName: string) => string> = {
    [LLMMessageType.WELCOME]: (userName) => `${userName} a rejoint le serveur pour la première fois`,
    [LLMMessageType.WELCOME_BACK]: (userName) => `${userName} est revenu sur le serveur`,
    [LLMMessageType.GOODBYE]: (userName) => `${userName} a quitté le serveur`,
    [LLMMessageType.BIRTHDAY]: (userName) => `C'est l'anniversaire de ${userName}`,
    [LLMMessageType.BIRTHDAY_SPECIAL]: (userName) => `C'était l'anniversaire de ${userName} hier`
};

/**
 * Service centralisé pour la génération de messages LLM
 * Utilisé par welcomeService et birthdayService
 */
export class LLMMessageService {
    /**
     * Génère un message via LLM ou utilise le fallback
     */
    static async generateMessage(options: LLMMessageOptions): Promise<string> {
        const {type, userId, userName, channel, client, age, mentionUser = false} = options;

        // Vérifier si le bot est en Low Power Mode
        if (isLowPowerMode()) {
            logger.info(`Low Power Mode - using fallback for ${type}`);
            const fallbackMessage = FALLBACK_MESSAGES[type](userId, userName, age);
            await channel.send(fallbackMessage);
            await this.recordInMemory(userId, userName, channel.id, (channel as any).name || 'DM', type, fallbackMessage);
            return fallbackMessage;
        }

        logger.info(`Generating ${type} message for ${userName}...`);

        // Créer le prompt
        const prompt = MESSAGE_PROMPTS[type](userId, userName, age);

        // Générer le message via LLM
        try {
            const finalResponse = await processLLMRequest({
                prompt,
                userId,
                userName,
                channel,
                client,
                sendMessage: true,
                skipMemory: true,
                returnResponse: true
            });

            if (!finalResponse) {
                logger.warn(`⚠️ No response received, using fallback`);
                const fallbackMessage = FALLBACK_MESSAGES[type](userId, userName, age);
                await channel.send(fallbackMessage);
                await this.recordInMemory(userId, userName, channel.id, (channel as any).name || 'DM', type, fallbackMessage);
                return fallbackMessage;
            }

            // Assurer que la mention est présente si nécessaire
            const messageToSend = this.ensureMention(finalResponse, userId, mentionUser);

            // Enregistrer dans la mémoire
            logger.info(`📝 Response received (${messageToSend.length} chars)`);
            await this.recordInMemory(userId, userName, channel.id, (channel as any).name || 'DM', type, messageToSend);

            logger.info(`✅ ${type} message generated for ${userName}`);
            return messageToSend;
        } catch (error) {
            logger.error(`Error generating message:`, error);

            // Fallback en cas d'erreur
            const fallbackMessage = FALLBACK_MESSAGES[type](userId, userName, age);
            await channel.send(fallbackMessage);
            await this.recordInMemory(userId, userName, channel.id, (channel as any).name || 'DM', type, fallbackMessage);
            logger.info(`⚠️ Fallback message sent for ${userName}`);
            return fallbackMessage;
        }
    }

    /**
     * Enregistre un message dans la mémoire
     */
    private static async recordInMemory(
        userId: string,
        userName: string,
        channelId: string,
        channelName: string,
        messageType: LLMMessageType,
        response: string
    ): Promise<void> {
        try {
            const userContext = MEMORY_CONTEXT[messageType](userName);

            logger.info(`💾 Recording ${messageType} in memory:`);
            logger.info(`  - User context: "${userContext}"`);
            logger.info(`  - Response (${response.length} chars): "${response.substring(0, 100)}..."`);

            await memory.appendTurn(
                {
                    ts: Date.now(),
                    discordUid: userId,
                    displayName: userName,
                    channelId: channelId,
                    channelName: channelName,
                    userText: userContext,
                    assistantText: response,
                    isPassive: false
                },
                MEMORY_MAX_TURNS
            );

            logger.info(`✅ Successfully recorded ${messageType} in memory for ${userName}`);
        } catch (error) {
            logger.error(`❌ Error recording in memory:`, error);
        }
    }

    /**
     * Assure que le message contient la mention de l'utilisateur si nécessaire
     */
    private static ensureMention(message: string, userId: string, shouldMention: boolean): string {
        if (!shouldMention) return message;

        const mentionPattern = `<@${userId}>`;
        if (!message.includes(mentionPattern)) {
            logger.info(`⚠️ Mention missing, adding it`);
            return `${mentionPattern} ${message}`;
        }
        return message;
    }
}
