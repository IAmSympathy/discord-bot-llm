import {Message as DiscordMessage} from "discord.js";
import {convertTextEmojisToUnicode, extractValidEmojis, removeFirstEmoji, removeResponsePrefixes} from "../utils/textTransformers";
import {createLogger} from "../utils/logger";

const logger = createLogger("EmojiReactionHandler");

/**
 * Gère l'extraction et l'application des réactions emoji
 * Le premier emoji est converti en réaction Discord et supprimé du message
 * Les autres emojis restent dans le texte
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
                    logger.info(`Applied reaction: ${firstEmoji} (${emojis.length - 1} other emoji(s) kept in text)`);
                } catch (error) {
                    logger.warn(`Failed to apply ${firstEmoji}:`, error);
                }
            }
        }

        // 3. Retirer UNIQUEMENT le premier emoji (qui devient la réaction)
        // Les autres emojis restent dans le message
        return removeFirstEmoji(modifiedText);
    }

    getAppliedEmojis(): string[] {
        return this.appliedEmojis;
    }
}
