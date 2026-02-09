import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, Guild, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../xpSystem";
import {EventType} from "./eventTypes";
import {loadEventsData, saveEventsData} from "./eventsDataManager";
import {endEvent, sendGeneralAnnouncement, startEvent} from "./eventChannelManager";
import {isLowPowerMode} from "../botStateService";

const logger = createLogger("ImpostorEvent");

// ========== TYPES ET INTERFACES ==========

/**
 * Types de missions possibles
 */
enum MissionType {
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
 * Définition d'une mission
 */
interface MissionDefinition {
    type: MissionType;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    goal: number; // Objectif à atteindre
}

/**
 * État d'une mission
 */
interface MissionState {
    type: MissionType;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    goal: number;
    progress: number;
    completed: boolean;
    imposedData?: string; // Pour les missions avec symbole ou mots imposés
    isLowPowerAlternative?: boolean; // Indique si c'est une mission alternative Low Power
    originalMission?: MissionState; // Sauvegarde de la mission originale si remplacée
}

// ========== CONSTANTES ==========

/**
 * Emojis pour les difficultés des missions (utilisés pour le texte formaté)
 */
const DIFFICULTY_EMOJIS = {
    easy: "🟢",
    medium: "🟡",
    hard: "🔴"
} as const;

/**
 * Emojis numérotés pour les missions (utilisés dans les embeds)
 */
const DIFFICULTY_NUMBER_EMOJIS = {
    easy: "1️⃣",
    medium: "2️⃣",
    hard: "3️⃣"
} as const;

/**
 * Symboles possibles pour les missions difficiles
 */
const MISSION_SYMBOLS = ['%', '+', '&', '$', '#', '@', '!', '*'] as const;

/**
 * Missions alternatives moyennes pour Low Power Mode (sans Netricsa)
 */
const MEDIUM_MISSIONS_LOW_POWER: Omit<MissionDefinition, 'imposedData'>[] = [
    {type: MissionType.JOIN_VOCAL_SOLO, description: "Être seul dans un salon vocal pour un total de 10 minutes", difficulty: "medium", goal: 10},
    {type: MissionType.LONG_MESSAGE, description: "Envoyer un message de plus de 200 caractères", difficulty: "medium", goal: 1},
    {type: MissionType.USE_DISCORD_FORMATTING, description: "Utiliser du formatage Discord dans un message (gras, italique, code, etc...)", difficulty: "medium", goal: 1}
];

// ========== FONCTIONS UTILITAIRES ==========

/**
 * Crée l'embed d'annonce pour le salon général
 */
function createImpostorGeneralAnnouncementEmbed(endTime: number, huntChannelId: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x64737d)
        .setTitle("🕵️ Nouvel Événement : Chasse à l'Imposteur !")
        .setDescription(
            `Un événement mystérieux vient d'apparaître !\n\n` +
            `**Mission :** Démasquer l'imposteur parmi vous\n` +
            `**Temps limite :** <t:${Math.floor(endTime / 1000)}:R>\n` +
            `**Récompense :** 200 XP pour le détective 💫\n` +
            `**Pénalité :** -50 XP pour une fausse accusation 💔\n\n` +
            `🔍 Participez dans <#${huntChannelId}>\n` +
            `🤫 Quelqu'un a une mission secrète... Saurez-vous le trouver ?`
        )
        .setTimestamp();
}

/**
 * Retourne l'emoji de difficulté coloré pour une mission
 */
function getDifficultyEmoji(difficulty: "easy" | "medium" | "hard"): string {
    return DIFFICULTY_EMOJIS[difficulty];
}

/**
 * Retourne l'emoji numéroté pour une mission
 */
function getDifficultyNumberEmoji(difficulty: "easy" | "medium" | "hard"): string {
    return DIFFICULTY_NUMBER_EMOJIS[difficulty];
}


/**
 * Formate les missions de l'imposteur pour l'affichage en texte
 */
function formatImpostorMissions(missions: MissionState[]): string {
    return missions.map((mission, index) => {
        const emoji = getDifficultyEmoji(mission.difficulty);
        const statusEmoji = mission.completed ? "✅" : "🔄";
        const progressText = mission.completed
            ? `(${mission.goal}/${mission.goal})`
            : `(${mission.progress}/${mission.goal})`;

        return `${emoji} **Mission ${index + 1}** ${statusEmoji}\n${mission.description} ${progressText}`;
    }).join("\n\n");
}

/**
 * Ajoute les missions comme champs dans un embed
 */
