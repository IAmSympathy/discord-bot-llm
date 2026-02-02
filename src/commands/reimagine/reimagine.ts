import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {generateImage} from "../../services/imageGenerationService";
import {logBotImageReimagine} from "../../utils/discordLogger";
import {createErrorEmbed} from "../../utils/embedBuilder";
import {createLogger} from "../../utils/logger";
import {registerImageGeneration, unregisterImageGeneration, updateJobId} from "../../services/imageGenerationTracker";
import {formatTime} from "../../utils/timeFormat";
import {BotStatus, clearStatus, setStatus} from "../../services/statusService";
import {FileMemory} from "../../memory/fileMemory";
import {MEMORY_FILE_PATH, MEMORY_MAX_TURNS, TYPING_ANIMATION_INTERVAL} from "../../utils/constants";
import {isLowPowerMode} from "../../services/botStateService";

const logger = createLogger("ReimageCmd");
const memory = new FileMemory(MEMORY_FILE_PATH);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reimagine")
        .setDescription("Demande à Netricsa de transformer une image")
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
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Nombre de versions à générer")
                .setRequired(false)
                .addChoices(
                    {name: "1", value: 1},
                    {name: "2", value: 2},
                    {name: "3", value: 3}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        let tempFilePath: string | null = null;
        let progressMessage: any = null;

        try {
            // Vérifier le mode low power
            if (isLowPowerMode()) {
                const errorEmbed = createErrorEmbed(
                    "⚡ Mode Économie d'Énergie",
                    "Netricsa est en mode économie d'énergie et ne peut pas transformer d'images pour le moment.\n\nCe mode se désactive automatiquement quand l'owner est actif."
                );
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                return;
            }

            const prompt = interaction.options.getString("prompt", true);
            const referenceAttachment = interaction.options.getAttachment("image", true);
            const negativePrompt = interaction.options.getString("negative") || "";
            const amount = interaction.options.getInteger("amount") || 3;

            const width = 1024;
            const height = 1024;
            const steps = 18;
            const cfgScale = 5.5;
            const strength = 0.55;

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
            await setStatus(interaction.client, BotStatus.REIMAGINING_IMAGE, 600000); // 10 minutes

            // Message de progression avec animation de points
            progressMessage = await interaction.reply({
                content: "Réimagination de l'image."
            });

            // Animation des points (intervalle plus rapide pour meilleur feedback)
            let dotCount = 1;
            const animationInterval = setInterval(async () => {
                dotCount = (dotCount % 3) + 1;
                const dots = ".".repeat(dotCount);
                await progressMessage.edit(`Réimagination de l'image${dots}`).catch(() => {
                });
            }, TYPING_ANIMATION_INTERVAL);

            // Enregistrer la génération dans le tracker
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
                    fs.unlinkSync(tempFilePath);
                    reject(err);
                });
            });

            // Générer 3 images
            const startTime = Date.now();

            // Ajouter des mots-clés de qualité au prompt pour éviter les images floues
            const enhancedPrompt = `${prompt}, high quality`;

            const results = [];

            for (let i = 0; i < amount; i++) {
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

            // Désenregistrer la génération du tracker
            unregisterImageGeneration(interaction.user.id);

            let content =
                amount === 1
                    ? `Voici l'image que tu m'as demandé d'imaginer :\n> ${prompt}\n`
                    : `Voici ${amount} versions de l'image que tu m'as demandé d'imaginer :\n> ${prompt}\n`;

            if (negativePrompt) {
                content += `Négatif :\n> ${negativePrompt}`;
            }

            const finalMessage = await progressMessage.edit({
                content,
                files: results.map(r => r.attachment),
            });

            // Récupérer les URLs des 3 images envoyées pour le log
            const imageUrls = Array.from(finalMessage.attachments.values()).map((att: any) => att.url);

            // Logger les 3 images en une seule entrée
            await logBotImageReimagine(
                interaction.user.username,
                prompt,
                formatTime(parseFloat(generationTime)),
                imageUrls
            );

            // Ajouter à la mémoire que Netricsa a réimaginé une image
            await memory.appendTurn({
                ts: Date.now(),
                discordUid: interaction.user.id,
                displayName: interaction.user.username,
                userText: `/reimagine ${prompt}`,
                assistantText: `Voici l'image que tu m'as demandé de réimaginer : "${prompt}"`,
                channelId: interaction.channelId,
                channelName: interaction.channel?.isDMBased() ? "DM" : (interaction.channel as any)?.name || "unknown"
            }, MEMORY_MAX_TURNS);

            // Nettoyer le fichier temporaire
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            // Réinitialiser le statut Discord tout à la fin
            await clearStatus(interaction.client);

        } catch (error) {
            logger.error("Error reimagining image:", error);

            // Désenregistrer la génération en cas d'erreur
            unregisterImageGeneration(interaction.user.id);

            // Réinitialiser le statut Discord
            await clearStatus(interaction.client);

            // Nettoyer le fichier temporaire en cas d'erreur
            if (tempFilePath && require("fs").existsSync(tempFilePath)) {
                require("fs").unlinkSync(tempFilePath);
            }

            // Si c'est une annulation, éditer le message pour indiquer l'annulation
            if (error instanceof Error && error.message === "CANCELLED") {
                logger.info("Reimagination cancelled by user");
                if (progressMessage) {
                    await progressMessage.edit("🛑 Réimagination annulée.").catch(() => {
                    });
                }
                return;
            }

            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
            const errorEmbed = createErrorEmbed(
                "Erreur de Réimagination",
                `Impossible de réimaginer l'image.\n\n**Erreur:** ${errorMessage}`
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
