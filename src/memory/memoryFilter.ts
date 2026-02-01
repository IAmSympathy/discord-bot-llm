import {createLogger} from "../utils/logger";

/**
 * Système de filtrage intelligent de la mémoire
 * Adapté pour Discord privé entre amis (fautes, troll, langage SMS)
 */

const logger = createLogger("MemoryFilter");

// Messages à ignorer complètement (bruit pur)
const NOISE_PATTERNS = [
    /^(lol|mdr|xd|ptdr|mdrr|mdrrr)$/i, // Rires seuls
    /^[👍👎😂🤣😭🔥💀🎉❤️😊😅🙄😏]+$/, // Emojis uniquement
    /^[!?.,;:]+$/, // Ponctuation uniquement
    /^(ah+|oh+|eh+|hm+|um+|uh+)$/i, // Interjections pures
    /^[\s\n]+$/, // Espaces uniquement
];

// Mots-clés indiquant une valeur conversationnelle (serveur entre amis)
const HIGH_VALUE_KEYWORDS = [
    // Salutations (avec fautes et langage SMS)
    'salut', 'coucou', 'bonjour', 'bonsoir', 'hey', 'yo', 'cc', 'wsh', 'bjr', 'slt',
    'ça va', 'ca va', 'cv', 'quoi de neuf', 'quoi de 9', 'sa va', 'sava',

    // Plans et événements (avec fautes)
    'veux', 'dois', 'faut', 'besoin', 'allons', 'irons', 'viendras', 'rendez-vous',
    'demain', 'aujourd\'hui', 'ce soir', 'week-end', 'semaine', 'ojd', 'dem1',
    'veu', 'doi', 'fo', 'bezoin', // Fautes courantes

    // Questions importantes (avec fautes)
    'comment', 'pourquoi', 'quand', 'où', 'qui', 'quel', 'quelle', 'quels', 'quelles',
    'est-ce que', 'qu\'est-ce', 'commen', 'pourkoi', 'koi', 'ki', 'ou', 'kand',
    'comen', 'pourkoa', 'keske', 'keskec', // Variantes SMS

    // Opinions et discussions (avec fautes)
    'pense', 'crois', 'trouve', 'opinion', 'avis', 'selon', 'contre', 'pour',
    'pance', 'croi', 'truv', // Fautes

    // Relations et personnes (avec fautes)
    'elle', 'lui', 'eux', 'famille', 'ami', 'copain', 'copine', 'rencontré',
    'frère', 'sœur', 'mère', 'père', 'parents', 'frer', 'soeur', 'pote', 'darons',

    // Préférences et goûts (avec fautes)
    'préfère', 'aime', 'déteste', 'adore', 'kiffe', 'veux pas', 'plutôt', 'mieux',
    'prefere', 'deteste', 'kiff', 'jaime', 'jadore', 'jdeteste',

    // Émotions importantes (avec fautes)
    'heureux', 'triste', 'énervé', 'content', 'désolé', 'inquiet', 'stressé',
    'enerve', 'desole', 'stresse', 'conten', 'trist',

    // Événements importants
    'accident', 'hôpital', 'malade', 'mort', 'cassé', 'blessé',
    'hopital', 'casse', 'blesse', 'malad',

    // Demandes à l'IA (avec fautes)
    'génère', 'génere', 'genere', 'crée', 'cree', 'créer', 'creer',
    'analyse', 'analyser', 'regarde', 'regarder', 'décris', 'decris',
    'cherche', 'recherche', 'trouve', 'trouver', 'google',
    'dessine', 'dessin', 'image', 'photo', 'gif',
    'explique', 'expliquer', 'dis-moi', 'dis moi', 'di moi',
    'analize', 'regarrd', 'cherch', 'explikes', // Fautes courantes
];

