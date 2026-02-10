import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel, VoiceChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP} from "../../services/xpSystem";
import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../../utils/logger";
import {getCurrentDate, getUserDailyStats} from "../../services/dailyStatsService";
import {getDailyVoiceTime} from "../../voiceTracker";
import {EnvConfig} from "../../utils/envConfig";

const logger = createLogger("DailyChallengesCmd");
const CHALLENGES_FILE = path.join(process.cwd(), "data", "daily_challenges.json");

/**
 * Paliers de rendements décroissants pour l'XP vocal (doit matcher voiceTracker.ts)
 */
const VOICE_XP_TIERS = [
    {minMinutes: 0, maxMinutes: 60, multiplier: 1.0, label: "100%", emoji: "🟢"},
    {minMinutes: 60, maxMinutes: 120, multiplier: 0.75, label: "75%", emoji: "🟡"},
    {minMinutes: 120, maxMinutes: 180, multiplier: 0.5, label: "50%", emoji: "🟠"},
    {minMinutes: 180, maxMinutes: 240, multiplier: 0.25, label: "25%", emoji: "🔴"},
    {minMinutes: 240, maxMinutes: Infinity, multiplier: 0.1, label: "10%", emoji: "⚫"}
];

/**
 * Types de défis disponibles
 */
enum ChallengeType {
    MESSAGES = "messages",
    REACTIONS = "reactions",
    VOCAL = "vocal",
    GAMES = "games",
    HANGMAN = "hangman",
    IMAGES = "images",
    COUNTER = "counter",
    AI_CHAT = "ai_chat",
    COMMANDS = "commands"
}

/**
 * Définition d'un défi
 */
interface ChallengeDefinition {
    id: string;
    type: ChallengeType;
    name: string;
    description: string;
    emoji: string;
    goal: number; // Objectif à atteindre
    xpReward: number;
}

/**
 * Progression d'un utilisateur sur un défi
 */
interface UserChallengeProgress {
    challengeId: string;
    completed: boolean;
    rewardClaimed: boolean; // Si la récompense a été réclamée
}

/**
 * Structure des données de défis quotidiens
 */
interface DailyChallengesData {
    currentDate: string; // Format: YYYY-MM-DD
    challenges: ChallengeDefinition[]; // Les 3 défis du jour
    persistentMessageId?: string; // ID du message persistant dans le salon des défis
    users: {
        [userId: string]: {
            lastCheck: number;
            progress: UserChallengeProgress[];
        };
    };
}

/**
 * Liste de tous les défis possibles
 */
