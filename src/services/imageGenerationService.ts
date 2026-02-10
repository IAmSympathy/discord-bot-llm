import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";
import {AttachmentBuilder} from "discord.js";
import {enqueueGlobally} from "../queue/queue";

const logger = createLogger("ImageGeneration");

/**
 * Service pour la génération et l'upscaling d'images
 * Utilise un microservice Python avec Diffusers (HuggingFace)
 * Et Real-ESRGAN pour l'upscaling fidèle
 */

// URL du microservice Python
const IMAGE_API_URL = process.env.IMAGE_API_URL || "http://localhost:8000";

// Dossier de sortie pour les images générées
const OUTPUT_DIR = path.join(process.cwd(), "generated_images");

// Créer le dossier de sortie s'il n'existe pas
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
    logger.info(`Created output directory: ${OUTPUT_DIR}`);
}

export interface GenerationOptions {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    cfgScale?: number;
    seed?: number;
    sampler?: string;
    referenceImagePath?: string; // Pour img2img
    strength?: number; // Force de transformation (0-1)
}

export interface UpscaleOptions {
    imagePath: string;
    scale?: number; // x4 par défaut avec Real-ESRGAN x4plus
    model?: "general" | "anime"; // Modèle à utiliser (general = photos, anime = illustrations)
}

/**
 * Génère une image avec Stable Diffusion via le microservice Python
 */
export async function generateImage(options: GenerationOptions): Promise<{ path: string; attachment: AttachmentBuilder; jobId?: string }> {
    // Mettre la génération d'image dans la queue globale pour éviter les surcharges
    return enqueueGlobally(async () => {
        const mode = options.referenceImagePath ? "img2img" : "txt2img";
        logger.info(`Generating image (${mode}): "${options.prompt.substring(0, 50)}..."`);

        const payload: any = {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt || "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, signature, poorly drawn, deformed, disfigured, malformed, mutated, out of frame, cropped, worst quality, jpeg artifacts, duplicate",
            width: options.width || 1024,
            height: options.height || 1024,
            steps: options.steps || 40,
            cfg_scale: options.cfgScale || 8.0,
            seed: options.seed || -1,
            sampler: options.sampler || "DPM++ 2M Karras",
        };

        // Si image de référence fournie, l'ajouter au payload
        if (options.referenceImagePath) {
            const imageBuffer = fs.readFileSync(options.referenceImagePath);
            const imageBase64 = imageBuffer.toString("base64");
            payload.reference_image = imageBase64;
            payload.strength = options.strength || 0.75;
        }

        try {
            // Timeout de 10 minutes pour les générations très longues (img2img peut prendre 5-6 minutes)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes

            const response = await fetch(`${IMAGE_API_URL}/generate`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
                signal: controller.signal,
                // @ts-ignore - undici-specific options
                headersTimeout: 600000, // 10 minutes pour les headers (undici timeout)
                bodyTimeout: 600000 // 10 minutes pour le body (undici timeout)
            });

            clearTimeout(timeoutId);

            logger.info(`API response status: ${response.status}`);

            if (!response.ok) {
                const error = await response.text();

                // Code 499 = annulation volontaire, pas une erreur
                if (response.status === 499) {
                    throw new Error("CANCELLED");
                }

                throw new Error(`Image API error: ${response.status} - ${error}`);
            }

            // Parser la réponse JSON
            logger.info("Parsing response JSON...");
            const data = await response.json();
            logger.info("Response parsed successfully");

            if (!data.success || !data.image) {
                throw new Error("No image generated");
            }

            logger.info(`Image base64 size: ${data.image.length} chars`);

            // Décoder le base64 et sauvegarder
            const imageBuffer = Buffer.from(data.image, "base64");
            const outputFilename = `gen_${mode}_${Date.now()}.png`;
            const outputPath = path.join(OUTPUT_DIR, outputFilename);
            fs.writeFileSync(outputPath, imageBuffer);

            logger.info(`✅ Image generated: ${outputFilename} (${data.info.width}x${data.info.height}, mode: ${data.info.mode})`);

            // Créer l'attachment Discord
            const attachment = new AttachmentBuilder(imageBuffer, {name: outputFilename});

            return {
                path: outputPath,
                attachment,
                jobId: data.job_id // Retourner le job_id pour le tracker
            };
        } catch (error) {
            if (error instanceof Error) {
                // Log détaillé de l'erreur
                logger.error(`Image generation error: ${error.message}`);
                logger.error(`Error name: ${error.name}`);
                logger.error(`Error stack: ${error.stack}`);

                // Erreur de connexion à l'API
                if (error.message.includes("fetch failed") ||
                    error.name === "AbortError" ||
                    error.message.includes("ECONNREFUSED") ||
                    error.message.includes("ETIMEDOUT")) {
                    throw new Error(`CONNECTION_ERROR: ${error.message}`);
                }
                // Erreur de parsing JSON
                if (error.message.includes("JSON") || error.message.includes("parse")) {
                    throw new Error("Erreur de parsing de la réponse. L'image est peut-être trop grande.");
                }
            }
            throw error;
        }
    });
}