function addMissionFieldsToEmbed(embed: EmbedBuilder, missions: MissionState[]): void {
    missions.forEach((mission, index) => {
        const statusEmoji = mission.completed ? '✅' : `${mission.progress}/${mission.goal}`;
        const difficultyEmoji = getDifficultyNumberEmoji(mission.difficulty);
        const altMarker = mission.isLowPowerAlternative ? ' 🔄' : '';
        embed.addFields({
            name: `${difficultyEmoji} Mission ${index + 1}${altMarker} - ${statusEmoji}`,
            value: mission.description,
            inline: false
        });
    });
}

/**
 * Ajoute les missions avec statut de complétion dans un embed
 */
function addMissionFieldsWithStatusToEmbed(embed: EmbedBuilder, missions: MissionState[]): void {
    missions.forEach((mission, index) => {
        const difficultyEmoji = getDifficultyNumberEmoji(mission.difficulty);
        const statusEmoji = mission.completed ? '✅' : '❌';
        const progressText = mission.completed ? 'Complétée' : `${mission.progress}/${mission.goal}`;
        embed.addFields({
            name: `${difficultyEmoji} Tâche ${index + 1} - ${statusEmoji} ${progressText}`,
            value: mission.description,
            inline: false
        });
    });
}

/**
 * Récupère des mots aléatoires depuis l'API (même API que Hangman)
 */