const ALL_POSSIBLE_CHALLENGES: ChallengeDefinition[] = [
    // Défis Messages - Réduits pour éviter le spam
    {
        id: "msg_3",
        type: ChallengeType.MESSAGES,
        name: "Bavard",
        description: "Envoyer 3 messages",
        emoji: "💬",
        goal: 3,
        xpReward: 40
    },
    {
        id: "msg_5",
        type: ChallengeType.MESSAGES,
        name: "Causeur",
        description: "Envoyer 5 messages",
        emoji: "💬",
        goal: 5,
        xpReward: 60
    },
    {
        id: "msg_8",
        type: ChallengeType.MESSAGES,
        name: "Grand Parleur",
        description: "Envoyer 8 messages",
        emoji: "📢",
        goal: 8,
        xpReward: 80
    },
    // Défis Réactions - Réduits drastiquement
    {
        id: "react_3",
        type: ChallengeType.REACTIONS,
        name: "Réactif",
        description: "Ajouter 3 réactions",
        emoji: "👍",
        goal: 3,
        xpReward: 30
    },
    {
        id: "react_5",
        type: ChallengeType.REACTIONS,
        name: "Super Réactif",
        description: "Ajouter 5 réactions",
        emoji: "⭐",
        goal: 5,
        xpReward: 50
    },
    // Défis Vocal
    {
        id: "vocal_15",
        type: ChallengeType.VOCAL,
        name: "Causette Vocale",
        description: "Passer 15 minutes en vocal",
        emoji: "🎤",
        goal: 15,
        xpReward: 75
    },
    {
        id: "vocal_30",
        type: ChallengeType.VOCAL,
        name: "Bavardage Vocal",
        description: "Passer 30 minutes en vocal",
        emoji: "🎧",
        goal: 30,
        xpReward: 150
    },
    {
        id: "vocal_60",
        type: ChallengeType.VOCAL,
        name: "Marathon Vocal",
        description: "Passer 1 heure en vocal",
        emoji: "🎙️",
        goal: 60,
        xpReward: 250
    },
    // Défis Jeux
    {
        id: "games_3",
        type: ChallengeType.GAMES,
        name: "Joueur",
        description: "Jouer 3 parties de jeux (`/games`)",
        emoji: "🎮",
        goal: 3,
        xpReward: 75
    },
    {
        id: "games_5",
        type: ChallengeType.GAMES,
        name: "Gamer",
        description: "Jouer 5 parties de jeux (`/games`)",
        emoji: "🎯",
        goal: 5,
        xpReward: 125
    },
    {
        id: "games_win_2",
        type: ChallengeType.GAMES,
        name: "Victorieux",
        description: "Gagner 2 parties de jeux (`/games`)",
        emoji: "🏆",
        goal: 2,
        xpReward: 150
    },
    // Défis Images
    {
        id: "images_1",
        type: ChallengeType.IMAGES,
        name: "Artiste du Jour",
        description: "Générer 1 image avec Netricsa (`/imagine`)",
        emoji: "🎨",
        goal: 1,
        xpReward: 75
    },
    {
        id: "images_3",
        type: ChallengeType.IMAGES,
        name: "Créateur Actif",
        description: "Générer 3 images avec Netricsa (`/imagine`)",
        emoji: "🖼️",
        goal: 3,
        xpReward: 150
    },
    // Défis Compteur - Réduits pour éviter le spam
    {
        id: "counter_3",
        type: ChallengeType.COUNTER,
        name: "Compteur Pro",
        description: "Contribuer 3 fois au compteur",
        emoji: "🔢",
        goal: 3,
        xpReward: 50
    },
    {
        id: "counter_5",
        type: ChallengeType.COUNTER,
        name: "Maître du Compteur",
        description: "Contribuer 5 fois au compteur",
        emoji: "💯",
        goal: 5,
        xpReward: 75
    },
    // Défis IA
    {
        id: "ai_2",
        type: ChallengeType.AI_CHAT,
        name: "Causeur avec Netricsa",
        description: "Avoir 2 conversations avec Netricsa",
        emoji: "🤖",
        goal: 2,
        xpReward: 60
    },
    {
        id: "ai_3",
        type: ChallengeType.AI_CHAT,
        name: "Ami de Netricsa",
        description: "Avoir 3 conversations avec Netricsa",
        emoji: "💭",
        goal: 3,
        xpReward: 90
    },
    // Défis Commandes - Ajustés
    {
        id: "cmd_3",
        type: ChallengeType.COMMANDS,
        name: "Commandant",
        description: "Utiliser 3 commandes",
        emoji: "⚡",
        goal: 3,
        xpReward: 40
    },
    {
        id: "cmd_5",
        type: ChallengeType.COMMANDS,
        name: "Maître des Commandes",
        description: "Utiliser 5 commandes",
        emoji: "⚡",
        goal: 5,
        xpReward: 60
    }
];

/**
 * Défi fixe de bonhomme pendu (toujours présent en 4ème position)
 */
const FIXED_HANGMAN_CHALLENGE: ChallengeDefinition = {
    id: "hangman_daily_fixed",
    type: ChallengeType.HANGMAN,
    name: "Pendu Quotidien",
    description: "Jouer 1 partie de bonhomme pendu",
    emoji: "🎭",
    goal: 1,
    xpReward: 50
};

/**
 * Charge les données des défis quotidiens
 */