// Patterns indiquant du contexte important (conversations sociales)
const IMPORTANT_PATTERNS = [
    /\b(va|vais|allons|irons)\s+(à|au|chez|a)/i, // Plans : "va au ciné", "allons chez" (avec fautes)
    /\b(demain|ce soir|week-end|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|wknd|dem1)\b/i, // Dates (avec abréviations)
    /\b(rencontr|rendez-vous|rdv|rende vous)\b/i, // Rendez-vous (avec fautes)
    /\b(anniversaire|fête|fete|party|soirée|soiree)\b/i, // Événements (avec/sans accents)
    /\b(problème|probleme|soucis|soucit|inquiet|stressé|stresse|énervé|enerve)\b/i, // Problèmes (avec/sans accents)
    /https?:\/\/[^\s]+/i, // URLs (liens importants)
    /\b(tu te souviens|rappelle-toi|rappel toi|souvenir|rappele)\b/i, // Références au passé (avec fautes)

    // Demandes de conversation/discussion
    /\b(on peut parler|peut-on parler|parler de|discuter de|parle moi|parle-moi)\b/i,

    // Demandes à l'IA - Génération
    /\b(génère|génere|genere|crée|cree|créer|creer|fait|fais|dessine|dessin)\b/i,

    // Demandes à l'IA - Analyse
    /\b(analyse|analyser|regarde|regarder|décris|decris|c'est quoi|cest quoi|qu'est-ce|quest-ce)\b/i,

    // Demandes à l'IA - Recherche
    /\b(cherche|recherche|trouve|google|search|dit-moi|dit moi|di moi|dis-moi|dis moi)\b/i,

    // Demandes à l'IA - Explications
    /\b(explique|expliquer|comment ça|comment sa|commen sa|pourquoi|pourkoi|pourkoua)\b/i,
];

/**
 * Détermine si un message utilisateur doit être stocké dans la mémoire
 */
