import {promises as fs} from "node:fs";
import * as path from "node:path";
import {slidingWindowMemory} from "./memoryFilter";
import {MEMORY_IMPORTANCE_THRESHOLD, MEMORY_IMPORTANT_OLD_TURNS, MEMORY_RECENT_TURNS} from "../utils/constants";
import {createLogger} from "../utils/logger";

const logger = createLogger("FileMemory");

export type WebContext = {
    query: string;
    facts: string[];
};

export type ImageGenerationInfo = {
    type: "imagine" | "reimagine" | "upscale";
    prompt?: string; // Juste pour se souvenir du sujet
};

export type MemoryTurn = {
    ts: number;
    discordUid: string;
    displayName: string;
    userText: string;
    assistantText?: string; // Optionnel pour les messages passifs (Mode Hybride)

    // Channel où le message a été envoyé
    channelId: string;
    channelName: string;

    // Image (optionnelle)
    imageDescriptions?: string[];

    // Contexte web (optionnel)
    webContext?: WebContext;

    // Réactions appliquées par l'assistant (ex: ["😏", "🔥"])
    assistantReactions?: string[];

    // Génération d'image (optionnel)
    imageGeneration?: ImageGenerationInfo;

    // Indique si c'est un message passif (vu mais sans réponse du bot)
    isPassive?: boolean;

    // Indique si c'est une réponse à un autre message (reply)
    isReply?: boolean;
};

type MemoryFile = {
    version: 2;
    globalTurns: MemoryTurn[];
};

function defaultMemoryFile(): MemoryFile {
    return {version: 2, globalTurns: []};
}

export class FileMemory {
    private filePath: string;
    private data: MemoryFile | null = null;
    private writeChain: Promise<void> = Promise.resolve();

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async getRecentTurns(maxTurns: number = MEMORY_RECENT_TURNS): Promise<MemoryTurn[]> {
        await this.ensureLoaded();

        // Combiner les turns de tous les channels dans un seul tableau
        const allTurns: MemoryTurn[] = [];
        for (const turn of this.data!.globalTurns) {
            allTurns.push(turn);
        }

        // Trier par timestamp
        allTurns.sort((a, b) => a.ts - b.ts);

        // Appliquer le Sliding Window System
        const result = slidingWindowMemory(
            allTurns,
            maxTurns,
            MEMORY_IMPORTANT_OLD_TURNS,
            MEMORY_IMPORTANCE_THRESHOLD
        );

        return result as MemoryTurn[];
    }

    async appendTurn(turn: MemoryTurn, maxTurns: number): Promise<void> {
        await this.ensureLoaded();

        this.data!.globalTurns.push(turn);

        // Limiter le nombre total de turns
        if (this.data!.globalTurns.length > maxTurns) {
            this.data!.globalTurns = this.data!.globalTurns.slice(-maxTurns);
        }

        this.writeChain = this.writeChain.then(() => this.flush());
        await this.writeChain;
    }

    async clearChannel(channelKey: string): Promise<void> {
        await this.ensureLoaded();

        // Filtrer pour retirer tous les turns de ce channel
        const beforeCount = this.data!.globalTurns.length;
        this.data!.globalTurns = this.data!.globalTurns.filter(turn => turn.channelId !== channelKey);
        const afterCount = this.data!.globalTurns.length;

        if (beforeCount !== afterCount) {
            logger.info(`Removed ${beforeCount - afterCount} turns from channel ${channelKey}`);
            this.writeChain = this.writeChain.then(() => this.flush());
            await this.writeChain;
        }
    }

    async clearAll(): Promise<void> {
        await this.ensureLoaded();

        this.data!.globalTurns = [];
        this.writeChain = this.writeChain.then(() => this.flush());
        await this.writeChain;
    }

    private async ensureLoaded() {
        if (this.data) return;

        await fs.mkdir(path.dirname(this.filePath), {recursive: true});

        try {
            const raw = await fs.readFile(this.filePath, "utf-8");
            const parsed = JSON.parse(raw);

            if (parsed?.version === 2) {
                this.data = parsed as MemoryFile;
            } else {
                this.data = defaultMemoryFile();
                await this.flush();
            }
        } catch {
            this.data = defaultMemoryFile();
            await this.flush();
        }
    }

    private async flush() {
        if (!this.data) return;

        const tmp = `${this.filePath}.tmp`;
        const payload = JSON.stringify(this.data, null, 2);
        await fs.writeFile(tmp, payload, "utf-8");
        await fs.rename(tmp, this.filePath);
    }
}
