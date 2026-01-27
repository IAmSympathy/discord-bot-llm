import {OLLAMA_API_URL, OLLAMA_TEXT_MODEL} from "../utils/constants";
import {convertTextEmojisToUnicode, extractValidEmojis} from "../utils/textTransformers";
import fs from "fs";

/**
 * Génère un emoji de réaction en utilisant le LLM
 */
export async function generateEmojiReaction(context: string, promptTemplate: string): Promise<string> {
    const systemPromptPath = process.env.SYSTEM_PROMPT_PATH;
    if (!systemPromptPath) {
        console.warn("[EmojiService] SYSTEM_PROMPT_PATH not defined, using default");
        return "🤗";
    }

    const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
    const prompt = promptTemplate.replace("{context}", context);

    try {
        const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                model: OLLAMA_TEXT_MODEL,
                prompt: `${systemPrompt}\n\n${prompt}`,
                stream: false,
            }),
        });

        if (!response.ok) {
            console.error(`[EmojiService] Error: ${response.status} ${response.statusText}`);
            return "🤗";
        }

        const data = await response.json();
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