async function fetchRandomWordsForMission(count: number): Promise<string[]> {
    const words: string[] = [];
    const fallbackWords = [
        'chat', 'chien', 'soleil', 'lune', 'océan', 'montagne', 'rivière',
        'forêt', 'ville', 'pain', 'café', 'pizza', 'robot', 'dragon',
        'musique', 'danse', 'livre', 'école', 'sport', 'jeu'
    ];

    try {
        // Essayer de récupérer les mots depuis l'API
        for (let i = 0; i < count; i++) {
            try {
                const response = await fetch('https://trouve-mot.fr/api/random');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data[0] && data[0].name) {
                        const word = data[0].name.toLowerCase();
                        // Vérifier que le mot est valide (4-12 caractères, lettres uniquement)
                        if (/^[a-zàâäéèêëïîôöùûüÿç]+$/.test(word) && word.length >= 4 && word.length <= 12) {
                            words.push(word);
                        } else {
                            // Utiliser un mot de secours
                            words.push(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
                        }
                    } else {
                        words.push(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
                    }
                } else {
                    words.push(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
                }

                // Petite pause entre les requêtes API
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                logger.error(`Error fetching word ${i + 1} from API:`, error);
                words.push(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
            }
        }
    } catch (error) {
        logger.error("Error in fetchRandomWordsForMission:", error);
        // Utiliser des mots de secours
        for (let i = 0; i < count; i++) {
            words.push(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
        }
    }

    return words;
}

/**
 * Vérifie si une mission nécessite Netricsa et est donc impossible en Low Power Mode
 */
function isNetricsaDependentMission(missionType: MissionType): boolean {
    const netricsaMissions = [
        MissionType.CONVERSATION_AI,
        MissionType.GENERATE_IMAGES,
        MissionType.PROMPT_AND_GENERATE,
        MissionType.AI_WEB_SEARCH
    ];
    return netricsaMissions.includes(missionType);
}

/**
 * Génère une mission alternative Low Power selon la difficulté
 */
async function generateLowPowerAlternative(difficulty: "easy" | "medium" | "hard"): Promise<MissionState> {
    if (difficulty === "medium") {
        const selected = MEDIUM_MISSIONS_LOW_POWER[Math.floor(Math.random() * MEDIUM_MISSIONS_LOW_POWER.length)];
        return {
            ...selected,
            difficulty: "medium",
            progress: 0,
            completed: false,
            isLowPowerAlternative: true
        };
    } else { // hard
        const imposedSymbol = MISSION_SYMBOLS[Math.floor(Math.random() * MISSION_SYMBOLS.length)];
        const imposedWords = await fetchRandomWordsForMission(3);

        const alternatives = [
            {type: MissionType.USE_SYMBOL, description: `Mettre le symbole "${imposedSymbol}" dans un de tes messages`, goal: 1, imposedData: imposedSymbol},
            {type: MissionType.USE_IMPOSED_WORDS, description: `Utiliser les mots "${imposedWords.join('", "')}" dans tes messages`, goal: 3, imposedData: imposedWords.join(',')},
            {type: MissionType.PLAY_DIFFERENT_GAMES, description: "Jouer à tous les jeux disponibles (4 jeux différents)", goal: 4}
        ];
        const selected = alternatives[Math.floor(Math.random() * alternatives.length)];
        return {
            ...selected,
            difficulty: "hard",
            progress: 0,
            completed: false,
            isLowPowerAlternative: true
        };
    }
}

/**
 * Remplace les missions impossibles par des alternatives quand Netricsa passe en Low Power Mode
 * Sauvegarde les missions originales pour pouvoir les restaurer
 */
export async function handleLowPowerModeTransition(client: Client): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Trouver tous les événements imposteur actifs
        const activeImpostorEvents = eventsData.activeEvents.filter(
            e => e.type === EventType.IMPOSTOR && !e.data.completed
        );

        if (activeImpostorEvents.length === 0) return;

        for (const event of activeImpostorEvents) {
            let missionsChanged = false;
            const impostorId = event.data.impostorId;

            // Vérifier chaque mission
            for (let i = 0; i < event.data.missions.length; i++) {
                const mission = event.data.missions[i];

                // Si la mission est déjà complétée, ne pas la changer
                if (mission.completed) continue;

                // Si la mission est déjà une alternative Low Power, skip
                if (mission.isLowPowerAlternative) continue;

                // Si la mission nécessite Netricsa
                if (isNetricsaDependentMission(mission.type)) {
                    // Générer une mission alternative
                    const alternativeMission = await generateLowPowerAlternative(mission.difficulty);

                    // Sauvegarder la mission originale
                    alternativeMission.originalMission = {...mission};

                    // Remplacer temporairement la mission
                    event.data.missions[i] = alternativeMission;
                    missionsChanged = true;

                    logger.info(`[ImpostorEvent] Mission ${mission.type} temporarily replaced with ${alternativeMission.type} for user ${impostorId} (Low Power Mode)`);
                }
            }

            // Si des missions ont été changées, notifier l'imposteur
            if (missionsChanged) {
                try {
                    const user = await client.users.fetch(impostorId);

                    const embed = new EmbedBuilder()
                        .setColor(0x64737d)
                        .setTitle('🕵️ TÂCHES TEMPORAIREMENT MODIFIÉES ⚠️')
                        .setDescription(
                            `Je suis passée en **Mode Low Power** ! 🔋\n\n` +
                            `Certaines tâches me nécessitant ont été **temporairement remplacées** par des alternatives.\n\n` +
                            `✨ **Bonne nouvelle :** Si je sort du Low Power Mode, tes tâches originales seront **restaurées** avec ta progression !\n\n` +
                            `**Tâches actuelles :**`
                        )
                        .setTimestamp();

                    // Ajouter les missions avec la fonction utilitaire
                    addMissionFieldsToEmbed(embed, event.data.missions);

                    await user.send({embeds: [embed]});
                } catch (error) {
                    logger.warn(`Could not notify user ${impostorId} about mission changes:`, error);
                }
            }
        }

        // Sauvegarder les changements
        saveEventsData(eventsData);

    } catch (error) {
        logger.error('[ImpostorEvent] Error handling Low Power Mode transition:', error);
    }
}

/**
 * Restaure les missions originales quand Netricsa sort du Low Power Mode
 */
export async function handleLowPowerModeExit(client: Client): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Trouver tous les événements imposteur actifs
        const activeImpostorEvents = eventsData.activeEvents.filter(
            e => e.type === EventType.IMPOSTOR && !e.data.completed
        );

        if (activeImpostorEvents.length === 0) return;

        for (const event of activeImpostorEvents) {
            let missionsRestored = false;
            const impostorId = event.data.impostorId;

            // Vérifier chaque mission
            for (let i = 0; i < event.data.missions.length; i++) {
                const mission = event.data.missions[i];

                // Si c'est une alternative Low Power avec une mission originale sauvegardée
                if (mission.isLowPowerAlternative && mission.originalMission) {
                    // Restaurer la mission originale
                    event.data.missions[i] = mission.originalMission;
                    missionsRestored = true;

                    logger.info(`[ImpostorEvent] Mission restored from ${mission.type} to ${mission.originalMission.type} for user ${impostorId} (Low Power Mode exit)`);
                }
            }

            // Si des missions ont été restaurées, notifier l'imposteur
            if (missionsRestored) {
                try {
                    const user = await client.users.fetch(impostorId);

                    const embed = new EmbedBuilder()
                        .setColor(0x64737d)
                        .setTitle('🕵️ TÂCHES RESTAURÉES ✅ ')
                        .setDescription(
                            `Je suis de retour en mode normal ! ⚡\n\n` +
                            `Tes tâches originales ont été **restaurées** !\n\n` +
                            `**Tâches actuelles :**`
                        )
                        .setTimestamp();

                    // Ajouter les missions avec la fonction utilitaire
                    addMissionFieldsToEmbed(embed, event.data.missions);

                    await user.send({embeds: [embed]});
                } catch (error) {
                    logger.warn(`Could not notify user ${impostorId} about mission restoration:`, error);
                }
            }
        }

        // Sauvegarder les changements
        saveEventsData(eventsData);

    } catch (error) {
        logger.error('[ImpostorEvent] Error handling Low Power Mode exit:', error);
    }
}

