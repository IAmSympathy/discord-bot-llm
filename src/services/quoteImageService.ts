import {createCanvas, loadImage, SKRSContext2D} from "@napi-rs/canvas";
import * as https from "https";
import * as http from "http";
import {createLogger} from "../utils/logger";

const logger = createLogger("QuoteImageService");

// ─── Constantes (miroir du plugin Quoter) ───────────────────────────────────
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const QUOTE_AREA_WIDTH = 520;
const QUOTE_AREA_X = 640;
const MAX_CONTENT_HEIGHT = 480;

const FONT_SIZES = {
    initial: 42,
    minimum: 18,
    decrement: 2,
    lineHeightMultiplier: 1.25,
    authorMultiplier: 0.60,
    usernameMultiplier: 0.45,
    authorMinimum: 22,
    usernameMinimum: 18,
    watermark: 18,
};

const SPACING = {
    authorTop: 60,
    username: 10,
    gradientWidth: 400,
    watermarkPadding: 20,
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface QuoteOptions {
    /** URL de l'avatar (Discord CDN) */
    avatarUrl: string;
    /** Texte de la citation */
    quote: string;
    /** Nom affiché (globalName ou username) */
    displayName: string;
    /** @username */
    username: string;
    /** Appliquer filtre niveaux de gris */
    grayScale?: boolean;
    /** Texte watermark (max 32 chars) */
    watermark?: string;
    /** Afficher le watermark */
    showWatermark?: boolean;
}

// ─── Télécharger une image en Buffer ────────────────────────────────────────
async function fetchImageBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith("https") ? https : http;
        protocol.get(url, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks)));
            res.on("error", reject);
        }).on("error", reject);
    });
}

