/**
 * Interface pour une énigme
 */
export interface Riddle {
    id: string;
    question: string;
    answer: string; // Réponse correcte (en minuscules)
    alternativeAnswers?: string[]; // Réponses alternatives acceptées
    hint: string; // Indice
    difficulty: 'facile' | 'moyen' | 'difficile';
    category: string;
    xpReward: number;
}

/**
 * Base de données d'énigmes
 */
export const RIDDLES: Riddle[] = [
    // ===== FACILES =====
    {
        id: 'riddle_easy_1',
        question: "Je suis toujours devant toi mais tu ne peux jamais me voir. Qui suis-je ?",
        answer: "avenir",
        alternativeAnswers: ["futur", "le futur", "l'avenir"],
        hint: "💭 Pense au temps... Ce qui n'est pas encore arrivé.",
        difficulty: 'facile',
        category: 'Logique',
        xpReward: 100
    },
    {
        id: 'riddle_easy_2',
        question: "Plus je sèche, plus je deviens mouillé. Qui suis-je ?",
        answer: "serviette",
        alternativeAnswers: ["une serviette", "la serviette", "torchon"],
        hint: "🛁 On l'utilise après la douche.",
        difficulty: 'facile',
        category: 'Logique',
        xpReward: 100
    },
    {
        id: 'riddle_easy_3',
        question: "Qu'est-ce qui a des dents mais ne peut pas mordre ?",
        answer: "peigne",
        alternativeAnswers: ["un peigne", "le peigne", "fourchette"],
        hint: "💇 On l'utilise pour les cheveux.",
        difficulty: 'facile',
        category: 'Objets',
        xpReward: 100
    },
    {
        id: 'riddle_easy_4',
        question: "Je commence la nuit et termine le matin. Qui suis-je ?",
        answer: "n",
        alternativeAnswers: ["la lettre n", "lettre n"],
        hint: "🔤 Regarde bien les lettres de ces deux mots.",
        difficulty: 'facile',
        category: 'Jeux de mots',
        xpReward: 100
    },
    {
        id: 'riddle_easy_5',
        question: "Qu'est-ce qui monte mais ne descend jamais ?",
        answer: "âge",
        alternativeAnswers: ["l'âge", "age"],
        hint: "🎂 Ça augmente chaque année pour tout le monde.",
        difficulty: 'facile',
        category: 'Logique',
        xpReward: 100
    },

    // ===== MOYENS =====
    {
        id: 'riddle_medium_1',
        question: "Je suis léger comme une plume, mais même l'homme le plus fort ne peut me tenir plus de quelques minutes. Qui suis-je ?",
        answer: "souffle",
        alternativeAnswers: ["respiration", "le souffle", "la respiration", "air"],
        hint: "💨 C'est vital et invisible. Tu le retiens, mais pas longtemps.",
        difficulty: 'moyen',
        category: 'Logique',
        xpReward: 200
    },
    {
        id: 'riddle_medium_2',
        question: "Plus il y en a, moins tu vois. Qu'est-ce que c'est ?",
        answer: "obscurité",
        alternativeAnswers: ["noir", "ténèbres", "l'obscurité", "le noir"],
        hint: "🌑 C'est l'absence de lumière.",
        difficulty: 'moyen',
        category: 'Logique',
        xpReward: 200
    },
    {
        id: 'riddle_medium_3',
        question: "Je parle sans bouche et j'écoute sans oreilles. Je n'ai pas de corps mais je vis dans le vent. Qui suis-je ?",
        answer: "écho",
        alternativeAnswers: ["echo", "l'écho", "l'echo"],
        hint: "🏔️ On m'entend souvent dans les montagnes ou les grottes.",
        difficulty: 'moyen',
        category: 'Nature',
        xpReward: 200
    },
    {
        id: 'riddle_medium_4',
        question: "Plus tu m'enlèves, plus je deviens grand. Qui suis-je ?",
        answer: "trou",
        alternativeAnswers: ["un trou", "le trou"],
        hint: "🕳️ Creuse, creuse, et tu verras grandir...",
        difficulty: 'moyen',
        category: 'Logique',
        xpReward: 200
    },
    {
        id: 'riddle_medium_5',
        question: "Je cours mais je n'ai pas de jambes. Je possède un lit mais je ne dors jamais. Qui suis-je ?",
        answer: "rivière",
        alternativeAnswers: ["fleuve", "une rivière", "la rivière", "cours d'eau"],
        hint: "🌊 Je coule et j'ai des rives.",
        difficulty: 'moyen',
        category: 'Nature',
        xpReward: 200
    },
    {
        id: 'riddle_medium_6',
        question: "Qu'est-ce qui appartient à toi mais que les autres utilisent plus que toi ?",
        answer: "nom",
        alternativeAnswers: ["prénom", "ton nom", "ton prénom", "le nom"],
        hint: "📛 On t'appelle par ça tous les jours.",
        difficulty: 'moyen',
        category: 'Logique',
        xpReward: 200
    },

    // ===== DIFFICILES =====
    {
        id: 'riddle_hard_1',
        question: "Deux pères et deux fils sont dans une voiture, mais il n'y a que trois personnes dans le véhicule. Comment est-ce possible ?",
        answer: "grand-père",
        alternativeAnswers: ["grand père", "3 générations", "trois générations", "grandpere", "père fils et grand-père"],
        hint: "👴👨👦 Pense aux générations : grand-père, père, et fils.",
        difficulty: 'difficile',
        category: 'Logique',
        xpReward: 300
    },
    {
        id: 'riddle_hard_2',
        question: "Je suis au début de l'éternité, à la fin du temps et de l'espace. Je suis au début de chaque fin et à la fin de chaque place. Qui suis-je ?",
        answer: "e",
        alternativeAnswers: ["la lettre e", "lettre e"],
        hint: "🔤 Cherche la lettre commune dans ces mots.",
        difficulty: 'difficile',
        category: 'Jeux de mots',
        xpReward: 300
    },
    {
        id: 'riddle_hard_3',
        question: "Un homme regarde un portrait et dit : 'Je n'ai ni frère ni sœur, mais le père de cet homme est le fils de mon père.' Qui est sur le portrait ?",
        answer: "fils",
        alternativeAnswers: ["son fils", "le fils"],
        hint: "👨‍👦 'Le fils de mon père' c'est... moi ! Donc le père de l'homme sur le portrait c'est...",
        difficulty: 'difficile',
        category: 'Logique',
        xpReward: 300
    },
    {
        id: 'riddle_hard_4',
        question: "Qu'est-ce qui peut voyager autour du monde tout en restant dans un coin ?",
        answer: "timbre",
        alternativeAnswers: ["un timbre", "le timbre"],
        hint: "✉️ Ça se colle sur une enveloppe.",
        difficulty: 'difficile',
        category: 'Objets',
        xpReward: 300
    },
    {
        id: 'riddle_hard_5',
        question: "Un médecin et un garçon marchent ensemble. Le garçon est le fils du médecin, mais le médecin n'est pas le père du garçon. Comment est-ce possible ?",
        answer: "mère",
        alternativeAnswers: ["la mère", "sa mère", "une femme", "femme médecin"],
        hint: "👩‍⚕️ Le médecin est une...",
        difficulty: 'difficile',
        category: 'Logique',
        xpReward: 300
    },

    // ===== ÉNIGMES SHERBROOKE / QUÉBEC =====
    {
        id: 'riddle_sherbrooke_1',
        question: "Quel est le surnom de Sherbrooke, la Reine de quoi ?",
        answer: "cantons",
        alternativeAnswers: ["reine des cantons", "la reine des cantons-de-l'est", "cantons de l'est"],
        hint: "👑 Sherbrooke est connue comme la Reine des...",
        difficulty: 'moyen',
        category: 'Sherbrooke',
        xpReward: 250
    },
    {
        id: 'riddle_sherbrooke_2',
        question: "Combien de rivières traversent Sherbrooke ?",
        answer: "2",
        alternativeAnswers: ["deux", "deux rivières", "2 rivières"],
        hint: "🌊 Il y a la Magog et la...",
        difficulty: 'facile',
        category: 'Sherbrooke',
        xpReward: 150
    },

    // ===== ÉNIGMES GAMING =====
    {
        id: 'riddle_gaming_1',
        question: "Je suis un plombier qui saute sur des tortues. Qui suis-je ?",
        answer: "mario",
        alternativeAnswers: ["super mario"],
        hint: "🍄 It's-a me, ...",
        difficulty: 'facile',
        category: 'Gaming',
        xpReward: 100
    },
    {
        id: 'riddle_gaming_2',
        question: "Dans Minecraft, combien de blocs d'obsidienne faut-il minimum pour créer un portail du Nether ?",
        answer: "10",
        alternativeAnswers: ["dix", "10 blocs"],
        hint: "⛏️ Un rectangle de 4x5, mais on peut enlever les coins.",
        difficulty: 'moyen',
        category: 'Gaming',
        xpReward: 200
    },

    // ===== ÉNIGMES CULTURE GÉNÉRALE =====
    {
        id: 'riddle_culture_1',
        question: "Quel est le plus petit pays du monde ?",
        answer: "vatican",
        alternativeAnswers: ["le vatican", "cité du vatican"],
        hint: "🇻🇦 C'est un pays dans Rome, en Italie.",
        difficulty: 'moyen',
        category: 'Culture',
        xpReward: 200
    },
    {
        id: 'riddle_culture_2',
        question: "Combien de pattes a une araignée ?",
        answer: "8",
        alternativeAnswers: ["huit", "8 pattes"],
        hint: "🕷️ Plus que 6, moins que 10.",
        difficulty: 'facile',
        category: 'Nature',
        xpReward: 100
    },

    // ===== ÉNIGMES MATHÉMATIQUES =====
    {
        id: 'riddle_math_1',
        question: "Un fermier a 17 moutons. Tous sauf 9 meurent. Combien en reste-t-il ?",
        answer: "9",
        alternativeAnswers: ["neuf", "9 moutons"],
        hint: "🐑 Lis bien : 'tous SAUF 9 meurent'.",
        difficulty: 'moyen',
        category: 'Mathématiques',
        xpReward: 200
    },
    {
        id: 'riddle_math_2',
        question: "Si tu as 3 pommes et que tu en enlèves 2, combien en as-tu ?",
        answer: "2",
        alternativeAnswers: ["deux", "2 pommes"],
        hint: "🍎 Tu EN as enlevé 2... donc tu as pris 2.",
        difficulty: 'facile',
        category: 'Mathématiques',
        xpReward: 100
    }
];

