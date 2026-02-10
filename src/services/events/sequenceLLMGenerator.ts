import {createLogger} from "../../utils/logger";
import {LLMMessage, OllamaService} from "../ollamaService";
import {Sequence} from "./sequenceData";
import {isLowPowerMode} from "../botStateService";
import {isStandbyMode} from "../standbyModeService";

const logger = createLogger("SequenceLLMGenerator");

interface LLMSequenceResponse {
    sequence: string;
    answer: string;
    alternativeAnswers?: string[];
    hint: string;
    category?: string;
}

/**
 * Génère une suite logique avec le LLM
 */
async function generateSequenceWithLLM(difficulty?: 'facile' | 'moyen' | 'difficile'): Promise<Sequence | null> {
    try {
        const ollamaService = new OllamaService();

        const difficultyDescriptions = {
            'facile': 'Simple et évidente (ex: suites de nombres pairs, alphabet)',
            'moyen': 'Nécessite réflexion (ex: Fibonacci, carrés parfaits)',
            'difficile': 'Complexe et astucieuse (ex: nombres premiers, suites visuelles)'
        };

        difficulty = difficulty || 'moyen';

        const systemPrompt = `Tu es un créateur de suites logiques expert. Tu dois créer une suite LOGIQUE et COHÉRENTE.

RÈGLES IMPORTANTES :
1. La suite doit avoir UNE SEULE réponse claire et évidente
2. La logique doit être mathématique ou basée sur un pattern reconnaissable
3. Évite les suites trop abstraites ou ambiguës
4. La réponse doit être un nombre, une lettre, ou un mot court

TYPES DE SUITES À PRIVILÉGIER :
- Nombres : arithmétique (+2, +3...), géométrique (×2, ×3...), carrés, cubes
- Lettres : alphabet, alphabet inversé, sauts réguliers
- Logique : Fibonacci, nombres premiers, patterns visuels

EXEMPLES DE BONNES SUITES :
- "2, 4, 6, 8, ?" → 10 (nombres pairs)
- "1, 4, 9, 16, ?" → 25 (carrés parfaits)
- "A, C, E, G, ?" → I (une lettre sur deux)
- "1, 1, 2, 3, 5, ?" → 8 (Fibonacci)

EXEMPLES À ÉVITER :
- Suites trop courtes (moins de 4 éléments)
- Suites avec plusieurs réponses possibles
- Suites basées sur des connaissances culturelles spécifiques

Réponds UNIQUEMENT avec un objet JSON dans ce format exact (sans markdown, sans balises) :
{
  "sequence": "La suite avec ? à la fin (ex: 2, 4, 6, 8, ?)",
  "answer": "la réponse (nombre, lettre ou mot court)",
  "alternativeAnswers": ["réponse alternative 1", "réponse alternative 2"],
  "hint": "Un indice avec un emoji au début",
  "category": "La catégorie (Nombres/Lettres/Logique/etc.)"
}`;

        const userPrompt = `Crée une suite logique de niveau ${difficulty}.
Description du niveau : ${difficultyDescriptions[difficulty]}

EXEMPLES DE SUITES DE QUALITÉ (NE PAS COPIER, JUSTE S'EN INSPIRER) :

Facile :
- "2, 4, 6, 8, ?" (Réponse: 10) - Nombres pairs
- "A, B, C, D, ?" (Réponse: E) - Alphabet
- "5, 10, 15, 20, ?" (Réponse: 25) - Table de 5

Moyen :
- "1, 4, 9, 16, ?" (Réponse: 25) - Carrés parfaits
- "1, 1, 2, 3, 5, ?" (Réponse: 8) - Fibonacci
- "Z, Y, X, W, ?" (Réponse: V) - Alphabet inversé

Difficile :
- "2, 3, 5, 7, 11, ?" (Réponse: 13) - Nombres premiers
- "1, 8, 27, 64, ?" (Réponse: 125) - Cubes parfaits
- "A, C, F, J, ?" (Réponse: O) - Sauts croissants

IMPORTANT :
- La suite doit avoir AU MOINS 4 éléments avant le "?"
- La logique doit être évidente une fois qu'on a la réponse
- Donne 2-3 réponses alternatives si possible (ex: "10", "dix")

Crée maintenant une suite ORIGINALE et LOGIQUE de niveau ${difficulty} :`;

        const messages: LLMMessage[] = [
            {role: "system", content: systemPrompt},
            {role: "user", content: userPrompt}
        ];

        logger.info(`Generating sequence with LLM (difficulty: ${difficulty})...`);

        const response = await ollamaService.chat(messages, {
            temperature: 0.9,
            num_predict: 300
        }, false);

        const responseText = await response.text();
        logger.info(`LLM response received (first 200 chars): ${responseText.substring(0, 200)}...`);

        // Parser la réponse JSON
        let sequenceData: LLMSequenceResponse;
        try {
            const ollamaResponse = JSON.parse(responseText);
            let contentText = ollamaResponse.message?.content || responseText;

            let cleanedResponse = contentText.trim();
            cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
            cleanedResponse = cleanedResponse.replace(/```\s*/g, '');

            const jsonMatch = cleanedResponse.match(/\{[\s\S]*}/);
            if (jsonMatch) {
                cleanedResponse = jsonMatch[0];
            }

            sequenceData = JSON.parse(cleanedResponse);
            logger.info(`Parsed sequence data: ${JSON.stringify(sequenceData)}`);
        } catch (parseError) {
            logger.error("Failed to parse LLM response as JSON:", parseError);
            logger.error("Raw response:", responseText);
            return null;
        }

        // Valider les données
        if (!sequenceData.sequence || !sequenceData.answer || !sequenceData.hint) {
            logger.error("Invalid sequence data from LLM:", sequenceData);
            return null;
        }

        // Calculer l'XP basé sur la difficulté
        const xpRewards = {
            'facile': 100,
            'moyen': 200,
            'difficile': 300
        };

        // Créer l'objet Sequence
        const sequence: Sequence = {
            id: `sequence_llm_${Date.now()}`,
            sequence: sequenceData.sequence,
            answer: sequenceData.answer.toLowerCase().trim(),
            alternativeAnswers: sequenceData.alternativeAnswers?.map(a => a.toLowerCase().trim()) || [],
            hint: sequenceData.hint,
            difficulty: difficulty,
            category: sequenceData.category || 'Suite logique',
            xpReward: xpRewards[difficulty]
        };

        logger.info(`✅ Successfully generated sequence: "${sequence.sequence}" (Answer: ${sequence.answer})`);
        return sequence;

    } catch (error) {
        logger.error("Error generating sequence with LLM:", error);
        return null;
    }
}

/**
 * Génère une suite logique en utilisant le LLM, avec fallback sur la base de données
 */
export async function generateOrFallbackSequence(difficulty?: 'facile' | 'moyen' | 'difficile'): Promise<Sequence> {
    // Vérifier si le bot est en mode low power ou standby
    if (isLowPowerMode()) {
        logger.info("Bot is in low power mode, using fallback database sequence");
        const {getRandomSequence, getRandomSequenceByDifficulty} = require("./sequenceData");

        if (difficulty) {
            return getRandomSequenceByDifficulty(difficulty);
        } else {
            return getRandomSequence();
        }
    }

    if (isStandbyMode()) {
        logger.info("Bot is in standby mode, using fallback database sequence");
        const {getRandomSequence, getRandomSequenceByDifficulty} = require("./sequenceData");

        if (difficulty) {
            return getRandomSequenceByDifficulty(difficulty);
        } else {
            return getRandomSequence();
        }
    }

    // Essayer de générer avec le LLM
    const llmSequence = await generateSequenceWithLLM(difficulty);

    if (llmSequence) {
        logger.info("Using LLM-generated sequence");
        return llmSequence;
    }

    // Fallback : utiliser une suite de la base de données
    logger.warn("LLM generation failed, falling back to database sequence");
    const {getRandomSequence, getRandomSequenceByDifficulty} = require("./sequenceData");

    if (difficulty) {
        return getRandomSequenceByDifficulty(difficulty);
    } else {
        return getRandomSequence();
    }
}


