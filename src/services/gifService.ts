import {Message} from "discord.js";
import {createLogger} from "../utils/logger";

const logger = createLogger("GifService");

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
        if (tenorUrl.includes('media.tenor.com') || tenorUrl.includes('media1.tenor.com') || tenorUrl.includes('c.tenor.com')) {
            logger.info(`Direct media URL: ${tenorUrl}`);
            return tenorUrl;
        }

        // Si c'est une page tenor.com/view/, extraire l'URL du média
        if (tenorUrl.includes('tenor.com/view/') || tenorUrl.includes('tenor.com/')) {
            logger.info(`Fetching Tenor page to extract media URL: ${tenorUrl}`);
            try {
                const response = await fetch(tenorUrl);
                if (!response.ok) {
                    logger.error(`Failed to fetch Tenor page: ${response.status}`);
                    return null;
                }

                const html = await response.text();

                // Chercher les URLs de média dans le HTML
                // Peu importe le format, il sera converti en PNG par imageService

                // Méthode 1: Chercher og:image
                const ogImageMatch = html.match(/<meta\s+[^>]*property="og:image"\s+content="([^"]+)"/i);
                if (ogImageMatch && ogImageMatch[1]) {
                    logger.info(`Found og:image: ${ogImageMatch[1]}`);
                    return ogImageMatch[1];
                }

                // Méthode 2: Chercher n'importe quelle URL media1.tenor.com
                const media1TenorMatch = html.match(/https:\/\/media1\.tenor\.com\/[^"\s]+\.(?:gif|png|jpg|webp)/i);
                if (media1TenorMatch) {
                    logger.info(`Found media1.tenor.com URL: ${media1TenorMatch[0]}`);
                    return media1TenorMatch[0];
                }

                // Méthode 3: Chercher media.tenor.com
                const mediaTenorMatch = html.match(/https:\/\/media\.tenor\.com\/[^"\s]+\.(?:gif|png|jpg|webp)/i);
                if (mediaTenorMatch) {
                    logger.info(`Found media.tenor.com URL: ${mediaTenorMatch[0]}`);
                    return mediaTenorMatch[0];
                }

                // Méthode 4: Chercher c.tenor.com
                const cTenorMatch = html.match(/https:\/\/c\.tenor\.com\/[^"\s]+\.(?:gif|png|jpg|webp)/i);
                if (cTenorMatch) {
                    logger.info(`Found c.tenor.com URL: ${cTenorMatch[0]}`);
                    return cTenorMatch[0];
                }

                logger.warn(`Could not extract media URL from Tenor page`);
            } catch (error) {
                logger.error(`Error fetching Tenor page:`, error);
                return null;
            }
        }

        logger.warn(`Unknown Tenor URL format: ${tenorUrl}`);
        return null;
    } catch (error) {
        logger.error(`Error processing Tenor URL ${tenorUrl}:`, error);
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
            logger.error(`Failed to download GIF: ${response.status}`);
            return null;
        }

        const gifBuffer = await response.arrayBuffer();

        // Note: Pour extraire la première frame d'un GIF, on a besoin d'une librairie
        // Comme sharp ne supporte pas bien les GIFs animés, on va utiliser une approche différente

        // Option 1: Si c'est un GIF, le convertir directement en base64
        // Le modèle vision d'Ollama peut gérer les GIFs et prendra la première frame
        const base64 = Buffer.from(gifBuffer).toString('base64');
        logger.info(`Converted GIF to base64 (${base64.length} chars)`);
        return `data:image/png;base64,${base64}`;
    } catch (error) {
        logger.error(`Error extracting first frame from ${gifUrl}:`, error);
        return null;
    }
}

/**
 * Collecte tous les médias (images + GIFs) d'un message Discord
 */
export async function collectAllMediaUrls(message: Message): Promise<string[]> {
    const imageUrls: string[] = [];

    // 1. Attachments Discord (images et GIFs uploadés)
    for (const [, attachment] of message.attachments) {
        if (attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/')) {
            logger.info(`Found attachment: ${attachment.contentType} - ${attachment.url}`);
            imageUrls.push(attachment.url);
        }
    }

    const messageContent = message.content || '';

    // 2. Chercher toutes les URLs Tenor (pages view et URLs directes)
    const tenorUrls = messageContent.match(/https?:\/\/(?:media\.tenor\.com|tenor\.com|c\.tenor\.com)\/[^\s]+/gi);

    if (tenorUrls) {
        for (const tenorUrl of tenorUrls) {
            const mediaUrl = await getTenorFirstFrame(tenorUrl);
            if (mediaUrl) {
                logger.info(`Found Tenor media: ${tenorUrl} -> ${mediaUrl}`);
                imageUrls.push(mediaUrl);
            }
        }
    }

    // 3. URLs directes d'images/GIFs dans le message (non-Tenor)
    const directMediaUrls = extractDirectMediaUrls(messageContent);
    for (const url of directMediaUrls) {
        logger.info(`Found direct media URL: ${url}`);
        imageUrls.push(url);
    }

    // 4. Vérifier les embeds Discord (GIFs/images envoyés via le sélecteur)
    if (message.embeds && message.embeds.length > 0) {
        for (const embed of message.embeds) {
            if (embed.image?.url) {
                const imageUrl = embed.image.url;
                if (!imageUrls.includes(imageUrl)) {
                    logger.info(`Found embed image: ${imageUrl}`);
                    imageUrls.push(imageUrl);
                }
            }
            if (embed.thumbnail?.url) {
                const thumbUrl = embed.thumbnail.url;
                if (!imageUrls.includes(thumbUrl)) {
                    logger.info(`Found embed thumbnail: ${thumbUrl}`);
                    imageUrls.push(thumbUrl);
                }
            }
        }
    }

    return imageUrls;
}

/**
 * Vérifie si une URL est un GIF
 */
export function isGifUrl(url: string): boolean {
    return url.toLowerCase().includes('.gif') ||
        url.includes('tenor.com') ||
        url.includes('media.tenor.com');
}
