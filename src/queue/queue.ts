import { Message as DiscordMessage, TextChannel } from "discord.js";
import { FileMemory } from "../memory/fileMemory";

const wait = require("node:timers/promises").setTimeout;

// Interface pour les requêtes LLM directes
interface DirectLLMRequest {
  prompt: string;
  userId: string;
  userName: string;
  channel: TextChannel;
  replyToMessage?: DiscordMessage;
  imageUrls?: string[];
}

// Fonction pour télécharger une image et la convertir en base64
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return base64;
  } catch (error) {
    console.error(`[downloadImage] Error downloading ${url}:`, error);
    return null;
  }
}

// Fonction pour générer une description d'image avec le modèle vision
async function generateImageDescription(imageBase64: string): Promise<string | null> {
  const visionModelName = process.env.OLLAMA_VISION_MODEL || "llava:7b";
  const visionSystemPrompt = "Décris cette image de manière détaillée et précise. Sois concis mais complet.";

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: visionModelName,
        messages: [
          { role: "system", content: visionSystemPrompt },
          { role: "user", content: "Décris cette image.", images: [imageBase64] },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 500,
        },
      }),
    });

    if (!response.ok) {
      console.error(`[Vision] Error: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    const description = result.message?.content || null;
    console.log(`[Vision] Generated description (${description?.length || 0} chars)`);
    return description;
  } catch (error) {
    console.error(`[Vision] Error generating description:`, error);
    return null;
  }
}

// Configuration mémoire persistante
const memoryFilePath = process.env.MEMORY_FILE || "./data/memory.json";
const memoryMaxTurns = Number(process.env.MEMORY_MAX_TURNS || "12");
const memory = new FileMemory(memoryFilePath);

// Fonction pour effacer la mémoire d'un channel
export async function clearMemory(channelKey: string): Promise<void> {
  await memory.clearChannel(channelKey);
  console.log(`[Memory] Channel ${channelKey} memory cleared`);
}

// Fonction pour traiter une requête LLM directement (sans thread, pour le watch de channel)
export async function processLLMRequest(request: DirectLLMRequest) {
  const { prompt, userId, userName, channel, replyToMessage, imageUrls } = request;

  console.log(`[processLLMRequest] User ${userId} sent prompt: ${prompt}${imageUrls && imageUrls.length > 0 ? ` with ${imageUrls.length} image(s)` : ""}`);

  // Envoyer un message d'analyse si des images sont présentes
  let analysisMessage: DiscordMessage | null = null;
  let analysisInterval: NodeJS.Timeout | null = null;
  if (imageUrls && imageUrls.length > 0) {
    if (replyToMessage) {
      analysisMessage = await replyToMessage.reply("Analyse en cours.");
    } else {
      analysisMessage = await channel.send("Analyse en cours.");
    }

    // Animer les points
    let dotCount = 1;
    analysisInterval = setInterval(async () => {
      if (analysisMessage) {
        dotCount = (dotCount % 3) + 1;
        const dots = ".".repeat(dotCount);
        await analysisMessage.edit(`Analyse en cours${dots}`).catch(() => {});
      }
    }, 500);
  }

  // Télécharger les images et générer leurs descriptions avec le modèle vision
  let imageDescriptions: string[] = [];
  if (imageUrls && imageUrls.length > 0) {
    console.log(`[processLLMRequest] Processing ${imageUrls.length} image(s)...`);
    for (const url of imageUrls) {
      const base64 = await downloadImageAsBase64(url);
      if (base64) {
        console.log(`[Image] Downloaded ${url}, generating description...`);
        const description = await generateImageDescription(base64);
        if (description) {
          imageDescriptions.push(description);
          console.log(`[Image] Description: ${description.substring(0, 100)}...`);
        } else {
          console.error(`[Image] Failed to generate description for ${url}`);
        }
      } else {
        console.error(`[Image] Failed to download ${url}`);
      }
    }
    console.log(`[processLLMRequest] Successfully processed ${imageDescriptions.length}/${imageUrls.length} image(s)`);
  }

  // Récupérer le prompt de personnalité depuis .env
  const systemPrompt = process.env.BOT_SYSTEM_PROMPT || "Tu es un assistant Discord.";

  // Clé de mémoire unique (le bot n'écrit que dans un seul channel)
  const watchedChannelId = process.env.WATCH_CHANNEL_ID;
  const channelKey = watchedChannelId || channel.id;

  // Récupérer l'historique des conversations précédentes
  const recentTurns = await memory.getRecentTurns(channelKey, memoryMaxTurns);

  // Les descriptions d'images historiques sont déjà dans recentTurns via imageDescription

  // Construire le contexte avec l'historique - format très clair pour éviter la confusion
  const historyBlock =
    recentTurns.length === 0
      ? ""
      : recentTurns
          .map((t) => {
            const imageContext = t.imageDescription ? `\n[L'utilisateur a fourni une image. Description générée automatiquement: ${t.imageDescription}]` : "";
            return `UTILISATEUR (UID: ${t.discordUid}, Nom: ${t.displayName}):\n${t.userText}${imageContext}\n\nTOI (Milton, l'assistant):\n${t.assistantText}`;
          })
          .join("\n\n--- Échange suivant ---\n\n");

  // Ajouter les descriptions d'images actuelles au message utilisateur
  const imageContext = imageDescriptions.length > 0 ? `\n[L'utilisateur fournit une image. Description générée automatiquement: ${imageDescriptions.join(" | ")}]` : "";
  const currentUserBlock = `UTILISATEUR (UID: ${userId}, Nom: ${userName}):\n${prompt}${imageContext}`;

  // Assembler le prompt final avec un préambule explicatif
  const contextPreamble =
    historyBlock.length > 0 ? `IMPORTANT: Voici l'historique de la conversation. Lis attentivement QUI a dit QUOI. Ne confonds JAMAIS ce que l'utilisateur a dit avec ce que TU as dit.\n\n=== HISTORIQUE ===\n\n${historyBlock}\n\n=== FIN HISTORIQUE ===\n\n=== MESSAGE ACTUEL ===\n\n` : "";

  const userMessage = `${contextPreamble}${currentUserBlock}\n\nRéponds maintenant en tant que Milton:`;

  console.log(`[System Prompt Length]: ${systemPrompt.length} chars`);
  console.log(`[Memory]: ${recentTurns.length} turns loaded`);
  if (imageDescriptions.length > 0) {
    console.log(`[Images]: ${imageDescriptions.length} image description(s) included in context`);
  }

  // Toujours utiliser le modèle texte avec l'API generate
  const url = "http://localhost:11434/api/generate";
  const textModelName = process.env.OLLAMA_TEXT_MODEL || "llama3.2";
  const modelName = textModelName;

  const options = {
    temperature: 0.7,
    repeat_penalty: 1.2,
    num_predict: 4000,
  };

  const data = {
    model: modelName,
    prompt: userMessage,
    system: systemPrompt,
    stream: true,
    options,
  };

  console.log(`[processLLMRequest] Sending request to text model ${modelName}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let result = "";
    let responseChunks: Array<string> = [];
    let messages: Array<DiscordMessage> = [];

    // Buffer pour gérer les chunks JSON partiels (NDJSON)
    let jsonBuffer = "";

    // Variables pour compter les tokens
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    // Throttle pour ne pas dépasser les limites Discord
    const throttleResponse = async () => {
      if (messages.length === 0 || messages.length !== responseChunks.length) {
        const currentContent = responseChunks[responseChunks.length - 1];
        if (!currentContent || currentContent.trim().length === 0) {
          return; // Ne pas envoyer de message vide
        }

        // Arrêter l'animation et utiliser le message d'analyse s'il existe
        if (messages.length === 0 && analysisMessage) {
          if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
          }
          await analysisMessage.edit(currentContent);
          messages.push(analysisMessage);
          analysisMessage = null;
        } else if (messages.length === 0) {
          // Pas de message d'analyse, créer un nouveau message
          if (replyToMessage) {
            const message = await replyToMessage.reply(currentContent);
            messages.push(message);
          } else {
            const message = await channel.send(currentContent);
            messages.push(message);
          }
        } else {
          // Nouveau chunk nécessaire
          const message = await channel.send(currentContent);
          messages.push(message);
        }
      }

      // Mettre à jour les messages existants
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].content !== responseChunks[i]) {
          await messages[i].edit(responseChunks[i]);
        }
      }
    };

    const throttleResponseInterval = setInterval(() => throttleResponse(), 2000);

    return new ReadableStream({
      start(controller) {
        return pump();
        function pump(): any {
          return reader?.read().then(async function ({ done, value }) {
            if (done) {
              console.log(`[processLLMRequest] Request complete for user ${userId}`);

              // Afficher les stats de tokens
              if (totalTokens > 0) {
                console.log(`[Tokens] Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}`);
              }

              await wait(2000);
              // Mettre à jour le dernier message avec le contenu final
              if (messages.length > 0) {
                await messages[messages.length - 1].edit(responseChunks[responseChunks.length - 1]);
              }

              // Sauvegarder le tour de conversation dans la mémoire persistante
              const assistantText = result.trim();
              if (assistantText.length > 0) {
                await memory.appendTurn(
                  channelKey,
                  {
                    ts: Date.now(),
                    discordUid: userId,
                    displayName: userName,
                    userText: prompt,
                    assistantText,
                    ...(imageDescriptions.length > 0 ? { imageDescription: imageDescriptions.join(" | ") } : {}),
                  },
                  memoryMaxTurns,
                );
                console.log(`[Memory]: Conversation saved${imageDescriptions.length > 0 ? " with image description" : ""}`);
              }

              clearInterval(throttleResponseInterval);
              controller.close();
              return;
            }

            jsonBuffer += decoder.decode(value, { stream: true });
            const lines = jsonBuffer.split("\n");
            jsonBuffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;

              if (process.env.DEBUG_OLLAMA_RAW === "1") {
                console.log("[Ollama Raw Line]", line);
              }

              let decodedChunk: any;
              try {
                decodedChunk = JSON.parse(line);
              } catch (parseError) {
                console.error("[processLLMRequest] JSON parse error:", parseError, "Line:", line);
                continue;
              }

              // Gérer les réponses chat API (message.content) et generate API (response)
              const chunk = decodedChunk.message?.content || decodedChunk.response || "";

              // Extraire les informations de tokens si disponibles
              if (decodedChunk.prompt_eval_count) {
                promptTokens = decodedChunk.prompt_eval_count;
              }
              if (decodedChunk.eval_count) {
                completionTokens = decodedChunk.eval_count;
              }
              if (promptTokens && completionTokens) {
                totalTokens = promptTokens + completionTokens;
              }

              if (responseChunks.length === 0) {
                responseChunks.push("");
              }

              result += chunk;

              if (result.length > 1800) {
                // Finaliser le chunk actuel
                responseChunks[responseChunks.length - 1] = result;
                // Commencer un nouveau chunk
                responseChunks.push("");
                result = "";
              } else {
                // Mettre à jour le chunk actuel
                responseChunks[responseChunks.length - 1] = result;
              }
            }

            controller.enqueue(value);
            return pump();
          });
        }
      },
    });
  } catch (error) {
    console.error("[processLLMRequest] Error:", error);
    if (replyToMessage) {
      await replyToMessage.reply("An error occurred while processing your message.");
    } else {
      await channel.send("An error occurred while processing your message.");
    }
  }
}
