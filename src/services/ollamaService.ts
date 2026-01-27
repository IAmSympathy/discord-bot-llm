import {OLLAMA_API_URL, OLLAMA_TEXT_MODEL} from "../utils/constants";
import fs from "fs";

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMOptions {
    temperature?: number;
    repeat_penalty?: number;
    num_predict?: number;
}

/**
 * Service pour interagir avec l'API Ollama
 */
export class OllamaService {
    /**
     * Envoie une requête de chat à Ollama
     */
    async chat(messages: LLMMessage[], options: LLMOptions = {}, stream = true): Promise<Response> {
        const defaultOptions: LLMOptions = {
            temperature: 1.0,
            repeat_penalty: 1.1,
            num_predict: 600,
            ...options,
        };

        const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                model: OLLAMA_TEXT_MODEL,
                messages,
                stream,
                options: defaultOptions,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    /**
     * Charge les prompts système depuis les fichiers
     */
    loadSystemPrompts(channelId: string): { systemPrompt: string; serverPrompt: string; finalPrompt: string } {
        const promptPath = process.env.SYSTEM_PROMPT_PATH;
        const serverPromptPath = process.env.SERVER_PROMPT_PATH;

        if (!promptPath) {
            throw new Error("SYSTEM_PROMPT_PATH n'est pas défini dans le .env");
        }

        if (!serverPromptPath) {
            throw new Error("SERVER_PROMPT_PATH n'est pas défini dans le .env");
        }

        const systemPrompt = fs.readFileSync(promptPath, "utf8");
        const serverPrompt =
            fs.readFileSync(serverPromptPath, "utf8") +
            `\n\n=== CONTEXTE ACTUEL ===
        ID du salon actuel: ${channelId}
        === CONTEXTE ACTUEL ===`;
        const finalPrompt = `${serverPrompt}\n\n${systemPrompt}`;

        return {systemPrompt, serverPrompt, finalPrompt};
    }
}
