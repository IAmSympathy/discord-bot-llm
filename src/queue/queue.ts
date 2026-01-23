import { Message as DiscordMessage, TextChannel, ThreadChannel } from "discord.js";
import { FileMemory } from "../memory/fileMemory";

const wait = require("node:timers/promises").setTimeout;

// Interface pour les requêtes LLM directes
interface DirectLLMRequest {
  prompt: string;
  userId: string;
  userName: string;
  channel: TextChannel | ThreadChannel;
  replyToMessage?: DiscordMessage;
  referencedMessage?: DiscordMessage;
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
          temperature: 0.9,
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

function sanitizeSnippet(text: string, maxLength = 240): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

async function searchBrave(query: string): Promise<string | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("search_lang", "fr");
  url.searchParams.set("country", "FR");
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("text_decorations", "0");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      console.warn(`[BraveSearch] Error ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const results: Array<{ title?: string; url?: string; description?: string }> = data?.web?.results || [];
    if (!results.length) return null;

    const lines = results.slice(0, 5).map((r, i) => {
      const title = r.title ? sanitizeSnippet(r.title, 120) : "Sans titre";
      const desc = r.description ? sanitizeSnippet(r.description, 240) : "";
      const link = r.url || "";
      return `${i + 1}. ${title}${desc ? ` — ${desc}` : ""}${link ? ` (${link})` : ""}`;
    });

    const joined = lines.join("\n");
    return joined.length > 1200 ? joined.slice(0, 1199) + "…" : joined;
  } catch (error) {
    console.warn("[BraveSearch] Request failed:", error);
    return null;
  }
}

// Configuration mémoire persistante
const memoryFilePath = process.env.MEMORY_FILE || "./data/memory.json";
const memoryMaxTurns = Number(process.env.MEMORY_MAX_TURNS || "12");
const memory = new FileMemory(memoryFilePath);

// Système de queue par channel pour traiter les requêtes séquentiellement
type AsyncJob<T> = () => Promise<T>;
const channelQueues = new Map<string, Promise<unknown>>();
const activeStreams = new Map<string, { abortFlag: boolean; channelId: string }>();

function enqueuePerChannel<T>(channelKey: string, job: AsyncJob<T>): Promise<T> {
  const prev = channelQueues.get(channelKey) ?? Promise.resolve();

  const next = prev
    .catch(() => {
      // Avaler les erreurs du job précédent pour ne pas bloquer la file
    })
    .then(job);

  channelQueues.set(
    channelKey,
    next.finally(() => {
      // Nettoyage si personne n'a enchaîné après
      if (channelQueues.get(channelKey) === next) channelQueues.delete(channelKey);
    }),
  );

  return next;
}

// Fonction pour effacer la mémoire d'un channel
export async function clearMemory(channelKey: string): Promise<void> {
  await memory.clearChannel(channelKey);
  console.log(`[Memory] Channel ${channelKey} memory cleared`);
}

// Fonction pour effacer TOUTE la mémoire (tous les channels)
export async function clearAllMemory(): Promise<void> {
  await memory.clearAll();
  console.log(`[Memory] All channels memory cleared`);
}

// Fonction pour arrêter un stream en cours
export function abortStream(channelKey: string): boolean {
  const streamInfo = activeStreams.get(channelKey);
  if (streamInfo) {
    streamInfo.abortFlag = true;
    activeStreams.delete(channelKey);
    console.log(`[AbortStream] Stream aborted for channel ${channelKey}`);
    return true;
  }
  return false;
}

// Fonction pour traiter une requête LLM directement (sans thread, pour le watch de channel)
export async function processLLMRequest(request: DirectLLMRequest) {
  const { prompt, userId, userName, channel, replyToMessage, referencedMessage, imageUrls } = request;

  // Clé de mémoire unique par channel
  // Si on est dans le watched channel, utiliser son ID fixe
  // Sinon, utiliser l'ID du channel actuel (pour les mentions dans d'autres channels)
  const watchedChannelId = process.env.WATCH_CHANNEL_ID;
  const channelKey = channel.id === watchedChannelId ? watchedChannelId : channel.id;

  // Mettre en queue pour traiter séquentiellement par channel
  return enqueuePerChannel(channelKey, async () => {
    console.log(`[processLLMRequest] User ${userId} sent prompt: ${prompt}${imageUrls && imageUrls.length > 0 ? ` with ${imageUrls.length} image(s)` : ""}`);

    // Enregistrer ce stream comme actif
    const streamInfo = { abortFlag: false, channelId: channel.id };
    activeStreams.set(channelKey, streamInfo);

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
              return `UTILISATEUR (UID: ${t.discordUid}, Nom: ${t.displayName}):\n${t.userText}${imageContext}\n\nTOI (Netricsa, l'assistant):\n${t.assistantText}`;
            })
            .join("\n\n--- Échange suivant ---\n\n");

