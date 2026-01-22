import { Client, Message, TextChannel } from "discord.js";
import { processLLMRequest } from "./queue/queue";

function isWatchedChannel(message: Message, watchedChannelId?: string) {
  return !!watchedChannelId && message.channelId === watchedChannelId;
}

export function registerWatchedChannelResponder(client: Client) {
  const watchedChannelId = process.env.WATCH_CHANNEL_ID;

  if (!watchedChannelId) {
    console.log("[watchChannel] No WATCH_CHANNEL_ID configured, automatic message watching disabled.");
    return;
  }

  console.log(`[watchChannel] Watching channel: ${watchedChannelId}`);

  client.on("messageCreate", async (message) => {
    try {
      // Ignore bots (évite boucle infinie)
      if (message.author?.bot) return;

      // Seulement le channel configuré
      if (!isWatchedChannel(message, watchedChannelId)) return;

      // Ignorer les commandes slash-like tapées en texte
      if (message.content?.startsWith("/")) return;

      const userText = message.content?.trim();
      if (!userText) return;

      // Indique que le bot "écrit"
      await message.channel.sendTyping();

      console.log(`[watchChannel] Processing message from ${message.author.displayName}: ${userText}`);

      // Utiliser la logique LLM existante mais sans thread
      await processLLMRequest({
        prompt: userText,
        userId: message.author.id,
        userName: message.author.displayName,
        channel: message.channel as TextChannel,
        replyToMessage: message,
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
