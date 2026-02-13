import {OLLAMA_API_URL, OLLAMA_VISION_MODEL} from "../utils/constants";
import {EnvConfig} from "../utils/envConfig";
import fs from "fs";
import sharp from "sharp";
import {logError} from "../utils/discordLogger";

const OLLAMA_TIMEOUT_MS = 120000; // Timeout de 120 secondes pour les requêtes Ollama
const MAX_RETRIES = 3; // Nombre maximum de tentatives
const INITIAL_RETRY_DELAY = 1000; // Délai initial entre les tentatives (1 seconde)

/**
 * Fonction utilitaire pour retry avec backoff exponentiel
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES,
    delay: number = INITIAL_RETRY_DELAY,
    operationName: string = "operation"
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) {
            console.error(`[Retry] ${operationName} failed after ${MAX_RETRIES} attempts`);
            throw error;
        }

        const isRetryableError = error instanceof Error && (
            error.name === 'AbortError' ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('fetch failed')
        );

        if (!isRetryableError) {
            console.log(`[Retry] ${operationName} - Non-retryable error, throwing immediately`);
            throw error;
        }

        const attempt = MAX_RETRIES - retries + 1;
        console.warn(`[Retry] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        return retryWithBackoff(fn, retries - 1, delay * 2, operationName);
    }
}

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
 * Redimensionne une image pour l'analyse tout en gardant le ratio
 * Réduit la résolution à un maximum de 768px sur le côté le plus long
 * Cela accélère considérablement l'analyse sans perte significative de qualité
 */
async function resizeForAnalysis(buffer: Buffer): Promise<Buffer> {
    try {
        const metadata = await sharp(buffer).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const maxDimension = 768;

        // Si l'image est déjà petite, ne pas la redimensionner
        if (width <= maxDimension && height <= maxDimension) {
            console.log(`[ImageService] Image already optimal size (${width}x${height}), skipping resize`);
            return buffer;
        }

        // Calculer les nouvelles dimensions en gardant le ratio
        let newWidth: number;
        let newHeight: number;

        if (width > height) {
            // Image horizontale
            newWidth = maxDimension;
            newHeight = Math.round((height / width) * maxDimension);
        } else {
            // Image verticale ou carrée
            newHeight = maxDimension;
            newWidth = Math.round((width / height) * maxDimension);
        }

        const resizedBuffer = await sharp(buffer)
            .resize(newWidth, newHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();

        const originalSizeKB = (buffer.length / 1024).toFixed(2);
        const resizedSizeKB = (resizedBuffer.length / 1024).toFixed(2);
        console.log(`[ImageService] Resized from ${width}x${height} (${originalSizeKB} KB) to ${newWidth}x${newHeight} (${resizedSizeKB} KB)`);

        return resizedBuffer;
    } catch (error) {
        console.error(`[ImageService] Error resizing image:`, error);
        return buffer; // Retourner l'original en cas d'erreur
    }
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
 * Les images sont redimensionnées à 768px max pour accélérer l'analyse
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

        // Redimensionner l'image pour accélérer l'analyse
        buffer = await resizeForAnalysis(buffer);

        const base64 = buffer.toString("base64");
        return base64;
    } catch (error) {
        console.error(`[ImageService] Error downloading ${url}:`, error);
        return null;
    }
}

/**
 * Génère une description d'image avec le modèle vision
 * @param imageBase64 - Image encodée en base64
 * @param context - Contexte optionnel pour adapter le prompt ('creation' pour une analyse artistique détaillée)
 */
