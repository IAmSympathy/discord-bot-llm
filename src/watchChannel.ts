import { Client, Message, TextChannel, ChannelType } from "discord.js";
import { processLLMRequest } from "./queue/queue";
import { setBotPresence } from "./bot";
import emojiRegex from "emoji-regex";

function isWatchedChannel(message: Message, watchedChannelId?: string) {
  return !!watchedChannelId && message.channelId === watchedChannelId;
}

async function readStreamAsString(stream: ReadableStream<any>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode(); // flush
  return result;
}

export function registerWatchedChannelResponder(client: Client) {
  const watchedChannelId = process.env.WATCH_CHANNEL_ID;
  const forumChannelId = process.env.FORUM_CHANNEL_ID;

  if (watchedChannelId) {
    console.log(`[watchChannel] Watching channel: ${watchedChannelId}`);
  }

  console.log(`[watchChannel] Bot mention detection enabled in all channels`);

  client.on("messageCreate", async (message) => {
    try {
      // Ignore bots (évite boucle infinie)
      if (message.author?.bot) return;

      // Ignorer les commandes slash-like tapées en texte
      if (message.content?.startsWith("/")) return;

      // Filtrer les messages qui commencent par "!s"
      if (message.content.trim().startsWith("!s ")) {
        console.log(`Ignored message from ${message.author} because it starts with "!s"`);
        return; // Ne rien faire
      }

      //Se met en Ne pas déranger
      await setBotPresence(client, "dnd", "Réfléchit…");

      const userText = message.content?.trim();

      // Vérifier si le bot est mentionné OU si on est dans le channel surveillé
      const isMentioned = message.mentions.has(client.user!.id);
      const isInWatchedChannel = watchedChannelId && isWatchedChannel(message, watchedChannelId);

      // Réagis au message parlant de Nettie seulement si c'Est pas dans un chanel watched ou ping
      if ((message.content.toLowerCase().includes("nettie") || message.content.toLowerCase().includes("netricsa")) && !(isMentioned || isInWatchedChannel)) {
        console.log(`Message from ${message.author} talks about Nettie`);

        // Prompt pour demander au LLM un emoji unique exprimant l'émotion liée au message
        const emojiPrompt = `Donne uniquement **un seul emoji** qui exprime ton émotion par rapport ce qui est dit sur toi (Nettie/Netricsa) dans ce message :
        "${message.content}"
        Ne mets aucun texte, aucun autre emoji.`;

        try {
          // Appeler le LLM pour générer l'emoji
          const channel = message.channel as TextChannel; // Discord API compatible

          const llmStream = await processLLMRequest({
            prompt: emojiPrompt,
            userId: message.author.id,
            userName: message.author.username,
            channel: channel,
            sendMessage: false, // Pas besoin de reply
          });

          if (!llmStream) {
            console.warn("[Emoji] LLM did not return a stream, using fallback emoji 🤗");
            await message.react("🤗");
            return;
          }

          const llmResult = await readStreamAsString(llmStream);

          const regex = emojiRegex();
          const emojis = Array.from(llmResult.matchAll(regex), (m) => m[0]);

          // On suppose que `processLLMRequest` renvoie le texte final en string (adapter si tu utilises un stream)
          // Ici on prend le premier caractère Unicode comme emoji
          const generatedEmoji = emojis.length > 0 ? emojis[0] : "🤗"; // fallback si aucun emoji

          await message.react(generatedEmoji);
          console.log(`[Emoji] Reacted with: ${generatedEmoji}`);
        } catch (error) {
          console.error("[watchChannel] Failed to get emoji from LLM:", error);
          await message.react("🤗"); // Fallback
        }

        return;
      }

      if (!isMentioned && !isInWatchedChannel) return;

      // Extraire les images (attachments Discord)
      const imageUrls: string[] = [];
      for (const attachment of message.attachments.values()) {
        if (attachment.contentType?.startsWith("image/")) {
          imageUrls.push(attachment.url);
        }
      }

      // Si pas de texte ni d'image, on ignore
      if (!userText && imageUrls.length === 0) return;

      // Construire le contexte avec le message référencé si présent
      let contextPrompt = userText || "[Image envoyée sans texte]";
      let referencedMsg: Message | undefined = undefined;

      // Vérifier si on doit ajouter une réaction obligatoire (thread dans forum Création)
      let mustReact = false;

      // Si on est dans un thread et qu'il n'y a pas de référence, on référence automatiquement le message principal du thread
      let messageReferenceId = message.reference?.messageId;
      if (!messageReferenceId && message.channel.isThread()) {
        const thread = message.channel;
        // Récupérer le premier message du thread (message starter)
        try {
          const messages = await thread.messages.fetch({ limit: 1, after: "0" });
          const starterMessage = messages.first();
          if (starterMessage) {
            messageReferenceId = starterMessage.id;
            console.log(`[watchChannel] Auto-referencing thread starter message in thread "${thread.name}"`);
          }
        } catch (error) {
          console.warn("[watchChannel] Failed to fetch thread starter message:", error);
        }
      }

      if (messageReferenceId) {
        try {
          const referencedMessage = await message.channel.messages.fetch(messageReferenceId);
          referencedMsg = referencedMessage;
          const refAuthor = referencedMessage.author.bot ? "Nettie (toi)" : referencedMessage.author.displayName || referencedMessage.author.username;
          const refContent = referencedMessage.content || "[message sans texte]";

          // Extraire les images du message référencé
          for (const attachment of referencedMessage.attachments.values()) {
            if (attachment.contentType?.startsWith("image/")) {
              imageUrls.push(attachment.url);
              console.log(`[watchChannel] Found image in referenced message: ${attachment.url}`);
            }
          }

          // Vérifier si c'est le premier message d'un thread dans le forum Création
          if (message.channel.isThread() && forumChannelId) {
            const thread = message.channel;
            if (thread.parent?.type === ChannelType.GuildForum && thread.parent.id === forumChannelId) {
              // Récupérer le premier message du thread
              const messages = await thread.messages.fetch({ limit: 1, after: "0" });
              const firstMessage = messages.first();
              if (firstMessage && firstMessage.id === referencedMessage.id) {
                mustReact = true;
                console.log(`[watchChannel] Detected reply to original post in Création forum - must react`);
              }
            }
          }

          const refImageNotice = referencedMessage.attachments.size > 0 ? " [contient une image]" : "";
          contextPrompt = `[L'utilisateur répond au message suivant]\n${refAuthor}: ${refContent}${refImageNotice}\n\n[Réponse de l'utilisateur]\n${contextPrompt}`;
          console.log(`[watchChannel] Message references another message from ${refAuthor}`);
        } catch (error) {
          console.warn("[watchChannel] Failed to fetch referenced message:", error);
        }
      }

      // Ajouter l'instruction de réaction obligatoire si nécessaire
      if (mustReact) {
        contextPrompt = `[Note: Ajoute obligatoirement un emoji au début de ton message pour donner ton avis]\n${contextPrompt}`;
      }

      // Indique que le bot "écrit"
      await message.channel.sendTyping();

      const triggerReason = isMentioned ? "mentioned" : "watched channel";
      console.log(`[watchChannel] Processing message from ${message.author.displayName} (${triggerReason}): ${userText}${imageUrls.length > 0 ? ` [${imageUrls.length} image(s)]` : ""}`);

      // Utiliser la logique LLM existante mais sans thread
      await processLLMRequest({
        prompt: contextPrompt,
        userId: message.author.id,
        userName: message.author.displayName,
        channel: message.channel as TextChannel,
        replyToMessage: message,
        referencedMessage: referencedMsg,
        imageUrls,
      });

      //Se met en ligne
      await setBotPresence(client, "online");
    } catch (err) {
      console.error("[watchChannel] messageCreate error:", err);
      try {
        await message.reply({ content: "An error occurred while processing your message." });
      } catch (replyErr) {
        console.error("[watchChannel] Failed to send error message:", replyErr);
      }
    }
  });
}