function loadChallengesData(): DailyChallengesData {
    try {
        if (fs.existsSync(CHALLENGES_FILE)) {
            const data = fs.readFileSync(CHALLENGES_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading challenges data:", error);
    }
    return {
        currentDate: "",
        challenges: [],
        users: {}
    };
}

/**
 * Sauvegarde les données des défis quotidiens
 */
function saveChallengesData(data: DailyChallengesData): void {
    try {
        fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving challenges data:", error);
    }
}

/**
 * Génère 3 nouveaux défis aléatoires pour la journée
 */
function generateDailyChallenges(): ChallengeDefinition[] {
    const shuffled = [...ALL_POSSIBLE_CHALLENGES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
}

/**
 * Crée l'embed pour les défis quotidiens (pour le salon persistant)
 */
function createChallengesEmbed(challenges: ChallengeDefinition[]): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎯 Défis Quotidiens")
        .setDescription(
            "**Complète ces défis pour gagner de l'XP bonus !**\n\n" +
            "*Les défis se renouvellent chaque jour à minuit.*\n" +
            "*Utilise `/challenges` pour voir ta progression personnelle et réclamer tes récompenses.*"
        )
        .setTimestamp()
        .setFooter({text: "N'oublie pas de faire /daily pour réclamer ta récompense quotidienne ! 🎁"});

    // Ajouter les 3 défis aléatoires
    challenges.forEach((challenge, index) => {
        embed.addFields({
            name: `${index + 1}. ${challenge.emoji} ${challenge.name}`,
            value: `${challenge.description}\n**Récompense :** 💫 ${challenge.xpReward} XP`,
            inline: false
        });
    });

    // Ajouter une section séparée pour le défi permanent
    embed.addFields({
        name: `━━━━━━━━━━━━━━━━━━━━━━\n ${FIXED_HANGMAN_CHALLENGE.emoji} ${FIXED_HANGMAN_CHALLENGE.name}`,
        value:
            `${FIXED_HANGMAN_CHALLENGE.description}\n` +
            `**Récompense :** 💫 ${FIXED_HANGMAN_CHALLENGE.xpReward} XP\n\n`,
        inline: false
    });

    // Calculer le temps jusqu'à minuit pour le reset vocal
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // Minuit suivant
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const hoursUntilMidnight = Math.floor(msUntilMidnight / (1000 * 60 * 60));
    const minutesUntilMidnight = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));

    return embed;
}

/**
 * Met à jour le message persistant dans le salon des défis quotidiens
 */
async function updatePersistentChallengesMessage(client: any, challenges: ChallengeDefinition[]): Promise<void> {
    try {
        const channelId = EnvConfig.DAILY_CHALLENGES_CHANNEL_ID;
        if (!channelId) {
            logger.warn("DAILY_CHALLENGES_CHANNEL_ID not configured");
            return;
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
            logger.error("Daily challenges channel not found or not text-based");
            return;
        }

        const challengesData = loadChallengesData();
        const embed = createChallengesEmbed(challenges);

        // Si un message existe déjà, le mettre à jour
        if (challengesData.persistentMessageId) {
            try {
                const message = await channel.messages.fetch(challengesData.persistentMessageId);
                await message.edit({embeds: [embed]});
                logger.info("Updated persistent challenges message");
                return;
            } catch (error) {
                logger.warn("Could not fetch/update persistent message, creating new one:", error);
            }
        }

        // Sinon, créer un nouveau message
        const newMessage = await channel.send({embeds: [embed]});
        challengesData.persistentMessageId = newMessage.id;
        saveChallengesData(challengesData);
        logger.info("Created new persistent challenges message");

    } catch (error) {
        logger.error("Error updating persistent challenges message:", error);
    }
}

/**
 * Calcule la progression actuelle d'un utilisateur sur un défi
 */
