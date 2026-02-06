import {OLLAMA_API_URL, OLLAMA_TEXT_MODEL} from "../utils/constants";
import {EnvConfig} from "../utils/envConfig";
import {Tool} from "./profileTools";
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
    async chat(messages: LLMMessage[], options: LLMOptions = {}, stream = true, tools?: Tool[]): Promise<Response> {
        const defaultOptions: LLMOptions = {
            temperature: 1.0,
            repeat_penalty: 1.1,
            num_predict: 600,
            ...options,
        };

        const body: any = {
            model: OLLAMA_TEXT_MODEL,
            messages,
            stream,
            options: defaultOptions,
        };

        // Ajouter les tools si fournis
        if (tools && tools.length > 0) {
            body.tools = tools;
        }

        const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    /**
     * Charge les prompts système depuis les fichiers
     */
    loadSystemPrompts(channelId: string, isDM: boolean = false): { systemPrompt: string; serverPrompt: string; finalPrompt: string } {
        const promptPath = EnvConfig.SYSTEM_PROMPT_PATH;

        if (!promptPath) {
            throw new Error("SYSTEM_PROMPT_PATH n'est pas défini dans le .env");
        }

        const systemPrompt = fs.readFileSync(promptPath, "utf8");

        let serverPrompt: string;

        if (isDM) {
            // Contexte spécial pour les DMs
            serverPrompt = `\n\n=== CONTEXTE ACTUEL ===
⚠️ CONVERSATION PRIVÉE (DM - MESSAGE DIRECT)
Tu es en conversation privée (DM) avec un utilisateur. 
- Cette conversation est PRIVÉE et CONFIDENTIELLE entre toi et cet utilisateur uniquement.
- Il n'y a pas d'autres personnes dans cette conversation.
- L'utilisateur attend une réponse personnelle et directe.
- Tu peux être plus détendue et personnelle dans tes réponses.
ID du canal: ${channelId} (DM)
=== CONTEXTE ACTUEL ===`;
        } else {
            // Contexte minimal pour les canaux serveur
            serverPrompt = `\n\n=== CONTEXTE ACTUEL ===
Tu es sur le serveur Discord **The Not So Serious Lands**, un serveur québécois privé entre amis.

Pour interagir avec toi :
- Écrire dans <#1464063041950974125> (salon Netricsa)
- Te mentionner depuis n'importe quel salon

Les utilisateurs peuvent consulter <#1158184382679498832> pour les infos du serveur.

ID du salon actuel: ${channelId}
=== CONTEXTE ACTUEL ===`;
        }

        const finalPrompt = `${systemPrompt}\n\n${serverPrompt}`;

        return {systemPrompt, serverPrompt, finalPrompt};
    }
}