export function shouldStoreUserMessage(message: string): boolean {
    const trimmed = message.trim();

    // Exception: Demandes à l'IA toujours gardées (même courtes)
    if (/\b(génère|genere|crée|cree|analyse|analyser|cherche|recherche|explique|dessine|regarde|décris|decris|dit-moi|dit moi|di moi)\b/i.test(trimmed)) {
        return true;
    }

    // Exception: Salutations toujours gardées (conversations naturelles)
    if (/^(salut|coucou|bonjour|bonsoir|hey|yo|cc|wsh|bjr)\b/i.test(trimmed)) {
        return true;
    }

    // Exception: Questions sociales toujours gardées
    if (/^(ça va|ca va|comment ça va|comment ca va|comment tu vas|cv|quoi de neuf|quoi de 9)/i.test(trimmed)) {
        return true;
    }

    // Exception: Questions sociales avec modificateurs (ça va bien?, ça va mal?, etc.)
    if (/^(ça|ca)\s+(va|vas)\s*(bien|mal|toi|vous|\?)/i.test(trimmed)) {
        return true;
    }

    // Exception: Questions importantes courtes (tu fais quoi?, tu viens?, t'es rank combien?, etc.)
    // Support apostrophes: t'es, t'as, etc.
    if (/^(tu|vous|t'|t)\s+(fais|fait|viens|vient|es|est|vas|va|as)\s+/i.test(trimmed) && trimmed.includes('?')) {
        return true;
    }
    if (/^(t'es|t'as|c'est)\s+/i.test(trimmed) && trimmed.includes('?')) {
        return true; // t'es rank combien?, t'as quel âge?, c'est quoi?
    }

    // Exception: Questions avec mots interrogatifs + point d'interrogation
    if (trimmed.includes('?') && /\b(quoi|pourquoi|pourkoi|comment|commen|qui|ki|quand|où|ou|combien|comb1|quel|quelle|lequel)\b/i.test(trimmed)) {
        return true;
    }

    // Exception: Réponses conversationnelles courtes importantes
    // "Oui", "Non", "Ouais", "Nope" suivis d'une continuation conversationnelle
    // Simplifié : si contient oui/non/ouais + toi
    if (/\b(oui|ouais|ouep|yep|yeah|ye|non|nope|nah|ben|no|yes)\b.*\btoi\b/i.test(trimmed)) {
        return true; // "Oui toi?", "Non et toi?", "Ouais, toi?", "ye toi?", "ben oui toi"
    }

    // Exception: Réponses courtes avec "ben" (ben oui, ben non, ben ouais)
    if (/^bin|ben\s+(oui|non|ouais|si|yes|no)/i.test(trimmed)) {
        return true; // "ben oui", "ben non", "ben ouais"
    }

    // Exception: Questions de relance courtes ("Toi?", "Et toi?")
    if (/^(et\s+)?toi\s*\??$/i.test(trimmed)) {
        return true; // "Toi?", "Et toi?"
    }

    // Trop court = probablement pas important (réduit à 10 caractères pour garder plus de contexte)
    if (trimmed.length < 10) {
        // Exception: si c'est une question courte mais valide
        if (/^(pourquoi|pourkoi|comment|commen|quand|où|ou|qui|ki|quel|koi)\s*\??$/i.test(trimmed)) {
            return true;
        }

        // Exception: Réponses courtes oui/non/ok - laissées passer pour être gérées par le système de contexte temporel dans queue.ts
        // Ces réponses seront gardées SEULEMENT si elles répondent à une question récente (< 30s)
        if (/^(oui|non|ouais|ouep|yep|yeah|ye|ok|nope|nah|nan|yes|no|si|rien|nothing|r1|ben\s+(oui|non)|bien\s+(sur|sûr)|certainement|évidemment|evidemment|absolument|carrément|carrement|grave|clair)$/i.test(trimmed)) {
            return true; // Laisse passer pour le système de contexte temporel
        }

        return false;
    }

    // Pattern de bruit évident
    for (const pattern of NOISE_PATTERNS) {
        if (pattern.test(trimmed)) {
            return false;
        }
    }

    // Contient des patterns importants
    for (const pattern of IMPORTANT_PATTERNS) {
        if (pattern.test(trimmed)) {
            return true;
        }
    }

    // Contient des mots-clés de haute valeur
    const lowerMessage = trimmed.toLowerCase();
    for (const keyword of HIGH_VALUE_KEYWORDS) {
        if (lowerMessage.includes(keyword)) {
            return true;
        }
    }

    // Messages avec URLs (liens Tenor, images, etc.)
    if (trimmed.includes('http://') || trimmed.includes('https://')) {
        return true;
    }

    // Messages avec mentions Discord
    if (trimmed.includes('<@') || trimmed.includes('<#')) {
        return true;
    }

    // Si le message est assez long (30+ caractères) et contient au moins une lettre
    if (trimmed.length >= 30 && /[a-zA-ZÀ-ÿ]/.test(trimmed)) {
        return true;
    }

    // Par défaut, on ne garde pas
    return false;
}

/**
 * Détermine si une réponse de l'assistant doit être stockée
 * (généralement on garde toutes les réponses, sauf les très courtes)
 */
export function shouldStoreAssistantMessage(message: string): boolean {
    const trimmed = message.trim();

    // Les réponses de refus de modération ne sont jamais stockées (déjà géré ailleurs)
    // Ici on filtre juste les réponses trop courtes ou vides
    if (trimmed.length < 5) {
        return false;
    }

    // Pattern de bruit évident
    for (const pattern of NOISE_PATTERNS) {
        if (pattern.test(trimmed)) {
            return false;
        }
    }

    // Toutes les autres réponses sont gardées
    return true;
}

/**
 * Calcule un score d'importance pour un turn de mémoire
 * Plus le score est élevé, plus le turn est important
 */
export function calculateTurnImportance(turn: {
    userText: string;
    assistantText?: string; // Optionnel pour les messages passifs
    imageDescriptions?: string[];
    webContext?: any;
    ts?: number; // Timestamp du message
    isReply?: boolean; // Si c'est une réponse à un autre message
}): number {
    let score = 0;

    // Base score
    score += 1;

    // Images = contexte visuel important
    if (turn.imageDescriptions && turn.imageDescriptions.length > 0) {
        score += 5;
    }

    // Contexte web = recherche factuelle
    if (turn.webContext) {
        score += 3;
    }

    // Reply = conversation importante (quelqu'un répond à quelque chose)
    if (turn.isReply) {
        score += 2;
    }

    // Message utilisateur long = plus de contexte
    if (turn.userText.length > 100) {
        score += 2;
    }

    // Réponse longue = réponse détaillée importante
    if (turn.assistantText && turn.assistantText.length > 200) {
        score += 1;
    }

    // Patterns importants dans le message utilisateur
    for (const pattern of IMPORTANT_PATTERNS) {
        if (pattern.test(turn.userText)) {
            score += 2;
            break;
        }
    }

    // Code dans les messages
    if (turn.userText.includes('```') || (turn.assistantText && turn.assistantText.includes('```'))) {
        score += 3;
    }

    // Mots-clés de haute valeur (contexte social, émotions, plans)
    let keywordBonus = 0;

    // Salutations et politesse (rend les conversations naturelles)
    if (/^(salut|coucou|bonjour|bonsoir|hey|yo|cc|wsh|bjr)\b/i.test(turn.userText)) {
        keywordBonus += 1;
    }

    // Questions sociales basiques (ça va?, comment ça va?, etc.)
    if (/\b(ça va|ca va|comment ça va|comment ca va|comment tu vas|cv|quoi de neuf|quoi de 9)\b/i.test(turn.userText)) {
        keywordBonus += 1;
    }

    // Demandes à l'IA (priorité haute)
    if (/\b(génère|genere|crée|cree|analyse|analyser|cherche|recherche|explique|dessine|regarde|décris|decris)\b/i.test(turn.userText)) {
        keywordBonus += 3;
    }

    // Plans et événements importants
    if (/\b(demain|dem1|ce soir|week-end|wknd|samedi|dimanche|va|allons|rendez-vous|rdv|fête|fete|party|anniversaire)\b/i.test(turn.userText)) {
        keywordBonus += 3;
    }

    // Relations et personnes importantes
    if (/\b(elle|lui|eux|famille|ami|copain|copine|rencontré|rencontre|parents|frère|frer|sœur|soeur)\b/i.test(turn.userText)) {
        keywordBonus += 2;
    }

    // Émotions et états importants
    if (/\b(heureux|triste|énervé|enerve|content|désolé|desole|inquiet|stressé|stresse|cool|génial|genial|nul|chiant)\b/i.test(turn.userText)) {
        keywordBonus += 2;
    }

    // Opinions et préférences
    if (/\b(je préfère|je prefere|j'aime|jaime|je déteste|je deteste|j'adore|jadore|je kiffe|kiff|plutôt|plutot|mieux)\b/i.test(turn.userText)) {
        keywordBonus += 2;
    }

    // Questions importantes sur des personnes ou situations
    if (/\b(comment|commen|pourquoi|pourkoi|qu'est-ce|quest-ce|quel est|qui est|ki|koi)\b/i.test(turn.userText) && turn.userText.includes('?')) {
        keywordBonus += 1;
    }

    score += keywordBonus;

    // NOUVEAU : Pénalité temporelle basée sur l'âge du message
    if (turn.ts) {
        const ageInDays = (Date.now() - turn.ts) / (1000 * 60 * 60 * 24);

        // Messages très récents (< 1 jour) : pas de pénalité
        if (ageInDays < 1) {
            // Aucune pénalité
        }
        // Messages de 1-3 jours : légère pénalité
        else if (ageInDays < 3) {
            score *= 0.9; // -10%
        }
        // Messages de 3-7 jours : pénalité moyenne
        else if (ageInDays < 7) {
            score *= 0.7; // -30%
        }
        // Messages de 7-14 jours : forte pénalité
        else if (ageInDays < 14) {
            score *= 0.5; // -50%
        }
        // Messages > 14 jours : très forte pénalité
        else {
            score *= 0.3; // -70%
        }
    }

    return score;
}

/**
 * Filtre et priorise les turns de mémoire
 * Garde les plus importants en priorité
 */
export function filterAndPrioritizeMemory(turns: Array<any>, maxTurns: number): Array<any> {
    if (turns.length <= maxTurns) {
        return turns;
    }

    // Calculer le score d'importance pour chaque turn
    const scoredTurns = turns.map(turn => ({
        turn,
        score: calculateTurnImportance(turn),
        index: turns.indexOf(turn),
    }));

    // Garder TOUJOURS les N derniers messages (contexte récent important)
    const recentCount = Math.min(5, Math.floor(maxTurns / 3));
    const recentTurns = scoredTurns.slice(-recentCount);

    // Pour le reste, trier par importance
    const olderTurns = scoredTurns.slice(0, -recentCount);
    olderTurns.sort((a, b) => b.score - a.score);

    // Prendre les meilleurs
    const selectedOlder = olderTurns.slice(0, maxTurns - recentCount);

    // Combiner et retrier par ordre chronologique
    const selected = [...selectedOlder, ...recentTurns];
    selected.sort((a, b) => a.index - b.index);

    return selected.map(s => s.turn);
}

/**
 * Analyse un message et retourne des métadonnées sur son type
 */
export function analyzeMessageType(message: string): {
    type: 'greeting' | 'ai_request' | 'plan' | 'question' | 'preference' | 'emotion' | 'opinion' | 'reaction' | 'other';
    confidence: number;
} {
    const lower = message.toLowerCase();

    // Salutations et questions sociales basiques (PRIORITÉ sur les autres patterns)
    if (/^(salut|coucou|bonjour|bonsoir|hey|yo|cc|wsh|bjr)\b/.test(lower)) {
        return {type: 'greeting', confidence: 0.9};
    }

    // Salutations + mentions Discord (Yo @user, Salut @user)
    if (/<@\d+>\s+(salut|coucou|bonjour|bonsoir|hey|yo|cc|wsh|bjr)\b/.test(lower)) {
        return {type: 'greeting', confidence: 0.9};
    }

    // Questions sociales "ça va" (AVANT le test de "va" pour les plans)
    // Supporte les mentions Discord (@user) au début et les salutations avant
    if (/(^|<@\d+>\s+|yo\s+|hey\s+|salut\s+)(ça va|ca va|comment ça va|comment ca va|comment tu vas|cv|quoi de neuf|quoi de 9)/i.test(lower)) {
        return {type: 'greeting', confidence: 0.85};
    }

    // Demandes à l'IA (priorité absolue)
    if (/\b(génère|genere|crée|cree|analyse|analyser|cherche|recherche|explique|dessine|regarde|décris|decris|dit-moi|dit moi|di moi)\b/.test(lower)) {
        return {type: 'ai_request', confidence: 0.95};
    }

    // Plans et événements
    if (/\b(va|vais|allons|irons|demain|dem1|ce soir|week-end|wknd|rendez-vous|rdv|fête|fete|party)\b/.test(lower)) {
        return {type: 'plan', confidence: 0.9};
    }

    // Question
    if (/\b(comment|commen|pourquoi|pourkoi|quand|où|ou|qui|ki|quel|quelle|est-ce que|qu'est-ce|quest-ce|koi)\b/.test(lower) || message.includes('?')) {
        return {type: 'question', confidence: 0.85};
    }

    // Préférence
    if (/\b(préfère|prefere|aime|déteste|deteste|adore|kiffe|kiff|plutôt|plutot|mieux|veux pas)\b/.test(lower)) {
        return {type: 'preference', confidence: 0.8};
    }

    // Émotion
    if (/\b(heureux|triste|énervé|enerve|content|désolé|desole|inquiet|stressé|stresse|cool|génial|genial|nul|chiant)\b/.test(lower)) {
        return {type: 'emotion', confidence: 0.8};
    }

    // Opinion
    if (/\b(pense|crois|trouve|opinion|avis|selon|contre|pour)\b/.test(lower)) {
        return {type: 'opinion', confidence: 0.7};
    }

    // Réaction simple
    if (message.length < 20 && /^(ok|lol|mdr|ah|oh|oui|non|yes|no)/.test(lower)) {
        return {type: 'reaction', confidence: 0.95};
    }

    return {type: 'other', confidence: 0.5};
}

/**
 * Sliding Window System - Garde intelligemment le contexte
 *
 * Stratégie :
 * 1. Garde TOUJOURS les N derniers turns (contexte récent)
 * 2. Garde les meilleurs anciens turns (contexte historique important)
 * 3. Jette le reste (bruit et messages peu importants)
 *
 * @param turns - Tous les turns de mémoire
 * @param recentCount - Nombre de turns récents à toujours garder
 * @param oldCount - Nombre de turns anciens importants à garder
 * @param minScore - Score minimum pour qu'un ancien turn soit gardé
 */
export function slidingWindowMemory(
    turns: Array<any>,
    recentCount: number,
    oldCount: number,
    minScore: number = 2
): Array<any> {
    // Si on a moins de turns que recentCount, tout garder
    if (turns.length <= recentCount) {
        return turns;
    }

    // Étape 1 : Séparer les turns récents des anciens
    const recentTurns = turns.slice(-recentCount);
    const oldTurns = turns.slice(0, -recentCount);

    // Si pas assez d'anciens turns, tout garder
    if (oldTurns.length === 0) {
        return turns;
    }

    // Étape 2 : Calculer le score pour chaque ancien turn
    const scoredOldTurns = oldTurns.map((turn, index) => ({
        turn,
        score: calculateTurnImportance(turn),
        originalIndex: index, // Pour préserver l'ordre chronologique
    }));

    // Étape 3 : Filtrer par score minimum et trier par importance
    const importantOldTurns = scoredOldTurns
        .filter(({score}) => score >= minScore)
        .sort((a, b) => b.score - a.score) // Trier par score décroissant
        .slice(0, oldCount) // Garder seulement les N meilleurs
        .sort((a, b) => a.originalIndex - b.originalIndex) // Retrier chronologiquement
        .map(({turn}) => turn);

    // Étape 4 : Combiner anciens importants + récents
    const result = [...importantOldTurns, ...recentTurns];

    logger.info(`[Sliding Window] Total: ${turns.length} turns`);
    logger.info(`[Sliding Window] Recent: ${recentTurns.length} turns (always kept)`);
    logger.info(`[Sliding Window] Old: ${oldTurns.length} turns → ${importantOldTurns.length} kept (score >= ${minScore})`);
    logger.info(`[Sliding Window] Result: ${result.length} turns`);

    return result;
}