    // Ajouter les descriptions d'images actuelles au message utilisateur
    const imageContext = imageDescriptions.length > 0 ? `\n[L'utilisateur fournit une image. Description générée automatiquement: ${imageDescriptions.join(" | ")}]` : "";
    const currentUserBlock = `UTILISATEUR (UID Discord: ${userId}, Nom: ${userName}):\n${prompt}${imageContext}\n\n[RAPPEL: Pour mentionner cet utilisateur sur Discord, utilise exactement: <@${userId}>]`;

    const searchIntentRegex =
      /(cherche|recherche|rechercher|trouve|trouver|source|sources|lien|liens|actualité|news|site|web|internet|documentation|doc|wiki|wikipédia|prix|comparaison|avis|review|références|\bquand\b|\bc'?est[-\s]*quoi\b|\bqui\b|\boù\b|\bpourquoi\b|\bcombien\b|\bquel(le)?s?\b|\bqu'?est-ce que\b|\bc'?est\b)/i;
    const shouldSearch = !!process.env.BRAVE_SEARCH_API_KEY && searchIntentRegex.test(prompt || "");
    const webResults = shouldSearch ? await searchBrave(prompt) : null;
    if (webResults) {
      console.log("[BraveSearch] Web context added to prompt");
    }
    const webBlock = webResults ? `IMPORTANT: Voici du contexte provenant du web. Ne mentionne pas que ça provient du web et utilise ce contexte dans ta réponse. Prend le comme factuel.=== DÉBUT CONTEXTE WEB === (Brave Search) ===\n${webResults}\n=== FIN CONTEXTE WEB ===\n\n` : "";

    // Assembler le prompt final avec un préambule explicatif
    const contextPreamble =
      historyBlock.length > 0
        ? `IMPORTANT: Voici l'historique de la conversation. Lis attentivement QUI a dit QUOI. Ne confonds JAMAIS ce que l'utilisateur a dit avec ce que TU as dit.\n\n=== HISTORIQUE ===\n\n${historyBlock}\n\n=== FIN HISTORIQUE ===\n\n${webBlock}=== MESSAGE ACTUEL ===\n\n`
        : webBlock.length > 0
          ? `${webBlock}=== MESSAGE ACTUEL ===\n\n`
          : "";

    const userMessage = `${contextPreamble}${currentUserBlock}\n\nRéponds maintenant en tant que Netricsa:`;

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
      temperature: 0.95,
      repeat_penalty: 1.3,
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
      let reactionApplied = false;
      let reactionRefApplied = false;

      // Buffer pour gérer les chunks JSON partiels (NDJSON)
      let jsonBuffer = "";

      // Variables pour compter les tokens
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;

      const extractAndApplyReaction = async (text: string): Promise<string> => {
        let modifiedText = text;

        // Réaction au message de l'utilisateur
        const match = modifiedText.match(/\[REACT:([^\]]+)\]/);
        if (match && !reactionApplied && replyToMessage) {
          const emoji = match[1].trim();
          try {
            await replyToMessage.react(emoji);
            reactionApplied = true;
            console.log(`[Reaction] Applied ${emoji} to user message`);
          } catch (error) {
            console.warn(`[Reaction] Failed to apply ${emoji}:`, error);
          }
          modifiedText = modifiedText.replace(/\[REACT:[^\]]+\]/g, "").trim();
        }

