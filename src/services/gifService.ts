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
 * Convertit une URL Tenor (page view) en URL du média réel
 * Scrape la page pour extraire l'URL du GIF/image
 */
export async function getTenorFirstFrame(tenorUrl: string): Promise<string | null> {
    try {
        // Si c'est déjà une URL media.tenor.com directe, la retourner
        if (tenorUrl.includes('media.tenor.com') || tenorUrl.includes('c.tenor.com') || tenorUrl.includes('media1.tenor.com')) {
            console.log(`[GifService] Direct media URL: ${tenorUrl}`);
            return tenorUrl;
        }

        // Si c'est une page tenor.com/view/, extraire l'URL du média
        if (tenorUrl.includes('tenor.com/view/')) {
            console.log(`[GifService] Fetching Tenor page to extract media URL: ${tenorUrl}`);

            try {
                const response = await fetch(tenorUrl);
                if (!response.ok) {
                    console.error(`[GifService] Failed to fetch Tenor page: ${response.status}`);
                    return null;
                }

                const html = await response.text();

                // Chercher les URLs de média dans le HTML
                // Peu importe le format, il sera converti en PNG par imageService

                // Méthode 1: Chercher og:image
                const ogImageMatch = html.match(/<meta\s+[^>]*property="og:image"\s+content="([^"]+)"/i);
                if (ogImageMatch && ogImageMatch[1]) {
                    console.log(`[GifService] Found og:image: ${ogImageMatch[1]}`);
                    return ogImageMatch[1];
                }

                // Méthode 2: Chercher n'importe quelle URL media1.tenor.com
                const media1TenorMatch = html.match(/https:\/\/media1\.tenor\.com\/[^"\s]+\.(?:gif|png|jpg|webp)/i);
                if (media1TenorMatch && media1TenorMatch[0]) {
                    console.log(`[GifService] Found media1.tenor.com URL: ${media1TenorMatch[0]}`);
                    return media1TenorMatch[0];
                }

                // Méthode 3: Chercher media.tenor.com
                const mediaTenorMatch = html.match(/https:\/\/media\.tenor\.com\/[^"\s]+\.(?:gif|png|jpg|webp)/i);
                if (mediaTenorMatch && mediaTenorMatch[0]) {
                    console.log(`[GifService] Found media.tenor.com URL: ${mediaTenorMatch[0]}`);
                    return mediaTenorMatch[0];
                }

                // Méthode 4: Chercher c.tenor.com
                const cTenorMatch = html.match(/https:\/\/c\.tenor\.com\/[^"\s]+\.(?:gif|png|jpg|webp)/i);
                if (cTenorMatch && cTenorMatch[0]) {
                    console.log(`[GifService] Found c.tenor.com URL: ${cTenorMatch[0]}`);
                    return cTenorMatch[0];
                }

                console.warn(`[GifService] Could not extract media URL from Tenor page`)

                console.warn(`[GifService] Could not extract media URL from Tenor page`);
                return null;

            } catch (error) {
                console.error(`[GifService] Error fetching Tenor page:`, error);
                return null;
            }
        }

        console.warn(`[GifService] Unknown Tenor URL format: ${tenorUrl}`);
        return null;
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

    const messageContent = message.content || '';

    // 2. Chercher toutes les URLs Tenor (pages view et URLs directes)
    const allTenorMatches = messageContent.match(/https?:\/\/(?:media\.tenor\.com|tenor\.com|c\.tenor\.com)\/[^\s]+/gi);

    if (allTenorMatches) {
        for (const tenorUrl of allTenorMatches) {
            const mediaUrl = await getTenorFirstFrame(tenorUrl);
            if (mediaUrl && !urls.includes(mediaUrl)) {
                urls.push(mediaUrl);
                console.log(`[GifService] Found Tenor media: ${tenorUrl} -> ${mediaUrl}`);
            }
        }
    }

    // 3. URLs directes d'images/GIFs dans le message (non-Tenor)
    const directUrls = extractDirectMediaUrls(messageContent);
    for (const url of directUrls) {
        // Éviter les doublons
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
