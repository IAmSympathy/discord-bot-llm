import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";
import {Client, TextChannel} from "discord.js";

const logger = createLogger("AchievementService");
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, "user_achievements.json");

/**
 * Catégories d'achievements
 */
export enum AchievementCategory {
    PROFIL = "profil",
    NETRICSA = "netricsa",
    DISCORD = "discord",
    JEUX = "jeux"
}

/**
 * Définition d'un achievement
 */
export interface Achievement {
    id: string;
    category: AchievementCategory;
    name: string;
    description: string;
    emoji: string;
    secret: boolean; // Si true, la description n'est pas visible tant que non débloqué
    xpReward: number;
}

/**
 * Progression d'un achievement pour un utilisateur
 */
export interface UserAchievement {
    achievementId: string;
    unlockedAt: number | null; // timestamp ou null si pas débloqué
    notified: boolean; // Si l'utilisateur a été notifié du déblocage
}

/**
 * Base de données des achievements utilisateurs
 */
interface AchievementsDatabase {
    [userId: string]: {
        username: string;
        achievements: UserAchievement[];
        lastUpdate: number;
    };
}

/**
 * Liste de tous les achievements disponibles
 */
export const ALL_ACHIEVEMENTS: Achievement[] = [
    // === ACHIEVEMENTS PROFIL ===
    {
        id: "profile_birthday_set",
        category: AchievementCategory.PROFIL,
        name: "Gâteau d'anniversaire",
        description: "Ajouter sa date d'anniversaire à son profil avec notification activée",
        emoji: "🎂",
        secret: false,
        xpReward: 100
    },
    {
        id: "profile_nickname",
        category: AchievementCategory.PROFIL,
        name: "Surnommé",
        description: "Avoir au moins 1 surnom enregistré par Netricsa",
        emoji: "🏷️",
        secret: false,
        xpReward: 100
    },
    {
        id: "profile_facts_3",
        category: AchievementCategory.PROFIL,
        name: "Livre ouvert",
        description: "Avoir 3 faits enregistrés dans son profil par Netricsa",
        emoji: "📚",
        secret: false,
        xpReward: 100
    },
    {
        id: "profile_interests_5",
        category: AchievementCategory.PROFIL,
        name: "Passionné",
        description: "Avoir 5 centres d'intérêt enregistrés par Netricsa",
        emoji: "❤️",
        secret: false,
        xpReward: 150
    },
    // === ACHIEVEMENTS COMPTEUR ===
    {
        id: "counter_10_counts",
        category: AchievementCategory.JEUX,
        name: "Compteur Amateur",
        description: "Faire 10 contributions au compteur",
        emoji: "🎯",
        secret: false,
        xpReward: 100
    },
    {
        id: "counter_50_counts",
        category: AchievementCategory.JEUX,
        name: "Compteur Confirmé",
        description: "Faire 50 contributions au compteur",
        emoji: "🏅",
        secret: false,
        xpReward: 200
    },
    {
        id: "counter_100_counts",
        category: AchievementCategory.JEUX,
        name: "Maître du Compteur",
        description: "Faire 100 contributions au compteur",
        emoji: "👑",
        secret: false,
        xpReward: 500
    },
    {
        id: "counter_500_counts",
        category: AchievementCategory.JEUX,
        name: "Légende du Compteur",
        description: "Faire 500 contributions au compteur",
        emoji: "💎",
        secret: false,
        xpReward: 1000
    },
    {
        id: "counter_1000_counts",
        category: AchievementCategory.JEUX,
        name: "Dieu du Compteur",
        description: "Faire 1000 contributions au compteur",
        emoji: "🌟",
        secret: false,
        xpReward: 1500           // Réduit de 2000 à 1500
    },

    // === ACHIEVEMENTS JEUX - GÉNÉRAUX ===
    {
        id: "game_first",
        category: AchievementCategory.JEUX,
        name: "Première Partie",
        description: "Jouer sa première partie",
        emoji: "🎲",
        secret: false,
        xpReward: 50
    },
    {
        id: "game_played_50",
        category: AchievementCategory.JEUX,
        name: "Joueur Régulier",
        description: "Jouer 50 parties au total",
        emoji: "🎮",
        secret: false,
        xpReward: 100
    },
    {
        id: "game_played_200",
        category: AchievementCategory.JEUX,
        name: "Accro aux Jeux",
        description: "Jouer 200 parties au total",
        emoji: "🎯",
        secret: false,
        xpReward: 200
    },
    {
        id: "game_polyvalent",
        category: AchievementCategory.JEUX,
        name: "Polyvalent",
        description: "Jouer à tous les jeux disponibles",
        emoji: "🌟",
        secret: false,
        xpReward: 150
    },
    {
        id: "game_first_win",
        category: AchievementCategory.JEUX,
        name: "Premier Sang",
        description: "Gagner sa première partie",
        emoji: "🏆",
        secret: false,
        xpReward: 50
    },
    {
        id: "game_win_25",
        category: AchievementCategory.JEUX,
        name: "Champion en Herbe",
        description: "Gagner 25 parties au total",
        emoji: "⭐",
        secret: false,
        xpReward: 150
    },
    {
        id: "game_win_100",
        category: AchievementCategory.JEUX,
        name: "Maître des Jeux",
        description: "Gagner 100 parties au total",
        emoji: "👑",
        secret: false,
        xpReward: 300
    },
    {
        id: "game_win_500",
        category: AchievementCategory.JEUX,
        name: "Légende Vivante",
        description: "Gagner 500 parties au total",
        emoji: "🔥",
        secret: false,
        xpReward: 400            // Réduit de 500 à 400
    },
    {
        id: "game_streak_3",
        category: AchievementCategory.JEUX,
        name: "Hot Streak",
        description: "Gagner 3 parties d'affilée",
        emoji: "🔥",
        secret: false,
        xpReward: 100
    },
    {
        id: "game_streak_5",
        category: AchievementCategory.JEUX,
        name: "Unstoppable",
        description: "Gagner 5 parties d'affilée",
        emoji: "⚡",
        secret: false,
        xpReward: 200
    },
    {
        id: "game_streak_10",
        category: AchievementCategory.JEUX,
        name: "Domination",
        description: "Gagner 10 parties d'affilée",
        emoji: "🌟",
        secret: false,
        xpReward: 400
    },
    {
        id: "game_streak_20",
        category: AchievementCategory.JEUX,
        name: "Perfection",
        description: "Gagner 20 parties d'affilée",
        emoji: "💎",
        secret: false,
        xpReward: 500            // Réduit de 800 à 500
    },
    {
        id: "game_loss_10",
        category: AchievementCategory.JEUX,
        name: "Persévérant",
        description: "Perdre 10 parties mais continuer à jouer",
        emoji: "💪",
        secret: false,
        xpReward: 100
    },
    {
        id: "game_loss_50",
        category: AchievementCategory.JEUX,
        name: "Inébranlable",
        description: "Perdre 50 parties mais continuer à jouer",
        emoji: "🛡️",
        secret: false,
        xpReward: 200
    },
    {
        id: "game_loss_100",
        category: AchievementCategory.JEUX,
        name: "Titan",
        description: "Perdre 100 parties mais continuer à jouer",
        emoji: "🦾",
        secret: false,
        xpReward: 300
    },

    // === ACHIEVEMENTS JEUX - ROCHE-PAPIER-CISEAUX ===
    {
        id: "rps_win_10",
        category: AchievementCategory.JEUX,
        name: "Débutant RPS",
        description: "Gagner 10 parties de Roche-Papier-Ciseaux",
        emoji: "✊",
        secret: false,
        xpReward: 100
    },
    {
        id: "rps_win_50",
        category: AchievementCategory.JEUX,
        name: "Amateur RPS",
        description: "Gagner 50 parties de Roche-Papier-Ciseaux",
        emoji: "🪨",
        secret: false,
        xpReward: 200
    },
    {
        id: "rps_win_200",
        category: AchievementCategory.JEUX,
        name: "Expert RPS",
        description: "Gagner 200 parties de Roche-Papier-Ciseaux",
        emoji: "📜",
        secret: false,
        xpReward: 400
    },
    {
        id: "rps_pvp_25",
        category: AchievementCategory.JEUX,
        name: "Duelliste RPS",
        description: "Gagner 25 parties de RPS contre des joueurs",
        emoji: "⚔️",
        secret: false,
        xpReward: 200
    },
    {
        id: "rps_pvp_100",
        category: AchievementCategory.JEUX,
        name: "Maître du Duel RPS",
        description: "Gagner 100 parties de RPS contre des joueurs",
        emoji: "👊",
        secret: false,
        xpReward: 500
    },
    {
        id: "rps_pve_50",
        category: AchievementCategory.JEUX,
        name: "Entraîneur RPS",
        description: "Gagner 50 parties de RPS contre Netricsa",
        emoji: "🤖",
        secret: false,
        xpReward: 150
    },
    {
        id: "rps_pve_200",
        category: AchievementCategory.JEUX,
        name: "Destructeur de Bot RPS",
        description: "Gagner 200 parties de RPS contre Netricsa",
        emoji: "🎯",
        secret: false,
        xpReward: 300
    },
    {
        id: "rps_triple",
        category: AchievementCategory.JEUX,
        name: "Triple Menace",
        description: "Gagner avec chaque choix (Roche, Papier, Ciseaux)",
        emoji: "✊📜✂️",
        secret: false,
        xpReward: 50
    },
    {
        id: "rps_only_rock",
        category: AchievementCategory.JEUX,
        name: "Têtu comme une Roche",
        description: "Gagner 10 parties en ne jouant QUE Roche",
        emoji: "🪨",
        secret: true,
        xpReward: 100
    },
    {
        id: "rps_only_paper",
        category: AchievementCategory.JEUX,
        name: "L'Écrivain",
        description: "Gagner 10 parties en ne jouant QUE Papier",
        emoji: "📜",
        secret: true,
        xpReward: 100
    },
    {
        id: "rps_only_scissors",
        category: AchievementCategory.JEUX,
        name: "Le Coiffeur",
        description: "Gagner 10 parties en ne jouant QUE Ciseaux",
        emoji: "✂️",
        secret: true,
        xpReward: 100
    },
    {
        id: "rps_streak_5",
        category: AchievementCategory.JEUX,
        name: "Prédicateur",
        description: "Gagner 5 parties d'affilée en RPS",
        emoji: "🔮",
        secret: false,
        xpReward: 200
    },

    // === ACHIEVEMENTS JEUX - TIC-TAC-TOE ===
    {
        id: "ttt_win_10",
        category: AchievementCategory.JEUX,
        name: "Débutant TTT",
        description: "Gagner 10 parties de Tic-Tac-Toe",
        emoji: "⭕",
        secret: false,
        xpReward: 100
    },
    {
        id: "ttt_win_50",
        category: AchievementCategory.JEUX,
        name: "Amateur TTT",
        description: "Gagner 50 parties de Tic-Tac-Toe",
        emoji: "❌",
        secret: false,
        xpReward: 200
    },
    {
        id: "ttt_win_200",
        category: AchievementCategory.JEUX,
        name: "Expert TTT",
        description: "Gagner 200 parties de Tic-Tac-Toe",
        emoji: "🎯",
        secret: false,
        xpReward: 400
    },
    {
        id: "ttt_pvp_25",
        category: AchievementCategory.JEUX,
        name: "Stratège TTT",
        description: "Gagner 25 parties de TTT contre des joueurs",
        emoji: "🤝",
        secret: false,
        xpReward: 200
    },
    {
        id: "ttt_pvp_100",
        category: AchievementCategory.JEUX,
        name: "Grand Maître TTT",
        description: "Gagner 100 parties de TTT contre des joueurs",
        emoji: "🧠",
        secret: false,
        xpReward: 500
    },
    {
        id: "ttt_pve_50",
        category: AchievementCategory.JEUX,
        name: "Élève Studieux",
        description: "Gagner 50 parties de TTT contre Netricsa",
        emoji: "🤖",
        secret: false,
        xpReward: 150
    },
    {
        id: "ttt_pve_200",
        category: AchievementCategory.JEUX,
        name: "Diplômé TTT",
        description: "Gagner 200 parties de TTT contre Netricsa",
        emoji: "🎓",
        secret: false,
        xpReward: 300
    },
    {
        id: "ttt_draw_20",
        category: AchievementCategory.JEUX,
        name: "Le Mur",
        description: "Faire 20 égalités en TTT",
        emoji: "🧱",
        secret: false,
        xpReward: 100
    },

    // === ACHIEVEMENTS JEUX - CONNECT 4 ===
    {
        id: "c4_win_10",
        category: AchievementCategory.JEUX,
        name: "Débutant C4",
        description: "Gagner 10 parties de Connect 4",
        emoji: "🟡",
        secret: false,
        xpReward: 150
    },
    {
        id: "c4_win_50",
        category: AchievementCategory.JEUX,
        name: "Amateur C4",
        description: "Gagner 50 parties de Connect 4",
        emoji: "🔴",
        secret: false,
        xpReward: 250
    },
    {
        id: "c4_win_200",
        category: AchievementCategory.JEUX,
        name: "Expert C4",
        description: "Gagner 200 parties de Connect 4",
        emoji: "⚫",
        secret: false,
        xpReward: 500
    },
    {
        id: "c4_pvp_25",
        category: AchievementCategory.JEUX,
        name: "Tacticien C4",
        description: "Gagner 25 parties de C4 contre des joueurs",
        emoji: "🎯",
        secret: false,
        xpReward: 300
    },
    {
        id: "c4_pvp_100",
        category: AchievementCategory.JEUX,
        name: "Génie C4",
        description: "Gagner 100 parties de C4 contre des joueurs",
        emoji: "🧠",
        secret: false,
        xpReward: 600
    },
    {
        id: "c4_pve_50",
        category: AchievementCategory.JEUX,
        name: "Calculateur",
        description: "Gagner 50 parties de C4 contre Netricsa",
        emoji: "🤖",
        secret: false,
        xpReward: 200
    },
    {
        id: "c4_pve_200",
        category: AchievementCategory.JEUX,
        name: "Maître Algorithmique",
        description: "Gagner 200 parties de C4 contre Netricsa",
        emoji: "🎓",
        secret: false,
        xpReward: 400
    },

    // === ACHIEVEMENTS JEUX - PENDU ===
    {
        id: "hangman_win_10",
        category: AchievementCategory.JEUX,
        name: "Débutant Pendu",
        description: "Gagner 10 parties de Pendu",
        emoji: "📝",
        secret: false,
        xpReward: 100
    },
    {
        id: "hangman_win_50",
        category: AchievementCategory.JEUX,
        name: "Amateur Pendu",
        description: "Gagner 50 parties de Pendu",
        emoji: "📚",
        secret: false,
        xpReward: 200
    },
    {
        id: "hangman_win_200",
        category: AchievementCategory.JEUX,
        name: "Expert Pendu",
        description: "Gagner 200 parties de Pendu",
        emoji: "🎓",
        secret: false,
        xpReward: 400
    },
    {
        id: "hangman_perfect",
        category: AchievementCategory.JEUX,
        name: "Sans Faute",
        description: "Gagner une partie sans aucune erreur",
        emoji: "🎯",
        secret: false,
        xpReward: 150
    },
    {
        id: "hangman_perfect_10",
        category: AchievementCategory.JEUX,
        name: "Perfection Absolue",
        description: "Gagner 10 parties sans aucune erreur",
        emoji: "💎",
        secret: false,
        xpReward: 500
    },
    {
        id: "hangman_streak_5",
        category: AchievementCategory.JEUX,
        name: "Série Parfaite",
        description: "Gagner 5 parties de Pendu d'affilée",
        emoji: "🏆",
        secret: false,
        xpReward: 250
    },

    // === ACHIEVEMENTS JEUX - SECRETS & FUN ===
    {
        id: "game_easy",
        category: AchievementCategory.JEUX,
        name: "Trop Facile",
        description: "Gagner 10 parties contre Netricsa sans perdre",
        emoji: "😎",
        secret: true,
        xpReward: 300
    },
    {
        id: "game_beat_netricsa_100",
        category: AchievementCategory.JEUX,
        name: "Je Suis Ton Père",
        description: "Battre Netricsa 100 fois au total",
        emoji: "🤖",
        secret: true,
        xpReward: 400
    },
    {
        id: "game_all_today",
        category: AchievementCategory.JEUX,
        name: "Touche-à-Tout",
        description: "Jouer à tous les jeux dans la même journée",
        emoji: "🔄",
        secret: false,
        xpReward: 100
    },
    {
        id: "game_night_owl",
        category: AchievementCategory.JEUX,
        name: "Insomniac Gamer",
        description: "Jouer entre 2h et 5h du matin",
        emoji: "🌙",
        secret: true,
        xpReward: 150
    },
    {
        id: "game_marathon",
        category: AchievementCategory.JEUX,
        name: "Marathonien",
        description: "Jouer 20 parties en une seule session",
        emoji: "⏰",
        secret: false,
        xpReward: 200
    },
    {
        id: "game_bad_day",
        category: AchievementCategory.JEUX,
        name: "C'est Pas Mon Jour",
        description: "Perdre 10 parties d'affilée",
        emoji: "💀",
        secret: true,
        xpReward: 50
    },
    {
        id: "game_first_10_loss",
        category: AchievementCategory.JEUX,
        name: "L'Apprentissage",
        description: "Perdre ses 10 premières parties",
        emoji: "😅",
        secret: true,
        xpReward: 50
    },

    // === ACHIEVEMENTS NETRICSA - GÉNÉRATION D'IMAGES ===
    {
        id: "netricsa_gen_10",
        category: AchievementCategory.NETRICSA,
        name: "Créateur Amateur",
        description: "Imaginer 10 images avec Netricsa",
        emoji: "🎨",
        secret: false,
        xpReward: 100
    },
    {
        id: "netricsa_gen_50",
        category: AchievementCategory.NETRICSA,
        name: "Artiste Confirmé",
        description: "Imaginer 50 images avec Netricsa",
        emoji: "🖌️",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_gen_200",
        category: AchievementCategory.NETRICSA,
        name: "Maître Artiste",
        description: "Imaginer 200 images avec Netricsa",
        emoji: "🌟",
        secret: false,
        xpReward: 500
    },
    {
        id: "netricsa_gen_500",
        category: AchievementCategory.NETRICSA,
        name: "Légende de l'Art",
        description: "Imaginer 500 images avec Netricsa",
        emoji: "🎭",
        secret: false,
        xpReward: 1000
    },
    // === ACHIEVEMENTS NETRICSA - RÉIMAGINATION ===
    {
        id: "netricsa_reimagine_10",
        category: AchievementCategory.NETRICSA,
        name: "Réimaginateur Amateur",
        description: "Réimaginer 10 images",
        emoji: "✨",
        secret: false,
        xpReward: 100
    },
    {
        id: "netricsa_reimagine_50",
        category: AchievementCategory.NETRICSA,
        name: "Réimaginateur Confirmé",
        description: "Réimaginer 50 images",
        emoji: "🎪",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_reimagine_200",
        category: AchievementCategory.NETRICSA,
        name: "Maître Réimaginateur",
        description: "Réimaginer 200 images",
        emoji: "🌈",
        secret: false,
        xpReward: 500
    },
    // === ACHIEVEMENTS NETRICSA - UPSCALING ===
    {
        id: "netricsa_upscale_10",
        category: AchievementCategory.NETRICSA,
        name: "HD Amateur",
        description: "Upscaler 10 images",
        emoji: "📸",
        secret: false,
        xpReward: 100
    },
    {
        id: "netricsa_upscale_50",
        category: AchievementCategory.NETRICSA,
        name: "HD Master",
        description: "Upscaler 50 images",
        emoji: "🎬",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_upscale_200",
        category: AchievementCategory.NETRICSA,
        name: "4K Legend",
        description: "Upscaler 200 images",
        emoji: "💎",
        secret: false,
        xpReward: 500
    },
    // === ACHIEVEMENTS NETRICSA - CONVERSATIONS IA ===
    {
        id: "netricsa_conv_5",
        category: AchievementCategory.NETRICSA,
        name: "Première Conversation",
        description: "Converser 5 fois avec Netricsa",
        emoji: "💭",
        secret: false,
        xpReward: 50
    },
    {
        id: "netricsa_conv_50",
        category: AchievementCategory.NETRICSA,
        name: "Bavard IA",
        description: "Converser 50 fois avec Netricsa",
        emoji: "🗣️",
        secret: false,
        xpReward: 100
    },
    {
        id: "netricsa_conv_200",
        category: AchievementCategory.NETRICSA,
        name: "Causeur Expert",
        description: "Converser 200 fois avec Netricsa",
        emoji: "💬",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_conv_500",
        category: AchievementCategory.NETRICSA,
        name: "Meilleur Ami de Netricsa",
        description: "Converser 500 fois avec Netricsa",
        emoji: "🎙️",
        secret: false,
        xpReward: 500
    },
    // === ACHIEVEMENTS NETRICSA - PROMPTS ===
    {
        id: "netricsa_prompt_5",
        category: AchievementCategory.NETRICSA,
        name: "Prompt Amateur",
        description: "Créer 5 prompts personnalisés",
        emoji: "📋",
        secret: false,
        xpReward: 100
    },
    {
        id: "netricsa_prompt_20",
        category: AchievementCategory.NETRICSA,
        name: "Maître du Prompt",
        description: "Créer 20 prompts personnalisés",
        emoji: "📝",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_prompt_50",
        category: AchievementCategory.NETRICSA,
        name: "Architecte de Prompts",
        description: "Créer 50 prompts personnalisés",
        emoji: "🎯",
        secret: false,
        xpReward: 500
    },
    // === ACHIEVEMENTS NETRICSA - MEMES ===
    {
        id: "netricsa_meme_10",
        category: AchievementCategory.NETRICSA,
        name: "Chercheur de Memes",
        description: "Rechercher 10 memes avec /findmeme",
        emoji: "🤣",
        secret: false,
        xpReward: 100
    },
    {
        id: "netricsa_meme_50",
        category: AchievementCategory.NETRICSA,
        name: "Collectionneur de Memes",
        description: "Rechercher 50 memes avec /findmeme",
        emoji: "🎪",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_meme_200",
        category: AchievementCategory.NETRICSA,
        name: "Roi des Memes",
        description: "Rechercher 200 memes avec /findmeme",
        emoji: "🎭",
        secret: false,
        xpReward: 500
    },
    // === ACHIEVEMENTS NETRICSA - COMBINÉS ===
    {
        id: "netricsa_all_features",
        category: AchievementCategory.NETRICSA,
        name: "Touche-à-tout",
        description: "Utiliser toutes les fonctions images (imaginer, réimaginer, upscaler)",
        emoji: "🎨",
        secret: false,
        xpReward: 200
    },
    {
        id: "netricsa_creator",
        category: AchievementCategory.NETRICSA,
        name: "Créateur Complet",
        description: "Imaginer 100 images et créer 10 prompts",
        emoji: "💎",
        secret: false,
        xpReward: 300
    },
    {
        id: "netricsa_master",
        category: AchievementCategory.NETRICSA,
        name: "Maître Netricsa",
        description: "200 imaginations + 100 conversations + 20 prompts",
        emoji: "🌟",
        secret: false,
        xpReward: 1000
    },
    {
        id: "netricsa_total_artist",
        category: AchievementCategory.NETRICSA,
        name: "Artiste Total",
        description: "500 imaginations + 200 réimages + 100 upscales",
        emoji: "🎭",
        secret: true,
        xpReward: 2000
    },
    // === ACHIEVEMENTS DISCORD - MESSAGES ===
    {
        id: "discord_msg_10",
        category: AchievementCategory.DISCORD,
        name: "Première Parole",
        description: "Envoyer 10 messages sur le serveur",
        emoji: "💬",
        secret: false,
        xpReward: 50
    },
    {
        id: "discord_msg_100",
        category: AchievementCategory.DISCORD,
        name: "Bavard",
        description: "Envoyer 100 messages sur le serveur",
        emoji: "🗨️",
        secret: false,
        xpReward: 100
    },
    {
        id: "discord_msg_500",
        category: AchievementCategory.DISCORD,
        name: "Causeur",
        description: "Envoyer 500 messages sur le serveur",
        emoji: "💭",
        secret: false,
        xpReward: 200
    },
    {
        id: "discord_msg_1000",
        category: AchievementCategory.DISCORD,
        name: "Orateur",
        description: "Envoyer 1000 messages sur le serveur",
        emoji: "🗣️",
        secret: false,
        xpReward: 300
    },
    {
        id: "discord_msg_5000",
        category: AchievementCategory.DISCORD,
        name: "Porte-Parole",
        description: "Envoyer 5000 messages sur le serveur",
        emoji: "📢",
        secret: false,
        xpReward: 500
    },
    // === ACHIEVEMENTS DISCORD - RÉACTIONS DONNÉES ===
    {
        id: "discord_react_50",
        category: AchievementCategory.DISCORD,
        name: "Réactif",
        description: "Ajouter 50 réactions",
        emoji: "👍",
        secret: false,
        xpReward: 50
    },
    {
        id: "discord_react_200",
        category: AchievementCategory.DISCORD,
        name: "Expressif",
        description: "Ajouter 200 réactions",
        emoji: "😄",
        secret: false,
        xpReward: 100
    },
    {
        id: "discord_react_500",
        category: AchievementCategory.DISCORD,
        name: "Émotif",
        description: "Ajouter 500 réactions",
        emoji: "🎭",
        secret: false,
        xpReward: 200
    },
    // === ACHIEVEMENTS DISCORD - COMMANDES ===
    {
        id: "discord_cmd_10",
        category: AchievementCategory.DISCORD,
        name: "Découvreur",
        description: "Utiliser 10 commandes",
        emoji: "⚡",
        secret: false,
        xpReward: 50
    },
    {
        id: "discord_cmd_50",
        category: AchievementCategory.DISCORD,
        name: "Commandant",
        description: "Utiliser 50 commandes",
        emoji: "🎮",
        secret: false,
        xpReward: 100
    },
    {
        id: "discord_cmd_200",
        category: AchievementCategory.DISCORD,
        name: "Expert des Commandes",
        description: "Utiliser 200 commandes",
        emoji: "🎯",
        secret: false,
        xpReward: 200
    },
    {
        id: "discord_cmd_500",
        category: AchievementCategory.DISCORD,
        name: "Maître des Commandes",
        description: "Utiliser 500 commandes",
        emoji: "🏅",
        secret: false,
        xpReward: 300
    },
    // === ACHIEVEMENTS DISCORD - VOCAL ===
    {
        id: "discord_voice_1h",
        category: AchievementCategory.DISCORD,
        name: "Première Voix",
        description: "Passer 1h en vocal",
        emoji: "🎤",
        secret: false,
        xpReward: 50
    },
    {
        id: "discord_voice_10h",
        category: AchievementCategory.DISCORD,
        name: "Causeur Vocal",
        description: "Passer 10h en vocal",
        emoji: "🎧",
        secret: false,
        xpReward: 100
    },
    {
        id: "discord_voice_50h",
        category: AchievementCategory.DISCORD,
        name: "Habitué du Vocal",
        description: "Passer 50h en vocal",
        emoji: "🎙️",
        secret: false,
        xpReward: 200
    },
    {
        id: "discord_voice_100h",
        category: AchievementCategory.DISCORD,
        name: "Marathonien Vocal",
        description: "Passer 100h en vocal",
        emoji: "📻",
        secret: false,
        xpReward: 300
    },
    {
        id: "discord_voice_500h",
        category: AchievementCategory.DISCORD,
        name: "Légende du Vocal",
        description: "Passer 500h en vocal",
        emoji: "🔊",
        secret: false,
        xpReward: 500
    },
    {
        id: "discord_voice_1000h",
        category: AchievementCategory.DISCORD,
        name: "Roi du Vocal",
        description: "Passer 1000h en vocal",
        emoji: "📡",
        secret: false,
        xpReward: 1000
    },
    // === ACHIEVEMENTS DISCORD - EMOJIS ===
    {
        id: "discord_emoji_100",
        category: AchievementCategory.DISCORD,
        name: "Amateur d'Emojis",
        description: "Utiliser 100 emojis",
        emoji: "😊",
        secret: false,
        xpReward: 50
    },
    {
        id: "discord_emoji_500",
        category: AchievementCategory.DISCORD,
        name: "Fan d'Emojis",
        description: "Utiliser 500 emojis",
        emoji: "😎",
        secret: false,
        xpReward: 100
    },
    {
        id: "discord_emoji_1000",
        category: AchievementCategory.DISCORD,
        name: "Maître des Emojis",
        description: "Utiliser 1000 emojis",
        emoji: "🤩",
        secret: false,
        xpReward: 200
    },
    {
        id: "discord_emoji_5000",
        category: AchievementCategory.DISCORD,
        name: "Emoji Addict",
        description: "Utiliser 5000 emojis",
        emoji: "🌈",
        secret: false,
        xpReward: 300
    },
    {
        id: "discord_emoji_fav",
        category: AchievementCategory.DISCORD,
        name: "Collectionneur",
        description: "Utiliser le même emoji 100 fois",
        emoji: "😄",
        secret: false,
        xpReward: 100
    },
    // === ACHIEVEMENTS DISCORD - COMBINÉS ===
    {
        id: "discord_social",
        category: AchievementCategory.DISCORD,
        name: "Social Butterfly",
        description: "500 messages + 200 réactions + 50h vocal",
        emoji: "🎭",
        secret: false,
        xpReward: 300
    },
    {
        id: "discord_active",
        category: AchievementCategory.DISCORD,
        name: "Hyperactif",
        description: "1000 messages + 500 emojis + 100 commandes",
        emoji: "💎",
        secret: false,
        xpReward: 500
    },
    {
        id: "discord_legend",
        category: AchievementCategory.DISCORD,
        name: "Légende Vivante",
        description: "5000 messages + 500 réactions + 500h vocal",
        emoji: "👑",
        secret: true,
        xpReward: 1000
    },
    // === ACHIEVEMENTS DISCORD - SPÉCIAUX ===
    {
        id: "discord_night_owl",
        category: AchievementCategory.DISCORD,
        name: "Noctambule",
        description: "Envoyer un message à 3h du matin",
        emoji: "🌙",
        secret: true,
        xpReward: 100
    },
    {
        id: "discord_early_bird",
        category: AchievementCategory.DISCORD,
        name: "Lève-tôt",
        description: "Envoyer un message à 6h du matin",
        emoji: "☀️",
        secret: true,
        xpReward: 100
    },
    {
        id: "discord_birthday",
        category: AchievementCategory.DISCORD,
        name: "Anniversaire !",
        description: "Se connecter le jour de son anniversaire",
        emoji: "🎂",
        secret: false,
        xpReward: 200
    }
];

