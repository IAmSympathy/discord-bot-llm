import {Client, Guild, GuildMember, TextChannel} from "discord.js";
import {UserProfileService} from "./userProfileService";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";
import {FileMemory} from "../memory/fileMemory";
import * as fs from "fs";
import * as path from "path";

const logger = createLogger("BirthdayService");
const MEMORY_FILE_PATH = EnvConfig.MEMORY_FILE_PATH;
const MEMORY_MAX_TURNS = EnvConfig.MEMORY_MAX_TURNS;
const memory = new FileMemory(MEMORY_FILE_PATH);

/**
 * Service pour gérer les anniversaires des utilisateurs
 * Vérifie quotidiennement et envoie un message de félicitations avec attribution de rôle
 */

const BIRTHDAY_STATE_FILE = path.join(process.cwd(), "data", "birthday_state.json");
const WELCOME_CHANNEL_ID = EnvConfig.WELCOME_CHANNEL_ID;
const BIRTHDAY_ROLE_ID = EnvConfig.BIRTHDAY_ROLE_ID;
const GUILD_ID = EnvConfig.GUILD_ID;


// Cas spécial : Tah-Um (ton userId)
const SPECIAL_USER_ID = "288799652902469633"; // Tah-Um - anniversaire décalé d'un jour

/**
 * Variantes de messages d'anniversaire
 */
const BIRTHDAY_VARIANTS = [
    (userId: string, age?: number) => age
        ? `Joyeux anniversaire <@${userId}> ! Tu as maintenant **${age} ans** ! Profite bien de ta journée ! 🎉🎂`
        : `Joyeux anniversaire <@${userId}> ! Profite bien de ta journée ! 🎉🎂`,
    (userId: string, age?: number) => age
        ? `C'est ton jour <@${userId}> ! **${age} ans** aujourd'hui ! Passe une excellente journée ! 🎂🎉`
        : `C'est ton jour <@${userId}> ! Passe une excellente journée ! 🎂🎉`,
    (userId: string, age?: number) => age
        ? `Bonne fête <@${userId}> ! **${age} ans** déjà ! Profite à fond de cette journée ! 🎈🎊`
        : `Bonne fête <@${userId}> ! Profite à fond de cette journée ! 🎈🎊`,
    (userId: string, age?: number) => age
        ? `Joyeux anniversaire <@${userId}> ! Bienvenue dans le club des **${age} ans** ! 🎊🎂`
        : `Joyeux anniversaire <@${userId}> ! Que cette journée soit mémorable ! 🎊🎂`,
    (userId: string, age?: number) => age
        ? `Bon anniversaire <@${userId}> ! **${age} ans** ça se fête ! Amuse-toi bien ! 🥳🎉`
        : `Bon anniversaire <@${userId}> ! Amuse-toi bien ! 🥳🎉`
];

const BIRTHDAY_SPECIAL_VARIANTS = [
    (userId: string) => `<@${userId}> Est-ce que vous aviez oublié ? 😏🎂`,
    (userId: string) => `<@${userId}> Quelqu'un a raté quelque chose hier... 🤔🎂`,
    (userId: string) => `<@${userId}> On dirait que tout le monde avait la tête ailleurs hier... 😏🎉`,
    (userId: string) => `<@${userId}> Oups, on a failli passer à côté ! 😅🎂`,
    (userId: string) => `<@${userId}> Mieux vaut tard que jamais non ? 😏🎈`
];

/**
 * Sélectionne une variante aléatoire
 */
