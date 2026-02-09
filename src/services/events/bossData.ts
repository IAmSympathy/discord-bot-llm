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
        hp: 150,
        damagePerMessage: 1,
        duration: 1 * 60 * 60 * 1000, // 1 heure (était 5 minutes)
        finalBlowXP: 100,
        failurePenalty: -35
    },
    {
        id: "kenny",
        name: "Kenny",
        description: "Kenny se prend pour un héro et veut vaincre Mental pour prouver sa valeur. Montrez à cette incel qu'il n'est pas à la hauteur de sa prétention !",
        imagePath: "bosses/kenny.png",
        hp: 600,
        damagePerMessage: 3,
        duration: 1.5 * 60 * 60 * 1000, // 1h30 (était 8 minutes)
        finalBlowXP: 140,
        failurePenalty: -53
    },
    {
        id: "major_biomech",
        name: "Major Bio-mechanoid",
        description: "Un de nos robots de combat avancé conçu pour semer la destruction. Il a été piraté et ne fait que répéter en boucle \"I'm BatuNat\" ! Réinitialisez-le pour qu'il reprenne de la raison !",
        imagePath: "bosses/major_biomech.png",
        hp: 900,
        damagePerMessage: 3,
        duration: 2 * 60 * 60 * 1000, // 2 heures (était 10 minutes)
        finalBlowXP: 175,
        failurePenalty: -70
    },
    {
        id: "adult_arachnoid",
        name: "Adult Arachnoid",
        description: "Cette Arachnoid adulte est devenue agressive et veut prendre tous les membres du serveur comme ses enfants ! Affrontez-la pour montrer que sa fausse couche n'est pas une excuse pour son comportement !",
        imagePath: "bosses/adult_arachnoid.png",
        hp: 1200,
        damagePerMessage: 3,
        duration: 2.5 * 60 * 60 * 1000, // 2h30 (était 12 minutes)
        finalBlowXP: 210,
        failurePenalty: -88
    },
    {
        id: "khnum",
        name: "Khnum, Messenger of Amon-Ra",
        description: "Ce Khnum est un messager d'Amon-Ra, le dieu égyptien du soleil. Il a été envoyé pour punir les membres du serveur pour leurs goonings lunaire incessants !",
        imagePath: "bosses/khnum.png",
        hp: 1500,
        damagePerMessage: 3,
        duration: 3 * 60 * 60 * 1000, // 3 heures (était 15 minutes)
        finalBlowXP: 245,
        failurePenalty: -105
    },
    {
        id: "witch_bride_of_achriman",
        name: "Witch-Bride of Achriman",
        description: "Cette sorcière puissante avait fait un pacte avec notre sbire Achriman pour obtenir des pouvoirs magiques, mais cela n'a aucun n'intérêt puisqu'elle est devenu créatrice de contenu OnlyFans ! Affrontez-la pour briser le pacte et l'enlever de nos rangs !",
        imagePath: "bosses/witch_bride_of_achriman.png",
        hp: 1800,
        damagePerMessage: 3,
        duration: 3.5 * 60 * 60 * 1000, // 3h30 (était 18 minutes)
        finalBlowXP: 280,
        failurePenalty: -123
    },
    {
        id: "technopolyp",
        name: "Technopolyp",
        description: "Ce Technopolyp était supposé faire partie de la grande attaque de 2001, mais a manqué le rendez-vous. Maintenant, il cherche à détruire les piliers du serveur pour se venger !",
        imagePath: "bosses/technopolyp.png",
        hp: 2100,
        damagePerMessage: 3,
        duration: 4 * 60 * 60 * 1000, // 4 heures (était 20 minutes)
        finalBlowXP: 315,
        failurePenalty: -140
    },
    {
        id: "beheaded_kamikaze",
        name: "Beheaded Kamikaze",
        description: "⚠️ UN KAMIKAZE SANS TÊTE FONCE VERS LE SERVEUR !\n\nIl va exploser dans quelques secondes et faire perdre 350 XP à TOUS les membres !\n\n💥 Quelqu'un doit se sacrifier pour l'arrêter ! Le héros qui le tue perdra 70 XP mais sauvera tout le monde !",
        imagePath: "bosses/beheaded_kamikaze.png",
        hp: 1,
        damagePerMessage: 1,
        duration: 5 * 60 * 1000, // 5 minutes (reste court pour l'urgence)
        finalBlowXP: -70,
        failurePenalty: -350,
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
        hp: 1800,
        damagePerMessage: 3,
        duration: 5 * 60 * 60 * 1000, // 5 heures (était 25 minutes)
        finalBlowXP: 210,
        sharedXP: 560,
        failurePenalty: -105
    },
    {
        id: "serious_sam",
        name: "Serious Sam",
        description: "Serious Sam veut récupérer Netricsa ! Il est temps de lui montrer qu'être sérieux ne suffit pas pour être un vrai héros !",
        imagePath: "bosses/titan_forge.png",
        hp: 3600,
        damagePerMessage: 3,
        duration: 8 * 60 * 60 * 1000, // 8 heures (était 40 minutes)
        finalBlowXP: 350,
        sharedXP: 1050,
        failurePenalty: -175
    },
    {
        id: "mental",
        name: "Mental..?",
        description: "Mental semble différent... Est-ce vraiment lui ou un imposteur ? Affrontez-le pour découvrir la vérité derrière ce changement mystérieux !",
        imagePath: "bosses/hydre_abyssale.png",
        hp: 6000,
        damagePerMessage: 3,
        duration: 12 * 60 * 60 * 1000, // 12 heures (était 60 minutes)
        finalBlowXP: 700,
        sharedXP: 1750,
        failurePenalty: -350
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