export async function generateImageDescription(imageBase64: string, context?: 'creation' | 'default'): Promise<{ description: string; tokens: number } | null> {
    const visionPromptPath = EnvConfig.SYSTEM_PROMPT_VISION_PATH;
    if (!visionPromptPath) {
        throw new Error("SYSTEM_PROMPT_VISION_PATH n'est pas défini dans le .env");
    }

    const visionSystemPrompt = fs.readFileSync(visionPromptPath, "utf8");

    // Adapter le prompt utilisateur selon le contexte
    let userPrompt = "Décris cette image.";

    if (context === 'creation') {
        userPrompt = `Analyse cette création artistique en détail.

IMPORTANT - Tu dois analyser :
• La COMPOSITION : placement des éléments, équilibre, dynamique visuelle
• Les COULEURS : palette utilisée, harmonie, contrastes, ambiance créée
• La TECHNIQUE : style artistique, maîtrise technique visible, médium utilisé
• Les DÉTAILS : éléments notables, textures, effets, originalité
• L'AMBIANCE : émotions transmises, atmosphère générale, message visuel

Sois PRÉCIS et DÉTAILLÉ dans ton analyse (minimum 4-5 phrases).
Identifie ce qui fonctionne BIEN techniquement et artistiquement.
Donne une analyse CONSTRUCTIVE qui pourra aider l'artiste.`;
    }

    try {
        // Utiliser le système de retry avec backoff exponentiel
        return await retryWithBackoff(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

            try {
                console.log(`[ImageService] Sending vision request to ${OLLAMA_API_URL}/api/chat with model ${OLLAMA_VISION_MODEL}`);
                console.log(`[ImageService] Image base64 length: ${imageBase64.length} characters`);

                const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "Netricsa-Bot/1.0",
                        "Connection": "close" // Désactiver keep-alive pour éviter les connexions stales
                    },
                    body: JSON.stringify({
                        model: OLLAMA_VISION_MODEL,
                        messages: [
                            {role: "system", content: visionSystemPrompt},
                            {role: "user", content: userPrompt, images: [imageBase64]},
                        ],
                        stream: false,
                        options: {
                            temperature: context === 'creation' ? 0.4 : 0.2,
                            num_predict: context === 'creation' ? 800 : 500,
                        },
                    }),
                    signal: controller.signal,
                    // @ts-ignore - undici-specific options
                    keepAlive: false
                });

                clearTimeout(timeoutId);

                console.log(`[ImageService] Received response: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    console.error(`[ImageService] Error: ${response.status} ${response.statusText}`);

                    // Essayer de lire le corps de la réponse pour plus de détails
                    try {
                        const errorText = await response.text();
                        console.error(`[ImageService] Error response body: ${errorText}`);
                    } catch (e) {
                        console.error(`[ImageService] Could not read error response body`);
                    }

                    await logError("Erreur de génération de description d'image", undefined, [
                        {name: "Status", value: `${response.status} ${response.statusText}`, inline: true},
                        {name: "Modèle", value: OLLAMA_VISION_MODEL, inline: true},
                        {name: "URL", value: OLLAMA_API_URL, inline: true}
                    ]);

                    return null;
                }

                const result = await response.json();
                const description = result.message?.content || null;
                const tokens = (result.prompt_eval_count || 0) + (result.eval_count || 0);

                console.log(`[ImageService] Generated description (${description?.length || 0} chars, ${tokens} tokens)${context ? ` [context: ${context}]` : ''}`);
                return description ? {description, tokens} : null;
            } catch (fetchError: any) {
                clearTimeout(timeoutId);

                // Gérer spécifiquement l'erreur d'abort (timeout)
                if (fetchError.name === 'AbortError') {
                    console.error(`[ImageService] Timeout après ${OLLAMA_TIMEOUT_MS / 1000} secondes lors de l'analyse d'image`);
                    await logError("Timeout lors de l'analyse d'image", undefined, [
                        {name: "Durée", value: `${OLLAMA_TIMEOUT_MS / 1000} secondes`, inline: true},
                        {name: "Modèle", value: OLLAMA_VISION_MODEL, inline: true}
                    ]);
                    throw fetchError; // Lancer pour le retry
                }

                // Logger TOUS les détails de l'erreur fetch
                console.error(`[ImageService] Fetch error details:`);
                console.error(`  - Name: ${fetchError.name}`);
                console.error(`  - Message: ${fetchError.message}`);
                console.error(`  - Code: ${fetchError.code || 'N/A'}`);
                console.error(`  - Cause: ${fetchError.cause?.message || 'N/A'}`);

                // Erreur de connexion ou autre
                throw fetchError;
            }
        }, MAX_RETRIES, INITIAL_RETRY_DELAY, `Vision analysis${context ? ` (${context})` : ''}`);
    } catch (error: any) {
        console.error(`[ImageService] Error generating description:`, error);

        // Logger les détails de l'erreur pour le debugging
        await logError("Erreur critique lors de l'analyse d'image", undefined, [
            {name: "Type d'erreur", value: error.name || "Unknown", inline: true},
            {name: "Message", value: error.message || "No message", inline: false},
            {name: "Cause", value: error.cause?.message || "No cause", inline: false}
        ]);

        return null;
    }
}

/**
 * Vérifie si le modèle vision est disponible sur le serveur Ollama
 * À appeler au démarrage pour diagnostiquer les problèmes
 */
export async function checkVisionModelAvailability(): Promise<boolean> {
    try {
        console.log(`[ImageService] Checking if vision model ${OLLAMA_VISION_MODEL} is available...`);

        // Utiliser le système de retry avec backoff exponentiel
        const response = await retryWithBackoff(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes pour la vérification

            try {
                const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
                    method: "GET",
                    signal: controller.signal,
                    headers: {
                        "User-Agent": "Netricsa-Bot/1.0",
                        "Connection": "close"
                    },
                    // @ts-ignore - undici-specific options
                    keepAlive: false
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Failed to fetch Ollama models: ${response.status}`);
                }

                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }, MAX_RETRIES, INITIAL_RETRY_DELAY, "Vision model check");

        const data = await response.json();
        const models = data.models || [];
        const modelNames = models.map((m: any) => m.name);

        console.log(`[ImageService] Available models: ${modelNames.join(', ')}`);

        const isAvailable = modelNames.some((name: string) =>
            name === OLLAMA_VISION_MODEL || name.startsWith(OLLAMA_VISION_MODEL.split(':')[0])
        );

        if (isAvailable) {
            console.log(`[ImageService] ✅ Vision model ${OLLAMA_VISION_MODEL} is available`);
        } else {
            console.error(`[ImageService] ❌ Vision model ${OLLAMA_VISION_MODEL} is NOT available`);
            console.error(`[ImageService] Please run: ollama pull ${OLLAMA_VISION_MODEL}`);

            await logError("Modèle vision non disponible", undefined, [
                {name: "Modèle requis", value: OLLAMA_VISION_MODEL, inline: true},
                {name: "Modèles disponibles", value: modelNames.join(', ') || "Aucun", inline: false},
                {name: "Solution", value: `Exécuter: ollama pull ${OLLAMA_VISION_MODEL}`, inline: false}
            ]);
        }

        return isAvailable;
    } catch (error) {
        console.error(`[ImageService] Error checking model availability:`, error);
        return false;
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
 * @param imageUrls - URLs des images à traiter
 * @param context - Contexte optionnel ('creation' pour une analyse artistique détaillée)
 */
export async function processImagesWithMetadata(imageUrls: string[], context?: 'creation' | 'default'): Promise<ImageAnalysisResult[]> {
    const results: ImageAnalysisResult[] = [];

    console.log(`[ImageService] Processing ${imageUrls.length} image(s) with metadata${context ? ` [context: ${context}]` : ''}...`);

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

            // Redimensionner l'image pour accélérer l'analyse
            buffer = await resizeForAnalysis(buffer);

            // Générer la description avec le contexte approprié
            const base64 = buffer.toString("base64");
            const result = await generateImageDescription(base64, context);

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

    return results;
}
