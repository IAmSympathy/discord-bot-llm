import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {upscaleImage} from "../../services/imageGenerationService";
import {logBotImageUpscale} from "../../utils/discordLogger";
import {createErrorEmbed} from "../../utils/embedBuilder";
import {createLogger} from "../../utils/logger";
import {hasActiveGeneration, registerImageGeneration, unregisterImageGeneration, updateJobId} from "../../services/imageGenerationTracker";
import {formatTime} from "../../utils/timeFormat";
import {BotStatus, clearStatus, setStatus} from "../../services/statusService";
import {FileMemory} from "../../memory/fileMemory";
import {MEMORY_FILE_PATH, MEMORY_MAX_TURNS, TYPING_ANIMATION_INTERVAL} from "../../utils/constants";
import {isLowPowerMode} from "../../services/botStateService";
import {NETRICSA_USER_ID, NETRICSA_USERNAME, recordImageUpscaled} from "../../services/userStatsService";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

const logger = createLogger("UpscaleCmd");
const memory = new FileMemory(MEMORY_FILE_PATH);

// Dossier temporaire pour télécharger les images
const TEMP_DIR = path.join(process.cwd(), "temp_images");
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, {recursive: true});
}

/**
 * Télécharge une image depuis une URL
 */
async function downloadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const filepath = path.join(TEMP_DIR, `temp_${Date.now()}.png`);
        const file = fs.createWriteStream(filepath);

        const protocol = url.startsWith("https") ? https : http;

        protocol.get(url, (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve(filepath);
            });
        }).on("error", (err) => {
            fs.unlinkSync(filepath);
            reject(err);
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("upscale")
        .setDescription("Demande à Netricsa d'upscaler une image")
        .addAttachmentOption((option) =>
            option
                .setName("image")
                .setDescription("L'image à upscaler")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type d'image")
                .setRequired(true)
                .addChoices(
                    {name: "Photo", value: "general"},
                    {name: "Illustration", value: "anime"}
                )
        )
        .addIntegerOption((option) =>
            option
                .setName("multiplier")
                .setDescription("Multiplicateur d'upscaling")
                .setRequired(true)
                .addChoices(
                    {name: "x2", value: 2},
                    {name: "x3", value: 3},
                    {name: "x4", value: 4}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        let tempFilePath: string | null = null;
        let progressMessage: any = null;
        let statusId: string = "";

        try {
            // Vérifier si l'utilisateur a déjà une génération en cours
            if (hasActiveGeneration(interaction.user.id)) {
                const errorEmbed = createErrorEmbed(
                    "⏳ Génération en Cours",
                    "Tu as déjà une génération d'image en cours. Attends qu'elle soit terminée avant d'en lancer une nouvelle."
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Vérifier le mode low power
            if (isLowPowerMode()) {
                const errorEmbed = createErrorEmbed(
                    "⚡ Mode Économie d'Énergie",
                    "Netricsa est en mode économie d'énergie et ne peut pas upscaler d'images pour le moment."
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            const attachment = interaction.options.getAttachment("image", true);
            const model = (interaction.options.getString("type") as "general" | "anime") || "general";
            const scale = interaction.options.getInteger("multiplier", true);

            // Vérifier que c'est une image
            if (!attachment.contentType?.startsWith("image/")) {
                const errorEmbed = createErrorEmbed(
                    "Fichier Invalide",
                    "Le fichier doit être une image (PNG, JPG, WEBP)."
                );
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                return;
            }

            const modelName = model === "anime" ? "Illustration" : "Photo";
            logger.info(`Upscaling image for ${interaction.user.username} with model ${model}, scale: x${scale}`);

            // Définir le statut Discord (15 minutes pour l'upscaling)
            statusId = await setStatus(interaction.client, BotStatus.UPSCALING_IMAGE, 900000); // 15 minutes

            // Message de progression avec animation de points
            progressMessage = await interaction.reply({
                content: `Upscaling de l'image avec la méthode **${modelName} (x${scale})**.`
            });

            // Animation des points
            let dotCount = 1;
            const animationInterval = setInterval(async () => {
                dotCount = (dotCount % 3) + 1;
                const dots = ".".repeat(dotCount);
                await progressMessage.edit(`Upscaling de l'image avec la méthode **${modelName} (x${scale})**${dots}`).catch(() => {
                });
            }, TYPING_ANIMATION_INTERVAL);

            // Enregistrer l'upscaling dans le tracker
            registerImageGeneration(
                interaction.user.id,
                interaction.channelId,
                "upscale",
                animationInterval
            );

            // Télécharger l'image
            tempFilePath = await downloadImage(attachment.url);

            // Upscaler l'image avec le scale spécifié
            const startTime = Date.now();
            const result = await upscaleImage({
                imagePath: tempFilePath,
                scale,
                model
            });
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Mettre à jour le job_id dans le tracker pour permettre l'annulation
            if (result.jobId) {
                updateJobId(interaction.user.id, result.jobId);
            }

            // Arrêter l'animation
            clearInterval(animationInterval);

            // Désenregistrer l'upscaling du tracker
            unregisterImageGeneration(interaction.user.id);

            // Envoyer l'image upscalée
            const finalMessage = await progressMessage.edit({
                content: `Voici l'image que tu m'as demandé d'upscaler avec la méthode **${modelName} (x${scale})** :\n`,
                files: [result.attachment]
            });

            // Récupérer l'URL de l'image envoyée pour le log
            const imageUrl = finalMessage.attachments.first()?.url;

            // Logger la commande avec le log spécifique à l'upscaling
            await logBotImageUpscale(
                interaction.user.username,
                "Real-ESRGAN",
                scale,
                formatTime(parseFloat(processingTime)),
                imageUrl
            );

            // Enregistrer dans les statistiques utilisateur
            recordImageUpscaled(interaction.user.id, interaction.user.username);
            // Enregistrer aussi pour Netricsa elle-même
            recordImageUpscaled(NETRICSA_USER_ID, NETRICSA_USERNAME);

            // Ajouter XP avec notification de level up (message non-éphémère)
            const {addXP, XP_REWARDS} = require("../../services/xpSystem");
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.imageUpscalee,
                    interaction.channel,
                    false
                );
            }

            // Ajouter à la mémoire une version simplifiée (pas besoin des détails techniques)
            await memory.appendTurn({
                ts: Date.now(),
                discordUid: interaction.user.id,
                displayName: interaction.user.username,
                userText: `/upscale`,
                assistantText: `J'ai upscalé une image`,
                channelId: interaction.channelId,
                channelName: interaction.channel?.isDMBased() ? "DM" : (interaction.channel as any)?.name || "unknown"
            }, MEMORY_MAX_TURNS);

            // Nettoyer le fichier temporaire
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            // Réinitialiser le statut Discord tout à la fin
            await clearStatus(interaction.client, statusId);

        } catch (error) {
            logger.error("Error upscaling image:", error);

            // Désenregistrer l'upscaling en cas d'erreur
            unregisterImageGeneration(interaction.user.id);

            // Réinitialiser le statut Discord
            await clearStatus(interaction.client, statusId);

            // Nettoyer le fichier temporaire en cas d'erreur
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            // Si c'est une annulation, éditer le message pour indiquer l'annulation
            if (error instanceof Error && error.message === "CANCELLED") {
                logger.info("Upscaling cancelled by user");
                if (progressMessage) {
                    await progressMessage.edit("🛑 Upscaling annulé.").catch(() => {
                    });
                }
                return;
            }

            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
            const errorEmbed = createErrorEmbed(
                "Erreur d'Upscaling",
                `Impossible d'upscaler l'image.\n\n**Erreur:** ${errorMessage}`
            );

            // Si l'interaction a déjà été répondue, utiliser editReply, sinon reply
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        }
    },
};
