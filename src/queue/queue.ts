import { Message as DiscordMessage, TextChannel, ThreadChannel } from "discord.js";
import { FileMemory } from "../memory/fileMemory";
import emojiRegex from "emoji-regex";
import fs from "fs";

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
  sendMessage?: boolean;
}

function extractValidEmojis(str: string): string[] {
  const regex = emojiRegex();
  return Array.from(str.matchAll(regex), (m) => m[0]);
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
  const visionModelName = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:7b";

  // Récupérer le prompt de vision
  const visionPromptPath = process.env.SYSTEM_PROMPT_VISION_PATH;

  if (!visionPromptPath) {
    throw new Error("SYSTEM_PROMPT_VISION_PATH n'est pas défini dans le .env");
  }
  const visionSystemPrompt = fs.readFileSync(visionPromptPath, "utf8");

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
          temperature: 0.2,
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
  url.searchParams.set("country", "CA");
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
  const { prompt, userId, userName, channel, replyToMessage, referencedMessage, imageUrls, sendMessage = true } = request;

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
        analysisMessage = await replyToMessage.reply("Analyse de l'image.");
      } else {
        analysisMessage = await channel.send("Analyse de l'image.");
      }

      // Animer les points
      let dotCount = 1;
      analysisInterval = setInterval(async () => {
        if (analysisMessage) {
          dotCount = (dotCount % 3) + 1;
          const dots = ".".repeat(dotCount);
          await analysisMessage.edit(`Analyse de l'image${dots}`).catch(() => {});
        }
      }, 1500);
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

    // Récupérer le prompt de personnalité
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
        ID du salon actuel: ${channel.id}
        === ONTEXTE ACTUEL ===`;
    const finalSystemPrompt = `${serverPrompt}\n\n${systemPrompt}`;

    // Récupérer l'historique des conversations précédentes
    const recentTurns = await memory.getRecentTurns(channelKey, memoryMaxTurns);

    // Les descriptions d'images historiques sont déjà dans recentTurns via imageDescription

    // Construire le contexte avec l'historique - format très clair pour éviter la confusion
    const historyBlock =
      recentTurns.length === 0
        ? ""
        : recentTurns
            .map((t) => {
              const imageContext = t.imageDescriptions?.length ? `\n[Images décrites]:\n- ${t.imageDescriptions.join("\n- ")}` : "";
              const webContextBlock = t.webContext ? `\n[Contexte factuel précédemment vérifié : ${t.webContext.facts.join(" | ")}]` : "";
              const reactionContext = t.assistantReactions?.length ? `\n[Réactions appliquées par toi (Netricsa)]: ${t.assistantReactions.join(" ")}` : "";
              const date = new Date(t.ts);

              return `UTILISATEUR (UID: ${t.discordUid}, Nom: ${t.displayName}):
              [Timestamp Unix: ${t.ts}]
              [Date ISO: ${date.toISOString()}]
              [Date locale fr-CA: ${date.toLocaleDateString("fr-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}]
              [Heure locale fr-CA: ${date.toLocaleTimeString("fr-CA", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}]
              Message:
              ${t.userText}${imageContext}

              TOI (Netricsa):
              ${t.assistantText}${reactionContext}`;
            })
            .join("\n\n--- Échange suivant ---\n\n");

    // Ajouter les descriptions d'images actuelles au message utilisateur
    const imageContext = imageDescriptions.length > 0 ? `\n[Images fournies par l'utilisateur, description générée automatiquement par Netricsa]:\n- ${imageDescriptions.join("\n- ")}` : "";
    const currentTs = Date.now();
    const currentDate = new Date(currentTs);
    const currentUserBlock = `
      UTILISATEUR (UID Discord: ${userId}, Nom: ${userName}):

      [Timestamp du message actuel: ${currentTs}]
      [Date ISO: ${currentDate.toISOString()}]
      [Date locale fr-CA: ${currentDate.toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}]
      [Heure locale fr-CA: ${currentDate.toLocaleTimeString("fr-CA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}]

    Message:
    ${prompt}

    [RAPPEL: Pour mentionner cet utilisateur, utilise exactement: <@${userId}>]
`;

    //==========================//
    //     RECHERCHE WEB        //
    //==========================//

    //détecte s'il faut chercher sur le web
    function detectSearchIntent(prompt: string): boolean {
      //Élimine le question comme "C'est quoi React", le LLM le sait déjà.
      if (prompt.length < 15) return false;

      const p = prompt.toLowerCase();

      // Questions factuelles explicites
      if (/(source|sources|lien|liens|référence|références|documentation|wiki|wikipédia)/i.test(p)) {
        return true;
      }

      // Actualité / temps réel
      if (/(actualité|news|aujourd'hui|cette semaine|récemment|dernier|dernière|mise à jour)/i.test(p)) {
        return true;
      }

      // Prix / comparaisons
      if (/(prix|coût|combien|review|avis|comparatif|vs)/i.test(p)) {
        return true;
      }

      // Faits datés / évolutifs
      if (/(version|sorti|date|quand|maintenant|actuel|au canada|en france|au québec|au quebec)/i.test(p)) {
        return true;
      }

      return false;
    }

    function normalizeSearchQuery(prompt: string): string {
      // Supprime les mots inutiles et ponctuations pour la recherche
      let query = prompt.toLowerCase();

      // Retirer les phrases superflues (ex: "C'est combien", "Est-ce que")
      query = query.replace(/c'est combien|est-ce que|dis moi|svp|c'est quoi|s'il te plaît/gi, "");

      // Retirer ponctuation inutile
      query = query.replace(/[?!.]/g, "");

      // Optionnel : capitaliser les mots clés
      query = query
        .split(" ")
        .map((w) => w.trim())
        .filter(Boolean)
        .join(" ");

      return query;
    }

    const shouldSearch = !!process.env.BRAVE_SEARCH_API_KEY && detectSearchIntent(prompt);
    const webResults = shouldSearch ? await searchBrave(prompt) : null;
    //
    let webContext: { query: string; facts: string[] } | null = null;

    if (webResults) {
      const facts = webResults
        .split("\n")
        .slice(0, 3)
        .map((l) => l.replace(/^\d+\.\s*/, "").slice(0, 200));

      webContext = {
        query: normalizeSearchQuery(prompt),
        facts,
      };
    }
    //
    if (webContext) {
      console.log("[BraveSearch] Web context added to prompt");
    }
    const webBlock = webContext
      ? `=== CONTEXTE FACTUEL ===
      Requête utilisée: ${webContext.query}
      Faits vérifiés:
      - ${webContext.facts.join("\n- ")}
      === FIN CONTEXTE FACTUEL ===

      `
      : "";

    // Assembler le prompt final avec un préambule explicatif
    const messages = [
      {
        role: "system",
        content: `
      ${finalSystemPrompt}

      ${webBlock || ""}
      ${historyBlock.length > 0 ? `=== HISTORIQUE ===\n\n${historyBlock}\n\n=== FIN HISTORIQUE ===` : ""}
      `,
      },
      {
        role: "user",
        content: currentUserBlock + imageContext,
      },
    ];

    console.log(`[System Prompt Length]: ${systemPrompt.length} chars`);
    console.log(`[Memory]: ${recentTurns.length} turns loaded`);
    if (imageDescriptions.length > 0) {
      console.log(`[Images]: ${imageDescriptions.length} image description(s) included in context`);
    }

    // Toujours utiliser le modèle texte avec l'API chatr
    const url = "http://localhost:11434/api/chat";
    const textModelName = process.env.OLLAMA_TEXT_MODEL || "llama3.2";
    const modelName = textModelName;

    const options = {
      temperature: 1.0,
      repeat_penalty: 1.1,
      num_predict: 600,
    };

    const data = {
      model: textModelName,
      messages: messages, // le tableau qu'on vient de créer
      stream: true, // ou false si tu veux réponse complète
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

      // Buffer pour gérer les chunks JSON partiels (NDJSON)
      let jsonBuffer = "";

      // Variables pour compter les tokens
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;

      const extractAndApplyReaction = async (text: string): Promise<{ modifiedText: string; reactions: string[] }> => {
        let modifiedText = text;

        if (replyToMessage) {
          // Cherche tous les emojis dans le texte complet
          const emojis = Array.from(new Set(extractValidEmojis(modifiedText))); // unique
          for (const emoji of emojis) {
            try {
              await replyToMessage.react(emoji);
              console.log(`[Reaction] Applied ${emoji} to user message`);
            } catch (error) {
              console.warn(`[Reaction] Failed to apply ${emoji}:`, error);
            }
          }

          // TOUJOURS retirer tous les emojis du texte avant affichage
          // Retirer les emojis Unicode
          modifiedText = modifiedText.replace(emojiRegex(), "");
          // Retirer les emojis Discord custom au format <:nom:id> et <a:nom:id>
          modifiedText = modifiedText.replace(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g, "");
          // Retirer les emojis Discord simples au format <:emoji:> (sans ID)
          modifiedText = modifiedText.replace(/<:([a-zA-Z0-9_]+):>/g, "");
          // Retirer les emojis Discord au format :emoji:
          modifiedText = modifiedText.replace(/:[a-zA-Z0-9_]+:/g, "");
          // Ne PAS modifier les espaces/sauts de ligne pour préserver le formatage Markdown
          return { modifiedText, reactions: emojis };
        }

        return { modifiedText, reactions: [] };
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

      const fixChannelMentions = (text: string) => {
        // Convertir les IDs de channel en format Discord correct
        // Cherche les patterns comme "channel 123456789" ou "salon 123456789" ou juste un ID seul de 17-19 chiffres
        return (
          text
            // Pattern: "ID du salon actuel: 123456" -> "ID du salon actuel: <#123456>"
            .replace(/(?:ID du salon|salon|channel|canal)\s*:?\s*(\d{17,19})\b/gi, (match, id) => match.replace(id, `<#${id}>`))
            // Pattern: ID Discord seul (17-19 chiffres) qui n'est pas déjà dans <#> et pas dans une URL
            .replace(/(?<!<#)(?<![\w/=])(\d{17,19})(?!>)(?![\w/=])/g, "<#$1>")
        );
      };

      // Throttle pour ne pas dépasser les limites Discord
      const throttleResponse = async () => {
        if (!sendMessage) return;

        // Créer le premier message si nécessaire
        if (messages.length === 0) {
          const rawContent = responseChunks[0];
          if (!rawContent || rawContent.trim().length === 0) {
            return; // Ne pas envoyer de message vide
          }
          const currentContent = fixChannelMentions(wrapLinksNoEmbed(decodeHtmlEntities(rawContent)));

          // Arrêter l'animation et utiliser le message d'analyse s'il existe
          if (analysisMessage) {
            if (analysisInterval) {
              clearInterval(analysisInterval);
              analysisInterval = null;
            }
            await analysisMessage.edit(currentContent);
            messages.push(analysisMessage);
            analysisMessage = null;
          } else {
            // Pas de message d'analyse, créer un nouveau message
            if (replyToMessage) {
              const message = await replyToMessage.reply({ content: currentContent, allowedMentions: { repliedUser: true } });
              messages.push(message);
            } else {
              const message = await channel.send(currentContent);
              messages.push(message);
            }
          }
          return;
        }

        // Créer des nouveaux messages pour les chunks supplémentaires
        while (messages.length < responseChunks.length) {
          const chunkIndex = messages.length;
          const rawContent = responseChunks[chunkIndex];
          if (!rawContent || rawContent.trim().length === 0) {
            break;
          }
          const currentContent = fixChannelMentions(wrapLinksNoEmbed(decodeHtmlEntities(rawContent)));
          const message = await channel.send(currentContent);
          messages.push(message);
        }

        // Mettre à jour les messages existants
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          if (!message) continue;
          const rawChunk = responseChunks[i];
          if (!rawChunk) continue;
          const nextContent = fixChannelMentions(wrapLinksNoEmbed(decodeHtmlEntities(rawChunk)));
          if (message.content !== nextContent) {
            await message.edit(nextContent);
          }
        }
      };

      const throttleResponseInterval = setInterval(() => throttleResponse(), 1500);

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
                  const finalContent = fixChannelMentions(wrapLinksNoEmbed(decodeHtmlEntities(responseChunks[responseChunks.length - 1])));
                  await messages[messages.length - 1].edit(finalContent);
                }

                // Sauvegarder le tour de conversation dans la mémoire persistante
                // Ne pas trim pour préserver les sauts de ligne, juste retirer les espaces aux extrémités de chaque ligne
                const assistantText = result
                  .split("\n")
                  .map((line) => line.trimEnd())
                  .join("\n")
                  .replace(/^\s+|\s+$/g, "");

                // Ne pas sauvegarder si la réponse est un refus de modération
                // Détection améliorée des réponses de refus du bot
                const isModerationRefusal = assistantText.toLowerCase().includes("je suis désolée") || assistantText.toLowerCase().includes("je ne peux pas répondre") || assistantText.toLowerCase().includes("je ne répondrai pas");

                const { modifiedText: assistantTextFinal, reactions: appliedReactions } = await extractAndApplyReaction(result);

                if (sendMessage && assistantTextFinal.length > 0 && !isModerationRefusal) {
                  await memory.appendTurn(
                    channelKey,
                    {
                      ts: Date.now(),
                      discordUid: userId,
                      displayName: userName,
                      userText: prompt,
                      assistantText: assistantTextFinal,
                      ...(imageDescriptions.length > 0 ? { imageDescriptions: imageDescriptions.slice(0, 5) } : {}),
                      ...(webContext ? { webContext } : {}),
                      ...(appliedReactions.length > 0 ? { assistantReactions: appliedReactions } : {}),
                    },
                    memoryMaxTurns,
                  );
                  console.log(`[Memory]: Conversation saved${imageDescriptions.length > 0 ? " with image description" : ""}${appliedReactions.length > 0 ? " and reactions" : ""}`);
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

                // Gérer les réponses chat API (message.content) et chat API (response)
                const chunk = decodedChunk.message?.delta || decodedChunk.message?.content || "";

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
                const { modifiedText, reactions } = await extractAndApplyReaction(result);
                result = modifiedText;

                if (result.length > 1900) {
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
