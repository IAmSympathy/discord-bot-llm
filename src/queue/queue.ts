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

  // Télécharger et convertir les images en base64
  let imagesBase64: string[] = [];
  if (imageUrls && imageUrls.length > 0) {
    console.log(`[processLLMRequest] Downloading ${imageUrls.length} image(s)...`);
    for (const url of imageUrls) {
      const base64 = await downloadImageAsBase64(url);
      if (base64) {
        imagesBase64.push(base64);
      }
    }
    console.log(`[processLLMRequest] Successfully downloaded ${imagesBase64.length}/${imageUrls.length} image(s)`);
  }

  // Récupérer le prompt de personnalité depuis .env
  const systemPrompt = process.env.BOT_SYSTEM_PROMPT || "Tu es un assistant Discord.";

  // Clé de mémoire unique (le bot n'écrit que dans un seul channel)
  const watchedChannelId = process.env.WATCH_CHANNEL_ID;
  const channelKey = watchedChannelId || channel.id;

  // Récupérer l'historique des conversations précédentes
  const recentTurns = await memory.getRecentTurns(channelKey, memoryMaxTurns);

  // Construire le contexte avec l'historique
  const historyBlock = recentTurns.length === 0 ? "" : recentTurns.map((t) => `[UID Discord: ${t.discordUid}] [Pseudo: ${t.displayName}]\nMessage: ${t.userText}\nAssistant: ${t.assistantText}`).join("\n\n");

  // Indiquer explicitement si des images sont présentes
  const imageNotice = imagesBase64.length > 0 ? `\n[${imagesBase64.length} image(s) fournie(s) - analyse-les dans ta réponse]` : "";
  const currentUserBlock = `[UID Discord: ${userId}]\n[Pseudo: ${userName}]\nMessage: ${prompt}${imageNotice}`;

  // Assembler le prompt final avec contexte si disponible
  const userMessage = historyBlock.length > 0 ? `Contexte (conversations précédentes dans ce channel) :\n\n${historyBlock}\n\n---\n\nMessage actuel :\n${currentUserBlock}` : currentUserBlock;

  console.log(`[System Prompt Length]: ${systemPrompt.length} chars`);
  console.log(`[Memory]: ${recentTurns.length} turns loaded`);

  const url = "http://localhost:11434/api/generate";

  const data: any = {
    model: "llama3.2-vision",
    prompt: userMessage,
    system: systemPrompt,
    stream: true,
    options: {
      temperature: 0.7,
      repeat_penalty: 1.2,
      num_predict: 1000,
    },
  };

  // Ajouter les images si disponibles
  if (imagesBase64.length > 0) {
    data.images = imagesBase64;
    console.log(`[processLLMRequest] Sending request with ${imagesBase64.length} image(s)`);
  }

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

    // Variables pour compter les tokens
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    // Throttle pour ne pas dépasser les limites Discord
    const throttleResponse = async () => {
      if (messages.length === 0 || messages.length !== responseChunks.length) {
        // Premier message ou nouveau chunk nécessaire
        if (replyToMessage && messages.length === 0) {
          // Répondre au message initial
          const message = await replyToMessage.reply(responseChunks[responseChunks.length - 1]);
          messages.push(message);
        } else {
          // Envoyer dans le channel
          const message = await channel.send(responseChunks[responseChunks.length - 1]);
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
                  },
                  memoryMaxTurns,
                );
                console.log(`[Memory]: Conversation saved`);
              }

              clearInterval(throttleResponseInterval);
              controller.close();
              return;
            }

            const decodedChunk = JSON.parse(decoder.decode(value));
            const chunk = decodedChunk.response || "";

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