        // Réaction au message référencé
        const matchRef = modifiedText.match(/\[REACT_REF:([^\]]+)\]/);
        if (matchRef && !reactionRefApplied && referencedMessage) {
          const emoji = matchRef[1].trim();
          try {
            await referencedMessage.react(emoji);
            reactionRefApplied = true;
            console.log(`[Reaction] Applied ${emoji} to referenced message`);
          } catch (error) {
            console.warn(`[Reaction] Failed to apply ${emoji} to referenced message:`, error);
          }
          modifiedText = modifiedText.replace(/\[REACT_REF:[^\]]+\]/g, "").trim();
        }

        return modifiedText;
      };

      const decodeHtmlEntities = (text: string) =>
        text
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
          .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

      const wrapLinksNoEmbed = (text: string) =>
        text
          // Convertir le format markdown [texte](url) en texte: <url>
          .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1: <$2>")
          // Entourer les URLs restantes de chevrons
          .replace(/(?<!<)(https?:\/\/[^\s>]+)(?!>)/g, "<$1>");

      // Throttle pour ne pas dépasser les limites Discord
      const throttleResponse = async () => {
        if (messages.length === 0 || messages.length !== responseChunks.length) {
          const rawContent = responseChunks[responseChunks.length - 1];
          if (!rawContent || rawContent.trim().length === 0) {
            return; // Ne pas envoyer de message vide
          }
          const currentContent = wrapLinksNoEmbed(decodeHtmlEntities(rawContent));

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
              const message = await replyToMessage.reply({ content: currentContent, allowedMentions: { repliedUser: true } });
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
          const message = messages[i];
          if (!message) continue;
          const rawChunk = responseChunks[i];
          if (!rawChunk) continue;
          const nextContent = wrapLinksNoEmbed(decodeHtmlEntities(rawChunk));
          if (message.content !== nextContent) {
            await message.edit(nextContent);
          }
        }
      };

      const throttleResponseInterval = setInterval(() => throttleResponse(), 2000);

      return new ReadableStream({
        start(controller) {
          return pump();
          function pump(): any {
            return reader?.read().then(async function ({ done, value }) {
              // Vérifier si le stream a été avorté
              if (streamInfo.abortFlag) {
                console.log(`[processLLMRequest] Stream aborted by user for channel ${channelKey}`);
                clearInterval(throttleResponseInterval);
                if (analysisInterval) clearInterval(analysisInterval);
                activeStreams.delete(channelKey);
                controller.close();
                return;
              }

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

                // Ne pas sauvegarder si la réponse est un refus de modération
                // Détection améliorée des réponses de refus du bot
                const isModerationRefusal =
                  (assistantText.toLowerCase().includes("je suis désolé") && assistantText.toLowerCase().includes("ne peux pas")) ||
                  (assistantText.toLowerCase().includes("i'm sorry") && assistantText.toLowerCase().includes("i cannot")) ||
                  assistantText.toLowerCase().includes("ne répondrai pas") ||
                  assistantText.toLowerCase().includes("m'abstiens") ||
                  assistantText.toLowerCase().includes("cannot respond") ||
                  assistantText.toLowerCase().includes("refuse to") ||
                  assistantText.toLowerCase().includes("inappropriate") ||
                  assistantText.toLowerCase().includes("inapproprié") ||
                  assistantText.length < 10 || // Réponses très courtes = probablement refus
                  /^(non|no|désolé|sorry)\.?$/i.test(assistantText); // Réponses ultra-courtes

                if (assistantText.length > 0 && !isModerationRefusal) {
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
                } else if (isModerationRefusal) {
                  console.log(`[Memory]: Moderation refusal detected, NOT saving to memory`);
                }

                activeStreams.delete(channelKey);
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

                // Extraire et appliquer la réaction si présente
                const cleanedResult = await extractAndApplyReaction(result);
                if (cleanedResult !== result) {
                  result = cleanedResult;
                }

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
  });
}
