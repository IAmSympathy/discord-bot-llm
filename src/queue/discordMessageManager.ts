import {DMChannel, Message, TextChannel, ThreadChannel} from "discord.js";
import {DISCORD_MESSAGE_LIMIT, TYPING_ANIMATION_INTERVAL} from "../utils/constants";
import {cleanDiscordText} from "../utils/textTransformers";
import {createLogger} from "../utils/logger";

const logger = createLogger("DiscordMessageManager");

/**
 * Gère l'animation d'un message d'analyse d'image
 */
export class ImageAnalysisAnimation {
    private message: Message | null = null;
    private interval: NodeJS.Timeout | null = null;
    private dotCount = 1;

    async start(replyToMessage?: Message, channel?: TextChannel | ThreadChannel | DMChannel): Promise<void> {
        try {
            if (replyToMessage) {
                this.message = await replyToMessage.reply("Analyse de l'image.");
            } else if (channel) {
                this.message = await channel.send("Analyse de l'image.");
            }

            if (this.message) {
                this.interval = setInterval(async () => {
                    if (this.message) {
                        this.dotCount = (this.dotCount % 3) + 1;
                        const dots = ".".repeat(this.dotCount);
                        await this.message.edit(`Analyse de l'image${dots}`).catch(() => {
                        });
                    }
                }, TYPING_ANIMATION_INTERVAL);
            }
        } catch (error) {
            logger.error(`[ImageAnalysisAnimation] Erreur lors du démarrage:`, error);
        }
    }

    async stop(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getMessage(): Message | null {
        return this.message;
    }

    clearMessage(): void {
        this.message = null;
    }
}

/**
 * Gère les messages Discord pour les réponses du bot en plusieurs chunks
 */
export class DiscordMessageManager {
    private messages: Message[] = [];
    private responseChunks: string[] = [];
    private replyToMessage?: Message;
    private channel: any;
    private analysisAnimation: ImageAnalysisAnimation | null = null;
    private onFirstMessageSent?: () => void;

    constructor(channel: any, replyToMessage?: Message) {
        this.channel = channel;
        this.replyToMessage = replyToMessage;
    }

    setAnalysisAnimation(animation: ImageAnalysisAnimation): void {
        this.analysisAnimation = animation;
    }

    setOnFirstMessageSent(callback: () => void): void {
        this.onFirstMessageSent = callback;
    }

    addToCurrentChunk(text: string): void {
        if (this.responseChunks.length === 0) {
            this.responseChunks.push("");
        }

        const currentChunkIndex = this.responseChunks.length - 1;

        // Si le texte actuel dépasse la limite, diviser proprement
        if (text.length > DISCORD_MESSAGE_LIMIT) {
            // Garder la première partie dans le chunk actuel
            this.responseChunks[currentChunkIndex] = text.substring(0, DISCORD_MESSAGE_LIMIT);
            // Créer un nouveau chunk avec le reste
            this.responseChunks.push(text.substring(DISCORD_MESSAGE_LIMIT));
        } else {
            // Sinon, simplement mettre à jour le chunk actuel
            this.responseChunks[currentChunkIndex] = text;
        }
    }

    async throttleUpdate(): Promise<void> {
        // Créer le premier message si nécessaire
        if (this.messages.length === 0) {
            const rawContent = this.responseChunks[0];
            // Attendre d'avoir au moins 20 caractères avant d'envoyer le premier message
            if (!rawContent || rawContent.trim().length < 20) {
                return;
            }

            const currentContent = cleanDiscordText(rawContent);

            // Vérifier si on a un message d'analyse à réutiliser
            const analysisMessage = this.analysisAnimation?.getMessage();
            if (analysisMessage) {
                await this.analysisAnimation!.stop();
                await analysisMessage.edit(currentContent);
                this.messages.push(analysisMessage);
                this.analysisAnimation!.clearMessage();
            } else {
                // Créer un nouveau message
                if (this.replyToMessage) {
                    const message = await this.replyToMessage.reply({content: currentContent, allowedMentions: {repliedUser: true}});
                    this.messages.push(message);
                } else {
                    const message = await this.channel.send(currentContent);
                    this.messages.push(message);
                }
            }

            // Appeler le callback pour arrêter le typing indicator
            if (this.onFirstMessageSent) {
                this.onFirstMessageSent();
            }

            return;
        }

        // Créer des nouveaux messages pour les chunks supplémentaires
        while (this.messages.length < this.responseChunks.length) {
            const chunkIndex = this.messages.length;
            const rawContent = this.responseChunks[chunkIndex];
            if (!rawContent || rawContent.trim().length === 0) {
                break;
            }
            const currentContent = cleanDiscordText(rawContent);
            const message = await this.channel.send(currentContent);
            this.messages.push(message);
        }

        // OPTIMISATION : Mettre à jour UNIQUEMENT le dernier message (celui en cours d'édition)
        // Au lieu de mettre à jour TOUS les messages à chaque fois
        if (this.messages.length > 0 && this.responseChunks.length > 0) {
            const lastIndex = this.messages.length - 1;
            const message = this.messages[lastIndex];
            const rawChunk = this.responseChunks[lastIndex];

            if (message && rawChunk) {
                const nextContent = cleanDiscordText(rawChunk);
                if (message.content !== nextContent) {
                    await message.edit(nextContent);
                }
            }
        }
    }

    async finalizeLastMessage(): Promise<void> {
        if (this.messages.length > 0 && this.responseChunks.length > 0) {
            const finalContent = cleanDiscordText(this.responseChunks[this.responseChunks.length - 1]);
            await this.messages[this.messages.length - 1].edit(finalContent);
        }
    }

    getChunks(): string[] {
        return this.responseChunks;
    }

    hasMessages(): boolean {
        return this.messages.length > 0;
    }
}