function calculateProgress(userId: string, challenge: ChallengeDefinition): number {
    const today = getCurrentDate();
    const dailyStats = getUserDailyStats(userId, today);

    if (!dailyStats) return 0;

    let currentProgress = 0;

    switch (challenge.type) {
        case ChallengeType.MESSAGES:
            currentProgress = dailyStats.messagesEnvoyes;
            break;
        case ChallengeType.REACTIONS:
            currentProgress = dailyStats.reactionsAjoutees;
            break;
        case ChallengeType.VOCAL:
            currentProgress = dailyStats.tempsVocalMinutes;
            break;
        case ChallengeType.GAMES:
            if (challenge.id.includes("win")) {
                currentProgress = dailyStats.gamesWon;
            } else {
                currentProgress = dailyStats.gamesPlayed;
            }
            break;
        case ChallengeType.HANGMAN:
            if (challenge.id.includes("win")) {
                currentProgress = dailyStats.hangmanWon || 0;
            } else {
                currentProgress = dailyStats.hangmanPlayed || 0;
            }
            break;
        case ChallengeType.IMAGES:
            currentProgress = dailyStats.imagesGenerees;
            break;
        case ChallengeType.COUNTER:
            currentProgress = dailyStats.counterContributions;
            break;
        case ChallengeType.AI_CHAT:
            currentProgress = dailyStats.conversationsIA;
            break;
        case ChallengeType.COMMANDS:
            currentProgress = dailyStats.commandesUtilisees;
            break;
    }

    return Math.min(currentProgress, challenge.goal);
}

/**
 * Initialise le message persistant des défis au démarrage du bot
 * À appeler depuis bot.ts au démarrage
 */
