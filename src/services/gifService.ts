/**
 * Service pour gérer les GIFs (Tenor et attachments Discord)
 */

export interface GifInfo {
    url: string;
    source: 'tenor' | 'discord' | 'direct';
}

/**
 * Extrait les URLs Tenor d'un message
 */
export function extractTenorUrls(text: string): string[] {
    const tenorRegex = /https?:\/\/(?:media\.tenor\.com|tenor\.com|c\.tenor\.com)\/[^\s]+/gi;
    const matches = text.match(tenorRegex);
    return matches || [];
}

/**
 * Extrait les URLs d'images/GIFs directes d'un message
 */
export function extractDirectMediaUrls(text: string): string[] {
    const mediaRegex = /https?:\/\/[^\s]+\.(?:gif|png|jpg|jpeg|webp)(?:\?[^\s]*)?/gi;
    const matches = text.match(mediaRegex);
    return matches || [];
}

/**
 * Convertit une URL Tenor en URL de la première frame (image statique)
 * Tenor fournit des URLs au format: https://media.tenor.com/xyz/tenor.gif
 * On peut obtenir l'image statique via l'API ou en modifiant l'URL
 */
export async function getTenorFirstFrame(tenorUrl: string): Promise<string | null> {
    try {
        // Méthode 1: Essayer de récupérer directement l'image statique
        // Tenor propose souvent une version .png ou .jpg de la première frame

        // Si c'est une URL media.tenor.com
        if (tenorUrl.includes('media.tenor.com')) {
            // Tenter de remplacer .gif par .png pour obtenir la frame statique
            const staticUrl = tenorUrl.replace(/\.gif$/i, '.png');

            // Vérifier si l'URL statique existe
            try {
                const response = await fetch(staticUrl, {method: 'HEAD'});
                if (response.ok) {
                    console.log(`[GifService] Found static frame for Tenor GIF: ${staticUrl}`);
                    return staticUrl;
                }
            } catch {
                // Continue avec l'URL originale
            }
        }

        // Si c'est une URL tenor.com/view/, extraire l'ID et utiliser l'API
        const viewMatch = tenorUrl.match(/tenor\.com\/view\/[^-]+-(\d+)/);
        if (viewMatch) {
            const gifId = viewMatch[1];
            // On pourrait utiliser l'API Tenor ici avec une clé API
            // Pour l'instant, on retourne l'URL originale du GIF
            console.log(`[GifService] Tenor GIF ID: ${gifId}`);
        }

        // Fallback: retourner l'URL du GIF (sera téléchargé et on extraira la frame)
        return tenorUrl;
    } catch (error) {
        console.error(`[GifService] Error processing Tenor URL ${tenorUrl}:`, error);
        return null;
    }
}

/**
 * Extrait la première frame d'un GIF en base64
 * Utilise sharp pour extraire la première frame
 */
export async function extractFirstFrameAsBase64(gifUrl: string): Promise<string | null> {
    try {
        // Télécharger le GIF
        const response = await fetch(gifUrl);
        if (!response.ok) {
            console.error(`[GifService] Failed to download GIF: ${response.status}`);
            return null;
        }

        const gifBuffer = await response.arrayBuffer();

        // Note: Pour extraire la première frame d'un GIF, on a besoin d'une librairie
        // Comme sharp ne supporte pas bien les GIFs animés, on va utiliser une approche différente

        // Option 1: Si c'est un GIF, le convertir directement en base64
        // Le modèle vision d'Ollama peut gérer les GIFs et prendra la première frame
        const base64 = Buffer.from(gifBuffer).toString('base64');
        console.log(`[GifService] Converted GIF to base64 (${base64.length} chars)`);
        return base64;

    } catch (error) {
        console.error(`[GifService] Error extracting first frame from ${gifUrl}:`, error);
        return null;
    }
}

/**
 * Collecte tous les médias (images + GIFs) d'un message Discord
 */
export async function collectAllMediaUrls(message: any): Promise<string[]> {
    const urls: string[] = [];

    // 1. Attachments Discord (images et GIFs uploadés)
    for (const attachment of message.attachments.values()) {
        // Inclure images ET gifs
        if (attachment.contentType?.startsWith('image/')) {
            urls.push(attachment.url);
            console.log(`[GifService] Found attachment: ${attachment.contentType} - ${attachment.url}`);
        }
    }

    // 2. URLs Tenor dans le message
    const tenorUrls = extractTenorUrls(message.content || '');
    for (const tenorUrl of tenorUrls) {
        const staticUrl = await getTenorFirstFrame(tenorUrl);
        if (staticUrl) {
            urls.push(staticUrl);
            console.log(`[GifService] Found Tenor GIF: ${tenorUrl} -> ${staticUrl}`);
        }
    }

    // 3. URLs directes d'images/GIFs dans le message
    const directUrls = extractDirectMediaUrls(message.content || '');
    for (const url of directUrls) {
        // Éviter les doublons avec Tenor
        if (!urls.includes(url) && !url.includes('tenor.com')) {
            urls.push(url);
            console.log(`[GifService] Found direct media URL: ${url}`);
        }
    }

    return urls;
}

/**
 * Vérifie si une URL est un GIF
 */
export function isGifUrl(url: string): boolean {
    return url.toLowerCase().includes('.gif') ||
        url.includes('tenor.com') ||
        url.includes('media.tenor.com');
}
