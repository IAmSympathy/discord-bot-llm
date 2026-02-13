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

            // Envoyer une demande de validation pour l'attribution d'XP
            const {requestCreationValidation} = require("./services/creationValidationService");
            await requestCreationValidation(client, userId, username, thread.id, thread.name);

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
                    await logBotImageAnalysis(username, imageResults, starterMessage.author.displayAvatarURL());
                }

                // Nettoyer l'enregistrement de l'animation (elle sera gérée par processLLMRequest maintenant)
                cleanupImageAnalysis(thread.id);
            }

            // Ajouter le contexte du forum et du post dans le prompt avec instructions spéciales
            let contextPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 CONTEXTE : CRÉATION ARTISTIQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Forum : "${forumName}"
📌 Post : "${postName}"

⚠️ SITUATION SPÉCIALE : Tu analyses une CRÉATION PERSONNELLE d'un membre
   → Il s'agit d'une œuvre artistique (dessin, art, vidéo, montage, etc.)
   → Le créateur attend un retour constructif et détaillé

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TON RÔLE ET TES INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TU DOIS :
   • Donner un AVIS CONSTRUCTIF et DÉTAILLÉ (minimum 3-4 phrases)
   • Identifier les POINTS FORTS (composition, couleurs, technique, originalité)
   • Suggérer des AXES D'AMÉLIORATION de manière bienveillante (si pertinent)
   • Montrer que tu as vraiment OBSERVÉ ET ANALYSÉ la création
   • Être ENCOURAGEANTE et POSITIVE tout en restant authentique

🎨 SI C'EST UNE IMAGE/ART :
   • Analyse les aspects visuels (couleurs, composition, style, ambiance, technique)
   • Commente le choix artistique, l'atmosphère créée
   • Mentionne ce qui rend cette création unique

🎬 SI C'EST UNE VIDÉO/MONTAGE :
   • Commente le rythme, l'éditing, les transitions
   • Analyse la créativité, le storytelling
   • Mentionne l'impact émotionnel ou narratif

❌ ÉVITE :
   • Les commentaires génériques ("c'est bien", "j'aime")
   • Les réponses trop courtes (minimum 3-4 phrases OBLIGATOIRES)
   • Les critiques non-constructives

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STRUCTURE DE TA RÉPONSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Première impression / Ce qui attire l'attention
2️⃣ Points forts techniques ou artistiques (détaillés)
3️⃣ Suggestion constructive (optionnelle mais bienvenue)
4️⃣ Encouragement final

💡 RAPPEL : Commence par un emoji qui reflète l'émotion que la création t'inspire

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 MESSAGE DU CRÉATEUR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

            // Si des images ont été analysées, ajouter l'analyse détaillée au contexte
            if (imageDescriptions.length > 0) {
                contextPrompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 ANALYSE DÉTAILLÉE DES VISUELS (Modèle Vision IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Cette analyse automatique te donne des détails techniques sur les visuels.
   Utilise ces informations pour enrichir ton feedback artistique.

`;
                imageDescriptions.forEach((desc, index) => {
                    contextPrompt += `📸 Image ${index + 1} :\n   ${desc}\n\n`;
                });
                contextPrompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 FIN DE L'ANALYSE AUTOMATIQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
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
