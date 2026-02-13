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
const IMAGE_API_URL = process.env.IMAGE_API_URL || "http://mabite:8000";

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

        // Retry jusqu'à 2 fois en cas d'erreur de connexion
        let lastError: Error | null = null;
        const maxRetries = 2;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    logger.info(`🔄 Retry attempt ${attempt}/${maxRetries} after connection error`);
                    // Attendre un peu avant de réessayer (2 secondes)
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                // Vérifier d'abord si l'API est accessible
                const {isStandbyMode} = require('./standbyModeService');
                if (isStandbyMode()) {
                    throw new Error("STANDBY_MODE: L'API de génération d'images est actuellement inaccessible.");
                }

                // Timeout de 10 minutes pour les générations très longues (img2img peut prendre 5-6 minutes)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes

                const response = await fetch(`${IMAGE_API_URL}/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Connection": "close", // Désactiver keep-alive pour éviter les connexions stales
                        "User-Agent": "Netricsa-Bot/1.0"
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    // @ts-ignore - undici-specific options
                    headersTimeout: 600000, // 10 minutes pour les headers (undici timeout)
                    bodyTimeout: 600000, // 10 minutes pour le body (undici timeout)
                    keepAlive: false // Forcer une nouvelle connexion à chaque requête
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
                lastError = error as Error;

                // Si c'est une annulation ou un mode Standby, ne pas réessayer
                if (error instanceof Error &&
                    (error.message.includes("CANCELLED") || error.message.includes("STANDBY_MODE"))) {
                    throw error;
                }

                // Si c'est la dernière tentative, sortir de la boucle
                if (attempt === maxRetries) {
                    break;
                }

                // Vérifier si c'est une erreur de connexion qui justifie un retry
                const isConnectionError = error instanceof Error && (
                    error.message.includes("fetch failed") ||
                    error.name === "AbortError" ||
                    error.message.includes("ECONNREFUSED") ||
                    error.message.includes("ETIMEDOUT") ||
                    error.message.includes("EAI_AGAIN") ||
                    error.message.includes("ECONNRESET") ||
                    error.message.includes("socket hang up")
                );

                if (!isConnectionError) {
                    // Pas une erreur de connexion, ne pas réessayer
                    throw error;
                }

                logger.warn(`⚠️ Connection error on attempt ${attempt}, will retry...`);
            }
        }

        // Si on arrive ici, toutes les tentatives ont échoué
        if (lastError) {
            if (lastError instanceof Error) {
                // Log détaillé de l'erreur
                logger.error(`Image generation error after ${maxRetries} attempts: ${lastError.message}`);
                logger.error(`Error name: ${lastError.name}`);
                logger.error(`Error stack: ${lastError.stack}`);

                // Mode Standby
                if (lastError.message.includes("STANDBY_MODE")) {
                    throw new Error("STANDBY_MODE: L'API de génération d'images est en mode veille.");
                }

                // Erreur de connexion à l'API
                if (lastError.message.includes("fetch failed") ||
                    lastError.name === "AbortError" ||
                    lastError.message.includes("ECONNREFUSED") ||
                    lastError.message.includes("ETIMEDOUT") ||
                    lastError.message.includes("EAI_AGAIN") ||
                    lastError.message.includes("ECONNRESET") ||
                    lastError.message.includes("socket hang up")) {
                    throw new Error(`CONNECTION_ERROR: L'API de génération d'images n'est pas accessible après ${maxRetries} tentatives. Le serveur est peut-être hors ligne ou surchargé.`);
                }
                // Erreur de parsing JSON
                if (lastError.message.includes("JSON") || lastError.message.includes("parse")) {
                    throw new Error("Erreur de parsing de la réponse. L'image est peut-être trop grande.");
                }
            }
            throw lastError;
        }

        throw new Error("Unknown error during image generation");
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

        const imageBuffer = fs.readFileSync(options.imagePath);
        const imageBase64 = imageBuffer.toString("base64");

        const payload = {
            image: imageBase64,
            scale: options.scale || 4,
            model: modelType
        };

        // Retry jusqu'à 2 fois en cas d'erreur de connexion
        let lastError: Error | null = null;
        const maxRetries = 2;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    logger.info(`🔄 Retry attempt ${attempt}/${maxRetries} after connection error`);
                    // Attendre un peu avant de réessayer (2 secondes)
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                // Vérifier d'abord si l'API est accessible
                const {isStandbyMode} = require('./standbyModeService');
                if (isStandbyMode()) {
                    throw new Error("STANDBY_MODE: L'API de génération d'images est actuellement inaccessible.");
                }

                logger.info("Starting upscale request...");

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutes

                const response = await fetch(`${IMAGE_API_URL}/upscale`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Connection": "close", // Désactiver keep-alive pour éviter les connexions stales
                        "User-Agent": "Netricsa-Bot/1.0"
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    // @ts-ignore - undici-specific options
                    timeout: 900000,
                    headersTimeout: 120000,
                    bodyTimeout: 900000,
                    keepAlive: false // Forcer une nouvelle connexion à chaque requête
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
                lastError = error as Error;

                // Si c'est une annulation ou un mode Standby, ne pas réessayer
                if (error instanceof Error &&
                    (error.message.includes("CANCELLED") || error.message.includes("STANDBY_MODE"))) {
                    throw error;
                }

                // Si c'est la dernière tentative, sortir de la boucle
                if (attempt === maxRetries) {
                    break;
                }

                // Vérifier si c'est une erreur de connexion qui justifie un retry
                const isConnectionError = error instanceof Error && (
                    error.message.includes("fetch failed") ||
                    error.name === "AbortError" ||
                    error.message.includes("ECONNREFUSED") ||
                    error.message.includes("ETIMEDOUT") ||
                    error.message.includes("EAI_AGAIN") ||
                    error.message.includes("ECONNRESET") ||
                    error.message.includes("socket hang up")
                );

                if (!isConnectionError) {
                    // Pas une erreur de connexion, ne pas réessayer
                    throw error;
                }

                logger.warn(`⚠️ Connection error on attempt ${attempt}, will retry...`);
            }
        }

        // Si on arrive ici, toutes les tentatives ont échoué
        if (lastError) {
            if (lastError instanceof Error) {
                // Log détaillé de l'erreur
                logger.error(`Upscaling error after ${maxRetries} attempts: ${lastError.message}`);
                logger.error(`Error name: ${lastError.name}`);
                logger.error(`Error stack: ${lastError.stack}`);

                // Mode Standby
                if (lastError.message.includes("STANDBY_MODE")) {
                    throw new Error("STANDBY_MODE: L'API de génération d'images est en mode veille.");
                }

                // Erreur de connexion ou timeout
                if (lastError.message.includes("fetch failed") ||
                    lastError.name === "AbortError" ||
                    lastError.message.includes("ECONNREFUSED") ||
                    lastError.message.includes("ETIMEDOUT") ||
                    lastError.message.includes("EAI_AGAIN") ||
                    lastError.message.includes("ECONNRESET") ||
                    lastError.message.includes("socket hang up")) {
                    throw new Error(`CONNECTION_ERROR: L'API de génération d'images n'est pas accessible après ${maxRetries} tentatives. Le serveur est peut-être hors ligne ou surchargé.`);
                }
            }
            throw lastError;
        }

        throw new Error("Unknown error during image upscaling");
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
