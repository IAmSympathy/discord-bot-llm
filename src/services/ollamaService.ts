import {OLLAMA_API_URL, OLLAMA_TEXT_MODEL} from "../utils/constants";
import {EnvConfig} from "../utils/envConfig";
import {Tool} from "./profileTools";
import fs from "fs";
import {createLogger} from "../utils/logger";

const logger = createLogger("OllamaService");

const OLLAMA_TIMEOUT_MS = 120000; // Timeout de 120 secondes pour les requêtes Ollama
const MAX_RETRIES = 3; // Nombre maximum de tentatives
const INITIAL_RETRY_DELAY = 1000; // Délai initial entre les tentatives (1 seconde)

/**
 * Fonction utilitaire pour retry avec backoff exponentiel
 * @param fn - Fonction async à exécuter
 * @param retries - Nombre de tentatives restantes
 * @param delay - Délai actuel entre les tentatives
 * @param operationName - Nom de l'opération pour le logging
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
            logger.error(`[Retry] ${operationName} failed after ${MAX_RETRIES} attempts`);
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
            logger.debug(`[Retry] ${operationName} - Non-retryable error, throwing immediately`);
            throw error;
        }

        const attempt = MAX_RETRIES - retries + 1;
        logger.warn(`[Retry] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Backoff exponentiel: doubler le délai à chaque tentative
        return retryWithBackoff(fn, retries - 1, delay * 2, operationName);
    }
}

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

        // Utiliser le système de retry avec backoff exponentiel
        return await retryWithBackoff(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

            try {
                const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "Netricsa-Bot/1.0",
                        "Connection": "close" // Désactiver keep-alive pour éviter les connexions stales
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                    // @ts-ignore - undici-specific options
                    keepAlive: false
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
                }

                return response;
            } catch (error) {
                clearTimeout(timeoutId);

                // Erreur de connexion (ECONNREFUSED, ETIMEDOUT, etc.)
                if (error instanceof Error) {
                    logger.error(`Failed to connect to Ollama at ${OLLAMA_API_URL}: ${error.name} - ${error.message}`);
                    throw new Error(`CONNECTION_ERROR: ${error.message}`);
                } else {
                    logger.error(`Failed to connect to Ollama at ${OLLAMA_API_URL}: ${String(error)}`);
                    throw new Error(`CONNECTION_ERROR: Unknown error`);
                }
            }
        }, MAX_RETRIES, INITIAL_RETRY_DELAY, "Ollama chat");
    }

    /**
     * Charge les prompts système depuis les fichiers
     * @param channelId - ID du canal Discord
     * @param isDM - Indique si c'est un DM
     * @param isAskNetricsa - Indique si c'est la commande /ask-netricsa (pas de réaction emoji)
     */
    loadSystemPrompts(channelId: string, isDM: boolean = false, isAskNetricsa: boolean = false): { systemPrompt: string; serverPrompt: string; finalPrompt: string } {
        const promptPath = isAskNetricsa
            ? EnvConfig.SYSTEM_PROMPT_PATH?.replace('system_prompt.txt', 'system_prompt_ask_netricsa.txt')
            : EnvConfig.SYSTEM_PROMPT_PATH;

        if (!promptPath) {
            throw new Error("SYSTEM_PROMPT_PATH n'est pas défini dans le .env");
        }

        const systemPrompt = fs.readFileSync(promptPath, "utf8");

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
