import { Client, Message, TextChannel } from "discord.js";
import { processLLMRequest } from "./queue/queue";

function isWatchedChannel(message: Message, watchedChannelId?: string) {
  return !!watchedChannelId && message.channelId === watchedChannelId;
}

export function registerWatchedChannelResponder(client: Client) {
  const watchedChannelId = process.env.WATCH_CHANNEL_ID;

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

      const userText = message.content?.trim();

      // Vérifier si le bot est mentionné OU si on est dans le channel surveillé
      const isMentioned = message.mentions.has(client.user!.id);
      const isInWatchedChannel = watchedChannelId && isWatchedChannel(message, watchedChannelId);

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

      if (message.reference?.messageId) {
        try {
          const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
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

          const refImageNotice = referencedMessage.attachments.size > 0 ? " [contient une image]" : "";
          contextPrompt = `[L'utilisateur répond au message suivant]\n${refAuthor}: ${refContent}${refImageNotice}\n\n[Réponse de l'utilisateur]\n${contextPrompt}`;
          console.log(`[watchChannel] Message references another message from ${refAuthor}`);
        } catch (error) {
          console.warn("[watchChannel] Failed to fetch referenced message:", error);
        }
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
