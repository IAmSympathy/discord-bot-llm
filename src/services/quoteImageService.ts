import {createCanvas, GlobalFonts, loadImage, SKRSContext2D} from "@napi-rs/canvas";
import * as https from "https";
import * as http from "http";
import * as path from "path";
import {createLogger} from "../utils/logger";

const logger = createLogger("QuoteImageService");

// ─── Chargement des polices Lora ─────────────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

function registerFonts(): void {
    const regular = path.join(FONTS_DIR, "Lora-Regular.ttf");
    const italic = path.join(FONTS_DIR, "Lora-Italic.ttf");
    try {
        GlobalFonts.registerFromPath(regular, "Lora");
        GlobalFonts.registerFromPath(italic, "Lora");
        logger.info("Lora fonts registered successfully");
    } catch (err) {
        logger.warn("Could not register Lora fonts, falling back to sans-serif:", err);
    }
}

registerFonts();

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

// ─── Normalisation des caractères Unicode fantaisie ─────────────────────────
// Couvre : Mathematical Bold/Italic/Bold-Italic/Script/Fraktur/Double-Struck/
//          Sans-Serif Bold/Italic, Enclosed Alphanumerics, Fullwidth, etc.

const UNICODE_FANCY_MAP: Record<number, string> = (() => {
    const map: Record<number, string> = {};

    // Plages Unicode Math Alphanumeric Symbols (U+1D400…U+1D7FF)
    const ranges: Array<{ start: number; base: string }> = [
        {start: 0x1D400, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Bold Capital
        {start: 0x1D41A, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Bold Small
        {start: 0x1D434, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Italic Capital
        {start: 0x1D44E, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Italic Small
        {start: 0x1D468, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Bold Italic Capital
        {start: 0x1D482, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Bold Italic Small
        {start: 0x1D49C, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Script Capital
        {start: 0x1D4B6, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Script Small
        {start: 0x1D4D0, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Bold Script Capital
        {start: 0x1D4EA, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Bold Script Small
        {start: 0x1D504, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Fraktur Capital
        {start: 0x1D51E, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Fraktur Small
        {start: 0x1D538, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Double-Struck Capital
        {start: 0x1D552, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Double-Struck Small
        {start: 0x1D56C, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Bold Fraktur Capital
        {start: 0x1D586, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Bold Fraktur Small
        {start: 0x1D5A0, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Sans-Serif Capital
        {start: 0x1D5BA, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Sans-Serif Small
        {start: 0x1D5D4, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Sans-Serif Bold Capital
        {start: 0x1D5EE, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Sans-Serif Bold Small
        {start: 0x1D608, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Sans-Serif Italic Capital
        {start: 0x1D622, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Sans-Serif Italic Small
        {start: 0x1D63C, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Sans-Serif Bold Italic Capital
        {start: 0x1D656, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Sans-Serif Bold Italic Small
        {start: 0x1D670, base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, // Mathematical Monospace Capital
        {start: 0x1D68A, base: "abcdefghijklmnopqrstuvwxyz"}, // Mathematical Monospace Small
    ];

    for (const {start, base} of ranges) {
        for (let i = 0; i < base.length; i++) {
            map[start + i] = base[i];
        }
    }

    // Chiffres Math Bold (U+1D7CE…U+1D7D7)
    for (let i = 0; i <= 9; i++) map[0x1D7CE + i] = String(i);   // Bold
    for (let i = 0; i <= 9; i++) map[0x1D7D8 + i] = String(i);   // Double-Struck
    for (let i = 0; i <= 9; i++) map[0x1D7E2 + i] = String(i);   // Sans-Serif
    for (let i = 0; i <= 9; i++) map[0x1D7EC + i] = String(i);   // Sans-Serif Bold
    for (let i = 0; i <= 9; i++) map[0x1D7F6 + i] = String(i);   // Monospace

    // Caractères isolés non couverts par les plages continues
    const isolated: Array<[number, string]> = [
        // Math Script exceptions
        [0x212C, "B"], [0x2130, "E"], [0x2131, "F"], [0x210B, "H"],
        [0x2110, "I"], [0x2112, "L"], [0x2133, "M"], [0x2118, "P"],
        [0x211B, "R"], [0x212F, "e"], [0x210A, "g"], [0x2113, "l"],
        [0x2134, "o"],
        // Math Fraktur exceptions
        [0x212D, "C"], [0x210C, "H"], [0x2111, "I"], [0x211C, "R"], [0x2128, "Z"],
        // Math Double-Struck exceptions
        [0x2102, "C"], [0x210D, "H"], [0x2115, "N"], [0x2119, "P"],
        [0x211A, "Q"], [0x211D, "R"], [0x2124, "Z"],
        // Fullwidth Latin (U+FF21…FF5A)
        ...Array.from({length: 26}, (_, i) => [0xFF21 + i, String.fromCharCode(65 + i)] as [number, string]),
        ...Array.from({length: 26}, (_, i) => [0xFF41 + i, String.fromCharCode(97 + i)] as [number, string]),
        // Fullwidth digits (U+FF10…FF19)
        ...Array.from({length: 10}, (_, i) => [0xFF10 + i, String(i)] as [number, string]),
        // Enclosed Alphanumeric Supplement (circled letters A-Z U+1F150…U+1F169)
        ...Array.from({length: 26}, (_, i) => [0x1F150 + i, String.fromCharCode(65 + i)] as [number, string]),
        // Circled Latin (U+24B6…U+24CF uppercase, U+24D0…U+24E9 lowercase)
        ...Array.from({length: 26}, (_, i) => [0x24B6 + i, String.fromCharCode(65 + i)] as [number, string]),
        ...Array.from({length: 26}, (_, i) => [0x24D0 + i, String.fromCharCode(97 + i)] as [number, string]),
        // Circled digits (U+2460…U+2468 = 1-9, U+24EA = 0)
        [0x24EA, "0"],
        ...Array.from({length: 9}, (_, i) => [0x2460 + i, String(i + 1)] as [number, string]),
        // Superscript / subscript digits
        [0x2070, "0"], [0x00B9, "1"], [0x00B2, "2"], [0x00B3, "3"],
        [0x2074, "4"], [0x2075, "5"], [0x2076, "6"], [0x2077, "7"],
        [0x2078, "8"], [0x2079, "9"],
    ];

    for (const [cp, ch] of isolated) {
        map[cp] = ch;
    }

    return map;
})();

/**
 * Convertit les caractères Unicode fantaisie (bold, italic, script, etc.)
 * en leurs équivalents ASCII normaux pour un rendu lisible sur canvas.
 */
export function normalizeFancyText(text: string): string {
    const result: string[] = [];
    for (const char of text) {           // itère sur les code points (gère les surrogates)
        const cp = char.codePointAt(0)!;
        if (cp in UNICODE_FANCY_MAP) {
            result.push(UNICODE_FANCY_MAP[cp]);
        } else {
            result.push(char);
        }
    }
    return result.join("");
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
    ctx.font = `300 ${fontSize}px 'Lora', serif`;
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

    // Normaliser les caractères fantaisie Unicode → ASCII lisible
    const normalizedQuote = normalizeFancyText(quote);
    const normalizedDisplayName = normalizeFancyText(displayName);
    const normalizedUsername = normalizeFancyText(username);

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
    const calc = calculateOptimalFontSize(ctx, normalizedQuote);

    // ── Texte de la citation ──
    ctx.fillStyle = "#ffffff";
    ctx.font = `300 ${calc.fontSize}px 'Lora', serif`;

    let quoteY = (CANVAS_HEIGHT - calc.totalHeight) / 2;

    for (const line of calc.lines) {
        const lineWidth = ctx.measureText(line).width;
        const xOffset = (QUOTE_AREA_WIDTH - lineWidth) / 2;
        quoteY += calc.lineHeight;
        ctx.fillText(line, QUOTE_AREA_X + xOffset, quoteY);
    }

    // ── Auteur ──
    ctx.font = `italic 300 ${calc.authorFontSize}px 'Lora', serif`;
    ctx.fillStyle = "#ffffff";
    const authorText = `- ${normalizedDisplayName}`;
    const authorWidth = ctx.measureText(authorText).width;
    const authorX = QUOTE_AREA_X + (QUOTE_AREA_WIDTH - authorWidth) / 2;
    const authorY = quoteY + SPACING.authorTop;
    ctx.fillText(authorText, authorX, authorY);

    // ── Username ──
    ctx.font = `300 ${calc.usernameFontSize}px 'Lora', serif`;
    ctx.fillStyle = "#888888";
    const usernameText = `@${normalizedUsername}`;
    const usernameWidth = ctx.measureText(usernameText).width;
    const usernameX = QUOTE_AREA_X + (QUOTE_AREA_WIDTH - usernameWidth) / 2;
    const usernameY = authorY + SPACING.username + calc.usernameFontSize;
    ctx.fillText(usernameText, usernameX, usernameY);

    // ── Watermark ──
    if (showWatermark && watermark) {
        ctx.fillStyle = "#888888";
        ctx.font = `300 ${FONT_SIZES.watermark}px 'Lora', serif`;
        const wmText = watermark.slice(0, 32);
        const wmWidth = ctx.measureText(wmText).width;
        const wmX = CANVAS_WIDTH - wmWidth - SPACING.watermarkPadding;
        const wmY = CANVAS_HEIGHT - SPACING.watermarkPadding;
        ctx.fillText(wmText, wmX, wmY);
    }

    return canvas.toBuffer("image/png");
}
