import {Message as DiscordMessage} from "discord.js";
import {convertTextEmojisToUnicode, extractValidEmojis, removeEmojis} from "../utils/textTransformers";

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
        // Convertir les smileys textuels en emojis Unicode AVANT d'extraire les emojis
        let modifiedText = convertTextEmojisToUnicode(text);

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

        // Retirer tous les emojis du texte
        return removeEmojis(modifiedText);
    }

    getAppliedEmojis(): string[] {
        return this.appliedEmojis;
    }
}
