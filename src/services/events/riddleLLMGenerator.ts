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

        const systemPrompt = `Tu es un créateur d'énigmes expert. Tu dois créer une énigme LOGIQUE et COHÉRENTE en français.

RÈGLES IMPORTANTES :
1. L'énigme doit avoir UNE SEULE réponse claire et évidente
2. La réponse doit faire SENS avec la description
3. Évite les énigmes abstraites ou métaphoriques difficiles à deviner
4. Préfère les énigmes concrètes basées sur la logique, les jeux de mots ou les observations

EXEMPLES DE BONNES ÉNIGMES :
- "Plus je sèche, plus je deviens mouillé. Qui suis-je ?" → Réponse: serviette (LOGIQUE : elle absorbe l'eau)
- "Qu'est-ce qui a des dents mais ne peut pas mordre ?" → Réponse: peigne (JEU DE MOTS : les dents du peigne)
- "Je commence la nuit et termine le matin. Qui suis-je ?" → Réponse: n (JEU DE MOTS : la lettre)

EXEMPLES DE MAUVAISES ÉNIGMES À ÉVITER :
- "Je me brise si je tends trop" → Trop abstrait, pas logique
- "Je suis invisible mais toujours là" → Trop vague
- Énigmes où la réponse ne correspond pas vraiment à la description

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

EXEMPLES D'ÉNIGMES DE QUALITÉ (NE PAS COPIER, JUSTE S'EN INSPIRER) :

Facile :
- "Plus je sèche, plus je deviens mouillé. Qui suis-je ?" (Réponse: serviette) - LOGIQUE claire
- "Qu'est-ce qui monte mais ne descend jamais ?" (Réponse: âge) - OBSERVATION logique
- "J'ai des dents mais je ne mords pas. Qui suis-je ?" (Réponse: peigne) - JEU DE MOTS simple

Moyen :
- "Plus tu m'enlèves, plus je deviens grand. Qui suis-je ?" (Réponse: trou) - LOGIQUE paradoxale
- "Je cours sans jambes, j'ai un lit mais ne dors pas. Qui suis-je ?" (Réponse: rivière) - MÉTAPHORE claire
- "Qu'est-ce qui appartient à toi mais que les autres utilisent plus que toi ?" (Réponse: nom) - RÉFLEXION

Difficile :
- "Je suis au début de l'éternité, à la fin du temps. Qui suis-je ?" (Réponse: e) - JEU DE MOTS avancé
- "Deux pères et deux fils, mais seulement 3 personnes. Comment ?" (Réponse: grand-père, père, fils) - LOGIQUE complexe

IMPORTANT :
- La réponse doit VRAIMENT correspondre à la description
- Évite les concepts trop abstraits (reflet, ombre, silence, etc.)
- Préfère des objets concrets ou des concepts clairs
- La logique doit être évidente une fois qu'on a la réponse

Crée maintenant une énigme ORIGINALE et LOGIQUE de niveau ${difficulty} :`;

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
        logger.info(`LLM response received (first 200 chars): ${responseText.substring(0, 200)}...`);

        // Parser la réponse JSON
        let riddleData: LLMRiddleResponse;
        try {
            // La réponse d'Ollama est un objet JSON avec { message: { content: "..." } }
            const ollamaResponse = JSON.parse(responseText);
            let contentText = ollamaResponse.message?.content || responseText;

            // Nettoyer la réponse (enlever les balises markdown si présentes)
            let cleanedResponse = contentText.trim();

            // Enlever les balises ```json si présentes
            cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
            cleanedResponse = cleanedResponse.replace(/```\s*/g, '');

            // Extraire le JSON si il y a du texte avant/après
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*}/);
            if (jsonMatch) {
                cleanedResponse = jsonMatch[0];
            }

            riddleData = JSON.parse(cleanedResponse);
            logger.info(`Parsed riddle data: ${JSON.stringify(riddleData)}`);
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




