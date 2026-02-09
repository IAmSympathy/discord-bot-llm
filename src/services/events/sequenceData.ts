/**
 * Interface pour une suite logique
 */
export interface Sequence {
    id: string;
    sequence: string; // La suite affichée (ex: "2, 4, 6, 8, ?")
    answer: string; // Réponse correcte (en minuscules)
    alternativeAnswers?: string[]; // Réponses alternatives acceptées
    hint: string; // Indice
    difficulty: 'facile' | 'moyen' | 'difficile';
    category: string;
    xpReward: number;
}

/**
 * Base de données de suites logiques
 */
export const SEQUENCES: Sequence[] = [
    // ===== FACILES =====
    {
        id: 'seq_easy_1',
        sequence: "2, 4, 6, 8, ?",
        answer: "10",
        alternativeAnswers: ["dix"],
        hint: "🔢 Les nombres pairs.",
        difficulty: 'facile',
        category: 'Nombres',
        xpReward: 100
    },
    {
        id: 'seq_easy_2',
        sequence: "1, 2, 3, 4, ?",
        answer: "5",
        alternativeAnswers: ["cinq"],
        hint: "🔢 Compte simplement.",
        difficulty: 'facile',
        category: 'Nombres',
        xpReward: 100
    },
    {
        id: 'seq_easy_3',
        sequence: "5, 10, 15, 20, ?",
        answer: "25",
        alternativeAnswers: ["vingt-cinq", "vingt cinq"],
        hint: "🔢 Table de 5.",
        difficulty: 'facile',
        category: 'Nombres',
        xpReward: 100
    },
    {
        id: 'seq_easy_4',
        sequence: "A, B, C, D, ?",
        answer: "e",
        alternativeAnswers: ["E"],
        hint: "🔤 L'alphabet.",
        difficulty: 'facile',
        category: 'Lettres',
        xpReward: 100
    },
    {
        id: 'seq_easy_5',
        sequence: "10, 20, 30, 40, ?",
        answer: "50",
        alternativeAnswers: ["cinquante"],
        hint: "🔢 Dizaines.",
        difficulty: 'facile',
        category: 'Nombres',
        xpReward: 100
    },
    {
        id: 'seq_easy_6',
        sequence: "Lundi, Mardi, Mercredi, ?",
        answer: "jeudi",
        alternativeAnswers: [],
        hint: "📅 Les jours de la semaine.",
        difficulty: 'facile',
        category: 'Temps',
        xpReward: 100
    },

    // ===== MOYENS =====
    {
        id: 'seq_medium_1',
        sequence: "1, 4, 9, 16, ?",
        answer: "25",
        alternativeAnswers: ["vingt-cinq", "vingt cinq"],
        hint: "🔢 Les carrés parfaits (1², 2², 3²...).",
        difficulty: 'moyen',
        category: 'Nombres',
        xpReward: 200
    },
    {
        id: 'seq_medium_2',
        sequence: "1, 1, 2, 3, 5, 8, ?",
        answer: "13",
        alternativeAnswers: ["treize"],
        hint: "🔢 Chaque nombre est la somme des deux précédents (Fibonacci).",
        difficulty: 'moyen',
        category: 'Nombres',
        xpReward: 200
    },
    {
        id: 'seq_medium_3',
        sequence: "2, 6, 12, 20, ?",
        answer: "30",
        alternativeAnswers: ["trente"],
        hint: "🔢 Regarde les différences : +4, +6, +8...",
        difficulty: 'moyen',
        category: 'Nombres',
        xpReward: 200
    },
    {
        id: 'seq_medium_4',
        sequence: "Z, Y, X, W, ?",
        answer: "v",
        alternativeAnswers: ["V"],
        hint: "🔤 L'alphabet à l'envers.",
        difficulty: 'moyen',
        category: 'Lettres',
        xpReward: 200
    },
    {
        id: 'seq_medium_5',
        sequence: "3, 6, 9, 15, 24, ?",
        answer: "39",
        alternativeAnswers: ["trente-neuf", "trente neuf"],
        hint: "🔢 Additionne les deux nombres précédents.",
        difficulty: 'moyen',
        category: 'Nombres',
        xpReward: 200
    },
    {
        id: 'seq_medium_6',
        sequence: "1, 3, 7, 15, 31, ?",
        answer: "63",
        alternativeAnswers: ["soixante-trois", "soixante trois"],
        hint: "🔢 Multiplie par 2 puis ajoute 1.",
        difficulty: 'moyen',
        category: 'Nombres',
        xpReward: 200
    },

    // ===== DIFFICILES =====
    {
        id: 'seq_hard_1',
        sequence: "2, 3, 5, 7, 11, ?",
        answer: "13",
        alternativeAnswers: ["treize"],
        hint: "🔢 Les nombres premiers.",
        difficulty: 'difficile',
        category: 'Nombres',
        xpReward: 300
    },
    {
        id: 'seq_hard_2',
        sequence: "1, 8, 27, 64, ?",
        answer: "125",
        alternativeAnswers: ["cent vingt-cinq", "cent vingt cinq"],
        hint: "🔢 Les cubes parfaits (1³, 2³, 3³...).",
        difficulty: 'difficile',
        category: 'Nombres',
        xpReward: 300
    },
    {
        id: 'seq_hard_3',
        sequence: "1, 2, 4, 8, 16, ?",
        answer: "32",
        alternativeAnswers: ["trente-deux", "trente deux"],
        hint: "🔢 Puissances de 2.",
        difficulty: 'difficile',
        category: 'Nombres',
        xpReward: 300
    },
    {
        id: 'seq_hard_4',
        sequence: "A, C, F, J, ?",
        answer: "o",
        alternativeAnswers: ["O"],
        hint: "🔤 Saute 0, 1, 2, 3... lettres à chaque fois.",
        difficulty: 'difficile',
        category: 'Lettres',
        xpReward: 300
    },
    {
        id: 'seq_hard_5',
        sequence: "1, 11, 21, 1211, 111221, ?",
        answer: "312211",
        alternativeAnswers: [],
        hint: "🔢 Décris ce que tu vois : 'un 1' devient '11', 'deux 1' devient '21'...",
        difficulty: 'difficile',
        category: 'Logique',
        xpReward: 300
    },
    {
        id: 'seq_hard_6',
        sequence: "0, 1, 1, 2, 3, 5, 8, 13, ?",
        answer: "21",
        alternativeAnswers: ["vingt-et-un", "vingt et un"],
        hint: "🔢 Suite de Fibonacci : additionne les deux précédents.",
        difficulty: 'difficile',
        category: 'Nombres',
        xpReward: 300
    },
];