async function initializeDailyChallengesMessage(client: any): Promise<void> {
    try {
        const challengesData = loadChallengesData();
        const today = getCurrentDate();

        // Si nouveau jour, générer de nouveaux défis
        if (challengesData.currentDate !== today) {
            logger.info(`Initializing challenges for new day: ${today}`);
            challengesData.currentDate = today;
            challengesData.challenges = generateDailyChallenges();
            // Ne pas réinitialiser persistentMessageId
            saveChallengesData(challengesData);
        }

        // Mettre à jour le message persistant
        if (challengesData.challenges && challengesData.challenges.length > 0) {
            await updatePersistentChallengesMessage(client, challengesData.challenges);
        }

        logger.info("Daily challenges message initialized");
    } catch (error) {
        logger.error("Error initializing daily challenges message:", error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("challenges")
        .setDescription("🎯 Consulte tes défis quotidiens et gagne de l'XP bonus !"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const today = getCurrentDate();

            let challengesData = loadChallengesData();

            logger.info(`[DEBUG] Loading challenges - Date: ${today}, Challenges count: ${challengesData.challenges?.length || 0}`);

            // Si nouveau jour, générer de nouveaux défis
            if (challengesData.currentDate !== today) {
                logger.info(`New day detected, generating new challenges for ${today}`);
                challengesData = {
                    currentDate: today,
                    challenges: generateDailyChallenges(),
                    persistentMessageId: challengesData.persistentMessageId, // Garder l'ID du message
                    users: {}
                };
                saveChallengesData(challengesData);

                // Mettre à jour le message persistant dans le salon
                await updatePersistentChallengesMessage(interaction.client, challengesData.challenges);
            }

            // Initialiser l'utilisateur s'il n'existe pas
            if (!challengesData.users[userId]) {
                challengesData.users[userId] = {
                    lastCheck: Date.now(),
                    progress: [
                        // Les 3 défis aléatoires
                        ...challengesData.challenges.map(c => ({
                            challengeId: c.id,
                            completed: false,
                            rewardClaimed: false
                        })),
                        // Le défi de pendu fixe
                        {
                            challengeId: FIXED_HANGMAN_CHALLENGE.id,
                            completed: false,
                            rewardClaimed: false
                        }
                    ]
                };
            } else {
                // Vérifier si l'utilisateur a les bons IDs de défis (au cas où les défis ont changé)
                const currentChallengeIds = challengesData.challenges.map(c => c.id);
                const userChallengeIds = challengesData.users[userId].progress
                    .map(p => p.challengeId)
                    .filter(id => id !== FIXED_HANGMAN_CHALLENGE.id); // Exclure le défi fixe de pendu

                // Si les IDs ne correspondent pas, réinitialiser la progression pour TOUS les défis (nouveau jour)
                const idsMatch = currentChallengeIds.length === userChallengeIds.length &&
                    currentChallengeIds.every(id => userChallengeIds.includes(id));

                if (!idsMatch) {
                    logger.info(`[DEBUG] Challenge IDs mismatch for user ${userId}, reinitializing ALL progress for new day`);

                    // Réinitialiser complètement tous les défis (y compris le pendu)
                    challengesData.users[userId].progress = [
                        // Les 3 nouveaux défis aléatoires
                        ...challengesData.challenges.map(c => ({
                            challengeId: c.id,
                            completed: false,
                            rewardClaimed: false
                        })),
                        // Le défi de pendu réinitialisé aussi
                        {
                            challengeId: FIXED_HANGMAN_CHALLENGE.id,
                            completed: false,
                            rewardClaimed: false
                        }
                    ];
                    saveChallengesData(challengesData);
                }
            }

            const userProgress = challengesData.users[userId];

            logger.info(`[DEBUG] User ${userId} progress initialized. Challenges in data: ${challengesData.challenges.length}, Progress entries: ${userProgress.progress.length}`);

            // S'assurer que le défi de pendu existe dans la progression (pour les utilisateurs existants)
            if (!userProgress.progress.find(p => p.challengeId === FIXED_HANGMAN_CHALLENGE.id)) {
                userProgress.progress.push({
                    challengeId: FIXED_HANGMAN_CHALLENGE.id,
                    completed: false,
                    rewardClaimed: false
                });
            }
            let totalXPEarned = 0;
            let newCompletions = 0;

            // Créer un tableau avec tous les défis (3 aléatoires + 1 fixe pendu)
            const allChallenges = [...challengesData.challenges, FIXED_HANGMAN_CHALLENGE];

            // Calculer la progression et distribuer les récompenses
            for (const challenge of allChallenges) {
                const progressEntry = userProgress.progress.find(p => p.challengeId === challenge.id);
                if (!progressEntry) continue;

                const currentProgress = calculateProgress(userId, challenge);
                const wasCompleted = progressEntry.completed;
                const isNowCompleted = currentProgress >= challenge.goal;

                // Si le défi vient d'être complété et que la récompense n'a pas été réclamée
                if (isNowCompleted && !wasCompleted && !progressEntry.rewardClaimed) {
                    progressEntry.completed = true;
                    progressEntry.rewardClaimed = true;
                    totalXPEarned += challenge.xpReward;
                    newCompletions++;
                    logger.info(`User ${interaction.user.username} completed challenge ${challenge.id}`);
                } else if (isNowCompleted) {
                    // Si déjà complété, juste mettre à jour le statut
                    progressEntry.completed = true;
                }
            }

            // Sauvegarder les données mises à jour
            userProgress.lastCheck = Date.now();
            saveChallengesData(challengesData);

            // Donner l'XP si des défis ont été complétés
            if (totalXPEarned > 0 && interaction.channel &&
                (interaction.channel instanceof TextChannel || interaction.channel instanceof VoiceChannel)) {
                await addXP(
                    userId,
                    interaction.user.username,
                    totalXPEarned,
                    interaction.channel,
                    false
                );
            }

            // Créer l'embed avec les défis
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🎯 Défis Quotidiens")
                .setTimestamp();

            // Message de description selon l'état des défis
            let description = "**Complète ces défis pour gagner de l'XP bonus !**\n\n";

            // Ajouter un message si des défis viennent d'être complétés
            if (newCompletions > 0) {
                description = `🎉 **Félicitations !** Tu as complété **${newCompletions}** défi${newCompletions > 1 ? 's' : ''} et gagné **${totalXPEarned} XP** !\n\n`;
                embed.setColor(0x57F287); // Vert si complétion
            }

            // Vérifier si tous les défis sont complétés
            const allCompleted = userProgress.progress.every(p => p.completed);
            if (allCompleted) {
                description = `🏆 **INCROYABLE !** Tu as complété tous les défis du jour !\n\nReviens demain pour de nouveaux défis ! 🎯\n\n`;
                embed.setColor(0xF6AD55); // Or si tous complétés
            }

            embed.setDescription(description);

            // === SECTION 1 : DÉFIS QUOTIDIENS ===
            embed.addFields({
                name: "━━━━━━━━━━━━━━━━━━━━━━",
                value: "**Défis du Jour**",
                inline: false
            });

            // Compter les défis complétés
            const randomChallengesCompleted = challengesData.challenges.filter(c => {
                const entry = userProgress.progress.find(p => p.challengeId === c.id);
                return entry && entry.completed;
            }).length;

            // Ajouter les 3 défis aléatoires
            logger.info(`[DEBUG] Displaying ${challengesData.challenges.length} challenges`);
            for (const challenge of challengesData.challenges) {
                const progressEntry = userProgress.progress.find(p => p.challengeId === challenge.id);
                if (!progressEntry) {
                    logger.warn(`[DEBUG] No progress entry found for challenge ${challenge.id}`);
                    continue;
                }

                const progress = calculateProgress(userId, challenge);
                const completed = progressEntry.completed;

                const progressPercent = Math.min((progress / challenge.goal) * 100, 100);
                const filledBars = Math.floor(progressPercent / 10);
                const emptyBars = 10 - filledBars;
                const progressBar = "▰".repeat(filledBars) + "▱".repeat(emptyBars);

                const status = completed ? "✅" : progress > 0 ? "🔄" : "⬜";
                const progressText = `${progress}/${challenge.goal}`;

                embed.addFields({
                    name: `${status} ${challenge.emoji} ${challenge.name}`,
                    value:
                        `${challenge.description}\n` +
                        `${progressBar} \n${progressText} • 💫 **${challenge.xpReward} XP**`,
                    inline: true
                });
            }

            // Ajouter un champ vide pour forcer une nouvelle ligne si nécessaire
            if (challengesData.challenges.length % 3 !== 0) {
                embed.addFields({
                    name: "\u200B",
                    value: "\u200B",
                    inline: true
                });
            }

            // === SECTION 3 : DÉFI PERMANENT ===
            embed.addFields({
                name: "━━━━━━━━━━━━━━━━━━━━━━",
                value: "**Disponible tous les jours**",
                inline: false
            });

            const hangmanProgressEntry = userProgress.progress.find(p => p.challengeId === FIXED_HANGMAN_CHALLENGE.id);
            if (hangmanProgressEntry) {
                const hangmanProgress = calculateProgress(userId, FIXED_HANGMAN_CHALLENGE);
                const hangmanCompleted = hangmanProgressEntry.completed;

                const progressPercent = Math.min((hangmanProgress / FIXED_HANGMAN_CHALLENGE.goal) * 100, 100);
                const filledBars = Math.floor(progressPercent / 10);
                const emptyBars = 10 - filledBars;
                const progressBar = "▰".repeat(filledBars) + "▱".repeat(emptyBars);

                const status = hangmanCompleted ? "✅" : hangmanProgress > 0 ? "🔄" : "⬜";
                const progressText = `${hangmanProgress}/${FIXED_HANGMAN_CHALLENGE.goal}`;

                embed.addFields({
                    name: `${status} ${FIXED_HANGMAN_CHALLENGE.emoji} ${FIXED_HANGMAN_CHALLENGE.name}`,
                    value:
                        `${FIXED_HANGMAN_CHALLENGE.description}\n` +
                        `${progressBar}\n${progressText} • 💫 **${FIXED_HANGMAN_CHALLENGE.xpReward} XP**`,
                    inline: false
                });
            }

            // === SECTION 4 : STATUT VOCAL (EN BAS) ===
            const dailyVoiceMinutes = getDailyVoiceTime(userId);
            let currentVoiceTier = VOICE_XP_TIERS[0];
            for (const tier of VOICE_XP_TIERS) {
                if (dailyVoiceMinutes >= tier.minMinutes && dailyVoiceMinutes < tier.maxMinutes) {
                    currentVoiceTier = tier;
                    break;
                }
            }

            const formatTime = (minutes: number): string => {
                if (minutes === 0) return "0 min";
                if (minutes < 60) return `${minutes} min`;
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
            };

            // Calculer l'XP vocal accumulé aujourd'hui
            let totalVoiceXP = 0;
            for (const tier of VOICE_XP_TIERS) {
                if (dailyVoiceMinutes <= tier.minMinutes) break;

                const minutesInTier = Math.min(dailyVoiceMinutes, tier.maxMinutes) - tier.minMinutes;
                if (minutesInTier > 0) {
                    totalVoiceXP += Math.ceil(minutesInTier * tier.multiplier);
                }
            }

            // Barre de progression pour le temps (sur 4h = 240 min max pour visualisation)
            const maxDisplayMinutes = 240;
            const timeProgressPercent = Math.min((dailyVoiceMinutes / maxDisplayMinutes) * 100, 100);
            const timeFilledBars = Math.floor(timeProgressPercent / 5);
            const timeEmptyBars = 20 - timeFilledBars;
            const timeProgressBar = "▰".repeat(timeFilledBars) + "▱".repeat(timeEmptyBars);

            // Barre de progression pour l'XP (on estime un max à ~300 XP pour la visualisation)
            const maxDisplayXP = 300;
            const xpProgressPercent = Math.min((totalVoiceXP / maxDisplayXP) * 100, 100);
            const xpFilledBars = Math.floor(xpProgressPercent / 5);
            const xpEmptyBars = 20 - xpFilledBars;
            const xpProgressBar = "▰".repeat(xpFilledBars) + "▱".repeat(xpEmptyBars);

            const voiceXPPerMinute = Math.ceil(1 * currentVoiceTier.multiplier);

            // Calculer le temps jusqu'à minuit
            const now = new Date();
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            const msUntilMidnight = midnight.getTime() - now.getTime();
            const hoursUntilReset = Math.floor(msUntilMidnight / (1000 * 60 * 60));
            const minutesUntilReset = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));


            embed.addFields({
                name: "━━━━━━━━━━━━━━━━━━━━━━\n🎤 XP Vocal Accumulé",
                value:
                    `${xpProgressBar}\n` +
                    `💫  **${totalVoiceXP} XP** gagné • ${voiceXPPerMinute} XP/min (${currentVoiceTier.label}) • ⏰ Reset dans ${hoursUntilReset}h ${minutesUntilReset}min`,
                inline: false
            });


            // Footer avec statistiques
            const totalChallenges = challengesData.challenges.length + 1; // +1 pour le pendu
            const totalCompleted = randomChallengesCompleted + (hangmanProgressEntry?.completed ? 1 : 0);
            embed.setFooter({
                text: `Progression : ${totalCompleted}/${totalChallenges} défis complétés • Utilise /challenges pour actualiser`
            });

            await interaction.reply({embeds: [embed], ephemeral: true});

            // Logger la commande
            if (newCompletions > 0) {
                await logCommand(
                    "🎯 Daily Challenges",
                    undefined,
                    [
                        {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                        {name: "✅ Complétés", value: `${newCompletions}`, inline: true},
                        {name: "💫 XP gagné", value: `${totalXPEarned}`, inline: true}
                    ]
                );
            }

        } catch (error) {
            logger.error("Error in challenges command:", error);
            await interaction.reply({
                content: "❌ Une erreur s'est produite lors de la récupération des défis quotidiens.",
                ephemeral: true
            });
        }
    },

    // Export de la fonction d'initialisation pour bot.ts
    initializeDailyChallengesMessage: initializeDailyChallengesMessage
};
