/**
 * Données des boss pour les événements de combat
 */

export interface BossData {
    id: string;
    name: string;
    description: string;
    imagePath: string; // Chemin relatif depuis assets/
    hp: number;
    damagePerMessage: number;
    duration: number; // Durée en millisecondes
    // Récompenses et pénalités
    finalBlowXP: number; // XP pour le coup final (mini boss) ou bonus (boss)
    sharedXP?: number; // XP partagé entre participants (boss uniquement)
    failurePenalty: number; // XP perdu si le boss n'est pas battu
    isSpecial?: boolean; // Pour les boss avec logique spéciale (Kamikaze)
}

/**
 * Mini Boss - Plus faciles, récompense pour le coup final uniquement
 * Temps estimés basés sur 4 joueurs actifs avec ~1 message toutes les 2-3 secondes par personne
 */
export const MINI_BOSSES: BossData[] = [
    {
        id: "marsh_hoppers",
        name: "Armée de Marsh Hoppers",
        description: "Une horde de ces petites créatures sautillantes veulent envahir le serveur ! Arrêtez-les avant qu'ils ne causent trop de dégâts !",
        imagePath: "bosses/marsh_hoppers.png",
        hp: 150, // ~100 messages avec spam
        damagePerMessage: 1,
        duration: 5 * 60 * 1000,
        finalBlowXP: 150,
        failurePenalty: -50
    },
    {
        id: "kenny",
        name: "Kenny",
        description: "Kenny se prend pour un héro et veut vaincre Mental pour prouver sa valeur. Montrez à cette incel qu'il n'est pas à la hauteur de sa prétention !",
        imagePath: "bosses/kenny.png",
        hp: 600, // ~200 messages
        damagePerMessage: 3,
        duration: 8 * 60 * 1000,
        finalBlowXP: 200,
        failurePenalty: -75
    },
    {
        id: "major_biomech",
        name: "Major Bio-mechanoid",
        description: "Un de nos robots de combat avancé conçu pour semer la destruction. Il a été piraté et ne fait que répéter en boucle \"I'm BatuNat\" ! Réinitialisez-le pour qu'il reprenne de la raison !",
        imagePath: "bosses/major_biomech.png",
        hp: 900, // ~300 messages
        damagePerMessage: 3,
        duration: 10 * 60 * 1000,
        finalBlowXP: 250,
        failurePenalty: -100
    },
    {
        id: "adult_arachnoid",
        name: "Adult Arachnoid",
        description: "Cette Arachnoid adulte est devenue agressive et veut prendre tous les membres du serveur comme ses enfants ! Affrontez-la pour montrer que sa fausse couche n'est pas une excuse pour son comportement !",
        imagePath: "bosses/adult_arachnoid.png",
        hp: 1200, // ~400 messages
        damagePerMessage: 3,
        duration: 12 * 60 * 1000,
        finalBlowXP: 300,
        failurePenalty: -125
    },
    {
        id: "khnum",
        name: "Khnum, Messenger of Amon-Ra",
        description: "Ce Khnum est un messager d'Amon-Ra, le dieu égyptien du soleil. Il a été envoyé pour punir les membres du serveur pour leurs goonings lunaire incessants !",
        imagePath: "bosses/khnum.png",
        hp: 1500, // ~500 messages
        damagePerMessage: 3,
        duration: 15 * 60 * 1000,
        finalBlowXP: 350,
        failurePenalty: -150
    },
    {
        id: "witch_bride_of_achriman",
        name: "Witch-Bride of Achriman",
        description: "Cette sorcière puissante avait fait un pacte avec notre sbire Achriman pour obtenir des pouvoirs magiques, mais cela n'a aucun n'intérêt puisqu'elle est devenu créatrice de contenu OnlyFans ! Affrontez-la pour briser le pacte et l'enlever de nos rangs !",
        imagePath: "bosses/witch_bride_of_achriman.png",
        hp: 1800, // ~600 messages
        damagePerMessage: 3,
        duration: 18 * 60 * 1000,
        finalBlowXP: 400,
        failurePenalty: -175
    },
    {
        id: "technopolyp",
        name: "Technopolyp",
        description: "Ce Technopolyp était supposé faire partie de la grande attaque de 2001, mais a manqué le rendez-vous. Maintenant, il cherche à détruire les piliers du serveur pour se venger !",
        imagePath: "bosses/technopolyp.png",
        hp: 2100, // ~700 messages
        damagePerMessage: 3,
        duration: 20 * 60 * 1000,
        finalBlowXP: 450,
        failurePenalty: -200
    },
    {
        id: "beheaded_kamikaze",
        name: "Beheaded Kamikaze",
        description: "⚠️ UN KAMIKAZE SANS TÊTE FONCE VERS LE SERVEUR !\n\nIl va exploser dans quelques secondes et faire perdre 500 XP à TOUS les membres !\n\n💥 Quelqu'un doit se sacrifier pour l'arrêter ! Le héros qui le tue perdra 100 XP mais sauvera tout le monde !",
        imagePath: "bosses/beheaded_kamikaze.png",
        hp: 1,
        damagePerMessage: 1,
        duration: 2 * 60 * 1000,
        finalBlowXP: -100, // Le héros perd de l'XP pour sauver les autres
        failurePenalty: -500, // ÉNORME pénalité si personne ne se sacrifie
        isSpecial: true
    }
];