/**
 * Upscale une image
 */
export async function upscaleImage(options: UpscaleOptions): Promise<{ path: string; attachment: AttachmentBuilder; jobId?: string }> {
    // Mettre l'upscaling dans la queue globale pour éviter les surcharges
    return enqueueGlobally(async () => {
        const modelType = options.model || "general";
        logger.info(`Upscaling image with Real-ESRGAN ${modelType}: ${path.basename(options.imagePath)}`);

        try {
            const imageBuffer = fs.readFileSync(options.imagePath);
            const imageBase64 = imageBuffer.toString("base64");

            const payload = {
                image: imageBase64,
                scale: options.scale || 4,
                model: modelType
            };

            logger.info("Starting upscale request...");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutes

            const response = await fetch(`${IMAGE_API_URL}/upscale`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
                signal: controller.signal,
                // @ts-ignore - undici-specific options
                timeout: 900000,
                headersTimeout: 120000,
                bodyTimeout: 900000,
                keepAliveTimeout: 900000
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.text();

                // Code 499 = annulation volontaire
                if (response.status === 499) {
                    throw new Error("CANCELLED");
                }

                throw new Error(`Upscale API error: ${response.status} - ${error}`);
            }

            const data = await response.json();

            if (!data.success || !data.image) {
                throw new Error("No upscaled image returned");
            }

            // Sauvegarder l'image upscalée
            const upscaledBuffer = Buffer.from(data.image, "base64");
            const filename = `upscaled_x${options.scale || 4}_${Date.now()}.png`;
            const filepath = path.join(OUTPUT_DIR, filename);

            fs.writeFileSync(filepath, upscaledBuffer);
            logger.info(`✅ Image upscaled: ${filename} (${data.info.output_size})`);

            // Créer l'attachment Discord
            const attachment = new AttachmentBuilder(upscaledBuffer, {name: filename});

            return {
                path: filepath,
                attachment,
                jobId: data.job_id
            };

        } catch (error) {
            if (error instanceof Error) {
                // Log détaillé de l'erreur
                logger.error(`Upscaling error: ${error.message}`);
                logger.error(`Error name: ${error.name}`);
                logger.error(`Error stack: ${error.stack}`);

                // Erreur de connexion ou timeout
                if (error.message.includes("fetch failed") || error.name === "AbortError") {
                    const timeoutMin = 15;
                    throw new Error(`Connexion à l'API perdue ou timeout (${timeoutMin} min). L'upscaling prend trop de temps ou l'API a crashé.`);
                }
            }
            throw error;
        }
    });
}

/**
 * Vérifie si le microservice d'images est disponible
 */
export async function checkImageServiceAvailability(): Promise<boolean> {
    try {
        const response = await fetch(`${IMAGE_API_URL}/`, {
            method: "GET",
        });
        if (response.ok) {
            const data = await response.json();
            logger.info(`Image service: ${data.status} (device: ${data.device})`);
            return true;
        }
        return false;
    } catch (error) {
        logger.warn("Image service not available:", error);
        return false;
    }
}

/**
 * Nettoie les anciennes images générées (garde les 100 dernières)
 */
export function cleanupOldImages(): void {
    try {
        const files = fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.endsWith(".png"))
            .map(f => ({
                name: f,
                path: path.join(OUTPUT_DIR, f),
                time: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs
            }))
            .sort((a, b) => b.time - a.time);

        // Garder les 100 dernières, supprimer les autres
        if (files.length > 100) {
            const toDelete = files.slice(100);
            toDelete.forEach(file => {
                fs.unlinkSync(file.path);
            });
            logger.info(`Cleaned up ${toDelete.length} old images`);
        }
    } catch (error) {
        logger.error("Error cleaning up old images:", error);
    }
}