/**
 * ÉVÉNEMENT : IMPOSTEUR
 * Un utilisateur doit accomplir 3 missions secrètes sans se faire remarquer
 */
export async function startImpostorEvent(client: Client, guild: Guild, testUserId?: string, isTest: boolean = false): Promise<void> {
    try {
        const eventsData = loadEventsData();

        // Vérifier qu'il n'y a pas déjà un événement imposteur actif
        if (eventsData.activeEvents.some(e => e.type === EventType.IMPOSTOR)) {
            logger.info("Impostor event already active, skipping");
            return;
        }

        // Récupérer tous les utilisateurs actifs
        const {getAllStats} = require("../userStatsService");
        const allStats = getAllStats();

        const now = Date.now();
        const fiveDayAgo = now - (120 * 60 * 60 * 1000);

        // Filtrer les utilisateurs actifs récemment
        let potentialUsers = Object.entries(allStats)
            .filter(([userId, stats]: [string, any]) => {
                if (stats.username?.toLowerCase().includes('bot')) return false;
                if (userId === '1462959115528835092') return false;
                if (eventsData.userPreferences[userId]?.disableImpostor) return false;
                return stats.lastUpdate && stats.lastUpdate > fiveDayAgo;
            })
            .map(([userId, stats]: [string, any]) => ({
                userId,
                username: stats.username
            }));

        // Vérifier que les utilisateurs sont réellement membres du serveur et ne sont pas des bots Discord
        const eligibleUsers = (await Promise.all(
            potentialUsers.map(async (user) => {
                try {
                    const member = await guild.members.fetch(user.userId);
                    // Exclure les vrais bots Discord
                    if (member.user.bot) {
                        return null;
                    }
                    return user;
                } catch {
                    // L'utilisateur n'est plus sur le serveur
                    return null;
                }
            })
        )).filter(user => user !== null) as Array<{ userId: string, username: string }>;

        if (eligibleUsers.length === 0) {
            logger.info("No eligible users for impostor event");
            return;
        }

        // Choisir un utilisateur
        let selectedUser;
        if (testUserId) {
            // Vérifier que l'utilisateur de test est éligible
            try {
                const testMember = await guild.members.fetch(testUserId);
                if (testMember.user.bot) {
                    logger.warn(`Test user ${testUserId} is a bot, cannot be impostor`);
                    return;
                }
                selectedUser = {userId: testUserId, username: allStats[testUserId]?.username || testMember.displayName};
            } catch {
                logger.warn(`Test user ${testUserId} not found on server`);
                return;
            }
        } else {
            selectedUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
        }

        // Générer 3 missions (1 facile, 1 moyenne, 1 difficile)
        const easyMissions: MissionDefinition[] = [
            {type: MissionType.SEND_MESSAGES, description: "Envoyer 5 messages (excluant le compteur et les conversations Netricsa) dans n'importe quel salon", difficulty: "easy", goal: 5},
            {type: MissionType.ADD_REACTIONS_ONLINE, description: "Ajouter 3 réactions à des messages récents (2 semaines max) de 3 personnes différentes (excluant toi-même et les bots)", difficulty: "easy", goal: 3},
            {type: MissionType.USE_EMOJIS, description: "Envoyer 3 messages contenant des emojis différents", difficulty: "easy", goal: 3},
            {type: MissionType.MENTION_USERS, description: "Mentionner 3 personnes différentes dans tes messages", difficulty: "easy", goal: 3},
            {type: MissionType.USE_FUN_COMMANDS, description: "Utiliser 3 commandes fun différentes de Netricsa", difficulty: "easy", goal: 3}
        ];

        const mediumMissions: MissionDefinition[] = [
            {type: MissionType.CONVERSATION_AI, description: "Avoir une conversation avec Netricsa d'au moins 3 messages consécutifs", difficulty: "medium", goal: 3},
            {type: MissionType.GENERATE_IMAGES, description: "Générer 3 images uniques avec /imagine ou /reimagine", difficulty: "medium", goal: 3},
            {type: MissionType.JOIN_VOCAL_SOLO, description: "Être seul dans un salon vocal pour un total de 10 minutes", difficulty: "medium", goal: 10},
            {type: MissionType.LONG_MESSAGE, description: "Envoyer un message de plus de 200 caractères", difficulty: "medium", goal: 1},
            {type: MissionType.AI_WEB_SEARCH, description: "Avoir une conversation avec Netricsa qui inclut une recherche web", difficulty: "medium", goal: 1},
            {type: MissionType.USE_DISCORD_FORMATTING, description: "Utiliser du formatage Discord dans un message (gras, italique, code, etc...)", difficulty: "medium", goal: 1}
        ];

        // Générer les symboles et mots imposés pour les missions difficiles
        const imposedSymbol = MISSION_SYMBOLS[Math.floor(Math.random() * MISSION_SYMBOLS.length)];
        const imposedWords = await fetchRandomWordsForMission(3);

        const hardMissions: MissionDefinition[] = [
            {type: MissionType.PROMPT_AND_GENERATE, description: "Créer 2 prompts avec /prompt-maker", difficulty: "hard", goal: 2},
            {type: MissionType.USE_SYMBOL, description: `Mettre le symbole "${imposedSymbol}" dans un de tes messages`, difficulty: "hard", goal: 1},
            {type: MissionType.USE_IMPOSED_WORDS, description: `Utiliser les mots "${imposedWords.join('", "')}" dans tes messages`, difficulty: "hard", goal: 3},
            {type: MissionType.PLAY_DIFFERENT_GAMES, description: "Jouer à tous les jeux disponibles (4 jeux différents)", difficulty: "hard", goal: 4}
        ];

        // Filtrer les missions incompatibles avec Low Power Mode si nécessaire
        const availableMediumMissions = isLowPowerMode()
            ? mediumMissions.filter(m => !isNetricsaDependentMission(m.type))
            : mediumMissions;

        const availableHardMissions = isLowPowerMode()
            ? hardMissions.filter(m => !isNetricsaDependentMission(m.type))
            : hardMissions;

        // Choisir 1 mission de chaque catégorie
        const selectedEasy = easyMissions[Math.floor(Math.random() * easyMissions.length)];
        const selectedMedium = availableMediumMissions[Math.floor(Math.random() * availableMediumMissions.length)];
        const selectedHard = availableHardMissions[Math.floor(Math.random() * availableHardMissions.length)];

        const missions: MissionState[] = [
            {...selectedEasy, progress: 0, completed: false},
            {...selectedMedium, progress: 0, completed: false},
            {...selectedHard, progress: 0, completed: false}
        ];

        // Ajouter les données imposées pour certaines missions
        if (selectedHard.type === MissionType.USE_SYMBOL) {
            missions[2].imposedData = imposedSymbol;
        } else if (selectedHard.type === MissionType.USE_IMPOSED_WORDS) {
            missions[2].imposedData = imposedWords.join(',');
        }

        // Durée : 2 heures
        const duration = 2 * 60 * 60 * 1000;
        const endTime = Date.now() + duration;

        // Créer et enregistrer l'événement via l'event manager
        const result = await startEvent(
            client,
            guild,
            EventType.IMPOSTOR,
            "chasse-imposteur",
            "🔍",
            duration,
            {
                impostorId: selectedUser.userId,
                impostorUsername: selectedUser.username,
                missions: missions,
                completed: false,
                discovered: false,
                discoveredBy: null,
                isTest: isTest || !!testUserId
            }
        );

        if (!result) {
            logger.error("Failed to create impostor event");
            return;
        }

        const {eventId, channel: huntChannel} = result;

        // Envoyer l'embed de chasse dans le canal
        const huntEmbed = new EmbedBuilder()
            .setColor(0x64737d)
            .setTitle("🔍 CHASSE À L'IMPOSTEUR !")
            .setDescription(
                `**Un imposteur se cache parmi vous...** 🕵️\n\n` +
                `Quelqu'un a reçu une mission secrète et doit agir discrètement.\n` +
                `Saurez-vous le démasquer ?\n\n` +
                `**Règles de dénonciation :**\n` +
                `• Vous pouvez dénoncer **un suspect** en cliquant sur le bouton ci-dessous\n` +
                `• **Bon guess** : +200 XP 💫\n` +
                `• **Mauvais guess** : -50 XP 💔\n` +
                `• Vous ne pouvez dénoncer qu'**une seule fois**\n` +
                `• ⚡ **Soyez rapide !** Le premier à démasquer l'imposteur remporte la chasse !\n\n` +
                `**Fin de l'événement :** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
                `🤫 Observez attentivement... Qui agit étrangement ?`
            )
            .setFooter({text: "Bonne chance, détectives !"})
            .setTimestamp();

        const guessButton = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("impostor_guess")
                    .setLabel("🔍 Dénoncer un suspect")
                    .setStyle(ButtonStyle.Danger)
            );

        await huntChannel.send({embeds: [huntEmbed], components: [guessButton]});
        logger.info("Impostor hunt channel created");

        // Envoyer une annonce dans le salon général (sauf si test)
        const generalEmbed = createImpostorGeneralAnnouncementEmbed(endTime, huntChannel.id);
        await sendGeneralAnnouncement(guild, generalEmbed, isTest || !!testUserId);

        // Envoyer un DM à l'imposteur
        try {
            const user = await client.users.fetch(selectedUser.userId);

            const impostorEmbed = new EmbedBuilder()
                .setColor(0x64737d)
                .setTitle(`🕵️ MISSION IMPOSTEUR !${isTest ? " (TEST)" : ""}`)
                .setDescription(
                    `Tu as été secrètement choisi comme **IMPOSTEUR** ! 🎭\n\n` +
                    `**Ta mission :** \nAccomplir les 3 tâches suivantes discrètement dans les 2 prochaines heures :\n\n` +
                    `1️⃣ **${missions[0].description}**\n` +
                    `2️⃣ **${missions[1].description}**\n` +
                    `3️⃣ **${missions[2].description}**\n\n` +
                    `**Consignes :**\n` +
                    `• Agis naturellement - Ne te fais pas remarquer !\n` +
                    `• Les autres joueurs peuvent essayer de te démasquer dans <#${huntChannel.id}>\n` +
                    `• Je t'enverrai un message quand tu complètes une tâche\n` +
                    `• Tu as jusqu'à <t:${Math.floor(endTime / 1000)}:t> pour ta mission\n\n` +
                    `**Récompense :** 500 XP 💫\n\n` +
                    `⏰ **Temps limite** : <t:${Math.floor(endTime / 1000)}:R>` +
                    (isTest ? "\n\n⚠️ *Ceci est un événement de TEST. Les récompenses réelles ne seront pas distribuées.*" : "")
                )
                .setFooter({text: "Tu peux désactiver les missions imposteur avec /event-preferences"})
                .setTimestamp();

            await user.send({embeds: [impostorEmbed]});
            logger.info(`Impostor mission sent to ${selectedUser.username}${isTest ? ' [TEST MODE]' : ''}`);

            // Initialiser le tracking des guess
            const eventsData = loadEventsData();
            if (!eventsData.impostorGuesses) {
                eventsData.impostorGuesses = {};
            }
            eventsData.impostorGuesses[eventId] = {};
            saveEventsData(eventsData);

            logger.info(`Impostor event started! Impostor: ${selectedUser.username}, Duration: 2 hours`);

            // Programmer la fin automatique après 2 heures
            setTimeout(async () => {
                await endImpostorEvent(client, eventId, guild);
            }, duration);

        } catch (error: any) {
            if (error.code === 50007) {
                logger.warn(`Cannot send impostor mission to ${selectedUser.username} (DMs closed)`);
            } else {
                logger.error(`Error sending impostor mission to ${selectedUser.username}:`, error);
            }
        }

    } catch (error) {
        logger.error("Error starting impostor event:", error);
    }
}

