import { Client, Events, Message, ChannelType } from "discord.js";
import { setBotPresence } from "./bot";

const CITATIONS_THREAD_ID = process.env.CITATIONS_THREAD_ID;

async function getReactionEmoji(citation: string): Promise<string> {
  const systemPrompt = process.env.BOT_SYSTEM_PROMPT || "Tu es un assistant Discord.";
  const prompt = `[Contexte: Thread Citations - Citations drôles hors contexte]
[Format des citations: "Citation\n\n-Personne, Date, Contexte (facultatif)"]
[TÂCHE: Choisis UN SEUL emoji qui représente ton amusement face à cette citation. Réponds UNIQUEMENT avec l'emoji, rien d'autre.]

${citation}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_TEXT_MODEL || "llama3.2-vision",
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false,
      }),
    });

    const data = await response.json();
    const emojiMatch = data.response?.match(/[\p{Emoji}]/u);
    return emojiMatch ? emojiMatch[0] : "😄";
  } catch (error) {
    console.error("[CitationsThread] Erreur lors de la génération de l'emoji:", error);
    return "😄";
  }
}

export function registerCitationsThreadHandler(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // Ignorer les messages du bot lui-même
      if (message.author.bot) return;

      // Vérifier si on est dans le bon thread
      if (!CITATIONS_THREAD_ID || message.channelId !== CITATIONS_THREAD_ID) {
        return;
      }

      // Vérifier que c'est bien un thread
      if (!message.channel.isThread()) {
        return;
      }

      //Se met en Ne pas déranger
      await setBotPresence(client, "dnd", "Réfléchit…");

      const threadName = message.channel.name;
      const parentChannel = message.channel.parent?.name || "Unknown";

      console.log(`[CitationsThread] Nouveau message dans "${threadName}" (${parentChannel})`);

      const userMessage = message.content || "[Image sans texte]";
      console.log(`[CitationsThread] Citation de ${message.author.username}: "${userMessage.substring(0, 50)}..."`);

      // Obtenir l'emoji de réaction
      const emoji = await getReactionEmoji(userMessage);

      // Ajouter la réaction au message
      await message.react(emoji);
      console.log(`[CitationsThread] Réaction ${emoji} ajoutée`);

      await setBotPresence(client, "online");
    } catch (error) {
      console.error("[CitationsThread] Erreur lors du traitement du message:", error);
    }
  });

  console.log(`[CitationsThread] Handler enregistré pour le thread Citations (ID: ${CITATIONS_THREAD_ID})`);
}
