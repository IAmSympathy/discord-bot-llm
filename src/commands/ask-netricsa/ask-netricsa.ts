import {ChatInputCommandInteraction, GuildMember, InteractionContextType, MessageFlags, SlashCommandBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {processLLMRequest} from "../../queue/queue";
import {recordAIConversationStats} from "../../services/statsRecorder";
import {setBotPresence} from "../../bot";
import {isLowPowerMode} from "../../services/botStateService";
import {createLowPowerEmbed, createStandbyEmbed} from "../../utils/embedBuilder";
import {isStandbyMode} from "../../services/standbyModeService";

const logger = createLogger("AskNetricsaCmd");

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
        const {isStandbyMode} = require('../../services/standbyModeService');
        if (isStandbyMode()) {
            const errorEmbed = createStandbyEmbed(
                "Mode Veille",
                "Netricsa est en mode veille, car elle ne peut se connecter à l'ordinateur de son créateur. La conversation intelligente et l'analyse d'images ne sont pas disponible pour le moment."
            );
            await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            return;
        }

        try {
            const question = interaction.options.getString("question", true);
            const imageAttachment = interaction.options.getAttachment("image", false);
            const replyToId = interaction.options.getString("reply-to", false);

            // Déférer la réponse car le traitement peut prendre du temps
            await interaction.deferReply();

            logger.info(`Processing /ask-netricsa from ${interaction.user.displayName}: ${question}${imageAttachment ? ' [with image]' : ''}${replyToId ? ' [replying to message]' : ''}`);

            // Récupérer le message référencé si un ID est fourni
            let referencedMessage = null;
            if (replyToId && interaction.channel) {
                try {
                    referencedMessage = await interaction.channel.messages.fetch(replyToId);
                    logger.info(`Referenced message from ${referencedMessage.author.username}: ${referencedMessage.content.substring(0, 100)}...`);
                } catch (error) {
                    logger.warn(`Could not fetch message with ID ${replyToId}:`, error);
                    await interaction.editReply({
                        content: `❌ Impossible de récupérer le message avec l'ID \`${replyToId}\`. Vérifie que l'ID est correct et que le message existe dans ce canal.`
                    });
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
                    await interaction.editReply({
                        content: `❌ Le fichier fourni n'est pas une image valide. Types acceptés : PNG, JPG, JPEG, GIF, WEBP.`
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
                    const {UserProfileService} = await import("../../services/userProfileService");
                    await UserProfileService.updateRoles(
                        interaction.user.id,
                        interaction.user.displayName,
                        userRoles
                    );
                }
            }

            // Traiter la requête LLM
            // Note: On passe l'interaction au lieu d'un message pour que le système
            // utilise followUp au lieu de reply/edit (qui ne marchent pas pour les chunks)
            await processLLMRequest({
                prompt: question,
                userId: interaction.user.id,
                userName: interaction.user.displayName,
                channel: interaction.channel as TextChannel,
                client: interaction.client,
                interaction: interaction, // Passer l'interaction pour gérer les followUp
                referencedMessage: referencedMessage || undefined, // Message référencé (si fourni)
                imageUrls: imageUrls.length > 0 ? imageUrls : undefined, // Images (si fournies)
                originalUserMessage: question,
                skipMemory: true, // Ne pas enregistrer dans la mémoire et ne pas charger l'historique
            });

            // Enregistrer la conversation IA dans les statistiques
            recordAIConversationStats(interaction.user.id, interaction.user.displayName);

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

            await setBotPresence(interaction.client, "online");

        } catch (error) {
            logger.error("Error in /ask-netricsa command:", error);

            try {
                const errorMessage = "Une erreur s'est produite lors du traitement de ta question. Réessaye plus tard !";

                if (interaction.deferred) {
                    await interaction.editReply({content: errorMessage});
                } else if (!interaction.replied) {
                    await interaction.reply({content: errorMessage, ephemeral: true});
                }
            } catch (replyError) {
                logger.error("Failed to send error message:", replyError);
            }
        }
    },
};