/**
 * Termine l'événement Imposteur
 */
export async function endImpostorEvent(client: Client, eventId: string, guild: Guild): Promise<void> {
    const eventsData = loadEventsData();
    const eventIndex = eventsData.activeEvents.findIndex(e => e.id === eventId);

    if (eventIndex === -1) {
        logger.warn(`Impostor event ${eventId} not found`);
        return;
    }

    const event = eventsData.activeEvents[eventIndex];
    const impostorId = event.data.impostorId;
    const impostorUsername = event.data.impostorUsername;
    const completed = event.data.completed;
    const discovered = event.data.discovered;

    // Construire la liste des participants (imposteur + ceux qui ont guess)
    const participants = new Set<string>();
    participants.add(impostorId); // Ajouter l'imposteur

    // Ajouter tous ceux qui ont guess
    if (eventsData.impostorGuesses && eventsData.impostorGuesses[eventId]) {
        Object.keys(eventsData.impostorGuesses[eventId]).forEach(userId => participants.add(userId));
    }

    const participantPings = Array.from(participants).map(id => `<@${id}>`).join(' ');

    try {
        const user = await client.users.fetch(impostorId);

        if (discovered) {
            logger.info(`Impostor ${impostorUsername} was discovered, no rewards`);
        } else if (completed) {
            // L'imposteur a réussi toutes ses missions !
            const xpReward = 500;

            // Utiliser le canal de l'événement pour la notification XP
            const eventChannel = event.channelId ? guild.channels.cache.get(event.channelId) as TextChannel : undefined;
            await addXP(impostorId, impostorUsername, xpReward, eventChannel);

            logger.info(`Impostor ${impostorUsername} completed all missions, rewarded ${xpReward} XP`);

            // Annoncer la victoire dans le canal de chasse
            if (event.channelId) {
                const huntChannel = guild.channels.cache.get(event.channelId) as TextChannel;
                if (huntChannel) {
                    const victoryEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle("🕵️ L'IMPOSTEUR A RÉUSSI SA MISSION !")
                        .setDescription(
                            `**<@${impostorId}>** était l'imposteur et a accompli toutes ses tâches avec succès ! \n\n` +
                            `Personne ne l'a démasqué à temps...\n\n` +
                            `**Récompense de l'imposteur :** +${xpReward} XP 💫`
                        )
                        .setTimestamp();

                    // Ajouter les missions complétées avec la fonction utilitaire
                    addMissionFieldsWithStatusToEmbed(victoryEmbed, event.data.missions);

                    victoryEmbed.setFooter({text: 'Le salon se fermera dans 5 minutes...'});

                    await huntChannel.send({
                        content: participantPings,
                        embeds: [victoryEmbed]
                    });
                }
            }
        } else if (!completed) {
            const failedEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("⏰ MISSION IMPOSTEUR ÉCHOUÉE")
                .setDescription(
                    `Le temps est écoulé ! Tu n'as pas accompli toutes tes missions à temps. 😔\n\n` +
                    `Dommage ! Tu pourras réessayer lors d'une prochaine mission.\n\n` +
                    `Mieux vaut être plus rapide la prochaine fois ! 🏃\n\n` +
                    `**Voici tes tâches et ta progression :**`
                )
                .setTimestamp();

            // Ajouter les missions avec progression avec la fonction utilitaire
            addMissionFieldsWithStatusToEmbed(failedEmbed, event.data.missions);

            await user.send({embeds: [failedEmbed]});

            // Annoncer aussi dans le canal de chasse
            if (event.channelId) {
                const huntChannel = guild.channels.cache.get(event.channelId) as TextChannel;
                if (huntChannel) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle("⏰ TEMPS ÉCOULÉ !")
                        .setDescription(
                            `Le temps est écoulé et l'imposteur n'a pas accompli toutes ses tâches !\n\n` +
                            `**L'imposteur était : <@${impostorId}>** 🕵️\n\n` +
                            `Personne ne l'a démasqué, mais il n'a pas réussi à compléter sa mission à temps...\n\n` +
                            `**Progression de l'imposteur :**`
                        )
                        .setTimestamp();

                    // Ajouter les missions avec progression avec la fonction utilitaire
                    addMissionFieldsWithStatusToEmbed(timeoutEmbed, event.data.missions);

                    timeoutEmbed.setFooter({text: 'Le salon se fermera dans 5 minutes...'});

                    await huntChannel.send({
                        content: participantPings,
                        embeds: [timeoutEmbed]
                    });
                }
            }
        }

    } catch (error: any) {
        if (error.code === 50007) {
            logger.warn(`Cannot send impostor end message to ${impostorUsername} (DMs closed)`);
        } else {
            logger.error(`Error sending impostor end message:`, error);
        }
    }

    // Nettoyer le tracking
    if (eventsData.impostorGuesses && eventsData.impostorGuesses[eventId]) {
        delete eventsData.impostorGuesses[eventId];
    }

    // Déterminer le délai de fermeture et la raison
    const reason = discovered ? "completed" : completed ? "completed" : "expired";
    const closeDelay = discovered ? 300000 : 300000; // 5 minutes dans tous les cas

    // Terminer l'événement via l'event manager (qui gère la fermeture du salon)
    await endEvent(client, eventId, guild, reason, closeDelay);

    logger.info(`Impostor event ${eventId} ended (${discovered ? 'discovered' : completed ? 'completed' : 'failed'})`);
}

