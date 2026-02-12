import {OLLAMA_API_URL, OLLAMA_TEXT_MODEL} from "../utils/constants";
import {EnvConfig} from "../utils/envConfig";
import {Tool} from "./profileTools";
import fs from "fs";
import {createLogger} from "../utils/logger";

const logger = createLogger("OllamaService");

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

        try {
            const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (error) {
            // Erreur de connexion (ECONNREFUSED, ETIMEDOUT, etc.)
            logger.error(`Failed to connect to Ollama at ${OLLAMA_API_URL}: ${error instanceof Error ? error.message : error}`);
            throw new Error(`CONNECTION_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Charge les prompts système depuis les fichiers
     * @param channelId - ID du canal Discord
     * @param isDM - Indique si c'est un DM
     * @param isAskNetricsa - Indique si c'est la commande /ask-netricsa (pas de réaction emoji)
     */
    loadSystemPrompts(channelId: string, isDM: boolean = false, isAskNetricsa: boolean = false): { systemPrompt: string; serverPrompt: string; finalPrompt: string } {
        const promptPath = EnvConfig.SYSTEM_PROMPT_PATH;

        if (!promptPath) {
            throw new Error("SYSTEM_PROMPT_PATH n'est pas défini dans le .env");
        }

        let systemPrompt = fs.readFileSync(promptPath, "utf8");

        // Si c'est /ask-netricsa, retirer la section sur l'emoji de réaction
        if (isAskNetricsa) {
            systemPrompt = systemPrompt.replace(
                /1\. 😊 COMMENCE TOUJOURS PAR UN EMOJI[\s\S]*?→ Exemple : "😊 Super idée ! 🎉" → Réaction: 😊 \| Texte affiché: "Super idée ! 🎉"/,
                `1. 💬 FORMAT DE RÉPONSE
   → Sois naturelle et directe dans ta réponse
   → Tu peux utiliser des emojis dans ton texte pour exprimer des émotions`
            );

            // Retirer aussi la mention de l'emoji dans le résumé
            systemPrompt = systemPrompt.replace(
                /1\. ✅ Commence TOUJOURS par un emoji/,
                `1. ✅ Réponds de manière naturelle et directe`
            );
        }

        let serverPrompt: string;

        if (isDM) {
            // Contexte spécial pour les DMs
            serverPrompt = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CONTEXTE DE LA CONVERSATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CONVERSATION PRIVÉE (DM - MESSAGE DIRECT)

📍 Type : Message privé (DM)
👤 Participants : Toi + 1 utilisateur uniquement

🔒 CARACTÉRISTIQUES :
   • Cette conversation est PRIVÉE et CONFIDENTIELLE
   • Il n'y a pas d'autres personnes dans cette conversation
   • L'utilisateur attend une réponse personnelle et directe
   • Tu peux être plus détendue et personnelle dans tes réponses

📋 ID du canal : ${channelId} (DM)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        } else {
            // Contexte minimal pour les canaux serveur
            serverPrompt = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 CONTEXTE DU SERVEUR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Serveur : **The Not So Serious Lands**
🌍 Type : Serveur Discord québécois privé entre amis

💬 POUR INTERAGIR AVEC TOI :
   • Écrire dans <#1464063041950974125> (salon Netricsa)
   • Te mentionner (@Netricsa) depuis n'importe quel salon
   • T'écrire en messages privés (DM)'

ℹ️ Les utilisateurs peuvent consulter <#1158184382679498832> pour les infos du serveur

📋 ID du salon actuel : ${channelId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }

        const finalPrompt = `${systemPrompt}\n\n${serverPrompt}`;

        return {systemPrompt, serverPrompt, finalPrompt};
    }
}
