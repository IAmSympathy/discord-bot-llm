import {OLLAMA_API_URL, OLLAMA_VISION_MODEL} from "../utils/constants";
import fs from "fs";

/**
 * Télécharge une image ou GIF et la convertit en base64
 * Note: Les GIFs seront traités - Ollama prendra automatiquement la première frame
 */
export async function downloadImageAsBase64(url: string): Promise<string | null> {
    try {
        console.log(`[ImageService] Downloading media from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[ImageService] Download failed: ${response.status} ${response.statusText}`);
            return null;
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        console.log(`[ImageService] Successfully downloaded (${(buffer.byteLength / 1024).toFixed(2)} KB)`);
        return base64;
    } catch (error) {
        console.error(`[ImageService] Error downloading ${url}:`, error);
        return null;
    }
}

/**
 * Génère une description d'image avec le modèle vision
 */
export async function generateImageDescription(imageBase64: string): Promise<string | null> {
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
            return null;
        }

        const result = await response.json();
        const description = result.message?.content || null;
        console.log(`[ImageService] Generated description (${description?.length || 0} chars)`);
        return description;
    } catch (error) {
        console.error(`[ImageService] Error generating description:`, error);
        return null;
    }
}

/**
 * Traite plusieurs images et retourne leurs descriptions
 */
export async function processImages(imageUrls: string[]): Promise<string[]> {
    const descriptions: string[] = [];

    console.log(`[ImageService] Processing ${imageUrls.length} image(s)...`);

    for (const url of imageUrls) {
        const base64 = await downloadImageAsBase64(url);
        if (base64) {
            console.log(`[ImageService] Downloaded ${url}, generating description...`);
            const description = await generateImageDescription(base64);
            if (description) {
                descriptions.push(description);
                console.log(`[ImageService] Description: ${description.substring(0, 100)}...`);
            } else {
                console.error(`[ImageService] Failed to generate description for ${url}`);
            }
        } else {
            console.error(`[ImageService] Failed to download ${url}`);
        }
    }

    console.log(`[ImageService] Successfully processed ${descriptions.length}/${imageUrls.length} image(s)`);
    return descriptions;
}
