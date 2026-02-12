import {Client, GuildMember, PartialGuildMember, TextChannel} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";
import {DEFAULT_MEMBER_ROLE} from "../utils/constants";
import {FileMemory} from "../memory/fileMemory";

const logger = createLogger("WelcomeService");
const MEMORY_FILE_PATH = EnvConfig.MEMORY_FILE_PATH;
const MEMORY_MAX_TURNS = EnvConfig.MEMORY_MAX_TURNS;
const memory = new FileMemory(MEMORY_FILE_PATH);

/**
 * Variantes de messages pour bienvenue et au revoir
 */
const WELCOME_VARIANTS = [
    (userId: string) => `Bienvenue sur le serveur, <@${userId}> ! 👋 Va jeter un œil à <#1158184382679498832> pour apprendre à naviguer ici. N'hésite pas à venir me parler dans <#1464063041950974125> ou en me mentionnant si tu veux discuter avec moi ! 💬`,
    (userId: string) => `Salut <@${userId}> ! Content de te voir ici ! 😊 Si tu veux découvrir le serveur, passe par <#1158184382679498832>. Et si tu as besoin de moi, je suis dans <#1464063041950974125> ou tu peux me mentionner n'importe où ! 🎮`,
    (userId: string) => `Hey <@${userId}> ! Bienvenue parmi nous ! ✨ Commence par <#1158184382679498832> pour découvrir comment tout fonctionne. Tu peux me parler dans <#1464063041950974125> ou me mentionner quand tu veux ! 🚀`,
    (userId: string) => `<@${userId}> Tu es là ! Excellent ! 🌟 Va voir <#1158184382679498832> pour te familiariser avec le serveur. Si tu veux discuter, je suis disponible dans <#1464063041950974125> ou par mention ! 💡`,
    (userId: string) => `<@${userId}> Bienvenue à bord ! 🎉 Direction <#1158184382679498832> pour commencer ton aventure. Tu peux me contacter dans <#1464063041950974125> ou en me mentionnant si tu as besoin d'aide ! 🗺️`
];

const WELCOME_BACK_VARIANTS = [
    (userId: string) => `Bon retour sur le serveur, <@${userId}> ! 👋 Content de te revoir. Passe par <#1158184382679498832> si besoin de te remettre à jour. N'hésite pas à venir me parler dans <#1464063041950974125> ou en me mentionnant si tu as besoin de moi ! 😊`,
    (userId: string) => `Re <@${userId}> ! Tu nous as manqué ! 💙 Si tu as besoin d'un rappel, <#1158184382679498832> est toujours là. Je suis dans <#1464063041950974125> si tu veux discuter ! 💬`,
    (userId: string) => `Tiens, <@${userId}> est de retour ! Content de te revoir ! 😄 Un petit tour par <#1158184382679498832> pour te rafraîchir la mémoire ? Je suis dispo dans <#1464063041950974125> comme toujours ! ✨`,
    (userId: string) => `Regarde qui revient ! <@${userId}> ! Bienvenue à nouveau ! 🎊 <#1158184382679498832> t'attend si tu veux te remettre dans le bain. Tu me retrouves dans <#1464063041950974125> quand tu veux ! 🌟`,
    (userId: string) => `<@${userId}> est de retour parmi nous ! Bon retour ! 🎉 Si tu as besoin de te réacclimater, direction <#1158184382679498832>. Je suis toujours dans <#1464063041950974125> pour papoter ! 🗣️`
];

const GOODBYE_VARIANTS = [
    (displayName: string) => `${displayName} a quitté le serveur. Bon courage pour la suite ! 👋`,
    (displayName: string) => `${displayName} nous quitte... Bonne chance dans tes futures aventures ! 🌟`,
    (displayName: string) => `${displayName} vient de partir. À bientôt peut-être ! 💫`,
    (displayName: string) => `${displayName} s'en va. Que la force soit avec toi ! ⚡`,
    (displayName: string) => `${displayName} a pris la porte. On espère te revoir un jour ! 🚪`
];

/**
 * Sélectionne une variante aléatoire
 */