/**
 * Sélectionne une énigme aléatoire
 */
export function getRandomRiddle(): Riddle {
    return RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
}

/**
 * Sélectionne une énigme aléatoire par difficulté
 */
export function getRandomRiddleByDifficulty(difficulty: 'facile' | 'moyen' | 'difficile'): Riddle {
    const riddles = RIDDLES.filter(r => r.difficulty === difficulty);
    return riddles[Math.floor(Math.random() * riddles.length)];
}

/**
 * Enlève les déterminants français d'une chaîne
 */
function removeArticles(text: string): string {
    const lowerText = text.toLowerCase().trim();

    // Liste des déterminants français à enlever
    const articles = [
        /^le\s+/,      // "le "
        /^la\s+/,      // "la "
        /^l'/,         // "l'"
        /^les\s+/,     // "les "
        /^un\s+/,      // "un "
        /^une\s+/,     // "une "
        /^des\s+/,     // "des "
        /^du\s+/,      // "du "
        /^de\s+la\s+/, // "de la "
        /^de\s+l'/,    // "de l'"
        /^de\s+/,      // "de "
    ];

    let cleaned = lowerText;
    for (const article of articles) {
        cleaned = cleaned.replace(article, '');
    }

    return cleaned.trim();
}

/**
 * Vérifie si une réponse est correcte
 */
export function checkAnswer(riddle: Riddle, userAnswer: string): boolean {
    const normalizedAnswer = userAnswer.toLowerCase().trim();
    const cleanedAnswer = removeArticles(normalizedAnswer);

    const riddleAnswer = riddle.answer.toLowerCase();
    const cleanedRiddleAnswer = removeArticles(riddleAnswer);

    // Vérifier la réponse principale (avec et sans déterminants)
    if (normalizedAnswer === riddleAnswer ||
        cleanedAnswer === riddleAnswer ||
        normalizedAnswer === cleanedRiddleAnswer ||
        cleanedAnswer === cleanedRiddleAnswer) {
        return true;
    }

    // Vérifier les réponses alternatives
    if (riddle.alternativeAnswers) {
        return riddle.alternativeAnswers.some(alt => {
            const altLower = alt.toLowerCase();
            const cleanedAlt = removeArticles(altLower);

            return normalizedAnswer === altLower ||
                cleanedAnswer === altLower ||
                normalizedAnswer === cleanedAlt ||
                cleanedAnswer === cleanedAlt ||
                normalizedAnswer.includes(altLower) ||
                cleanedAnswer.includes(cleanedAlt);
        });
    }

    return false;
}
