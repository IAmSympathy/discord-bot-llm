import {Client, Guild, GuildMember, TextChannel} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {processLLMRequest} from "../queue/queue";
import {FileMemory} from "../memory/fileMemory";
import {isLowPowerMode} from "./botStateService";
import * as fs from "fs";
import * as path from "path";

/**
 * Service pour gérer les anniversaires des utilisateurs
 * Vérifie quotidiennement et envoie un message de félicitations avec attribution de rôle
 */

const BIRTHDAY_STATE_FILE = path.join(process.cwd(), "data", "birthday_state.json");
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const BIRTHDAY_ROLE_ID = process.env.BIRTHDAY_ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;

const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH || "./data/memory.json";
const memory = new FileMemory(MEMORY_FILE_PATH);
const MEMORY_MAX_TURNS = parseInt(process.env.MEMORY_MAX_TURNS || "50", 10);

// Cas spécial : Tah-Um (ton userId)
const SPECIAL_USER_ID = "288799652902469633"; // Tah-Um - anniversaire décalé d'un jour

interface BirthdayState {
    lastCheck: string; // Date au format YYYY-MM-DD
    celebratedToday: string[]; // Liste des userId déjà célébrés aujourd'hui
}

/**
 * Charge l'état des anniversaires
 */
function loadBirthdayState(): BirthdayState {
    try {
        if (fs.existsSync(BIRTHDAY_STATE_FILE)) {
            const data = fs.readFileSync(BIRTHDAY_STATE_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("[BirthdayService] Error loading birthday state:", error);
    }
    return {
        lastCheck: "",
        celebratedToday: []
    };
}

/**
 * Sauvegarde l'état des anniversaires
 */
function saveBirthdayState(state: BirthdayState): void {
    try {
        const dir = path.dirname(BIRTHDAY_STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(BIRTHDAY_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
    } catch (error) {
        console.error("[BirthdayService] Error saving birthday state:", error);
    }
}

/**
 * Obtient la date du jour au format YYYY-MM-DD
 */
function getTodayDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * Enregistre un message d'anniversaire dans la mémoire
 */
async function recordBirthdayInMemory(
    userId: string,
    userName: string,
    channelId: string,
    channelName: string,
    netriCSAResponse: string,
    isSpecialDelayed: boolean = false
): Promise<void> {
    try {
        const userContext = isSpecialDelayed
            ? `C'était l'anniversaire de ${userName} hier`
            : `C'est l'anniversaire de ${userName}`;

        console.log(`[BirthdayService] 💾 Recording birthday message in memory:`);
        console.log(`  - User context: "${userContext}"`);
        console.log(`  - Response (${netriCSAResponse.length} chars): "${netriCSAResponse.substring(0, 100)}..."`);

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

        console.log(`[BirthdayService] ✅ Successfully recorded birthday message in memory for ${userName}`);
    } catch (error) {
        console.error(`[BirthdayService] ❌ Error recording in memory:`, error);
    }
}

/**
 * Crée un message d'anniversaire fallback
 */
function createFallbackBirthdayMessage(userId: string, age?: number): string {
    let message = `**Joyeux anniversaire <@${userId}> !**`;
    if (age) {
        message += `\n\nTu as maintenant **${age} ans** ! Profite bien de ta journée !`;
    } else {
        message += `\n\nProfite bien de ta journée !`;
    }
    return message;
}

/**
 * Célèbre l'anniversaire de Tah-Um avec un message décalé d'un jour
 * Note: Pas de rôle d'anniversaire car c'est le lendemain
 */
async function celebrateSpecialBirthday(
    client: Client,
    guild: Guild,
    userId: string,
    username: string,
    age?: number
): Promise<boolean> {
    try {
        console.log(`[BirthdayService] 🎭 Special birthday celebration for ${username} (delayed by 1 day - NO ROLE)`);

        if (!WELCOME_CHANNEL_ID) return true;

        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!(channel instanceof TextChannel)) {
            console.warn("[BirthdayService] Welcome channel not found or not a text channel");
            return true;
        }

        // Vérifier si le bot est en Low Power Mode
        if (isLowPowerMode()) {
            console.log(`[BirthdayService] Low Power Mode - using fallback special birthday message`);
            const fallbackMessage = `<@${userId}> Est-ce que vous aviez oublié ?`;
            const sentMessage = await channel.send(fallbackMessage);
            await recordBirthdayInMemory(userId, username, channel.id, channel.name, sentMessage.content, true);
            return true;
        }

        console.log(`[BirthdayService] Generating special delayed birthday message via LLM...`);

        // Prompt spécial pour ton cas
        const ageInfo = age ? ` qui avait ${age} ans hier` : '';
        const prompt = `C'était l'anniversaire de <@${userId}> ${ageInfo} HIER !

Écris DIRECTEMENT ton message d'anniversaire décalé avec un ton taquin/sarcastique. Ton message DOIT ABSOLUMENT contenir la mention <@${userId}>.

Ton message DOIT :
- Contenir la mention <@${userId}>
- Commencer par "Est-ce que vous aviez oublié ?" ou une variante
- Avoir un ton taquin, sarcastique et drôle
- Mentionner que c'était HIER
- Être court (2-3 phrases max)

Réponds DIRECTEMENT avec ton message qui contient <@${userId}>, rien d'autre.`;

        // Générer le message via LLM
        const finalResponse = await processLLMRequest({
            prompt,
            userId: userId,
            userName: username,
            channel,
            client,
            sendMessage: false,
            skipMemory: true,
            returnResponse: true
        });

        if (!finalResponse) {
            console.warn(`[BirthdayService] ⚠️ No response received, using fallback special message`);
            const fallbackMessage = `<@${userId}> Est-ce que vous aviez oublié ? 😏🎂`;
            const sentMessage = await channel.send(fallbackMessage);
            await recordBirthdayInMemory(userId, username, channel.id, channel.name, sentMessage.content, true);
            return true;
        }

        // Vérifier si la mention est présente, sinon l'ajouter
        let messageToSend = finalResponse.trim();
        const mentionPattern = `<@${userId}>`;

        if (!messageToSend.includes(mentionPattern)) {
            console.log(`[BirthdayService] ⚠️ Mention missing in LLM response, adding it`);
            messageToSend = `${mentionPattern} ${messageToSend}`;
        }

        // Envoyer le message
        await channel.send(messageToSend);
        console.log(`[BirthdayService] ✅ Special delayed birthday message sent for ${username} (no role given)`);
        console.log(`[BirthdayService] 📝 Response (${messageToSend.length} chars): "${messageToSend.substring(0, 100)}..."`);

        // Enregistrer en mémoire avec isSpecialDelayed=true
        await recordBirthdayInMemory(userId, username, channel.id, channel.name, messageToSend, true);

        return true;
    } catch (error) {
        console.error(`[BirthdayService] Error celebrating special birthday for ${username}:`, error);
        return false;
    }
}

/**
 * Vérifie si c'était l'anniversaire d'hier de l'utilisateur spécial
 */
function getYesterdaySpecialBirthday(): { userId: string; username: string; age?: number } | null {
    try {
        const profile = UserProfileService.getProfile(SPECIAL_USER_ID);
        if (!profile?.birthday || !profile.birthday.notify) {
            return null;
        }

        // Calculer la date d'hier
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayDate = {
            day: yesterday.getDate(),
            month: yesterday.getMonth() + 1 // JavaScript months are 0-indexed
        };

        // Vérifier si c'était l'anniversaire hier
        if (profile.birthday.day === yesterdayDate.day && profile.birthday.month === yesterdayDate.month) {
            let age: number | undefined = undefined;
            if (profile.birthday.year) {
                age = now.getFullYear() - profile.birthday.year;
            }

            return {
                userId: profile.userId,
                username: profile.username,
                age
            };
        }

        return null;
    } catch (error) {
        console.error("[BirthdayService] Error checking yesterday's special birthday:", error);
        return null;
    }
}

/**
 * Célèbre l'anniversaire d'un utilisateur
 */
async function celebrateBirthday(
    client: Client,
    guild: Guild,
    userId: string,
    username: string,
    age?: number
): Promise<boolean> {
    try {
        // Récupérer le membre
        let member: GuildMember;
        try {
            member = await guild.members.fetch(userId);
        } catch (error) {
            console.log(`[BirthdayService] User ${username} (${userId}) not found in guild`);
            return false;
        }

        // Ajouter le rôle d'anniversaire si configuré
        if (BIRTHDAY_ROLE_ID) {
            try {
                const role = await guild.roles.fetch(BIRTHDAY_ROLE_ID);
                if (role && !member.roles.cache.has(BIRTHDAY_ROLE_ID)) {
                    await member.roles.add(role);
                    console.log(`[BirthdayService] 🎉 Added birthday role to ${username}`);
                }
            } catch (error) {
                console.error(`[BirthdayService] Error adding birthday role to ${username}:`, error);
            }
        }

        // Envoyer le message de félicitations
        if (!WELCOME_CHANNEL_ID) return true;

        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!(channel instanceof TextChannel)) {
            console.warn("[BirthdayService] Welcome channel not found or not a text channel");
            return true;
        }

        // Vérifier si le bot est en Low Power Mode
        if (isLowPowerMode()) {
            console.log(`[BirthdayService] Low Power Mode - using fallback birthday message for ${username}`);
            const fallbackMessage = createFallbackBirthdayMessage(userId, age);
            await channel.send(fallbackMessage);
            console.log(`[BirthdayService] 🎂 Fallback birthday message sent for ${username}${age ? ` (${age} ans)` : ''}`);
            return true;
        }

        console.log(`[BirthdayService] Generating birthday message for ${username} via LLM...`);

        // Créer le prompt pour le LLM
        const ageInfo = age ? ` qui a maintenant ${age} ans` : '';
        const prompt = `C'est l'anniversaire de <@${userId}> (${username})${ageInfo} aujourd'hui ! 🎂

Écris DIRECTEMENT ton message d'anniversaire personnalisé. Ton message DOIT ABSOLUMENT contenir la mention <@${userId}> puis le contenu de ton message.

Ton message DOIT :
- Contenir la mention <@${userId}>
- Être chaleureux et festif
- Mentionner son âge (${age} ans) si tu le connais
- Être bref mais personnalisé selon ce que tu sais de cette personne

Réponds DIRECTEMENT avec ton message d'anniversaire qui contient <@${userId}>, rien d'autre.`;

        // Générer le message via LLM (processLLMRequest charge automatiquement le system prompt et server prompt)
        const finalResponse = await processLLMRequest({
            prompt,
            userId: userId,
            userName: username,
            channel,
            client,
            sendMessage: false, // Ne pas envoyer automatiquement, on va vérifier la mention d'abord
            skipMemory: true,
            returnResponse: true
        });

        if (!finalResponse) {
            console.warn(`[BirthdayService] ⚠️ No response received from processLLMRequest, using fallback`);
            const fallbackMessage = createFallbackBirthdayMessage(userId, age);
            const sentMessage = await channel.send(fallbackMessage);
            await recordBirthdayInMemory(userId, username, channel.id, channel.name, sentMessage.content);
            return true;
        }

        // Vérifier si la mention est présente, sinon l'ajouter
        let messageToSend = finalResponse.trim();
        const mentionPattern = `<@${userId}>`;

        if (!messageToSend.includes(mentionPattern)) {
            console.log(`[BirthdayService] ⚠️ Mention missing in LLM response, adding it`);
            messageToSend = `${mentionPattern} ${messageToSend}`;
        }

        // Envoyer le message avec la mention garantie
        await channel.send(messageToSend);
        console.log(`[BirthdayService] ✅ Birthday message sent for ${username}${age ? ` (${age} ans)` : ''}`);
        console.log(`[BirthdayService] 📝 Response (${messageToSend.length} chars): "${messageToSend.substring(0, 100)}..."`);

        // Enregistrer en mémoire
        await recordBirthdayInMemory(userId, username, channel.id, channel.name, messageToSend);

        return true;
    } catch (error) {
        console.error(`[BirthdayService] Error celebrating birthday for ${username}:`, error);

        // Fallback en cas d'erreur
        try {
            if (WELCOME_CHANNEL_ID) {
                const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
                if (channel instanceof TextChannel) {
                    const fallbackMessage = createFallbackBirthdayMessage(userId, age);
                    const sentMessage = await channel.send(fallbackMessage);
                    await recordBirthdayInMemory(userId, username, channel.id, channel.name, sentMessage.content);
                    console.log(`[BirthdayService] ⚠️ Fallback birthday message sent for ${username}`);
                }
            }
        } catch (fallbackError) {
            console.error("[BirthdayService] Error sending fallback birthday message:", fallbackError);
        }

        return false;
    }
}

/**
 * Retire le rôle d'anniversaire de tous les membres qui l'ont
 * (à faire chaque jour pour nettoyer les rôles de la veille)
 */
async function cleanupBirthdayRoles(guild: Guild): Promise<void> {
    if (!BIRTHDAY_ROLE_ID) return;

    try {
        const role = await guild.roles.fetch(BIRTHDAY_ROLE_ID);
        if (!role) return;

        const members = role.members;
        console.log(`[BirthdayService] 🧹 Cleaning up birthday role from ${members.size} member(s)`);

        for (const [, member] of members) {
            try {
                await member.roles.remove(role);
                console.log(`[BirthdayService] 🧹 Removed birthday role from ${member.user.username}`);
            } catch (error) {
                console.error(`[BirthdayService] Error removing birthday role from ${member.user.username}:`, error);
            }
        }
    } catch (error) {
        console.error("[BirthdayService] Error cleaning up birthday roles:", error);
    }
}

/**
 * Vérifie et célèbre les anniversaires du jour
 */
async function checkBirthdays(client: Client): Promise<void> {
    if (!GUILD_ID) {
        console.log("[BirthdayService] GUILD_ID not configured, skipping birthday check");
        return;
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            console.log("[BirthdayService] Guild not found");
            return;
        }

        const today = getTodayDate();
        const state = loadBirthdayState();

        // Si c'est un nouveau jour, réinitialiser la liste et nettoyer les rôles
        if (state.lastCheck !== today) {
            console.log(`[BirthdayService] 🎂 New day detected, checking for birthdays...`);

            // Nettoyer les rôles d'anniversaire de la veille
            await cleanupBirthdayRoles(guild);

            state.lastCheck = today;
            state.celebratedToday = [];
        }

        // Récupérer les anniversaires du jour
        const birthdays = UserProfileService.getTodayBirthdays();

        // Célébrer les anniversaires d'aujourd'hui
        if (birthdays.length > 0) {
            console.log(`[BirthdayService] 🎉 Found ${birthdays.length} birthday(s) today!`);

            for (const birthday of birthdays) {
                // Vérifier si déjà célébré aujourd'hui
                if (state.celebratedToday.includes(birthday.userId)) {
                    console.log(`[BirthdayService] Already celebrated ${birthday.username} today`);
                    continue;
                }

                const success = await celebrateBirthday(
                    client,
                    guild,
                    birthday.userId,
                    birthday.username,
                    birthday.age
                );

                if (success) {
                    state.celebratedToday.push(birthday.userId);
                }
            }
        } else {
            console.log("[BirthdayService] No birthdays today");
        }

        // Cas spécial : Vérifier si c'était l'anniversaire de Tah-Um hier (toujours vérifier, même s'il n'y a pas d'anniversaires aujourd'hui)
        const specialBirthday = getYesterdaySpecialBirthday();
        if (specialBirthday) {
            console.log(`[BirthdayService] 🎭 Special case detected: ${specialBirthday.username}'s birthday was yesterday!`);

            // Vérifier si déjà célébré
            if (!state.celebratedToday.includes(specialBirthday.userId)) {
                const success = await celebrateSpecialBirthday(
                    client,
                    guild,
                    specialBirthday.userId,
                    specialBirthday.username,
                    specialBirthday.age
                );

                if (success) {
                    state.celebratedToday.push(specialBirthday.userId);
                }
            } else {
                console.log(`[BirthdayService] Special birthday already celebrated today for ${specialBirthday.username}`);
            }
        }

        saveBirthdayState(state);
    } catch (error) {
        console.error("[BirthdayService] Error checking birthdays:", error);
    }
}

/**
 * Initialise le service de vérification des anniversaires
 * Vérifie toutes les heures
 */
export function initializeBirthdayService(client: Client): void {
    if (!WELCOME_CHANNEL_ID) {
        console.log("[BirthdayService] WELCOME_CHANNEL_ID not configured, birthday notifications disabled");
        return;
    }

    if (!GUILD_ID) {
        console.log("[BirthdayService] GUILD_ID not configured, birthday service disabled");
        return;
    }

    console.log("[BirthdayService] ✅ Birthday service initialized");
    console.log(`[BirthdayService] Birthday role: ${BIRTHDAY_ROLE_ID || 'Not configured (role will not be given)'}`);

    // Vérification immédiate au démarrage (après 5 secondes)
    setTimeout(() => {
        checkBirthdays(client).catch(error => {
            console.error("[BirthdayService] Error in initial birthday check:", error);
        });
    }, 5000); // 5 secondes

    // Vérification toutes les heures
    setInterval(() => {
        checkBirthdays(client).catch(error => {
            console.error("[BirthdayService] Error in scheduled birthday check:", error);
        });
    }, 60 * 60 * 1000); // 1 heure
}