/**
 * Sélectionne une suite aléatoire
 */
export function getRandomSequence(): Sequence {
    return SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
}

/**
 * Sélectionne une suite aléatoire par difficulté
 */
export function getRandomSequenceByDifficulty(difficulty: 'facile' | 'moyen' | 'difficile'): Sequence {
    const sequences = SEQUENCES.filter(s => s.difficulty === difficulty);
    return sequences[Math.floor(Math.random() * sequences.length)];
}

/**
 * Enlève les déterminants et formatage des nombres
 */
function normalizeAnswer(text: string): string {
    return text.toLowerCase().trim()
        .replace(/\s+/g, '') // Enlever tous les espaces
        .replace(/-/g, ''); // Enlever les tirets
}

/**
 * Vérifie si une réponse est correcte
 */
export function checkSequenceAnswer(sequence: Sequence, userAnswer: string): boolean {
    const normalizedAnswer = normalizeAnswer(userAnswer);
    const normalizedCorrect = normalizeAnswer(sequence.answer);

    // Vérifier la réponse principale
    if (normalizedAnswer === normalizedCorrect) {
        return true;
    }

    // Vérifier les réponses alternatives
    if (sequence.alternativeAnswers) {
        return sequence.alternativeAnswers.some(alt =>
            normalizeAnswer(alt) === normalizedAnswer
        );
    }

    return false;
}

