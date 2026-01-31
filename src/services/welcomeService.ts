import {Client, GuildMember, PartialGuildMember, TextChannel} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {processLLMRequest} from "../queue/queue";
import {FileMemory} from "../memory/fileMemory";

const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH || "./data/memory.json";
const memory = new FileMemory(MEMORY_FILE_PATH);
const MEMORY_MAX_TURNS = parseInt(process.env.MEMORY_MAX_TURNS || "50", 10);

/**
 * Enregistre un message de bienvenue/au revoir dans la mémoire de manière propre
 * (sans les instructions techniques)
 */
async function recordWelcomeGoodbyeInMemory(
    userId: string,
    userName: string,
    channelId: string,
    channelName: string,
    eventType: 'welcome' | 'welcome_back' | 'goodbye',
    netriCSAResponse: string
): Promise<void> {
    try {
        // Créer un contexte simple et lisible pour la mémoire
        const userContext = eventType === 'welcome'
            ? `${userName} a rejoint le serveur pour la première fois`
            : eventType === 'welcome_back'
                ? `${userName} est revenu sur le serveur`
                : `${userName} a quitté le serveur`;

        await memory.appendTurn(
            {
                ts: Date.now(),
                discordUid: userId,
                displayName: userName,
                channelId: channelId,
                channelName: channelName,
                userText: userContext,
                assistantText: netriCSAResponse,
                isPassive: false
            },
            MEMORY_MAX_TURNS
        );

        console.log(`[WelcomeService] ✅ Recorded ${eventType} in memory for ${userName}`);
    } catch (error) {
        console.error(`[WelcomeService] Error recording in memory:`, error);
    }
}

/**
 * Génère et envoie un message de bienvenue personnalisé pour un nouveau membre
 */
export async function sendWelcomeMessage(member: GuildMember, client: Client): Promise<void> {
    try {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        if (!welcomeChannelId) {
            console.warn("[WelcomeService] WELCOME_CHANNEL_ID not configured");
            return;
        }

        const channel = await member.guild.channels.fetch(welcomeChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            console.warn("[WelcomeService] Welcome channel not found or not a text channel");
            return;
        }

        console.log(`[WelcomeService] Generating welcome message for ${member.user.username}...`);

        // Vérifier si l'utilisateur a déjà un profil (c'est un retour)
        const existingProfile = UserProfileService.getProfile(member.user.id);
        const isReturning = existingProfile !== null;

        // Créer le prompt en fonction du type de message
        const prompt = isReturning
            ? `<@${member.user.id}> revient sur le serveur !

Écris DIRECTEMENT ton message de bon retour (sans introduction comme "je vais générer" ou "voici le message"). Ton message DOIT contenir :
- La mention <@${member.user.id}>
- Un accueil "bon retour" chaleureux (tu le connais déjà !)
- Le salon <#1158184382679498832> pour se rappeller comment naviguer sur le serveur
- Une invitation à parler AVEC TOI dans <#1464063041950974125> ou en te mentionnant

Réponds DIRECTEMENT avec ton message de bienvenue, rien d'autre.`
            : `<@${member.user.id}> vient de rejoindre le serveur !

Écris DIRECTEMENT ton message de bienvenue (sans introduction comme "je vais générer" ou "voici le message"). Ton message DOIT contenir :
- La mention <@${member.user.id}>
- Un accueil chaleureux
- Le salon <#1158184382679498832> pour apprendre à naviguer sur le serveur
- Une invitation à parler AVEC TOI dans <#1464063041950974125> ou en te mentionnant

Réponds DIRECTEMENT avec ton message de bienvenue, rien d'autre.`;

        // Récupérer le nombre de messages avant l'envoi
        const messagesBefore = await channel.messages.fetch({limit: 1});
        const lastMessageIdBefore = messagesBefore.first()?.id;

        // Utiliser processLLMRequest avec skipMemory pour éviter l'enregistrement automatique
        await processLLMRequest({
            prompt,
            userId: member.user.id,
            userName: member.user.username,
            channel,
            client,
            sendMessage: true,
            skipMemory: true // Ne pas enregistrer le prompt technique
        });

        console.log(`[WelcomeService] ✅ ${isReturning ? 'Welcome back' : 'Welcome'} message sent for ${member.user.username}`);

        // Attendre un peu pour que le message soit envoyé
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Récupérer le nouveau message envoyé par Netricsa
        const messagesAfter = await channel.messages.fetch({limit: 5});
        const newMessage = Array.from(messagesAfter.values()).find(
            msg => msg.author.id === client.user?.id && msg.id !== lastMessageIdBefore
        );

        if (newMessage) {
            // Enregistrer dans la mémoire avec un contexte propre
            await recordWelcomeGoodbyeInMemory(
                member.user.id,
                member.user.username,
                channel.id,
                channel.name,
                isReturning ? 'welcome_back' : 'welcome',
                newMessage.content
            );
        }
    } catch (error) {
        console.error("[WelcomeService] Error sending welcome message:", error);

        // Fallback en cas d'erreur
        try {
            const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
            if (welcomeChannelId) {
                const channel = await member.guild.channels.fetch(welcomeChannelId) as TextChannel;
                const existingProfile = UserProfileService.getProfile(member.user.id);
                const isReturning = existingProfile !== null;

                const fallbackMessage = isReturning
                    ? `👋 Bon retour sur le serveur, <@${member.user.id}> ! Content de te revoir. Passe par <#1158184382679498832> si besoin de te remettre à jour. N'hésite pas à venir me parler dans <#1464063041950974125> ou en me mentionnant si tu as besoin de moi !`
                    : `👋 Bienvenue sur le serveur, <@${member.user.id}> ! Va jeter un œil à <#1158184382679498832> pour apprendre à naviguer ici. N'hésite pas à venir me parler dans <#1464063041950974125> ou en me mentionnant si tu veux discuter avec moi !`;

                // Dans le fallback, enregistrer aussi
                const sentMessage = await channel.send(fallbackMessage);
                await recordWelcomeGoodbyeInMemory(
                    member.user.id,
                    member.user.username,
                    channel.id,
                    channel.name,
                    isReturning ? 'welcome_back' : 'welcome',
                    sentMessage.content
                );
                console.log(`[WelcomeService] ⚠️ Fallback welcome message sent for ${member.user.username}`);
            }
        } catch (fallbackError) {
            console.error("[WelcomeService] Error sending fallback message:", fallbackError);
        }
    }
}

