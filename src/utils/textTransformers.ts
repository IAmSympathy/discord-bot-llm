import emojiRegex from "emoji-regex";

/**
 * Extrait les emojis valides d'une chaîne
 */
export function extractValidEmojis(text: string): string[] {
    const regex = emojiRegex();
    return Array.from(text.matchAll(regex), (m) => m[0]);
}

/**
 * Convertit les smileys textuels en emojis Unicode
 */
export function convertTextEmojisToUnicode(text: string): string {
    return text
        .replace(/:\)(?=[ \n])/g, "🙂")
        .replace(/:-\)(?=[ \n])/g, "🙂")
        .replace(/:\((?=[ \n])/g, "☹️")
        .replace(/:-\((?=[ \n])/g, "☹️")
        .replace(/:D(?=[ \n])/g, "😃")
        .replace(/:-D(?=[ \n])/g, "😃")
        .replace(/:O(?=[ \n])/g, "😮")
        .replace(/:-O(?=[ \n])/g, "😮")
        .replace(/:o(?=[ \n])/g, "😮")
        .replace(/:-o(?=[ \n])/g, "😮")
        .replace(/;-?\)(?=[ \n])/g, "😉")
        .replace(/:P(?=[ \n])/g, "😛")
        .replace(/:-P(?=[ \n])/g, "😛")
        .replace(/:p(?=[ \n])/g, "😛")
        .replace(/:-p(?=[ \n])/g, "😛")
        .replace(/:\|(?=[ \n])/g, "😐")
        .replace(/:-\|(?=[ \n])/g, "😐")
        .replace(/><\)(?=[ \n])/g, "😁")
        .replace(/<3(?=[ \n])/g, "❤️")
        .replace(/:\*(?=[ \n])/g, "😘")
        .replace(/:-\*(?=[ \n])/g, "😘");
}

/**
 * Décode les entités HTML
 */
export function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Entoure les liens de chevrons pour éviter les embeds Discord
 */
export function wrapLinksNoEmbed(text: string): string {
    return text
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1: <$2>")
        .replace(/(?<!<)(https?:\/\/[^\s>]+)(?!>)/g, "<$1>");
}

/**
 * Convertit les IDs de channel en mentions Discord
 */
export function fixChannelMentions(text: string): string {
    return text
        .replace(/(?:ID du salon|salon|channel|canal)\s*:?\s*(\d{17,19})\b/gi, (match, id) => match.replace(id, `<#${id}>`))
        .replace(/(?<!<#)(?<![\w/=])(\d{17,19})(?!>)(?![\w/=])/g, "<#$1>");
}

/**
 * Nettoie les commentaires HTML et espaces invisibles
 */
export function cleanHtmlComments(text: string): string {
    return text
        .replace(/<!---->/g, "")
        .replace(/^[\s\r\n]+/, "")
        .replace(/<(?!@|#|@&|a?:)(\d)>/g, "")
        .replace(/(^|\n)[<>]\s+/g, "$1")
        .replace(/^<>\r?\n/, "");
}

/**
 * Supprime tous les emojis d'un texte (sauf les emojis Discord custom commençant par "zzz")
 */
export function removeEmojis(text: string): string {
    return text
        .replace(emojiRegex(), "")
        .replace(/<a?:(?!zzz)[a-zA-Z0-9_]+:[0-9]+>/g, "")
        .replace(/<:(?!zzz)([a-zA-Z0-9_]+):>/g, "")
        .replace(/:(?!zzz)[a-zA-Z0-9_]+:/g, "")
        .replace(/<(?!(@|#|:|https?:\/\/))[a-zA-Z0-9_]+>/g, "");
}

/**
 * Applique toutes les transformations de nettoyage de texte
 */
export function cleanDiscordText(text: string): string {
    return cleanHtmlComments(fixChannelMentions(wrapLinksNoEmbed(decodeHtmlEntities(text))));
}

/**
 * Lit un stream et le convertit en string
 */
export async function readStreamAsString(stream: ReadableStream<any>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        result += decoder.decode(value, {stream: true});
    }

    result += decoder.decode();
    return result;
}
