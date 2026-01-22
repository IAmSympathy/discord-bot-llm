import { promises as fs } from "node:fs";
import * as path from "node:path";

export type MemoryTurn = {
  ts: number;
  discordUid: string;
  displayName: string;
  userText: string;
  assistantText: string;
};

type ChannelMemory = {
  turns: MemoryTurn[];
};

type MemoryFile = {
  version: 1;
  channels: Record<string, ChannelMemory>;
};

function defaultMemoryFile(): MemoryFile {
  return { version: 1, channels: {} };
}

export class FileMemory {
  private filePath: string;
  private data: MemoryFile | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async ensureLoaded() {
    if (this.data) return;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as MemoryFile;
      this.data = parsed?.version === 1 ? parsed : defaultMemoryFile();
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

  async getRecentTurns(channelKey: string, limit: number): Promise<MemoryTurn[]> {
    await this.ensureLoaded();
    const channel = this.data!.channels[channelKey];
    if (!channel?.turns?.length) return [];
    return channel.turns.slice(-limit);
  }

  async appendTurn(channelKey: string, turn: MemoryTurn, maxTurns: number): Promise<void> {
    await this.ensureLoaded();

    if (!this.data!.channels[channelKey]) {
      this.data!.channels[channelKey] = { turns: [] };
    }

    this.data!.channels[channelKey].turns.push(turn);

    const turns = this.data!.channels[channelKey].turns;
    if (turns.length > maxTurns) {
      this.data!.channels[channelKey].turns = turns.slice(-maxTurns);
    }

    this.writeChain = this.writeChain.then(() => this.flush());
    await this.writeChain;
  }
}