/**
 * Boss - Plus difficiles, récompense partagée + bonus au coup final
 * Temps estimés basés sur 4 joueurs actifs avec ~1 message toutes les 2-3 secondes par personne
 */
export const BOSSES: BossData[] = [
    {
        id: "ugh_zan_vi",
        name: "Ugh-Zan VI",
        description: "Ugh-Zan VI, étant trop sérieux, n'a jamais pu rejoindre les rangs de Mental. Il a décidé de se venger en attaquant le serveur ! Affrontez-le pour lui montrer que sa colère est vaine !",
        imagePath: "bosses/dragon_chaos.png",
        hp: 1800, // ~600 messages
        damagePerMessage: 3,
        duration: 25 * 60 * 1000,
        finalBlowXP: 300, // Bonus au coup final
        sharedXP: 800, // XP partagé entre tous
        failurePenalty: -150
    },
    {
        id: "serious_sam",
        name: "Serious Sam",
        description: "Serious Sam veut récupérer Netricsa ! Il est temps de lui montrer qu'être sérieux ne suffit pas pour être un vrai héros !",
        imagePath: "bosses/titan_forge.png",
        hp: 3600, // ~1200 messages
        damagePerMessage: 3,
        duration: 40 * 60 * 1000,
        finalBlowXP: 500, // Bonus au coup final
        sharedXP: 1500, // XP partagé entre tous
        failurePenalty: -250
    },
    {
        id: "mental",
        name: "Mental..?",
        description: "Mental semble différent... Est-ce vraiment lui ou un imposteur ? Affrontez-le pour découvrir la vérité derrière ce changement mystérieux !",
        imagePath: "bosses/hydre_abyssale.png",
        hp: 6000, // ~2000 messages
        damagePerMessage: 3,
        duration: 60 * 60 * 1000,
        finalBlowXP: 1000, // GROS bonus au coup final
        sharedXP: 2500, // XP partagé entre tous
        failurePenalty: -500 // GROSSE pénalité
    }
];

/**
 * Sélectionne un mini boss aléatoire
 */
export function getRandomMiniBoss(): BossData {
    return MINI_BOSSES[Math.floor(Math.random() * MINI_BOSSES.length)];
}

/**
 * Sélectionne un boss aléatoire
 */
export function getRandomBoss(): BossData {
    return BOSSES[Math.floor(Math.random() * BOSSES.length)];
}
