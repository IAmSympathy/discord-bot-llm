import {OLLAMA_API_URL, OLLAMA_VISION_MODEL} from "../utils/constants";
import fs from "fs";
import sharp from "sharp";
import {logError} from "../utils/discordLogger";

export interface ImageAnalysisResult {
    url: string;
    description: string;
    width: number;
    height: number;
    size: number; // en bytes
    format: string;
    tokens: number;
    processingTime: number; // en ms
}

/**
 * Convertit un buffer d'image (GIF, WebP, etc.) en PNG
 * Pour les GIFs animés, extrait la DERNIÈRE frame
 */
async function convertToPNG(buffer: Buffer): Promise<Buffer> {
    try {
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Pour les GIFs animés, sharp a une propriété pages pour le nombre de frames
        if (metadata.pages && metadata.pages > 1) {
            // Extraire la dernière frame (pages - 1 car index commence à 0)
            const lastFrameIndex = metadata.pages - 1;
            console.log(`[ImageService] GIF has ${metadata.pages} frames, extracting last frame (${lastFrameIndex})`);

            return await sharp(buffer, {page: lastFrameIndex})
                .png()
                .toBuffer();
        } else {
            // Image statique ou WebP - conversion simple
            return await sharp(buffer)
                .png()
                .toBuffer();
        }
    } catch (error) {
        console.error(`[ImageService] Error converting to PNG:`, error);
        throw error;
    }
}

/**
 * Télécharge une image ou GIF et la convertit en base64
 * Les GIFs et WebP sont automatiquement convertis en PNG pour compatibilité Ollama
 */
export async function downloadImageAsBase64(url: string): Promise<string | null> {
    try {
        console.log(`[ImageService] Downloading media from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[ImageService] Download failed: ${response.status} ${response.statusText}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        let buffer = Buffer.from(arrayBuffer);
        const sizeKB = (buffer.length / 1024).toFixed(2);
        console.log(`[ImageService] Successfully downloaded (${sizeKB} KB)`);

        // Détecter le format et convertir les GIFs/WebP en PNG
        const isGif = url.toLowerCase().includes('.gif');
        const isWebP = url.toLowerCase().includes('.webp');

        if (isGif || isWebP) {
            console.log(`[ImageService] Converting ${isGif ? 'GIF' : 'WebP'} to PNG for Ollama compatibility...`);
            try {
                buffer = await convertToPNG(buffer);
                const newSizeKB = (buffer.length / 1024).toFixed(2);
                console.log(`[ImageService] Converted to PNG (${newSizeKB} KB)`);
            } catch (conversionError) {
                console.error(`[ImageService] Conversion failed, using original:`, conversionError);
                // Continue avec le buffer original si la conversion échoue
            }
        }

        const base64 = buffer.toString("base64");
        return base64;
    } catch (error) {
        console.error(`[ImageService] Error downloading ${url}:`, error);
        return null;
    }
}

/**
 * Génère une description d'image avec le modèle vision
 */
export async function generateImageDescription(imageBase64: string): Promise<{ description: string; tokens: number } | null> {
    const visionPromptPath = process.env.SYSTEM_PROMPT_VISION_PATH;
    if (!visionPromptPath) {
        throw new Error("SYSTEM_PROMPT_VISION_PATH n'est pas défini dans le .env");
    }

    const visionSystemPrompt = fs.readFileSync(visionPromptPath, "utf8");

    try {
        const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                model: OLLAMA_VISION_MODEL,
                messages: [
                    {role: "system", content: visionSystemPrompt},
                    {role: "user", content: "Décris cette image.", images: [imageBase64]},
                ],
                stream: false,
                options: {
                    temperature: 0.2,
                    num_predict: 500,
                },
            }),
        });

        if (!response.ok) {
            console.error(`[ImageService] Error: ${response.status} ${response.statusText}`);

            await logError("Erreur de génération de description d'image", undefined, [
                {name: "Status", value: `${response.status} ${response.statusText}`, inline: true},
                {name: "Modèle", value: OLLAMA_VISION_MODEL, inline: true}
            ]);

            return null;
        }

        const result = await response.json();
        const description = result.message?.content || null;
        const tokens = (result.prompt_eval_count || 0) + (result.eval_count || 0);

        console.log(`[ImageService] Generated description (${description?.length || 0} chars, ${tokens} tokens)`);
        return description ? {description, tokens} : null;
    } catch (error) {
        console.error(`[ImageService] Error generating description:`, error);
        return null;
    }
}

/**
 * Traite plusieurs images et retourne leurs descriptions (compatibilité)
 */
export async function processImages(imageUrls: string[]): Promise<string[]> {
    const results = await processImagesWithMetadata(imageUrls);
    return results.map(r => r.description);
}

/**
 * Traite plusieurs images et retourne toutes leurs métadonnées
 */
export async function processImagesWithMetadata(imageUrls: string[]): Promise<ImageAnalysisResult[]> {
    const results: ImageAnalysisResult[] = [];

    console.log(`[ImageService] Processing ${imageUrls.length} image(s) with metadata...`);

    for (const url of imageUrls) {
        const startTime = Date.now();

        try {
            // Télécharger l'image
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[ImageService] Failed to download ${url}`);
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            let buffer = Buffer.from(arrayBuffer);
            const originalSize = buffer.length;

            // Obtenir les métadonnées avec sharp
            const metadata = await sharp(buffer).metadata();
            const originalFormat = metadata.format || 'unknown';

            // Convertir si nécessaire
            const isGif = url.toLowerCase().includes('.gif');
            const isWebP = url.toLowerCase().includes('.webp') || originalFormat === 'webp';

            if (isGif || isWebP) {
                buffer = await convertToPNG(buffer);
            }

            // Générer la description
            const base64 = buffer.toString("base64");
            const result = await generateImageDescription(base64);

            if (result) {
                const processingTime = Date.now() - startTime;

                results.push({
                    url,
                    description: result.description,
                    width: metadata.width || 0,
                    height: metadata.height || 0,
                    size: originalSize,
                    format: originalFormat,
                    tokens: result.tokens,
                    processingTime
                });

                console.log(`[ImageService] Processed ${url} in ${processingTime}ms`);
            } else {
                console.error(`[ImageService] Failed to generate description for ${url}`);
            }
        } catch (error) {
            console.error(`[ImageService] Error processing ${url}:`, error);
        }
    }

    console.log(`[ImageService] Successfully processed ${results.length}/${imageUrls.length} image(s)`);
    return results;
}