function getRandomVariant<T>(variants: T[]): T {
    return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Génère et envoie un message de bienvenue personnalisé pour un nouveau membre
 */
export async function sendWelcomeMessage(member: GuildMember, client: Client): Promise<void> {
    try {
        // Attribuer le rôle Beheaded et le rôle de niveau approprié au nouveau membre (sauf si c'est un bot)
        if (!member.user.bot && DEFAULT_MEMBER_ROLE) {
            try {
                await member.roles.add(DEFAULT_MEMBER_ROLE);
                logger.info(`✅ Assigned Beheaded role to ${member.user.username}`);

                // Importer le système XP pour obtenir le niveau actuel de l'utilisateur
                const {getUserLevel} = require("./xpSystem");
                const userLevel = getUserLevel(member.user.id);

                // Importer le service de rôles de niveau pour attribuer le bon rôle
                const {updateUserLevelRoles} = require("./levelRoleService");
                const roleResult = await updateUserLevelRoles(member.guild, member.user.id, userLevel);

                if (roleResult.changed && roleResult.newRole) {
                    logger.info(`✅ Assigned level role ${roleResult.newRole} (level ${userLevel}) to ${member.user.username}`);
                } else {
                    logger.info(`✅ User ${member.user.username} already has appropriate level role for level ${userLevel}`);
                }
            } catch (error) {
                logger.error(`Error assigning welcome roles to ${member.user.username}:`, error);

            }
        }

        const welcomeChannelId = EnvConfig.WELCOME_CHANNEL_ID;
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

        // Choisir une variante aléatoire du message approprié
        const welcomeMessage = isReturning
            ? getRandomVariant(WELCOME_BACK_VARIANTS)(member.user.id)
            : getRandomVariant(WELCOME_VARIANTS)(member.user.id);

        const userContext = isReturning
            ? `${member.user.username} est revenu sur le serveur`
            : `${member.user.username} a rejoint le serveur pour la première fois`;

        // Envoyer le message
        await channel.send(welcomeMessage);
        logger.info(`✅ Sent welcome message to ${member.user.username}`);

        // Enregistrer dans la mémoire
        await memory.appendTurn(
            {
                ts: Date.now(),
                discordUid: member.user.id,
                displayName: member.user.username,
                channelId: channel.id,
                channelName: channel.name,
                userText: userContext,
                assistantText: welcomeMessage
            },
            MEMORY_MAX_TURNS
        );
        logger.info(`💾 Recorded welcome message in memory for ${member.user.username}`);

    } catch (error) {
        logger.error("Error sending welcome message:", error);
    }
}

/**
 * Génère et envoie un message d'au revoir personnalisé pour un membre qui quitte
 */
export async function sendGoodbyeMessage(member: GuildMember | PartialGuildMember, client: Client): Promise<void> {
    try {
        const goodbyeChannelId = EnvConfig.WELCOME_CHANNEL_ID;
        if (!goodbyeChannelId) {
            logger.warn("WELCOME_CHANNEL_ID not configured");
            return;
        }

        const channel = await member.guild.channels.fetch(goodbyeChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            logger.warn("Goodbye channel not found or not a text channel");
            return;
        }

        // Ajouter un fait au profil de l'utilisateur pour indiquer qu'il a quitté le serveur
        try {
            await UserProfileService.addFact(
                member.user.id,
                member.user.username,
                `A quitté le serveur`
            );
            logger.info(`✅ Added departure fact to profile for ${member.user.username}`);

            // Vérifier les achievements de profil (ne pas notifier car l'utilisateur a quitté)
            const {checkProfileAchievements} = require("./achievementChecker");
            await checkProfileAchievements(member.user.id, member.user.username);
        } catch (error) {
            logger.error(`Error adding departure fact to profile:`, error);
        }

        // Message préfait d'au revoir (variante aléatoire)
        const goodbyeMessage = getRandomVariant(GOODBYE_VARIANTS)(member.user.displayName);
        const userContext = `${member.user.username} a quitté le serveur`;

        // Envoyer le message
        await channel.send(goodbyeMessage);
        logger.info(`✅ Sent goodbye message for ${member.user.username}`);

        // Enregistrer dans la mémoire
        await memory.appendTurn(
            {
                ts: Date.now(),
                discordUid: member.user.id,
                displayName: member.user.username,
                channelId: channel.id,
                channelName: channel.name,
                userText: userContext,
                assistantText: goodbyeMessage
            },
            MEMORY_MAX_TURNS
        );
        logger.info(`💾 Recorded goodbye message in memory for ${member.user.username}`);

    } catch (error) {
        logger.error("Error sending goodbye message:", error);
    }
}