/**
 * Marque la mission imposteur comme complétée
 * NOTE: Cette fonction n'est plus utilisée car la complétion est maintenant automatique
 */


/**
 * Gère une tentative de guess d'imposteur
 */
export async function handleImpostorGuess(
    client: Client,
    userId: string,
    username: string,
    suspectId: string,
    guild: Guild
): Promise<{ success: boolean; message: string }> {
    const eventsData = loadEventsData();

    const impostorEvent = eventsData.activeEvents.find(e => e.type === EventType.IMPOSTOR);

    if (!impostorEvent) {
        return {success: false, message: "Il n'y a pas d'imposteur actif en ce moment."};
    }

    // Vérifier si l'utilisateur est l'imposteur lui-même
    if (userId === impostorEvent.data.impostorId) {
        return {success: false, message: "Tu ne peux pas dénoncer quelqu'un alors que tu es l'imposteur ! 🤫"};
    }

    // Vérifier si déjà guess
    if (!eventsData.impostorGuesses) eventsData.impostorGuesses = {};
    if (!eventsData.impostorGuesses[impostorEvent.id]) eventsData.impostorGuesses[impostorEvent.id] = {};

    if (eventsData.impostorGuesses[impostorEvent.id][userId]) {
        return {success: false, message: "Tu as déjà dénoncé quelqu'un ! Tu ne peux dénoncer qu'une seule fois par chasse."};
    }

    // Marquer le guess
    eventsData.impostorGuesses[impostorEvent.id][userId] = true;
    saveEventsData(eventsData);

    // Récupérer le canal de l'événement pour les notifications XP
    const eventChannel = impostorEvent.channelId ? guild.channels.cache.get(impostorEvent.channelId) as TextChannel : undefined;

    // Vérifier si c'est le bon
    if (suspectId === impostorEvent.data.impostorId) {
        // BON GUESS
        logger.info(`${username} discovered the impostor ${impostorEvent.data.impostorUsername}!`);

        impostorEvent.data.discovered = true;
        impostorEvent.data.discoveredBy = userId;
        saveEventsData(eventsData);

        // Donner XP au détective (sauf si test) avec le canal de l'événement
        if (!impostorEvent.data.isTest) {
            await addXP(userId, username, 200, eventChannel, false);
            logger.info(`${username} gained 200 XP for discovering the impostor`);
        } else {
            logger.info("Test mode: Detective XP reward skipped");
        }

        // Message dans le canal d'événement (nouveau message)
        if (impostorEvent.channelId) {
            const huntChannel = guild.channels.cache.get(impostorEvent.channelId) as TextChannel;
            if (huntChannel) {
                const missionsText = formatImpostorMissions(impostorEvent.data.missions);

                const discoveryEmbed = new EmbedBuilder()
                    .setColor(0x57F287) // Vert - victoire du détective
                    .setTitle("🔍 IMPOSTEUR DÉMASQUÉ !")
                    .setDescription(
                        `**<@${userId}>** a démasqué l'imposteur ! 🕵️\n\n` +
                        `L'imposteur était **<@${impostorEvent.data.impostorId}>** !\n\n` +
                        `**Récompense du détective :** 200 XP 💫\n` +
                        `L'imposteur a échoué sa mission et ne gagne rien. 💔\n\n` +
                        `**📋 Missions de l'imposteur :**\n\n${missionsText}`
                    )
                    .setTimestamp()
                    .setFooter({text: 'Le salon se fermera dans 5 minutes...'});

                // Construire la liste des participants (imposteur + ceux qui ont guess)
                const participants = new Set<string>();
                participants.add(impostorEvent.data.impostorId); // Ajouter l'imposteur

                // Ajouter tous ceux qui ont guess
                if (eventsData.impostorGuesses && eventsData.impostorGuesses[impostorEvent.id]) {
                    Object.keys(eventsData.impostorGuesses[impostorEvent.id]).forEach(id => participants.add(id));
                }

                const participantPings = Array.from(participants).map(id => `<@${id}>`).join(' ');

                await huntChannel.send({
                    content: participantPings,
                    embeds: [discoveryEmbed]
                });
            }
        }

        // Notifier l'imposteur
        try {
            const impostor = await client.users.fetch(impostorEvent.data.impostorId);
            const missionsText = formatImpostorMissions(impostorEvent.data.missions);

            const failEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("😰 TU AS ÉTÉ DÉMASQUÉ !")
                .setDescription(
                    `**<@${userId}>** t'a démasqué ! 🔍\n\n` +
                    `Ta mission a échoué et tu ne gagnes aucune récompense.\n\n` +
                    `Sois plus discret la prochaine fois ! 🤫\n\n` +
                    `**📋 Tes missions :**\n\n${missionsText}`
                )
                .setTimestamp();

            await impostor.send({embeds: [failEmbed]});
        } catch (error) {
            logger.error("Error notifying impostor of discovery:", error);
        }

        // Terminer l'événement
        setTimeout(async () => {
            await endImpostorEvent(client, impostorEvent.id, guild);
        }, 60000);

        return {
            success: true,
            message: "🎉 Félicitations ! Tu as démasqué l'imposteur ! Tu gagnes 200 XP ! 💫"
        };

    } else {
        // MAUVAIS GUESS
        logger.info(`${username} made a wrong guess (suspected ${suspectId})`);

        // Retirer 50 XP (sauf en mode test) avec le canal de l'événement
        if (!impostorEvent.data.isTest) {
            await addXP(userId, username, -50, eventChannel, false);
            logger.info(`${username} lost 50 XP for wrong impostor guess`);
        } else {
            logger.info("Test mode: XP penalty skipped");
        }

        return {
            success: false,
            message: `Ce n'était pas l'imposteur !${impostorEvent.data.isTest ? "" : " Tu perds 50 XP pour fausse accusation."} 💔`
        };
    }
}

/**
 * Test de l'embed imposteur (sans créer d'événement)
 * NOTE: Cette fonction n'est plus utilisée, utilisez startImpostorEvent avec isTest=true à la place
 */
/*
export async function testImpostorEmbed(client: Client, ownerId: string): Promise<void> {
    // Cette fonction est deprecated, utilisez startImpostorEvent(client, guild, ownerId, true) à la place
}
*/

