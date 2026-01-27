import {Message as DiscordMessage} from "discord.js";
import {DISCORD_MESSAGE_LIMIT, IMAGE_ANALYSIS_ANIMATION_INTERVAL} from "../utils/constants";
import {cleanDiscordText} from "../utils/textTransformers";

/**
 * Gère l'animation d'un message d'analyse d'image
 */
export class ImageAnalysisAnimation {
    private message: DiscordMessage | null = null;
    private interval: NodeJS.Timeout | null = null;
    private dotCount = 1;

    async start(replyToMessage?: DiscordMessage, channel?: any): Promise<void> {
        if (replyToMessage) {
            this.message = await replyToMessage.reply("Analyse de l'image.");
        } else if (channel) {
            this.message = await channel.send("Analyse de l'image.");
        }

        this.interval = setInterval(async () => {
            if (this.message) {
                this.dotCount = (this.dotCount % 3) + 1;
                const dots = ".".repeat(this.dotCount);
                await this.message.edit(`Analyse de l'image${dots}`).catch(() => {
                });
            }
        }, IMAGE_ANALYSIS_ANIMATION_INTERVAL);
    }

    async stop(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getMessage(): DiscordMessage | null {
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
    private messages: DiscordMessage[] = [];
    private responseChunks: string[] = [];
    private replyToMessage?: DiscordMessage;
    private channel: any;
    private analysisAnimation: ImageAnalysisAnimation | null = null;

    constructor(channel: any, replyToMessage?: DiscordMessage) {
        this.channel = channel;
        this.replyToMessage = replyToMessage;
    }

    setAnalysisAnimation(animation: ImageAnalysisAnimation): void {
        this.analysisAnimation = animation;
    }

    addToCurrentChunk(text: string): void {
        if (this.responseChunks.length === 0) {
            this.responseChunks.push("");
        }

        const currentChunkIndex = this.responseChunks.length - 1;
        this.responseChunks[currentChunkIndex] = text;

        // Si le chunk dépasse la limite, créer un nouveau chunk
        if (text.length > DISCORD_MESSAGE_LIMIT) {
            this.responseChunks.push("");
        }
    }

    async throttleUpdate(): Promise<void> {
        // Créer le premier message si nécessaire
        if (this.messages.length === 0) {
            const rawContent = this.responseChunks[0];
            if (!rawContent || rawContent.trim().length === 0) {
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

        // Mettre à jour les messages existants
        for (let i = 0; i < this.messages.length; i++) {
            const message = this.messages[i];
            if (!message) continue;
            const rawChunk = this.responseChunks[i];
            if (!rawChunk) continue;
            const nextContent = cleanDiscordText(rawChunk);
            if (message.content !== nextContent) {
                await message.edit(nextContent);
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