// ─── Calcul du découpage en lignes ───────────────────────────────────────────
function calculateLines(
    ctx: SKRSContext2D,
    text: string,
    fontSize: number,
    maxWidth: number
): string[] {
    ctx.font = `300 ${fontSize}px sans-serif`;
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine: string[] = [];

    for (const word of words) {
        const wordWidth = ctx.measureText(word).width;
        if (wordWidth > maxWidth) {
            if (currentLine.length) {
                lines.push(currentLine.join(" "));
                currentLine = [];
            }
            let chunk = "";
            for (const char of word) {
                const test = chunk + char;
                if (ctx.measureText(test).width > maxWidth) {
                    if (chunk) lines.push(chunk);
                    chunk = char;
                } else {
                    chunk = test;
                }
            }
            if (chunk) lines.push(chunk);
        } else {
            const testLine = [...currentLine, word].join(" ");
            if (ctx.measureText(testLine).width > maxWidth && currentLine.length) {
                lines.push(currentLine.join(" "));
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
    }
    if (currentLine.length) lines.push(currentLine.join(" "));
    return lines;
}

// ─── Calcul de la taille de police optimale ──────────────────────────────────
function calculateOptimalFontSize(
    ctx: SKRSContext2D,
    quote: string
): {
    fontSize: number;
    lineHeight: number;
    authorFontSize: number;
    usernameFontSize: number;
    lines: string[];
    totalHeight: number;
} {
    let fontSize = FONT_SIZES.initial;

    while (fontSize >= FONT_SIZES.minimum) {
        const lines = calculateLines(ctx, quote, fontSize, QUOTE_AREA_WIDTH);
        const lineHeight = fontSize * FONT_SIZES.lineHeightMultiplier;
        const authorFontSize = Math.max(FONT_SIZES.authorMinimum, fontSize * FONT_SIZES.authorMultiplier);
        const usernameFontSize = Math.max(FONT_SIZES.usernameMinimum, fontSize * FONT_SIZES.usernameMultiplier);
        const totalHeight =
            lines.length * lineHeight + SPACING.authorTop + authorFontSize + SPACING.username + usernameFontSize;

        if (totalHeight <= MAX_CONTENT_HEIGHT) {
            return {fontSize, lineHeight, authorFontSize, usernameFontSize, lines, totalHeight};
        }
        fontSize -= FONT_SIZES.decrement;
    }

    const lines = calculateLines(ctx, quote, FONT_SIZES.minimum, QUOTE_AREA_WIDTH);
    const lineHeight = FONT_SIZES.minimum * FONT_SIZES.lineHeightMultiplier;
    const totalHeight =
        lines.length * lineHeight +
        SPACING.authorTop +
        FONT_SIZES.authorMinimum +
        SPACING.username +
        FONT_SIZES.usernameMinimum;

    return {
        fontSize: FONT_SIZES.minimum,
        lineHeight,
        authorFontSize: FONT_SIZES.authorMinimum,
        usernameFontSize: FONT_SIZES.usernameMinimum,
        lines,
        totalHeight,
    };
}

// ─── Génération de l'image quote ─────────────────────────────────────────────
export async function createQuoteImage(options: QuoteOptions): Promise<Buffer> {
    const {
        avatarUrl,
        quote,
        displayName,
        username,
        grayScale = true,
        watermark = "Netricsa Bot",
        showWatermark = false,
    } = options;

    logger.info(`Generating quote image for @${username}`);

    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext("2d");

    // Fond noir
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Avatar (zone gauche 600×600)
    try {
        const avatarBuffer = await fetchImageBuffer(avatarUrl);
        const avatarImage = await loadImage(avatarBuffer);
        ctx.drawImage(avatarImage, 0, 0, CANVAS_HEIGHT, CANVAS_HEIGHT);
    } catch (err) {
        logger.warn("Could not load avatar, skipping:", err);
    }

    // Niveaux de gris : désaturation pixel par pixel
    if (grayScale) {
        const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = avg;
            data[i + 1] = avg;
            data[i + 2] = avg;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Dégradé noir sur la droite de l'avatar (horizontal : x0→x1)
    const gradientX0 = CANVAS_HEIGHT - SPACING.gradientWidth;
    const gradientX1 = CANVAS_HEIGHT;
    const gradient = ctx.createLinearGradient(gradientX0, 0, gradientX1, 0);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(gradientX0, 0, SPACING.gradientWidth, CANVAS_HEIGHT);

    // Calcul typographie
    const calc = calculateOptimalFontSize(ctx, quote);

    // ── Texte de la citation ──
    ctx.fillStyle = "#ffffff";
    ctx.font = `300 ${calc.fontSize}px sans-serif`;

    let quoteY = (CANVAS_HEIGHT - calc.totalHeight) / 2;

    for (const line of calc.lines) {
        const lineWidth = ctx.measureText(line).width;
        const xOffset = (QUOTE_AREA_WIDTH - lineWidth) / 2;
        quoteY += calc.lineHeight;
        ctx.fillText(line, QUOTE_AREA_X + xOffset, quoteY);
    }

    // ── Auteur ──
    ctx.font = `italic 300 ${calc.authorFontSize}px sans-serif`;
    ctx.fillStyle = "#ffffff";
    const authorText = `- ${displayName}`;
    const authorWidth = ctx.measureText(authorText).width;
    const authorX = QUOTE_AREA_X + (QUOTE_AREA_WIDTH - authorWidth) / 2;
    const authorY = quoteY + SPACING.authorTop;
    ctx.fillText(authorText, authorX, authorY);

    // ── Username ──
    ctx.font = `300 ${calc.usernameFontSize}px sans-serif`;
    ctx.fillStyle = "#888888";
    const usernameText = `@${username}`;
    const usernameWidth = ctx.measureText(usernameText).width;
    const usernameX = QUOTE_AREA_X + (QUOTE_AREA_WIDTH - usernameWidth) / 2;
    const usernameY = authorY + SPACING.username + calc.usernameFontSize;
    ctx.fillText(usernameText, usernameX, usernameY);

    // ── Watermark ──
    if (showWatermark && watermark) {
        ctx.fillStyle = "#888888";
        ctx.font = `300 ${FONT_SIZES.watermark}px sans-serif`;
        const wmText = watermark.slice(0, 32);
        const wmWidth = ctx.measureText(wmText).width;
        const wmX = CANVAS_WIDTH - wmWidth - SPACING.watermarkPadding;
        const wmY = CANVAS_HEIGHT - SPACING.watermarkPadding;
        ctx.fillText(wmText, wmX, wmY);
    }

    return canvas.toBuffer("image/png");
}
