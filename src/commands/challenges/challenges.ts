import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel, VoiceChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP} from "../../services/xpSystem";
import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../../utils/logger";
import {getCurrentDate, getUserDailyStats} from "../../services/dailyStatsService";

const logger = createLogger("DailyChallengesCmd");
const CHALLENGES_FILE = path.join(process.cwd(), "data", "daily_challenges.json");

/**
 * Types de défis disponibles
 */
enum ChallengeType {
    MESSAGES = "messages",
    REACTIONS = "reactions",
    VOCAL = "vocal",
    GAMES = "games",
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
    // Défis Messages
    {
        id: "msg_5",
        type: ChallengeType.MESSAGES,
        name: "Bavard",
        description: "Envoyer 5 messages",
        emoji: "💬",
        goal: 5,
        xpReward: 50
    },
    {
        id: "msg_10",
        type: ChallengeType.MESSAGES,
        name: "Causeur",
        description: "Envoyer 10 messages",
        emoji: "💬",
        goal: 10,
        xpReward: 100
    },
    {
        id: "msg_20",
        type: ChallengeType.MESSAGES,
        name: "Grand Parleur",
        description: "Envoyer 20 messages",
        emoji: "📢",
        goal: 20,
        xpReward: 150
    },
    // Défis Réactions
    {
        id: "react_10",
        type: ChallengeType.REACTIONS,
        name: "Réactif",
        description: "Ajouter 10 réactions",
        emoji: "👍",
        goal: 10,
        xpReward: 50
    },
    {
        id: "react_25",
        type: ChallengeType.REACTIONS,
        name: "Super Réactif",
        description: "Ajouter 25 réactions",
        emoji: "⭐",
        goal: 25,
        xpReward: 100
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
        description: "Jouer 3 parties de jeux",
        emoji: "🎮",
        goal: 3,
        xpReward: 75
    },
    {
        id: "games_5",
        type: ChallengeType.GAMES,
        name: "Gamer",
        description: "Jouer 5 parties de jeux",
        emoji: "🎯",
        goal: 5,
        xpReward: 125
    },
    {
        id: "games_win_2",
        type: ChallengeType.GAMES,
        name: "Victorieux",
        description: "Gagner 2 parties de jeux",
        emoji: "🏆",
        goal: 2,
        xpReward: 150
    },
    // Défis Images
    {
        id: "images_1",
        type: ChallengeType.IMAGES,
        name: "Artiste du Jour",
        description: "Générer 1 image avec Netricsa",
        emoji: "🎨",
        goal: 1,
        xpReward: 75
    },
    {
        id: "images_3",
        type: ChallengeType.IMAGES,
        name: "Créateur Actif",
        description: "Générer 3 images avec Netricsa",
        emoji: "🖼️",
        goal: 3,
        xpReward: 150
    },
    // Défis Compteur
    {
        id: "counter_5",
        type: ChallengeType.COUNTER,
        name: "Compteur Pro",
        description: "Contribuer 5 fois au compteur",
        emoji: "🔢",
        goal: 5,
        xpReward: 75
    },
    {
        id: "counter_10",
        type: ChallengeType.COUNTER,
        name: "Maître du Compteur",
        description: "Contribuer 10 fois au compteur",
        emoji: "💯",
        goal: 10,
        xpReward: 150
    },
    // Défis IA
    {
        id: "ai_3",
        type: ChallengeType.AI_CHAT,
        name: "Causeur avec Netricsa",
        description: "Avoir 3 conversations avec Netricsa",
        emoji: "🤖",
        goal: 3,
        xpReward: 75
    },
    {
        id: "ai_5",
        type: ChallengeType.AI_CHAT,
        name: "Ami de Netricsa",
        description: "Avoir 5 conversations avec Netricsa",
        emoji: "💭",
        goal: 5,
        xpReward: 125
    },
    // Défis Commandes
    {
        id: "cmd_5",
        type: ChallengeType.COMMANDS,
        name: "Commandant",
        description: "Utiliser 5 commandes",
        emoji: "⚡",
        goal: 5,
        xpReward: 50
    }
];

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("challenges")
        .setDescription("Consulte tes défis quotidiens et gagne de l'XP bonus ! 🎯"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const today = getCurrentDate();

            let challengesData = loadChallengesData();

            // Si nouveau jour, générer de nouveaux défis
            if (challengesData.currentDate !== today) {
                logger.info(`New day detected, generating new challenges for ${today}`);
                challengesData = {
                    currentDate: today,
                    challenges: generateDailyChallenges(),
                    users: {}
                };
                saveChallengesData(challengesData);
            }

            // Initialiser l'utilisateur s'il n'existe pas
            if (!challengesData.users[userId]) {
                challengesData.users[userId] = {
                    lastCheck: Date.now(),
                    progress: challengesData.challenges.map(c => ({
                        challengeId: c.id,
                        completed: false,
                        rewardClaimed: false
                    }))
                };
            }

            const userProgress = challengesData.users[userId];
            let totalXPEarned = 0;
            let newCompletions = 0;

            // Calculer la progression et distribuer les récompenses
            for (const challenge of challengesData.challenges) {
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
                .setDescription("Complète ces défis pour gagner de l'XP bonus !\n*Les défis se renouvellent chaque jour à minuit.*")
                .setTimestamp();

            // Ajouter les défis avec leur progression
            for (const challenge of challengesData.challenges) {
                const progressEntry = userProgress.progress.find(p => p.challengeId === challenge.id);
                if (!progressEntry) continue;

                const progress = calculateProgress(userId, challenge);
                const completed = progressEntry.completed;

                // Barre de progression
                const progressPercent = Math.min((progress / challenge.goal) * 100, 100);
                const filledBars = Math.floor(progressPercent / 10);
                const emptyBars = 10 - filledBars;
                const progressBar = "▰".repeat(filledBars) + "▱".repeat(emptyBars);

                const status = completed ? "✅" : progress > 0 ? "🔄" : "⬜";
                const progressText = completed
                    ? `${challenge.goal}/${challenge.goal}`
                    : `${progress}/${challenge.goal}`;

                embed.addFields({
                    name: `${status} ${challenge.emoji} ${challenge.name}`,
                    value: `${challenge.description}\n${progressBar} ${progressText}\nRécompense : **${challenge.xpReward} XP** 💫`,
                    inline: false
                });
            }

            // Ajouter un message si des défis viennent d'être complétés
            if (newCompletions > 0) {
                embed.setDescription(
                    `🎉 **Félicitations !** Tu as complété **${newCompletions}** défi${newCompletions > 1 ? 's' : ''} et gagné **${totalXPEarned} XP** !\n\n` +
                    `Complète les défis restants pour encore plus de récompenses !\n*Les défis se renouvellent chaque jour à minuit.*`
                );
                embed.setColor(0x57F287); // Vert si complétion
            }

            // Vérifier si tous les défis sont complétés
            const allCompleted = userProgress.progress.every(p => p.completed);
            if (allCompleted) {
                embed.setDescription(
                    `🏆 **INCROYABLE !** Tu as complété tous les défis du jour !\n\n` +
                    `Reviens demain pour de nouveaux défis et encore plus de récompenses ! 🎯`
                );
                embed.setColor(0xF6AD55); // Or si tous complétés
            }

            await interaction.reply({embeds: [embed]});

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
    }
};