/**
 * Génère et envoie un message d'au revoir personnalisé pour un membre qui quitte
 */
export async function sendGoodbyeMessage(member: GuildMember | PartialGuildMember, client: Client): Promise<void> {
    try {
        const goodbyeChannelId = process.env.WELCOME_CHANNEL_ID;
        if (!goodbyeChannelId) {
            console.warn("[WelcomeService] WELCOME_CHANNEL_ID not configured");
            return;
        }

        const channel = await member.guild.channels.fetch(goodbyeChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            console.warn("[WelcomeService] Goodbye channel not found or not a text channel");
            return;
        }

        console.log(`[WelcomeService] Generating goodbye message for ${member.user.username}...`);

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
            console.log(`[WelcomeService] ✅ Added departure fact to profile for ${member.user.username}`);
        } catch (error) {
            console.error(`[WelcomeService] Error adding departure fact to profile:`, error);
        }

        // Créer le prompt pour le message d'au revoir
        const prompt = `${member.user.username} vient de quitter le serveur.

Écris DIRECTEMENT ton message d'au revoir (sans introduction comme "je vais générer"). 1-2 phrases maximum, respectueux et bienveillant.

Réponds DIRECTEMENT avec ton message, rien d'autre.`;

        // Récupérer le nombre de messages avant l'envoi
        const messagesBefore = await channel.messages.fetch({limit: 1});
        const lastMessageIdBefore = messagesBefore.first()?.id;

        // Utiliser processLLMRequest avec skipMemory pour éviter l'enregistrement automatique
        await processLLMRequest({
            prompt,
            userId: member.user.id,
            userName: member.user.username,
            channel,
            client,
            sendMessage: true,
            skipMemory: true // Ne pas enregistrer le prompt technique
        });

        console.log(`[WelcomeService] ✅ Goodbye message sent for ${member.user.username}`);

        // Attendre un peu pour que le message soit envoyé
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Récupérer le nouveau message envoyé par Netricsa
        const messagesAfter = await channel.messages.fetch({limit: 5});
        const newMessage = Array.from(messagesAfter.values()).find(
            msg => msg.author.id === client.user?.id && msg.id !== lastMessageIdBefore
        );

        if (newMessage) {
            // Enregistrer dans la mémoire avec un contexte propre
            await recordWelcomeGoodbyeInMemory(
                member.user.id,
                member.user.username,
                channel.id,
                channel.name,
                'goodbye',
                newMessage.content
            );
        }
    } catch (error) {
        console.error("[WelcomeService] Error sending goodbye message:", error);

        // Fallback en cas d'erreur
        try {
            const goodbyeChannelId = process.env.WELCOME_CHANNEL_ID;
            if (goodbyeChannelId) {
                const channel = await member.guild.channels.fetch(goodbyeChannelId) as TextChannel;
                const sentMessage = await channel.send(`👋 ${member.user.username} a quitté le serveur. Bon courage pour la suite !`);
                // Dans le fallback, enregistrer aussi
                await recordWelcomeGoodbyeInMemory(
                    member.user.id,
                    member.user.username,
                    channel.id,
                    channel.name,
                    'goodbye',
                    sentMessage.content
                );
                console.log(`[WelcomeService] ⚠️ Fallback goodbye message sent for ${member.user.username}`);
            }
        } catch (fallbackError) {
            console.error("[WelcomeService] Error sending fallback message:", fallbackError);
        }
    }
}
