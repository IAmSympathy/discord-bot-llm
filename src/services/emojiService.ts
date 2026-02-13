import {OLLAMA_API_URL, OLLAMA_TEXT_MODEL} from "../utils/constants";
import {EnvConfig} from "../utils/envConfig";
import {convertTextEmojisToUnicode, extractValidEmojis} from "../utils/textTransformers";
import fs from "fs";

const OLLAMA_TIMEOUT_MS = 60000; // Timeout de 60 secondes pour les emojis (plus rapide)
const MAX_RETRIES = 3; // Nombre maximum de tentatives
const INITIAL_RETRY_DELAY = 1000; // Délai initial entre les tentatives (1 seconde)

/**
 * Fonction utilitaire pour retry avec backoff exponentiel
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES,
    delay: number = INITIAL_RETRY_DELAY,
    operationName: string = "operation"
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) {
            console.error(`[Retry] ${operationName} failed after ${MAX_RETRIES} attempts`);
            throw error;
        }

        const isRetryableError = error instanceof Error && (
            error.name === 'AbortError' ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('fetch failed')
        );

        if (!isRetryableError) {
            console.log(`[Retry] ${operationName} - Non-retryable error, throwing immediately`);
            throw error;
        }

        const attempt = MAX_RETRIES - retries + 1;
        console.warn(`[Retry] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        return retryWithBackoff(fn, retries - 1, delay * 2, operationName);
    }
}

/**
 * Génère un emoji de réaction en utilisant le LLM
 */
export async function generateEmojiReaction(context: string, promptTemplate: string): Promise<string> {
    const systemPromptPath = EnvConfig.SYSTEM_PROMPT_PATH;
    if (!systemPromptPath) {
        console.warn("[EmojiService] SYSTEM_PROMPT_PATH not defined, using default");
        return "🤗";
    }

    const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
    const prompt = promptTemplate.replace("{context}", context);

    try {
        // Utiliser le système de retry avec backoff exponentiel
        const data = await retryWithBackoff(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

            try {
                const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "Netricsa-Bot/1.0",
                        "Connection": "close" // Désactiver keep-alive pour éviter les connexions stales
                    },
                    body: JSON.stringify({
                        model: OLLAMA_TEXT_MODEL,
                        prompt: `${systemPrompt}\n\n${prompt}`,
                        stream: false,
                    }),
                    signal: controller.signal,
                    // @ts-ignore - undici-specific options
                    keepAlive: false
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Emoji generation error: ${response.status} ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }, MAX_RETRIES, INITIAL_RETRY_DELAY, "Emoji generation");

        const llmResult = data.response || "";

        // Convertir les smileys textuels en emojis Unicode
        const convertedText = convertTextEmojisToUnicode(llmResult);
        const emojis = extractValidEmojis(convertedText);

        return emojis.length > 0 ? emojis[0] : "🤗";
    } catch (error) {
        console.error("[EmojiService] Failed to generate emoji:", error);
        return "🤗";
    }
}

/**
 * Génère un emoji pour une citation
 */
export async function generateCitationEmoji(citation: string): Promise<string> {
    const promptTemplate = `[Contexte: Thread Citations - Citations drôles hors contexte]
[Format des citations: "Citation\\n\\n-Personne, Date, Contexte (facultatif)"]
[TÂCHE: Choisis UN SEUL emoji qui représente ton amusement face à cette citation. Réponds UNIQUEMENT avec l'emoji, rien d'autre.]

{context}`;

    return generateEmojiReaction(citation, promptTemplate);
}

/**
 * Génère un emoji pour réagir à une mention du bot
 */
export async function generateMentionEmoji(message: string): Promise<string> {
    const promptTemplate = `Donne uniquement **un seul emoji** qui exprime ton émotion par rapport ce qui est dit sur toi (Nettie/Netricsa) dans ce message :
"{context}"
Ne mets aucun texte, aucun autre emoji.`;

    return generateEmojiReaction(message, promptTemplate);
}
