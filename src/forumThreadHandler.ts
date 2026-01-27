import {ChannelType, Client, Events, ThreadChannel} from "discord.js";
import {processLLMRequest} from "./queue/queue";
import {collectAllMediaUrls} from "./services/gifService";

const FORUM_CHANNEL_ID = process.env.FORUM_CHANNEL_ID;

export function registerForumThreadHandler(client: Client) {
    client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
        try {
            // Vérifier si le thread est dans un forum channel
            if (!thread.parent || thread.parent.type !== ChannelType.GuildForum) {
                return;
            }

            // Vérifier si c'est le bon forum channel
            if (!FORUM_CHANNEL_ID || thread.parent.id !== FORUM_CHANNEL_ID) {
                return;
            }

            const forumName = thread.parent.name;
            const postName = thread.name;
            console.log(`[ForumThread] Nouveau post détecté dans "${forumName}": ${postName}`);

            // Attendre un peu pour que le message soit disponible
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Récupérer les messages du thread (le premier sera le message initial)
            const messages = await thread.messages.fetch({limit: 1});
            const starterMessage = messages.first();

            if (!starterMessage) {
                console.log(`[ForumThread] Aucun message de démarrage trouvé pour ${thread.name}`);
                return;
            }

            // Extraire les médias (images et GIFs) du message initial
            const images = await collectAllMediaUrls(starterMessage);

            const userMessage = starterMessage.content || "[Image sans texte]";
            const userId = starterMessage.author.id;
            const username = starterMessage.author.username;

            // Ajouter le contexte du forum et du post dans le prompt
            const contextPrompt = `[Contexte: Forum "${forumName}", Post "${postName}"]
[Note: Ajoute une réaction emoji avec [REACT:emoji] pour exprimer ton opinion]
${userMessage}`;

            console.log(`[ForumThread] Analyse du post de ${username}: "${userMessage.substring(0, 50)}..."${images.length > 0 ? ` [${images.length} média(s)]` : ""}`);

            // Envoyer au LLM pour analyse
            await processLLMRequest({
                prompt: contextPrompt,
                userId,
                userName: username,
                channel: thread,
                replyToMessage: starterMessage,
                imageUrls: images,
            });

            console.log(`[ForumThread] Réponse envoyée dans le thread "${postName}"`);
        } catch (error) {
            console.error("[ForumThread] Erreur lors du traitement du nouveau thread:", error);
        }
    });

    console.log(`[ForumThread] Handler enregistré pour les nouveaux posts (ID: ${FORUM_CHANNEL_ID})`);
}
