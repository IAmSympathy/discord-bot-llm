import {Client, EmbedBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {EventType} from "./eventTypes";

const logger = createLogger("ImpostorMissionTracker");

/**
 * Types de missions pour l'événement imposteur
 */
export enum MissionType {
    // Faciles
    SEND_MESSAGES = "send_messages",
    ADD_REACTIONS_ONLINE = "add_reactions_online",
    USE_EMOJIS = "use_emojis",
    MENTION_USERS = "mention_users",
    USE_FUN_COMMANDS = "use_fun_commands",

    // Moyennes
    CONVERSATION_AI = "conversation_ai",
    GENERATE_IMAGES = "generate_images",
    JOIN_VOCAL_SOLO = "join_vocal_solo",
    LONG_MESSAGE = "long_message",
    AI_WEB_SEARCH = "ai_web_search",

    // Difficiles
    PROMPT_AND_GENERATE = "prompt_and_generate",
    USE_SYMBOL = "use_symbol",
    USE_IMPOSED_WORDS = "use_imposed_words",
    PLAY_DIFFERENT_GAMES = "play_different_games",
    USE_DISCORD_FORMATTING = "use_discord_formatting"
}

/**
 * Vérifie et met à jour la progression d'une mission
 */
async function updateMissionProgress(
    client: Client,
    userId: string,
    missionType: MissionType,
    increment: number = 1
): Promise<void> {
    const eventsData = loadEventsData();

    // Trouver l'événement imposteur actif pour cet utilisateur
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (!impostorEvent) {
        return; // Pas d'événement actif pour cet utilisateur
    }

    // Trouver la mission concernée
    const mission = impostorEvent.data.missions.find(
        (m: any) => m.type === missionType && !m.completed
    );

    if (!mission) {
        return; // Mission déjà complétée ou n'existe pas
    }

    // Mettre à jour la progression
    mission.progress += increment;

    // Vérifier si la mission est complétée
    if (mission.progress >= mission.goal) {
        mission.progress = mission.goal;
        mission.completed = true;

        // Envoyer une notification à l'imposteur
        try {
            const user = await client.users.fetch(userId);

            const difficultyEmoji = mission.difficulty === "easy" ? "1️⃣" : mission.difficulty === "medium" ? "2️⃣" : "3️⃣";
            const completedCount = impostorEvent.data.missions.filter((m: any) => m.completed).length;
            const totalMissions = impostorEvent.data.missions.length;

            const missionCompleteEmbed = new EmbedBuilder()
                .setColor(0x64737d)
                .setTitle("🕵️ TÂCHE COMPLÉTÉE !")
                .setDescription(
                    `${difficultyEmoji} ${mission.description}\n\n` +
                    `**Progression :** ${completedCount}/${totalMissions} missions complétées\n\n` +
                    (completedCount === totalMissions
                            ? `**TOUTES LES TÂCHES SONT COMPLÉTÉES !**\n` +
                            `Tu vas recevoir ta récompense de 500 XP sous peu... 💫\n\n` +
                            `Félicitations, maître espion. 🕵️`
                            : `Continue comme ça, il te reste encore ${totalMissions - completedCount} tâche${totalMissions - completedCount > 1 ? 's' : ''} à accomplir. 💪`
                    )
                )
                .setTimestamp();

            await user.send({embeds: [missionCompleteEmbed]});
            logger.info(`Mission ${missionType} completed for impostor ${userId}`);

            // Si toutes les missions sont complétées, marquer l'événement comme complété
            if (completedCount === totalMissions) {
                impostorEvent.data.completed = true;
                logger.info(`All missions completed for impostor ${userId}`);

                // Terminer l'événement
                const {endImpostorEvent} = require("./impostorEvent");
                const guild = client.guilds.cache.first(); // Récupérer le guild (à améliorer si multi-guild)
                if (guild) {
                    setTimeout(async () => {
                        await endImpostorEvent(client, impostorEvent.id, guild);
                    }, 5000); // 5 secondes de délai pour laisser le temps de lire le message
                }
            }

        } catch (error: any) {
            if (error.code === 50007) {
                logger.warn(`Cannot send mission completion DM to impostor ${userId} (DMs closed)`);
            } else {
                logger.error(`Error sending mission completion notification:`, error);
            }
        }
    }

    saveEventsData(eventsData);
}

/**
 * Appelé quand l'imposteur envoie un message
 */
export async function trackImpostorMessage(
    client: Client,
    userId: string,
    content: string,
    mentions: string[]
): Promise<void> {
    // SEND_MESSAGES
    await updateMissionProgress(client, userId, MissionType.SEND_MESSAGES, 1);

    // USE_EMOJIS - Vérifier si le message contient des emojis DIFFÉRENTS
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (impostorEvent) {
        const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
        const emojis = content.match(emojiRegex);
        if (emojis && emojis.length > 0) {
            // Initialiser le set d'emojis utilisés si nécessaire
            if (!impostorEvent.data.emojisUsed) {
                impostorEvent.data.emojisUsed = [];
            }

            // Prendre le premier emoji unique du message
            const uniqueEmojis = [...new Set(emojis)];
            const firstNewEmoji = uniqueEmojis.find(emoji => !impostorEvent.data.emojisUsed.includes(emoji));

            // Compter uniquement si ce message contient un nouvel emoji unique
            // Cela force à envoyer 3 MESSAGES différents avec des emojis différents
            if (firstNewEmoji) {
                impostorEvent.data.emojisUsed.push(firstNewEmoji);
                // Sauvegarder AVANT updateMissionProgress
                saveEventsData(eventsData);
                // +1 progression = 1 message avec un nouvel emoji
                await updateMissionProgress(client, userId, MissionType.USE_EMOJIS, 1);
            }
        }
    }

    // MENTION_USERS - Compter les mentions de personnes différentes
    if (mentions.length > 0 && impostorEvent) {
        // Initialiser le set de mentions si nécessaire
        if (!impostorEvent.data.usersMentioned) {
            impostorEvent.data.usersMentioned = [];
        }

        // Compter uniquement les nouvelles mentions uniques
        let newMentionsCount = 0;
        for (const mentionId of mentions) {
            if (!impostorEvent.data.usersMentioned.includes(mentionId)) {
                impostorEvent.data.usersMentioned.push(mentionId);
                newMentionsCount++;
            }
        }

        if (newMentionsCount > 0) {
            // Sauvegarder AVANT updateMissionProgress
            saveEventsData(eventsData);
            await updateMissionProgress(client, userId, MissionType.MENTION_USERS, newMentionsCount);
        }
    }

    // LONG_MESSAGE - Message de plus de 200 caractères
    if (content.length > 200) {
        await updateMissionProgress(client, userId, MissionType.LONG_MESSAGE, 1);
    }

    // USE_SYMBOL - Vérifier si le message contient le symbole imposé
    if (impostorEvent) {
        const mission = impostorEvent.data.missions.find((m: any) => m.type === MissionType.USE_SYMBOL && !m.completed);
        if (mission && mission.imposedData) {
            const symbol = mission.imposedData;

            // Si le symbole est @ ou #, vérifier qu'il n'est pas utilisé dans une mention ou un tag de salon
            if (symbol === '@' || symbol === '#') {
                // Supprimer toutes les mentions (@user, @role, @everyone, @here) et tags de salon (#channel)
                let cleanContent = content
                    .replace(/<@!?\d+>/g, '')     // Mentions utilisateurs
                    .replace(/<@&\d+>/g, '')      // Mentions rôles
                    .replace(/@everyone/g, '')    // @everyone
                    .replace(/@here/g, '')        // @here
                    .replace(/<#\d+>/g, '');      // Tags de salon

                // Vérifier si le symbole est toujours présent après le nettoyage
                if (cleanContent.includes(symbol)) {
                    await updateMissionProgress(client, userId, MissionType.USE_SYMBOL, 1);
                }
            } else {
                // Pour les autres symboles, vérification simple
                if (content.includes(symbol)) {
                    await updateMissionProgress(client, userId, MissionType.USE_SYMBOL, 1);
                }
            }
        }
    }

    // USE_IMPOSED_WORDS - Vérifier si le message contient des mots imposés
    if (impostorEvent) {
        const mission = impostorEvent.data.missions.find((m: any) => m.type === MissionType.USE_IMPOSED_WORDS && !m.completed);
        if (mission && mission.imposedData) {
            const imposedWords = mission.imposedData.split(',');

            // Initialiser le tableau des mots trouvés
            if (!impostorEvent.data.imposedWordsUsed) {
                impostorEvent.data.imposedWordsUsed = [];
            }

            // Normaliser le contenu (enlever accents et mettre en minuscules)
            const normalizeText = (text: string) => text
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            const contentNormalized = normalizeText(content);

            // Vérifier chaque mot imposé et compter les nouveaux
            let newWordsCount = 0;
            for (const word of imposedWords) {
                // Si le mot n'a pas encore été utilisé et est présent dans ce message
                if (!impostorEvent.data.imposedWordsUsed.includes(word) &&
                    contentNormalized.includes(normalizeText(word))) {
                    impostorEvent.data.imposedWordsUsed.push(word);
                    newWordsCount++;
                }
            }

            // Si de nouveaux mots ont été trouvés, mettre à jour la progression
            if (newWordsCount > 0) {
                // Sauvegarder AVANT updateMissionProgress
                saveEventsData(eventsData);
                await updateMissionProgress(client, userId, MissionType.USE_IMPOSED_WORDS, newWordsCount);
            }
        }
    }

    // USE_DISCORD_FORMATTING - Vérifier si le message utilise du formatage Discord
    if (impostorEvent) {
        const formattingPatterns = [
            /\*\*[^*]+\*\*/,    // Gras **texte**
            /\*[^*]+\*/,        // Italique *texte*
            /__[^_]+__/,        // Souligné __texte__
            /~~[^~]+~~/,        // Barré ~~texte~~
            /`[^`]+`/,          // Code inline `texte`
            /```[\s\S]+?```/,   // Code block ```texte```
            /\|\|[^|]+\|\|/,    // Spoiler ||texte||
            /> [^\n]+/          // Citation > texte
        ];

        const hasFormatting = formattingPatterns.some(pattern => pattern.test(content));
        if (hasFormatting) {
            await updateMissionProgress(client, userId, MissionType.USE_DISCORD_FORMATTING, 1);
        }
    }
}

/**
 * Appelé quand l'imposteur ajoute une réaction
 */
export async function trackImpostorReaction(client: Client, userId: string, messageAuthorId: string, messageTimestamp?: number): Promise<void> {
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (!impostorEvent) return;

    // Ne pas compter si pas d'auteur de message
    if (!messageAuthorId) return;

    // Ne pas compter les réactions à soi-même
    if (messageAuthorId === userId) return;

    // Vérifier l'âge du message (2 semaines maximum)
    if (messageTimestamp) {
        const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000; // 2 semaines en millisecondes
        const messageAge = Date.now() - messageTimestamp;

        if (messageAge > twoWeeksInMs) {
            logger.debug(`Message too old (${Math.floor(messageAge / (24 * 60 * 60 * 1000))} days), not counting reaction`);
            return;
        }
    }

    // Vérifier si l'auteur du message est un bot
    try {
        const messageAuthor = await client.users.fetch(messageAuthorId);
        // Ne pas compter les réactions aux bots (incluant Netricsa)
        if (messageAuthor.bot) return;
    } catch (error) {
        logger.error(`Error fetching message author ${messageAuthorId}:`, error);
        return;
    }

    // Initialiser le set des personnes à qui on a réagi
    if (!impostorEvent.data.reactionsToUsers) {
        impostorEvent.data.reactionsToUsers = [];
    }

    // Compter uniquement si c'est une nouvelle personne
    if (!impostorEvent.data.reactionsToUsers.includes(messageAuthorId)) {
        impostorEvent.data.reactionsToUsers.push(messageAuthorId);
        // Sauvegarder AVANT d'appeler updateMissionProgress
        saveEventsData(eventsData);

        // updateMissionProgress va recharger, modifier progress, et sauvegarder
        await updateMissionProgress(client, userId, MissionType.ADD_REACTIONS_ONLINE, 1);
    }
}

/**
 * Appelé quand l'imposteur utilise une commande fun
 */
export async function trackImpostorFunCommand(client: Client, userId: string, commandName: string): Promise<void> {
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (!impostorEvent) return;

    // Initialiser le set des commandes fun utilisées
    if (!impostorEvent.data.funCommandsUsed) {
        impostorEvent.data.funCommandsUsed = [];
    }

    // Compter uniquement si c'est une nouvelle commande
    if (!impostorEvent.data.funCommandsUsed.includes(commandName)) {
        impostorEvent.data.funCommandsUsed.push(commandName);
        // Sauvegarder AVANT updateMissionProgress
        saveEventsData(eventsData);
        await updateMissionProgress(client, userId, MissionType.USE_FUN_COMMANDS, 1);
    }
}

/**
 * Appelé quand l'imposteur a une conversation avec Netricsa
 */
export async function trackImpostorAIConversation(client: Client, userId: string): Promise<void> {
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (!impostorEvent) return;

    // Initialiser le compteur de messages consécutifs
    if (!impostorEvent.data.aiConversationStreak) {
        impostorEvent.data.aiConversationStreak = 0;
        impostorEvent.data.lastAIMessageTime = 0;
    }

    const now = Date.now();
    const timeSinceLastMessage = now - impostorEvent.data.lastAIMessageTime;

    // Réinitialiser si plus de 10 minutes depuis le dernier message
    if (timeSinceLastMessage > 10 * 60 * 1000) {
        impostorEvent.data.aiConversationStreak = 1;
    } else {
        impostorEvent.data.aiConversationStreak++;
    }

    impostorEvent.data.lastAIMessageTime = now;

    // Mettre à jour la progression si on atteint 3 messages consécutifs
    if (impostorEvent.data.aiConversationStreak >= 3) {
        // Sauvegarder le streak AVANT updateMissionProgress
        saveEventsData(eventsData);
        await updateMissionProgress(client, userId, MissionType.CONVERSATION_AI, 3);
        // updateMissionProgress va recharger et sauvegarder avec progress mis à jour
        // Recharger pour reset le streak après que la mission soit complétée
        const reloadedData = loadEventsData();
        const reloadedEvent = reloadedData.activeEvents.find(
            e => e.type === EventType.IMPOSTOR && e.data.impostorId === userId
        );
        if (reloadedEvent) {
            reloadedEvent.data.aiConversationStreak = 0;
            saveEventsData(reloadedData);
        }
    } else {
        // Sauvegarder le streak même si mission pas complétée
        saveEventsData(eventsData);
    }
}

/**
 * Appelé quand l'imposteur génère une image
 */
export async function trackImpostorImageGeneration(client: Client, userId: string): Promise<void> {
    await updateMissionProgress(client, userId, MissionType.GENERATE_IMAGES, 1);
}

/**
 * Appelé quand l'imposteur passe du temps en vocal
 */
export async function trackImpostorVoiceTime(client: Client, userId: string, minutes: number, withOthers: boolean): Promise<void> {
    // JOIN_VOCAL_SOLO : seul uniquement
    if (!withOthers) {
        await updateMissionProgress(client, userId, MissionType.JOIN_VOCAL_SOLO, minutes);
    }
}


/**
 * Appelé quand Netricsa fait une recherche web pour l'imposteur
 */
export async function trackImpostorWebSearch(client: Client, userId: string): Promise<void> {
    const eventsData = loadEventsData();
    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (!impostorEvent) {
        logger.debug(`No active impostor event for user ${userId}, skipping web search tracking`);
        return;
    }

    logger.info(`Tracking web search for user ${userId}`);
    await updateMissionProgress(client, userId, MissionType.AI_WEB_SEARCH, 1);
}

/**
 * Appelé quand l'imposteur crée un prompt avec /prompt-maker
 */
export async function trackImpostorPromptCreation(client: Client, userId: string): Promise<void> {
    await updateMissionProgress(client, userId, MissionType.PROMPT_AND_GENERATE, 1);
}

/**
 * Appelé quand l'imposteur joue à un jeu
 */
export async function trackImpostorGamePlayed(client: Client, userId: string, game: string): Promise<void> {
    const eventsData = loadEventsData();

    const impostorEvent = eventsData.activeEvents.find(
        e => e.type === EventType.IMPOSTOR &&
            e.data.impostorId === userId &&
            !e.data.completed
    );

    if (!impostorEvent) return;

    // Tracker les jeux différents joués
    if (!impostorEvent.data.gamesPlayed) {
        impostorEvent.data.gamesPlayed = [];
    }

    if (!impostorEvent.data.gamesPlayed.includes(game)) {
        impostorEvent.data.gamesPlayed.push(game);
        // Sauvegarder AVANT updateMissionProgress
        saveEventsData(eventsData);
        await updateMissionProgress(client, userId, MissionType.PLAY_DIFFERENT_GAMES, 1);
    }
}
