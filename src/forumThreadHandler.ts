import {ChannelType, Client, Events, ThreadChannel} from "discord.js";
import {cleanupImageAnalysis, processLLMRequest, registerImageAnalysis} from "./queue/queue";
import {collectAllMediaUrls} from "./services/gifService";
import {processImagesWithMetadata} from "./services/imageService";
import {ImageAnalysisAnimation} from "./queue/discordMessageManager";
import {logBotImageAnalysis} from "./utils/discordLogger";
import {isLowPowerMode} from "./services/botStateService";
import {EnvConfig} from "./utils/envConfig";
import {createLogger} from "./utils/logger";

const logger = createLogger("ForumThread");
const CREATION_FORUM_ID = EnvConfig.CREATION_FORUM_ID;

export function registerForumThreadHandler(client: Client) {
    client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
        try {
            // Vérifier si le thread est dans un forum channel
            if (!thread.parent || thread.parent.type !== ChannelType.GuildForum) {
                return;
            }

            // Vérifier si c'est le bon forum channel (salon création uniquement)
            if (!CREATION_FORUM_ID || thread.parent.id !== CREATION_FORUM_ID) {
                logger.info(`Post dans "${thread.parent.name}" ignoré (pas le salon création)`);
                return;
            }

            const forumName = thread.parent.name;
            const postName = thread.name;
            logger.info(`Nouveau post détecté dans "${forumName}": ${postName}`);

            // Vérifier si en Low Power Mode
            if (isLowPowerMode()) {
                logger.info("Low Power Mode - doing nothing in creation forum");
                return;
            }

            // Attendre 5 secondes pour que Discord charge complètement le message et ses attachments
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Récupérer les messages du thread (le premier sera le message initial)
            const messages = await thread.messages.fetch({limit: 1});
            const starterMessage = messages.first();

            if (!starterMessage) {
                logger.warn(`Aucun message de démarrage trouvé pour ${thread.name}`);
                return;
            }

            const userMessage = starterMessage.content || "[Image sans texte]";
            const userId = starterMessage.author.id;
            const username = starterMessage.author.username;

            // Vérifier rapidement s'il y a des médias
            const hasAttachments = starterMessage.attachments.size > 0;
            const messageContent = starterMessage.content || '';
            const hasTenorUrl = messageContent.includes('tenor.com');
            const hasDirectMediaUrl = /https?:\/\/[^\s]+\.(?:gif|png|jpg|jpeg|webp)(?:\?[^\s]*)?/i.test(messageContent);
            const hasMedia = hasAttachments || hasTenorUrl || hasDirectMediaUrl;

            // Démarrer l'animation IMMÉDIATEMENT si des médias sont détectés
            const analysisAnimation = new ImageAnalysisAnimation();
            let animationStarted = false;

            if (hasMedia) {
                logger.info(`${starterMessage.attachments.size} média(s) détecté(s), démarrage de l'animation...`);
                try {
                    await analysisAnimation.start(starterMessage, thread);
                    animationStarted = true;
                    // Enregistrer l'animation pour permettre son arrêt via /stop
                    registerImageAnalysis(thread.id, analysisAnimation, starterMessage.author.id);
                } catch (error) {
                    logger.error(`Erreur lors de l'envoi du message d'animation:`, error);
                }
            }

            // Collecter les médias (peut prendre du temps avec Tenor)
            const imageUrls = await collectAllMediaUrls(starterMessage);

            // Analyser les images avec un contexte spécial pour les créations artistiques
            let imageDescriptions: string[] = [];
            let imageResults: any[] = [];

            if (imageUrls.length > 0) {
                logger.info(`Analysing ${imageUrls.length} image(s) with artistic context...`);

                // Analyser les images
                imageResults = await processImagesWithMetadata(imageUrls, 'creation');
                imageDescriptions = imageResults.map(r => r.description);

                // Ne PAS arrêter l'animation ici - elle sera réutilisée par processLLMRequest
                // et stoppée automatiquement quand le streaming de la réponse commence

                // Logger l'analyse d'images
                if (imageResults.length > 0) {
                    await logBotImageAnalysis(username, imageResults);
                }

                // Nettoyer l'enregistrement de l'animation (elle sera gérée par processLLMRequest maintenant)
                cleanupImageAnalysis(thread.id);
            }

            // Ajouter le contexte du forum et du post dans le prompt avec instructions spéciales
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

            logger.info(`Analyse du post de ${username}: "${userMessage.substring(0, 50)}..."${imageUrls.length > 0 ? ` [${imageUrls.length} média(s) analysés]` : ""}`);

            // Envoyer au LLM pour analyse avec les images déjà analysées
            await processLLMRequest({
                prompt: contextPrompt,
                userId,
                userName: username,
                channel: thread,
                client: client,
                replyToMessage: starterMessage,
                imageUrls: imageUrls.length > 0 ? imageUrls : undefined, // Passer les URLs pour éviter les erreurs
                skipImageAnalysis: true, // Toujours true car on analyse avant
                preAnalyzedImages: imageResults.length > 0 ? imageResults : undefined, // Passer les résultats pré-calculés
                originalUserMessage: userMessage, // Message original pour les logs
                preStartedAnimation: animationStarted ? analysisAnimation : undefined, // Passer l'animation pour réutiliser le message
            });

            logger.info(`Réponse envoyée dans le thread "${postName}"`);
        } catch (error) {
            logger.error("Erreur lors du traitement du nouveau thread:", error);
        }
    });

    logger.info(`Handler de création enregistré pour les nouveaux posts (ID: ${CREATION_FORUM_ID})`);
}
