import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {generateImage} from "../../services/imageGenerationService";
import {logBotImageReimagine} from "../../utils/discordLogger";
import {createErrorEmbed} from "../../utils/embedBuilder";
import {createLogger} from "../../utils/logger";
import {hasActiveGeneration, registerImageGeneration, unregisterImageGeneration, updateJobId} from "../../services/imageGenerationTracker";
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
        let tempFilePath: string | null = null;
        let progressMessage: any = null;

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
                    "Netricsa est en mode économie d'énergie et ne peut pas transformer d'images pour le moment.\n\nCe mode se désactive automatiquement quand l'owner est actif."
                );
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                return;
            }

            const prompt = interaction.options.getString("prompt", true);
            const referenceAttachment = interaction.options.getAttachment("image", true);
            const negativePrompt = interaction.options.getString("negative") || "";
            const amount = interaction.options.getInteger("amount") || 3;
            const strengthInput = interaction.options.getString("strength");
            const strength = strengthInput ? Math.min(Math.max(parseFloat(strengthInput), 0.1), 0.9) : 0.55;

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

            // Créer un embed pour afficher les informations de manière compacte
            const {EmbedBuilder} = require("discord.js");
            const embed = new EmbedBuilder()
                .setColor(0x3498db) // Violet pour réimagination
                .addFields(
                    {name: "📝 Prompt", value: prompt.length > 1024 ? prompt.substring(0, 1021) + "..." : prompt}
                )
                .setFooter({text: `Temps: ${generationTime}s • 💪 Strength : ${strength}`})
                .setTimestamp();

            if (negativePrompt) {
                embed.addFields({
                    name: "🚫 Negative Prompt",
                    value: negativePrompt.length > 1024 ? negativePrompt.substring(0, 1021) + "..." : negativePrompt
                });
            }

            let baseContent = amount === 1
                ? `Voici l'image que tu m'as demandé de réimaginer`
                : `Voici ${amount} versions de l'image que tu m'as demandé de réimaginer`;

            const finalMessage = await progressMessage.edit({
                content: baseContent,
                embeds: [embed],
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

            // Ajouter à la mémoire une version simplifiée (pas besoin du prompt complet)
            await memory.appendTurn({
                ts: Date.now(),
                discordUid: interaction.user.id,
                displayName: interaction.user.username,
                userText: `/reimagine`,
                assistantText: `J'ai réimaginé une image`,
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
