import { Message as DiscordMessage, TextChannel } from "discord.js";

const wait = require("node:timers/promises").setTimeout;

// Interface pour les requêtes LLM directes
interface DirectLLMRequest {
  prompt: string;
  userId: string;
  userName: string;
  channel: TextChannel;
  replyToMessage?: DiscordMessage;
}

// Fonction pour traiter une requête LLM directement (sans thread, pour le watch de channel)
export async function processLLMRequest(request: DirectLLMRequest) {
  const { prompt, userId, userName, channel, replyToMessage } = request;

  console.log(`[processLLMRequest] User ${userId} sent prompt: ${prompt}`);

  // Récupérer le prompt de personnalité depuis .env
  const systemPrompt = process.env.BOT_SYSTEM_PROMPT || "Tu es un assistant Discord.";

  // Construire le message utilisateur avec son identité
  const userMessage = `[User ID: ${userId} | Display Name: ${userName}]\n${prompt}`;

  console.log(`[System Prompt Length]: ${systemPrompt.length} chars`);

  const url = "http://localhost:11434/api/generate";

  const data = {
    model: "llama3.2-vision",
    prompt: userMessage,
    system: systemPrompt,
    stream: true,
  };

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
              await wait(2000);
              // Mettre à jour le dernier message avec le contenu final
              if (messages.length > 0) {
                await messages[messages.length - 1].edit(responseChunks[responseChunks.length - 1]);
              }
              clearInterval(throttleResponseInterval);
              controller.close();
              return;
            }

            const chunk = JSON.parse(decoder.decode(value)).response;

            if (responseChunks.length === 0) {
              responseChunks.push(result);
            }

            if (result.length + chunk.length > 1800) {
              responseChunks.push(chunk);
              result = "";
            } else {
              responseChunks[responseChunks.length - 1] = responseChunks[responseChunks.length - 1].concat(chunk);
              result += chunk;
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