/**
 * Charge les achievements depuis le fichier
 * @internal - Exposé pour le startup checker
 */
export function loadAchievements(): AchievementsDatabase {
    try {
        if (fs.existsSync(ACHIEVEMENTS_FILE)) {
            const data = fs.readFileSync(ACHIEVEMENTS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading achievements:", error);
    }
    return {};
}

/**
 * Sauvegarde les achievements dans le fichier
 * @internal - Exposé pour le startup checker
 */
export function saveAchievements(data: AchievementsDatabase): void {
    try {
        const dir = path.dirname(ACHIEVEMENTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error("Error saving achievements:", error);
    }
}

/**
 * Initialise les achievements pour un utilisateur
 * @internal - Exposé pour le startup checker
 */
export function initUserAchievements(userId: string, username: string): void {
    const data = loadAchievements();

    if (!data[userId]) {
        data[userId] = {
            username,
            achievements: ALL_ACHIEVEMENTS.map(achievement => ({
                achievementId: achievement.id,
                unlockedAt: null,
                notified: false
            })),
            lastUpdate: Date.now()
        };
        saveAchievements(data);
    }
}

/**
 * Récupère les achievements d'un utilisateur
 */
export function getUserAchievements(userId: string, username: string): UserAchievement[] {
    const data = loadAchievements();

    if (!data[userId]) {
        initUserAchievements(userId, username);
        return getUserAchievements(userId, username);
    }

    // Vérifier si de nouveaux achievements ont été ajoutés
    const existingIds = data[userId].achievements.map(a => a.achievementId);
    const newAchievements = ALL_ACHIEVEMENTS.filter(a => !existingIds.includes(a.id));

    if (newAchievements.length > 0) {
        data[userId].achievements.push(...newAchievements.map(achievement => ({
            achievementId: achievement.id,
            unlockedAt: null,
            notified: false
        })));
        data[userId].lastUpdate = Date.now();
        saveAchievements(data);
    }

    return data[userId].achievements;
}

/**
 * Débloque un achievement pour un utilisateur
 */
export async function unlockAchievement(
    userId: string,
    username: string,
    achievementId: string,
    client?: Client,
    channelId?: string
): Promise<boolean> {
    // Utiliser getUserAchievements pour s'assurer que tous les achievements sont synchronisés
    getUserAchievements(userId, username);

    let data = loadAchievements();


    const userAchievement = data[userId].achievements.find(a => a.achievementId === achievementId);

    if (!userAchievement) {
        logger.warn(`Achievement ${achievementId} not found for user ${userId}`);
        return false;
    }

    // Déjà débloqué
    if (userAchievement.unlockedAt !== null) {
        return false;
    }

    // Débloquer l'achievement
    userAchievement.unlockedAt = Date.now();
    userAchievement.notified = false;
    data[userId].username = username;
    data[userId].lastUpdate = Date.now();
    saveAchievements(data);

    logger.info(`Achievement ${achievementId} unlocked for ${username}`);

    // Récompenser l'utilisateur avec un objet de protection
    try {
        const {rewardFireProtection} = require("./rewardService");
        const {getCurrentSeasonItems} = require("./userInventoryService");

        // Choisir la récompense selon la rareté de l'achievement
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
        if (achievement) {
            const seasonItems = getCurrentSeasonItems();
            // Achievements secrets ou difficiles donnent de meilleures récompenses
            if (achievement.secret) {
                rewardFireProtection(userId, username, "achievement", seasonItems.large);
            } else {
                rewardFireProtection(userId, username, "achievement", seasonItems.medium);
            }
        }
    } catch (error) {
        logger.error("Error rewarding fire protection for achievement:", error);
    }

    // Envoyer une notification si un client et un channel sont fournis
    if (client && channelId && !userAchievement.notified) {
        await sendAchievementNotification(client, channelId, userId, achievementId);
        userAchievement.notified = true;
        saveAchievements(data);
    }

    return true;
}

/**
 * Envoie une notification de déblocage d'achievement
 */
async function sendAchievementNotification(
    client: Client,
    channelId: string,
    userId: string,
    achievementId: string
): Promise<void> {
    try {
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return;

        // Si c'est un appel du startup check, pas besoin de fetch le channel
        const isStartupCheck = channelId === "startup_check";

        // Fetch le channel seulement si ce n'est pas le startup check et pas un achievement de profil
        let channel: any = null;
        if (!isStartupCheck && achievement.category !== AchievementCategory.PROFIL) {
            channel = await client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) return;
        }

        const {EmbedBuilder, AttachmentBuilder} = require("discord.js");
        const path = require("path");
        const fs = require("fs");

        // Charger l'image du badge d'achievement si elle existe
        const badgeImagePath = path.join(__dirname, "../../assets/achievement_badge.png");
        let attachment = null;
        let thumbnailUrl = null;

        if (fs.existsSync(badgeImagePath)) {
            attachment = new AttachmentBuilder(badgeImagePath, {name: "achievement_badge.png"});
            thumbnailUrl = "attachment://achievement_badge.png";
        }

        // Déterminer le titre selon si c'est un succès secret ou non
        let embedTitle = achievement.secret ? "🔓 Succès Secret !" : "✨ Succès !";

        // Déterminer la couleur selon l'XP
        let embedColor: number;
        if (achievement.xpReward <= 150) {
            embedColor = 0xA05822; // Bronze (COMMON)
        } else if (achievement.xpReward <= 500) {
            embedColor = 0xC0C0C0; // Silver (RARE)
            embedTitle += " Rare";
        } else if (achievement.xpReward <= 1000) {
            embedColor = 0xFFD700; // Gold (EPIC)
            embedTitle += " Épique";
        } else {
            embedColor = 0xFFD700; // Violet (LEGENDARY)
            embedTitle += " Légendaire";
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${embedTitle} !`)
            .setDescription(
                `## ${achievement.emoji} ${achievement.name}\n\n` +
                `*${achievement.description}*\n\n` +
                `🎁 **+${achievement.xpReward} XP** gagné !\n\n` +
                `Consulte tous tes succès avec \`/profile\` ou en faisant clic droit sur ton nom : Applications → **Voir le profil** !`
            )
            .setFooter({text: "Continue comme ça pour débloquer plus de succès !"})
            .setTimestamp();

        // Ajouter la thumbnail seulement si l'image existe
        if (thumbnailUrl) {
            embed.setThumbnail(thumbnailUrl);
        }

        const messageOptions: any = {
            content: `<@${userId}> 🎉`,
            embeds: [embed],
            allowedMentions: {users: [userId]}
        };

        // Ajouter l'attachment seulement si l'image existe
        if (attachment) {
            messageOptions.files = [attachment];
        }

        let notificationSent = false;
        let targetChannel: TextChannel | null = null;

        // Décider si DM ou Public basé sur l'XP et la catégorie
        // - Achievements PROFIL : toujours en DM
        // - Achievements SECRET : toujours en DM
        // - Achievements ≤ 150 XP : en DM
        // - Achievements > 150 XP : en public
        const sendInDM = (
            achievement.category === AchievementCategory.PROFIL ||
            achievement.secret ||
            achievement.xpReward <= 150
        );

        if (sendInDM) {
            try {
                const user = await client.users.fetch(userId);
                await user.send(messageOptions);
                logger.info(`Achievement notification sent via DM to ${user.username}`);
                notificationSent = true;
                // Pour les notifications de level up, on utilisera le DM du user
                targetChannel = await user.createDM() as any;
            } catch (error) {
                logger.warn(`Failed to send DM to user ${userId} (DMs probably closed), no notification sent`, error);
                // NE PAS envoyer de fallback dans le channel - simplement ne rien envoyer
                notificationSent = false;
            }
        } else {
            // Pour les autres catégories, envoyer dans le channel
            // Si c'est le startup check, on ne peut pas envoyer dans un channel
            if (!isStartupCheck && channel && channel.isTextBased()) {
                const message = await (channel as TextChannel).send(messageOptions);
                targetChannel = channel as TextChannel;
                notificationSent = true;

                // Si c'est un achievement de JEUX dans le salon compteur, supprimer après 10 secondes
                if (achievement.category === AchievementCategory.JEUX) {
                    const EnvConfig = await import("../utils/envConfig").then(m => m.EnvConfig);
                    const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;

                    if (COUNTER_CHANNEL_ID && channelId === COUNTER_CHANNEL_ID) {
                        setTimeout(async () => {
                            try {
                                await message.delete();
                                logger.info(`Achievement notification deleted after 10s in counter channel`);
                            } catch (error) {
                                // Ignore si le message est déjà supprimé
                            }
                        }, 10000);
                    }
                }
            }
        }

        // Ajouter l'XP de l'achievement SEULEMENT si la notification a été envoyée
        // ET envoyer la notification de level up au même endroit
        if (notificationSent) {
            // Log Discord pour l'achievement
            const {logCommand} = require("../utils/discordLogger");
            const user = await client.users.fetch(userId);

            // Déterminer le type de notification
            const notificationType = sendInDM ? "DM" : "Public";
            const achievementType = achievement.secret ? "Secret" : achievement.category;

            await logCommand("🏆 Achievement Débloqué", undefined, [
                {name: "👤 Utilisateur", value: user.username, inline: true},
                {name: "🎯 Achievement", value: `${achievement.emoji} ${achievement.name}`, inline: true},
                {name: "🎁 XP", value: `+${achievement.xpReward} XP`, inline: true},
                {name: "📋 Type", value: achievementType, inline: true},
                {name: "📨 Notification", value: notificationType, inline: true}
            ]);

            const {addXP} = require("./xpSystem");
            const member = await client.guilds.cache.first()?.members.fetch(userId);
            if (member) {
                if (targetChannel) {
                    // La notification de level up sera envoyée dans targetChannel (DM ou channel)
                    // Utiliser skipMultiplier=true pour les achievements
                    await addXP(userId, member.user.username, achievement.xpReward, targetChannel, member.user.bot, true);
                } else {
                    // Pas de targetChannel (startup check sans DM) - attribuer XP sans notification de level up
                    // Utiliser skipMultiplier=true pour les achievements
                    await addXP(userId, member.user.username, achievement.xpReward, undefined, member.user.bot, true);
                }
            }
        } else {
            logger.info(`XP not awarded for achievement ${achievementId} because notification could not be sent`);
        }

    } catch (error) {
        logger.error("Error sending achievement notification:", error);
    }
}

/**
 * Vérifie si un achievement est débloqué
 */
export function isAchievementUnlocked(userId: string, achievementId: string): boolean {
    const data = loadAchievements();

    if (!data[userId]) return false;

    const userAchievement = data[userId].achievements.find(a => a.achievementId === achievementId);
    return userAchievement?.unlockedAt !== null;
}

/**
 * Récupère le nombre d'achievements débloqués par catégorie
 */
export function getAchievementStats(userId: string): {
    [category: string]: { unlocked: number; total: number };
} {
    const userAchievements = getUserAchievements(userId, "");
    const stats: { [category: string]: { unlocked: number; total: number } } = {};

    for (const category of Object.values(AchievementCategory)) {
        const categoryAchievements = ALL_ACHIEVEMENTS.filter(a => a.category === category);
        const unlockedCount = userAchievements.filter(ua => {
            const achievement = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
            return achievement?.category === category && ua.unlockedAt !== null;
        }).length;

        stats[category] = {
            unlocked: unlockedCount,
            total: categoryAchievements.length
        };
    }

    return stats;
}

/**
 * Récupère tous les achievements d'une catégorie pour un utilisateur
 */
export function getAchievementsByCategory(
    userId: string,
    username: string,
    category: AchievementCategory
): Array<{ achievement: Achievement; unlocked: boolean; unlockedAt: number | null }> {
    const userAchievements = getUserAchievements(userId, username);

    return ALL_ACHIEVEMENTS
        .filter(a => a.category === category)
        .map(achievement => {
            const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id);
            return {
                achievement,
                unlocked: userAchievement?.unlockedAt !== null,
                unlockedAt: userAchievement?.unlockedAt || null
            };
        });
}

/**
 * Récupère le pourcentage de complétion global
 */
export function getCompletionPercentage(userId: string): number {
    const userAchievements = getUserAchievements(userId, "");
    const unlockedCount = userAchievements.filter(ua => ua.unlockedAt !== null).length;
    const totalCount = ALL_ACHIEVEMENTS.length;

    if (totalCount === 0) return 0;
    return Math.round((unlockedCount / totalCount) * 100);
}
