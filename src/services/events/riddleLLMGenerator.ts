import {createLogger} from "../../utils/logger";
import {LLMMessage, OllamaService} from "../ollamaService";
import {Riddle} from "./riddleData";
import {isLowPowerMode} from "../botStateService";

const logger = createLogger("RiddleLLMGenerator");

interface LLMRiddleResponse {
    question: string;
    answer: string;
    alternativeAnswers: string[];
    hint: string;
    category: string;
}

/**
 * Génère une énigme personnalisée en utilisant le LLM
 */
export async function generateRiddleWithLLM(difficulty: 'facile' | 'moyen' | 'difficile' = 'moyen'): Promise<Riddle | null> {
    try {
        const ollamaService = new OllamaService();

        const difficultyDescriptions = {
            'facile': 'Une énigme simple et accessible, adaptée pour débutants',
            'moyen': 'Une énigme de difficulté moyenne nécessitant un peu de réflexion',
            'difficile': 'Une énigme complexe et challenging qui demande de la logique avancée'
        };

        const systemPrompt = `Tu es un créateur d'énigmes expert. Tu dois créer une énigme originale et intéressante en français.

L'énigme doit :
- Être claire et bien formulée
- Avoir une réponse précise et unique
- Inclure un indice qui aide sans donner directement la réponse
- Être adaptée au niveau de difficulté demandé

Réponds UNIQUEMENT avec un objet JSON dans ce format exact (sans markdown, sans balises) :
{
  "question": "La question de l'énigme",
  "answer": "la réponse (en minuscules, un seul mot ou phrase courte)",
  "alternativeAnswers": ["réponse alternative 1", "réponse alternative 2"],
  "hint": "Un indice avec un emoji au début",
  "category": "La catégorie (Logique/Jeux de mots/Nature/Culture/etc.)"
}`;

        const userPrompt = `Crée une énigme de niveau ${difficulty}.
Description du niveau : ${difficultyDescriptions[difficulty]}

Exemples de bonnes énigmes :
- Facile : "Plus je sèche, plus je deviens mouillé. Qui suis-je ?" (Réponse: serviette)
- Moyen : "Plus tu m'enlèves, plus je deviens grand. Qui suis-je ?" (Réponse: trou)
- Difficile : "Je suis au début de l'éternité, à la fin du temps et de l'espace. Qui suis-je ?" (Réponse: e)

Crée maintenant une énigme ORIGINALE (différente de ces exemples).`;

        const messages: LLMMessage[] = [
            {role: "system", content: systemPrompt},
            {role: "user", content: userPrompt}
        ];

        logger.info(`Generating riddle with LLM (difficulty: ${difficulty})...`);

        const response = await ollamaService.chat(messages, {
            temperature: 0.9, // Plus créatif
            num_predict: 300
        }, false); // stream = false pour avoir la réponse complète

        const responseText = await response.text();
        logger.info(`LLM response received: ${responseText.substring(0, 200)}...`);

        // Parser la réponse JSON
        let riddleData: LLMRiddleResponse;
        try {
            // Nettoyer la réponse (enlever les balises markdown si présentes)
            let cleanedResponse = responseText.trim();

            // Enlever les balises ```json si présentes
            cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
            cleanedResponse = cleanedResponse.replace(/```\s*/g, '');

            // Extraire le JSON si il y a du texte avant/après
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*}/);
            if (jsonMatch) {
                cleanedResponse = jsonMatch[0];
            }

            riddleData = JSON.parse(cleanedResponse);
        } catch (parseError) {
            logger.error("Failed to parse LLM response as JSON:", parseError);
            logger.error("Raw response:", responseText);
            return null;
        }

        // Valider les données
        if (!riddleData.question || !riddleData.answer || !riddleData.hint) {
            logger.error("Invalid riddle data from LLM:", riddleData);
            return null;
        }

        // Calculer l'XP basé sur la difficulté
        const xpRewards = {
            'facile': 100,
            'moyen': 200,
            'difficile': 300
        };

        // Créer l'objet Riddle
        const riddle: Riddle = {
            id: `riddle_llm_${Date.now()}`,
            question: riddleData.question,
            answer: riddleData.answer.toLowerCase().trim(),
            alternativeAnswers: riddleData.alternativeAnswers?.map(a => a.toLowerCase().trim()) || [],
            hint: riddleData.hint,
            difficulty: difficulty,
            category: riddleData.category || 'Énigme personnalisée',
            xpReward: xpRewards[difficulty]
        };

        logger.info(`✅ Successfully generated riddle: "${riddle.question}" (Answer: ${riddle.answer})`);

        return riddle;

    } catch (error) {
        logger.error("Error generating riddle with LLM:", error);
        return null;
    }
}

/**
 * Génère une énigme en utilisant le LLM, avec fallback sur la base de données
 */
export async function generateOrFallbackRiddle(difficulty?: 'facile' | 'moyen' | 'difficile'): Promise<Riddle> {
    // Vérifier si le bot est en mode low power
    if (isLowPowerMode()) {
        logger.info("Bot is in low power mode, using fallback database riddle");
        const {getRandomRiddle, getRandomRiddleByDifficulty} = require("./riddleData");

        if (difficulty) {
            return getRandomRiddleByDifficulty(difficulty);
        } else {
            return getRandomRiddle();
        }
    }

    // Essayer de générer avec le LLM
    const llmRiddle = await generateRiddleWithLLM(difficulty);

    if (llmRiddle) {
        logger.info("Using LLM-generated riddle");
        return llmRiddle;
    }

    // Fallback : utiliser une énigme de la base de données
    logger.warn("LLM generation failed, falling back to database riddle");
    const {getRandomRiddle, getRandomRiddleByDifficulty} = require("./riddleData");

    if (difficulty) {
        return getRandomRiddleByDifficulty(difficulty);
    } else {
        return getRandomRiddle();
    }
}




