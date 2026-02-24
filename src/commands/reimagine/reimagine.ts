import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {generateImage} from "../../services/imageGenerationService";
import {createLowPowerEmbed, createStandbyEmbed, logBotImageReimagine} from "../../utils/discordLogger";
import {createErrorEmbed} from "../../utils/embedBuilder";
import {createLogger} from "../../utils/logger";
import {registerImageGeneration, unregisterImageGeneration, updateJobId} from "../../services/imageGenerationTracker";
import {formatTime} from "../../utils/timeFormat";
import {BotStatus, clearStatus, setStatus} from "../../services/statusService";
import {TYPING_ANIMATION_INTERVAL} from "../../utils/constants";
import {isLowPowerMode} from "../../services/botStateService";
import {NETRICSA_USER_ID, NETRICSA_USERNAME} from "../../services/userStatsService";
import {recordImageReimaginedStats} from "../../services/statsRecorder";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {addUserToQueue, getUserQueueOperation, isOperationAborted, isUserInQueue, registerActiveOperation, removeUserFromQueue, unregisterActiveOperation} from "../../queue/globalQueue";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

const logger = createLogger("ReimageCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reimagine")
        .setDescription("🌀 Demande à Netricsa de transformer une image")
        .addAttachmentOption((option) =>
            option
                .setName("image")
                .setDescription("Image de référence à transformer")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("prompt")
                .setDescription("Comment transformer l'image (EN ANGLAIS)")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("negative")
                .setDescription("Ce que tu NE veux PAS dans l'image (optionnel, EN ANGLAIS)")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("strength")
                .setDescription("Force de la transformation (0.1 à 0.9, par défaut 0.55)")
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Nombre de versions à générer (par défaut 3)")
                .setRequired(false)
                .addChoices(
                    {name: "1", value: 1},
                    {name: "2", value: 2},
                    {name: "3", value: 3}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // Vérifier que l'utilisateur est membre du serveur requis
        const {checkServerMembershipOrReply} = require("../../utils/serverMembershipCheck");
        if (!await checkServerMembershipOrReply(interaction)) {
            return;
        }

        // Obtenir le nom du canal pour le logging
        const channelName = getChannelNameFromInteraction(interaction);

        let tempFilePath: string | null = null;
        let progressMessage: any = null;
        let statusId: string = "";

        try {
            // Vérifier si l'utilisateur est déjà dans la queue globale
            if (isUserInQueue(interaction.user.id)) {
                const operation = getUserQueueOperation(interaction.user.id);
                const errorEmbed = createErrorEmbed(
                    "⏳ Opération en Cours",
                    `Tu as déjà une opération en cours (${operation}). Attends qu'elle soit terminée avant d'en lancer une nouvelle, ou utilise \`/stop\` pour l'annuler.`
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Vérifier le mode low power
            if (isLowPowerMode()) {
                const errorEmbed = createLowPowerEmbed(
                    "Mode Économie d'Énergie",
                    "Netricsa est en mode économie d'énergie, car l'ordinateur de son créateur priorise les performances pour d'autres tâches. La réimagination d'images n'est pas disponible pour le moment."
                );
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                return;
            }

            // Vérifier le mode standby
            const {isStandbyMode} = require('../../services/standbyModeService');
            if (isStandbyMode(interaction.client)) {
                const errorEmbed = createStandbyEmbed(
                    "Mode Veille",
                    "Netricsa est en mode veille, car elle ne peut se connecter à l'ordinateur de son créateur. La réimagination d'images n'est pas disponible pour le moment."
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                return;
            }

            const prompt = interaction.options.getString("prompt", true);
            const referenceAttachment = interaction.options.getAttachment("image", true);
            const negativePrompt = interaction.options.getString("negative") || "";
            const amount = interaction.options.getInteger("amount") || 3;
            const strengthInput = interaction.options.getString("strength");
            // Remplacer la virgule par un point pour accepter les deux formats
            const strength = strengthInput ? Math.min(Math.max(parseFloat(strengthInput.replace(",", ".")), 0.1), 0.9) : 0.55;

            const steps = 18;
            const cfgScale = 5.5;

            logger.info(`Reimagining image for ${interaction.user.username}: "${prompt.substring(0, 50)}..."`);

            // Vérifier que c'est une image
            if (!referenceAttachment.contentType?.startsWith("image/")) {
                const errorEmbed = createErrorEmbed(
                    "Fichier Invalide",
                    "L'image de référence doit être une image (PNG, JPG, WEBP)."
                );
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                return;
            }

            // Définir le statut Discord (10 minutes pour les réimaginations longues)
            statusId = await setStatus(interaction.client, BotStatus.REIMAGINING_IMAGE, 600000); // 10 minutes

            // Message de progression avec animation de points
            progressMessage = await interaction.reply({
                content: "\`Réimagination de l'image.\`"
            });

            // Animation des points (intervalle plus rapide pour meilleur feedback)
            let dotCount = 1;
            const animationInterval = setInterval(async () => {
                dotCount = (dotCount % 3) + 1;
                const dots = ".".repeat(dotCount);
                await progressMessage.edit(`\`Réimagination de l'image${dots}\``).catch(() => {
                });
            }, TYPING_ANIMATION_INTERVAL);

            // Ajouter l'utilisateur à la queue globale
            addUserToQueue(interaction.user.id, 'reimagine');

            // Créer un ID unique pour cette opération
            const operationId = `reimagine-${interaction.user.id}-${Date.now()}`;
            registerActiveOperation(operationId, 'reimagine', interaction.user.id, interaction.channelId);

            // Enregistrer la génération dans le tracker (pour l'annulation spécifique)
            registerImageGeneration(
                interaction.user.id,
                interaction.channelId,
                "imagine", // Note: on utilise "imagine" car le tracker ne supporte que "imagine" et "upscale"
                animationInterval
            );

            // Télécharger l'image de référence
            const path = require("path");
            const fs = require("fs");
            const https = require("https");
            const http = require("http");

            const TEMP_DIR = path.join(process.cwd(), "temp_images");
            if (!fs.existsSync(TEMP_DIR)) {
                fs.mkdirSync(TEMP_DIR, {recursive: true});
            }

            // Détecter l'extension en fonction du content-type
            let extension = ".png"; // Par défaut
            if (referenceAttachment.contentType?.includes("jpeg") || referenceAttachment.contentType?.includes("jpg")) {
                extension = ".jpg";
            } else if (referenceAttachment.contentType?.includes("webp")) {
                extension = ".webp";
            }
            // Pour PNG, garder .png

            tempFilePath = path.join(TEMP_DIR, `ref_${Date.now()}${extension}`);

            // Télécharger l'image de référence
            await new Promise<void>((resolve, reject) => {
                const file = fs.createWriteStream(tempFilePath);
                const protocol = referenceAttachment.url.startsWith("https") ? https : http;

                protocol.get(referenceAttachment.url, (response: any) => {
                    response.pipe(file);
                    file.on("finish", () => {
                        file.close();
                        resolve();
                    });
                }).on("error", (err: any) => {
                    try {
                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                        }
                    } catch (unlinkErr) {
                        // Ignorer les erreurs de suppression
                        logger.warn(`Could not delete file ${tempFilePath}:`, unlinkErr);
                    }
                    reject(err);
                });
            });

            // Lire les dimensions de l'image de référence pour garder le même ratio
            const sharp = require("sharp");
            const metadata = await sharp(tempFilePath).metadata();
            const originalWidth = metadata.width;
            const originalHeight = metadata.height;

            // Calculer les nouvelles dimensions en gardant le ratio et en respectant les contraintes SDXL
            // SDXL fonctionne mieux avec des multiples de 64
            let width: number, height: number;
            const aspectRatio = originalWidth / originalHeight;

            // Définir une dimension de base (1024 comme avant)
            const baseDimension = 1024;

            if (aspectRatio > 1) {
                // Image horizontale
                width = baseDimension;
                height = Math.round((baseDimension / aspectRatio) / 64) * 64; // Arrondir au multiple de 64 le plus proche
            } else if (aspectRatio < 1) {
                // Image verticale
                height = baseDimension;
                width = Math.round((baseDimension * aspectRatio) / 64) * 64; // Arrondir au multiple de 64 le plus proche
            } else {
                // Image carrée
                width = baseDimension;
                height = baseDimension;
            }

            logger.info(`Original dimensions: ${originalWidth}x${originalHeight}, Output dimensions: ${width}x${height} (ratio preserved)`);

            // Générer les images
            const startTime = Date.now();

            // Ajouter des mots-clés de qualité au prompt pour éviter les images floues
            const enhancedPrompt = `${prompt}, high quality`;

            const results = [];

            for (let i = 0; i < amount; i++) {
                // Vérifier si l'opération a été annulée
                if (isOperationAborted(operationId)) {
                    logger.info(`Reimagine cancelled by user for ${interaction.user.id}`);
                    clearInterval(animationInterval);
                    unregisterImageGeneration(interaction.user.id);
                    unregisterActiveOperation(operationId);
                    removeUserFromQueue(interaction.user.id);

                    // Nettoyer le fichier temporaire
                    if (tempFilePath && fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }

                    await progressMessage.edit("🛑 Réimagination annulée.");
                    await clearStatus(interaction.client, statusId);
                    return;
                }

                const result = await generateImage({
                    prompt: enhancedPrompt,
                    negativePrompt: negativePrompt,
                    width,
                    height,
                    steps,
                    cfgScale,
                    seed: -1, // Seed aléatoire pour chaque image
                    strength,
                    referenceImagePath: tempFilePath || undefined
                });

                // Mettre à jour le job_id dans le tracker pour permettre l'annulation
                if (result.jobId) {
                    updateJobId(interaction.user.id, result.jobId);
                }

                results.push(result);
            }

            const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Arrêter l'animation
            clearInterval(animationInterval);

            // Désenregistrer la génération du tracker et de la queue globale
            unregisterImageGeneration(interaction.user.id);
            unregisterActiveOperation(operationId);
            removeUserFromQueue(interaction.user.id);

            // Construire le Container Components v2
            const {ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags: MF} = require("discord.js");

            let textContent = `### 🌀 ${amount > 1 ? `${amount} réimaginations générées` : "Image réimaginée"}\n`;
            textContent += `**📝 Prompt :** ${prompt.length > 900 ? prompt.substring(0, 897) + "..." : prompt}`;
            if (negativePrompt) {
                textContent += `\n**🚫 Négatif :** ${negativePrompt.length > 900 ? negativePrompt.substring(0, 897) + "..." : negativePrompt}`;
            }
            textContent += `\n-# 💪 Strength : ${strength} • ⏱️ Temps : ${generationTime}s`;

            const gallery = new MediaGalleryBuilder();
            for (const r of results) {
                gallery.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${r.attachment.name}`));
            }

            const container = new ContainerBuilder()
                .setAccentColor(0x4fa0dd)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent))
                .addMediaGalleryComponents(gallery);

            const sendPayload: any = {
                content: "",
                components: [container],
                flags: MF.IsComponentsV2,
                files: results.map(r => r.attachment)
            };

            try {
                const finalMessage = await progressMessage.edit(sendPayload);
                const imageUrls = Array.from(finalMessage.attachments.values()).map((att: any) => att.url);
                await logBotImageReimagine(
                    interaction.user.username,
                    prompt,
                    formatTime(parseFloat(generationTime)),
                    imageUrls,
                    channelName,
                    interaction.user.displayAvatarURL()
                );
            } catch (editError: any) {
                logger.warn(`Cannot edit message, sending as follow-up. Error: ${editError.code}`);
                const followUpMessage = await interaction.followUp(sendPayload);
                const imageUrls = Array.from(followUpMessage.attachments.values()).map((att: any) => att.url);
                await logBotImageReimagine(
                    interaction.user.username,
                    prompt,
                    formatTime(parseFloat(generationTime)),
                    imageUrls,
                    channelName,
                    interaction.user.displayAvatarURL()
                );
            }

            // Enregistrer dans les statistiques utilisateur (UNE SEULE fois par commande, peu importe le nombre de variantes)
            recordImageReimaginedStats(interaction.user.id, interaction.user.username);
            // Enregistrer aussi pour Netricsa elle-même (une seule fois)
            recordImageReimaginedStats(NETRICSA_USER_ID, NETRICSA_USERNAME);

            // Tracker la génération d'image pour l'imposteur
            const {trackImpostorImageGeneration} = require("../../services/events/impostorMissionTracker");
            await trackImpostorImageGeneration(interaction.client, interaction.user.id);

            // Vérifier les achievements Netricsa
            const {checkNetricsaAchievements} = require("../../services/netricsaAchievementChecker");
            await checkNetricsaAchievements(
                interaction.user.id,
                interaction.user.username,
                interaction.client,
                interaction.channelId
            );

            // Ajouter XP avec notification de level up (UNE SEULE fois par commande)
            const {addXP, XP_REWARDS} = require("../../services/xpSystem");
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.imageReimaginee,
                    interaction.channel,
                    false
                );
            }

            // Chance d'obtenir un objet saisonnier (3% - commande Netricsa)
            const {tryRewardAndNotify} = require("../../services/rewardNotifier");
            await tryRewardAndNotify(interaction, interaction.user.id, interaction.user.username, "netricsa_command");

            logger.info("✅ Image reimagined successfully");

            // Nettoyer le fichier temporaire (avec retry pour éviter les erreurs EBUSY)
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                let retries = 3;
                while (retries > 0) {
                    try {
                        fs.unlinkSync(tempFilePath);
                        break;
                    } catch (err: any) {
                        if (err.code === 'EBUSY' && retries > 1) {
                            // Attendre un peu avant de réessayer
                            await new Promise(resolve => setTimeout(resolve, 100));
                            retries--;
                        } else {
                            // Si ce n'est pas EBUSY ou si on a épuisé les tentatives, logger et continuer
                            logger.warn(`Could not delete temporary file ${tempFilePath}:`, err.message);
                            break;
                        }
                    }
                }
            }

            // Réinitialiser le statut Discord tout à la fin
            await clearStatus(interaction.client, statusId);

        } catch (error) {
            logger.error("Error reimagining image:", error);

            // Désenregistrer la génération en cas d'erreur
            unregisterImageGeneration(interaction.user.id);
            removeUserFromQueue(interaction.user.id);

            // Réinitialiser le statut Discord
            await clearStatus(interaction.client, statusId);

            // Nettoyer le fichier temporaire en cas d'erreur (avec retry pour éviter les erreurs EBUSY)
            if (tempFilePath && require("fs").existsSync(tempFilePath)) {
                const fs = require("fs");
                let retries = 3;
                while (retries > 0) {
                    try {
                        fs.unlinkSync(tempFilePath);
                        break;
                    } catch (err: any) {
                        if (err.code === 'EBUSY' && retries > 1) {
                            // Attendre un peu avant de réessayer
                            await new Promise(resolve => setTimeout(resolve, 100));
                            retries--;
                        } else {
                            // Si ce n'est pas EBUSY ou si on a épuisé les tentatives, logger et continuer
                            logger.warn(`Could not delete temporary file ${tempFilePath}:`, err.message);
                            break;
                        }
                    }
                }
            }

            // Si c'est une annulation, éditer le message pour indiquer l'annulation
            if (error instanceof Error && error.message === "CANCELLED") {
                logger.info("Reimagination cancelled by user");
                if (progressMessage) {
                    try {
                        await progressMessage.edit("🛑 Réimagination annulée.");
                    } catch (editError) {
                        await interaction.followUp({content: "🛑 Réimagination annulée.", ephemeral: true});
                    }
                }
                return;
            }

            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";

            let errorTitle = "Erreur de Réimagination";
            let errorDescription = `Impossible de réimaginer l'image.\n\n**Erreur:** ${errorMessage}`;

            // Personnaliser le message selon le type d'erreur
            if (errorMessage.includes("CONNECTION_ERROR")) {
                errorTitle = "Service Indisponible";
                errorDescription = "❌ **L'API de génération d'images n'est pas accessible.**\n\n" +
                    "Le serveur est peut-être hors ligne, en maintenance, ou surchargé.\n\n" +
                    "📌 **Que faire ?**\n" +
                    "• Réessayer dans quelques instants\n" +
                    "• Vérifier si Netricsa est en mode veille (🌙)\n" +
                    "• Contacter un administrateur si le problème persiste";
            } else if (errorMessage.includes("STANDBY_MODE")) {
                errorTitle = "Mode Veille";
                errorDescription = "🌙 **Netricsa est en mode veille.**\n\n" +
                    "L'API de génération d'images n'est pas accessible pour le moment.\n\n" +
                    "Le bot vérifie régulièrement la disponibilité des services et reviendra en mode normal automatiquement.";
            }

            const errorEmbed = createErrorEmbed(errorTitle, errorDescription);

            // Si l'interaction a déjà été répondue, utiliser editReply, sinon reply
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        }
    },
};