function getRandomVariant<T>(variants: T[]): T {
    return variants[Math.floor(Math.random() * variants.length)];
}

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
        logger.error("Error loading birthday state:", error);
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
        logger.error("Error saving birthday state:", error);
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
        logger.info(`🎭 Special birthday celebration for ${username} (delayed by 1 day - NO ROLE)`);

        if (!WELCOME_CHANNEL_ID) return true;

        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!(channel instanceof TextChannel)) {
            logger.warn("Welcome channel not found or not a text channel");
            return true;
        }

        // Choisir une variante aléatoire du message spécial
        const birthdayMessage = getRandomVariant(BIRTHDAY_SPECIAL_VARIANTS)(userId);

        // Envoyer le message
        await channel.send(birthdayMessage);
        logger.info(`✅ Special delayed birthday message sent for ${username} (no role given)`);

        // Enregistrer dans la mémoire
        await memory.appendTurn(
            {
                ts: Date.now(),
                discordUid: userId,
                displayName: username,
                channelId: channel.id,
                channelName: channel.name,
                userText: `C'était l'anniversaire de ${username} hier`,
                assistantText: birthdayMessage
            },
            MEMORY_MAX_TURNS
        );
        logger.info(`💾 Recorded special birthday message in memory for ${username}`);

        return true;
    } catch (error) {
        logger.error(`Error celebrating special birthday for ${username}:`, error);
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
                // C'était hier, donc l'âge atteint est celui de cette année
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
        logger.error("Error checking yesterday's special birthday:", error);
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
            logger.info(`User ${username} (${userId}) not found in guild`);
            return false;
        }

        // Ajouter le rôle d'anniversaire si configuré
        if (BIRTHDAY_ROLE_ID) {
            try {
                const role = await guild.roles.fetch(BIRTHDAY_ROLE_ID);
                if (role && !member.roles.cache.has(BIRTHDAY_ROLE_ID)) {
                    await member.roles.add(role);
                    logger.info(`🎉 Added birthday role to ${username}`);
                }
            } catch (error) {
                logger.error(`Error adding birthday role to ${username}:`, error);
            }
        }

        // Envoyer le message de félicitations
        if (!WELCOME_CHANNEL_ID) return true;

        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!(channel instanceof TextChannel)) {
            logger.warn("Welcome channel not found or not a text channel");
            return true;
        }

        // Choisir une variante aléatoire du message d'anniversaire
        const birthdayMessage = getRandomVariant(BIRTHDAY_VARIANTS)(userId, age);

        // Envoyer le message
        await channel.send(birthdayMessage);
        logger.info(`✅ Birthday message sent for ${username}${age ? ` (${age} ans)` : ''}`);

        // Enregistrer dans la mémoire
        await memory.appendTurn(
            {
                ts: Date.now(),
                discordUid: userId,
                displayName: username,
                channelId: channel.id,
                channelName: channel.name,
                userText: `C'est l'anniversaire de ${username}${age ? ` (${age} ans)` : ''}`,
                assistantText: birthdayMessage
            },
            MEMORY_MAX_TURNS
        );
        logger.info(`💾 Recorded birthday message in memory for ${username}`);

        return true;
    } catch (error) {
        logger.error(`Error celebrating birthday for ${username}:`, error);

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
        logger.info(`🧹 Cleaning up birthday role from ${members.size} member(s)`);

        for (const [, member] of members) {
            try {
                await member.roles.remove(role);
                logger.info(`🧹 Removed birthday role from ${member.user.username}`);
            } catch (error) {
                logger.error(`Error removing birthday role from ${member.user.username}:`, error);
            }
        }
    } catch (error) {
        logger.error("Error cleaning up birthday roles:", error);
    }
}

/**
 * Vérifie et célèbre les anniversaires du jour
 */
async function checkBirthdays(client: Client): Promise<void> {
    if (!GUILD_ID) {
        logger.info("GUILD_ID not configured, skipping birthday check");
        return;
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            logger.info("Guild not found");
            return;
        }

        const today = getTodayDate();
        const state = loadBirthdayState();

        // Si c'est un nouveau jour, réinitialiser la liste et nettoyer les rôles
        if (state.lastCheck !== today) {
            logger.info(`🎂 New day detected, checking for birthdays...`);

            // Nettoyer les rôles d'anniversaire de la veille
            await cleanupBirthdayRoles(guild);

            state.lastCheck = today;
            state.celebratedToday = [];
        }

        // Récupérer les anniversaires du jour
        const birthdays = UserProfileService.getTodayBirthdays();

        // Célébrer les anniversaires d'aujourd'hui
        if (birthdays.length > 0) {
            logger.info(`🎉 Found ${birthdays.length} birthday(s) today!`);

            for (const birthday of birthdays) {
                // Vérifier si déjà célébré aujourd'hui
                if (state.celebratedToday.includes(birthday.userId)) {
                    logger.info(`Already celebrated ${birthday.username} today`);
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
            logger.info("No birthdays today");
        }

        // Cas spécial : Vérifier si c'était l'anniversaire de Tah-Um hier (toujours vérifier, même s'il n'y a pas d'anniversaires aujourd'hui)
        const specialBirthday = getYesterdaySpecialBirthday();
        if (specialBirthday) {
            logger.info(`🎭 Special case detected: ${specialBirthday.username}'s birthday was yesterday!`);

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
                logger.info(`Special birthday already celebrated today for ${specialBirthday.username}`);
            }
        }

        saveBirthdayState(state);
    } catch (error) {
        logger.error("Error checking birthdays:", error);
    }
}

/**
 * Initialise le service de vérification des anniversaires
 * Vérifie toutes les heures
 */
export function initializeBirthdayService(client: Client): void {
    if (!WELCOME_CHANNEL_ID) {
        logger.info("WELCOME_CHANNEL_ID not configured, birthday notifications disabled");
        return;
    }

    if (!GUILD_ID) {
        logger.info("GUILD_ID not configured, birthday service disabled");
        return;
    }

    logger.info("✅ Birthday service initialized");
    logger.info(`Birthday role: ${BIRTHDAY_ROLE_ID || 'Not configured (role will not be given)'}`);

    // Vérification immédiate au démarrage (après 5 secondes)
    setTimeout(() => {
        checkBirthdays(client).catch(error => {
            logger.error("Error in initial birthday check:", error);
        });
    }, 5000); // 5 secondes

    // Vérification toutes les heures
    setInterval(() => {
        checkBirthdays(client).catch(error => {
            logger.error("Error in scheduled birthday check:", error);
        });
    }, 60 * 60 * 1000); // 1 heure
}
