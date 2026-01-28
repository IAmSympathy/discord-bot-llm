import {Message as DiscordMessage} from "discord.js";
import {convertTextEmojisToUnicode, extractValidEmojis, removeEmojis, removeResponsePrefixes} from "../utils/textTransformers";

/**
 * Gère l'extraction et l'application des réactions emoji
 */
export class EmojiReactionHandler {
    private replyToMessage?: DiscordMessage;
    private reactionApplied = false;
    private appliedEmojis: string[] = [];

    constructor(replyToMessage?: DiscordMessage) {
        this.replyToMessage = replyToMessage;
    }

    async extractAndApply(text: string): Promise<string> {
        // 1. Nettoyer les préfixes invalides en premier (TOI (Netricsa) répond:, etc.)
        let modifiedText = removeResponsePrefixes(text);

        // 2. Convertir les smileys textuels en emojis Unicode
        modifiedText = convertTextEmojisToUnicode(modifiedText);

        if (this.replyToMessage && !this.reactionApplied) {
            const emojis = Array.from(new Set(extractValidEmojis(modifiedText)));

            if (emojis.length > 0) {
                const firstEmoji = emojis[0];
                try {
                    await this.replyToMessage.react(firstEmoji);
                    this.reactionApplied = true;
                    this.appliedEmojis = [firstEmoji];
                } catch (error) {
                    console.warn(`[Reaction] Failed to apply ${firstEmoji}:`, error);
                }
            }
        }

        // 3. Retirer tous les emojis du texte
        return removeEmojis(modifiedText);
    }

    getAppliedEmojis(): string[] {
        return this.appliedEmojis;
    }
}
