import {ChannelType, Client, Events, ThreadChannel} from "discord.js";
import {processLLMRequest} from "./queue/queue";
import {collectAllMediaUrls} from "./services/gifService";
import {processImagesWithMetadata} from "./services/imageService";

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
            const imageUrls = await collectAllMediaUrls(starterMessage);

            // Analyser les images avec un contexte spécial pour les créations artistiques
            let imageDescriptions: string[] = [];
            if (imageUrls.length > 0) {
                console.log(`[ForumThread] Analysing ${imageUrls.length} image(s) with artistic context...`);
                const imageResults = await processImagesWithMetadata(imageUrls, 'creation');
                imageDescriptions = imageResults.map(r => r.description);
            }

            const userMessage = starterMessage.content || "[Image sans texte]";
            const userId = starterMessage.author.id;
            const username = starterMessage.author.username;

            // Ajouter le contexte du forum et du post dans le prompt avec instructions spéciales pour les créations
            let contextPrompt = `[Contexte: Forum "${forumName}", Post "${postName}"]

═══ INSTRUCTIONS SPÉCIALES POUR LES CRÉATIONS ═══
Tu analyses la CRÉATION D'UN MEMBRE du serveur. Il s'agit d'une œuvre personnelle (dessin, art, vidéo, montage, etc.).

⚠️ IMPORTANT - Ton rôle :
• Donne un AVIS CONSTRUCTIF et DÉTAILLÉ (minimum 3-4 phrases)
• Identifie les POINTS FORTS de la création (composition, couleurs, technique, originalité, etc.)
• Suggère des AXES D'AMÉLIORATION de manière bienveillante si pertinent
• Montre que tu as vraiment OBSERVÉ ET ANALYSÉ la création
• Sois ENCOURAGEANTE et POSITIVE tout en restant authentique
• Si c'est une image/art, analyse les aspects visuels (couleurs, composition, style, ambiance, technique)
• Si c'est une vidéo/montage, commente le rythme, l'éditing, les transitions, la créativité
• ÉVITE les commentaires génériques comme "c'est bien" ou "j'aime"

📋 Structure suggérée :
1. Première impression / ce qui attire l'attention
2. Points forts techniques ou artistiques
3. Suggestion constructive (optionnelle)
4. Encouragement final

[Note: Ajoute une réaction emoji au début de ton message pour exprimer ton opinion - choisis un emoji qui reflète l'émotion que la création t'inspire]

${userMessage}`;

            // Si des images ont été analysées, ajouter l'analyse détaillée au contexte
            if (imageDescriptions.length > 0) {
                contextPrompt += `\n\n[ANALYSE DÉTAILLÉE DES VISUELS PAR LE MODÈLE VISION]\n`;
                imageDescriptions.forEach((desc, index) => {
                    contextPrompt += `\nImage ${index + 1}: ${desc}\n`;
                });
                contextPrompt += `\n[Utilise cette analyse pour enrichir ton feedback artistique]`;
            }

            console.log(`[ForumThread] Analyse du post de ${username}: "${userMessage.substring(0, 50)}..."${imageUrls.length > 0 ? ` [${imageUrls.length} média(s) analysés]` : ""}`);

            // Envoyer au LLM pour analyse (sans imageUrls car déjà analysées et incluses dans le prompt)
            await processLLMRequest({
                prompt: contextPrompt,
                userId,
                userName: username,
                channel: thread,
                client: client,
                replyToMessage: starterMessage,
                // Ne pas passer imageUrls car elles sont déjà analysées avec le contexte 'creation'
            });

            console.log(`[ForumThread] Réponse envoyée dans le thread "${postName}"`);
        } catch (error) {
            console.error("[ForumThread] Erreur lors du traitement du nouveau thread:", error);
        }
    });

    console.log(`[ForumThread] Handler enregistré pour les nouveaux posts (ID: ${FORUM_CHANNEL_ID})`);
}
