import {ChatInputCommandInteraction, GuildMember, InteractionContextType, Message, MessageFlags, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {processImagesWithMetadata} from "../../services/imageService";
import {recordAIConversationStats} from "../../services/statsRecorder";
import {setBotPresence} from "../../bot";
import {isLowPowerMode} from "../../services/botStateService";
import {createLowPowerEmbed, createStandbyEmbed} from "../../utils/embedBuilder";
import {isStandbyMode} from "../../services/standbyModeService";
import {TYPING_ANIMATION_INTERVAL} from "../../utils/constants";
import {OllamaService} from "../../services/ollamaService";
import {UserProfileService} from "../../services/userProfileService";
import {buildCurrentUserBlock, buildHistoryBlock, buildWebContextBlock} from "../../queue/promptBuilder";
import {getWebContext} from "../../services/searchService";
import {logBotImageAnalysis, logBotResponse} from "../../utils/discordLogger";
import {NETRICSA_USER_ID, NETRICSA_USERNAME} from "../../services/userStatsService";
import {EmojiReactionHandler} from "../../queue/emojiReactionHandler";

const logger = createLogger("AskNetricsaCmd");
const wait = require("node:timers/promises").setTimeout;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ask-netricsa")
        .setDescription("💬 Pose une question à Netricsa (Aucune mémoire entre les interactions)")
        .addStringOption((option) =>
            option
                .setName("question")
                .setDescription("Ta question pour Netricsa")
                .setRequired(true)
        )
        .addAttachmentOption((option) =>
            option
                .setName("image")
                .setDescription("Image à analyser (facultatif)")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("reply-to")
                .setDescription("ID du message auquel répondre (facultatif)")
                .setRequired(false)
        )
        // Rendre la commande visible UNIQUEMENT dans les user apps (intégrations)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async execute(interaction: ChatInputCommandInteraction) {
        // Vérifier que l'utilisateur est membre du serveur requis
        const {checkServerMembershipOrReply} = require("../../utils/serverMembershipCheck");
        if (!await checkServerMembershipOrReply(interaction)) {
            return;
        }

        // Vérifier le mode low power
        if (isLowPowerMode()) {
            const errorEmbed = createLowPowerEmbed(
                "Mode Économie d'Énergie",
                "Netricsa est en mode économie d'énergie, car l'ordinateur de son créateur priorise les performances pour d'autres tâches. La conversation intelligente et l'analyse d'images ne sont pas disponible pour le moment."
            );
            await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            return;
        }

        // Vérifier le mode standby
        if (isStandbyMode()) {
            const errorEmbed = createStandbyEmbed(
                "Mode Veille",
                "Netricsa est en mode veille, car elle ne peut se connecter à l'ordinateur de son créateur. La conversation intelligente et l'analyse d'images ne sont pas disponible pour le moment."
            );
            await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            return;
        }

        let progressMessage: Message | null = null;
        let animationInterval: NodeJS.Timeout | null = null;

        try {
            const question = interaction.options.getString("question", true);
            const imageAttachment = interaction.options.getAttachment("image", false);
            const replyToId = interaction.options.getString("reply-to", false);

            logger.info(`Processing /ask-netricsa from ${interaction.user.displayName}: ${question}${imageAttachment ? ' [with image]' : ''}${replyToId ? ' [replying to message]' : ''}`);

            // Récupérer le message référencé si un ID est fourni
            let referencedMessage: Message | null = null;
            if (replyToId && interaction.channel) {
                try {
                    referencedMessage = await interaction.channel.messages.fetch(replyToId);
                    logger.info(`Referenced message from ${referencedMessage.author.username}: ${referencedMessage.content.substring(0, 100)}...`);
                } catch (error) {
                    logger.warn(`Could not fetch message with ID ${replyToId}:`, error);
                    const errorMsg = `❌ Impossible de récupérer le message avec l'ID \`${replyToId}\`. Vérifie que l'ID est correct et que le message existe dans ce canal.`;
                    await interaction.reply({content: errorMsg, flags: MessageFlags.Ephemeral});
                    return;
                }
            }

            // Construire la liste des URLs d'images
            const imageUrls: string[] = [];
            if (imageAttachment) {
                // Vérifier que c'est bien une image
                if (imageAttachment.contentType?.startsWith('image/')) {
                    imageUrls.push(imageAttachment.url);
                    logger.info(`Image attachment added: ${imageAttachment.url}`);
                } else {
                    logger.warn(`Invalid attachment type provided: ${imageAttachment.contentType}`);
                    await interaction.reply({
                        content: `❌ Le fichier fourni n'est pas une image valide. Types acceptés : PNG, JPG, JPEG, GIF, WEBP.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }

            // Collecter les images du message référencé s'il y en a
            if (referencedMessage) {
                // Ajouter les attachments (images uploadées)
                referencedMessage.attachments.forEach(attachment => {
                    if (attachment.contentType?.startsWith('image/')) {
                        imageUrls.push(attachment.url);
                        logger.info(`Added image from referenced message: ${attachment.url}`);
                    }
                });

                // Ajouter les embeds avec images
                referencedMessage.embeds.forEach(embed => {
                    if (embed.image?.url) {
                        imageUrls.push(embed.image.url);
                        logger.info(`Added embed image from referenced message: ${embed.image.url}`);
                    }
                    if (embed.thumbnail?.url) {
                        imageUrls.push(embed.thumbnail.url);
                        logger.info(`Added embed thumbnail from referenced message: ${embed.thumbnail.url}`);
                    }
                });
            }

            // Mettre à jour les rôles Discord de l'utilisateur dans son profil (si disponible)
            if (interaction.member && interaction.member instanceof GuildMember) {
                const userRoles = interaction.member.roles.cache
                    .filter((role: any) => role.name !== "@everyone")
                    .map((role: any) => role.name);

                if (userRoles.length > 0) {
                    await UserProfileService.updateRoles(
                        interaction.user.id,
                        interaction.user.displayName,
                        userRoles
                    );
                }
            }

            // Créer l'animation EXACTEMENT comme /imagine
            const hasImages = imageUrls.length > 0;
            const animationText = hasImages ? "Analyse de l'image" : "Netricsa réfléchit";

            progressMessage = await interaction.reply({
                content: `\`${animationText}.\``,
                fetchReply: true
            }) as Message;

            // Animation des points
            let dotCount = 1;
            animationInterval = setInterval(async () => {
                if (progressMessage) {
                    dotCount = (dotCount % 3) + 1;
                    const dots = ".".repeat(dotCount);
                    await progressMessage.edit(`\`${animationText}${dots}\``).catch(() => {
                    });
                }
            }, TYPING_ANIMATION_INTERVAL);

            // === TRAITEMENT DES IMAGES ===
            let imageDescriptions: string[] = [];
            if (hasImages) {
                try {
                    logger.info(`Analyzing ${imageUrls.length} image(s)...`);
                    const imageResults = await processImagesWithMetadata(imageUrls);
                    imageDescriptions = imageResults.map(r => r.description);

                    if (imageResults.length > 0) {
                        await logBotImageAnalysis(interaction.user.displayName, imageResults);
                    }
                    logger.info(`Image analysis complete`);
                } catch (imageError) {
                    logger.error("Error during image analysis:", imageError);
                    imageDescriptions = imageUrls.map((url, index) => `[Image ${index + 1} - erreur lors de l'analyse]`);
                }
            }

            // === PRÉPARATION DU PROMPT ===
            const ollamaService = new OllamaService();
            const isDM = interaction.channel?.type === 1; // Type 1 = DM
            const {finalPrompt: systemPrompt} = ollamaService.loadSystemPrompts(interaction.channelId || "", isDM);

            // Pas de mémoire pour ask-netricsa
            const recentTurns: any[] = [];

            // Obtenir le contexte web si nécessaire
            const webContext = await getWebContext(question);
            if (webContext) {
                logger.info(`Web context added to prompt`);
            }

            // Récupérer le profil de l'utilisateur
            const userProfileSummary = UserProfileService.getProfileSummary(interaction.user.id);
            let userProfileBlock = "";
            if (userProfileSummary) {
                userProfileBlock = `\n\n═══ PROFIL DE L'UTILISATEUR ACTUEL: ${interaction.user.displayName.toUpperCase()} (UID Discord: ${interaction.user.id}) ═══\n⚠️ Ce profil appartient à la personne qui t'envoie le message actuel.\n${userProfileSummary}\n═══ FIN DU PROFIL DE ${interaction.user.displayName.toUpperCase()} ═══`;
                logger.info(`Profile loaded for ${interaction.user.displayName}`);
            }

            // Construire les blocs de prompt
            const historyBlock = buildHistoryBlock(recentTurns, interaction.channelId || "");
            const webBlock = buildWebContextBlock(webContext);
            const currentUserBlock = buildCurrentUserBlock(
                interaction.user.id,
                interaction.user.displayName,
                question,
                imageDescriptions,
                recentTurns
            );

            const messages = [
                {
                    role: "system" as const,
                    content: `${systemPrompt}${userProfileBlock}\n\n${webBlock}${historyBlock.length > 0 ? `\n\n${historyBlock}` : ""}`,
                },
                {
                    role: "user" as const,
                    content: currentUserBlock,
                },
            ];

            // === GÉNÉRATION DE LA RÉPONSE ===
            logger.info(`Sending request to Ollama...`);
            const response = await ollamaService.chat(messages, {}, true, undefined);
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let result = "";

            const emojiHandler = new EmojiReactionHandler(undefined);

            // Lire le stream
            let done = false;
            while (!done) {
                const {value, done: doneReading} = await reader!.read();
                done = doneReading;

                if (value) {
                    const chunk = decoder.decode(value, {stream: true});
                    const lines = chunk.split("\n");

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        try {
                            const decodedChunk = JSON.parse(line);
                            const text = decodedChunk.message?.content || decodedChunk.message?.delta || "";
                            result += text;
                        } catch (parseError) {
                            // Ignorer les erreurs de parsing
                        }
                    }
                }
            }

            // Arrêter l'animation
            if (animationInterval) {
                clearInterval(animationInterval);
                animationInterval = null;
            }

            await wait(500);

            // Nettoyer le résultat
            const cleanedText = await emojiHandler.extractAndApply(result);

            // Éditer le message avec la réponse finale
            if (progressMessage) {
                await progressMessage.edit({content: cleanedText});
            }

            // Logger la réponse
            const channelName = isDM ? `DM avec ${interaction.user.displayName}` : `ask-netricsa`;
            await logBotResponse(
                interaction.user.displayName,
                interaction.user.id,
                channelName,
                question,
                cleanedText,
                0, // tokens (non disponible ici)
                hasImages,
                webContext !== null,
                undefined,
                Date.now(),
                false // pas de mémoire
            );

            // Enregistrer les statistiques
            recordAIConversationStats(interaction.user.id, interaction.user.displayName);
            recordAIConversationStats(NETRICSA_USER_ID, NETRICSA_USERNAME);

            // Tracker la conversation IA pour l'imposteur
            const {trackImpostorAIConversation} = require("../../services/events/impostorMissionTracker");
            await trackImpostorAIConversation(interaction.client, interaction.user.id);

            // Vérifier les achievements Netricsa
            const {checkNetricsaAchievements} = require("../../services/netricsaAchievementChecker");
            await checkNetricsaAchievements(
                interaction.user.id,
                interaction.user.username,
                interaction.client,
                interaction.channelId || ""
            );

            // Ajouter XP
            const {addXP, XP_REWARDS} = require("../../services/xpSystem");
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.displayName,
                    XP_REWARDS.conversationIA,
                    interaction.channel,
                    false
                );
            }

            // Chance d'obtenir un objet saisonnier (3% - commande Netricsa)
            const {tryRewardAndNotify} = require("../../services/rewardNotifier");
            await tryRewardAndNotify(interaction, interaction.user.id, interaction.user.displayName, "netricsa_command");

            await setBotPresence(interaction.client, "online");

            logger.info("✅ /ask-netricsa completed successfully");

        } catch (error) {
            logger.error("Error in /ask-netricsa command:", error);

            // Arrêter l'animation en cas d'erreur
            if (animationInterval) {
                clearInterval(animationInterval);
            }

            try {
                const errorMessage = "Une erreur s'est produite lors du traitement de ta question. Réessaye plus tard !";

                if (progressMessage) {
                    await progressMessage.edit({content: errorMessage});
                } else if (interaction.deferred) {
                    await interaction.editReply({content: errorMessage});
                } else if (!interaction.replied) {
                    await interaction.reply({content: errorMessage, flags: MessageFlags.Ephemeral});
                }
            } catch (replyError) {
                logger.error("Failed to send error message:", replyError);
            }
        }
    },
};








