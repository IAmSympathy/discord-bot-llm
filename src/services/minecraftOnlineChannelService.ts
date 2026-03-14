import {Activity, Client, GuildChannel} from "discord.js";
import {createLogger} from "../utils/logger";
import {EnvConfig} from "../utils/envConfig";

const logger = createLogger("MinecraftOnlineChannelService");

const DEFAULT_STATUS_SOURCE_USER_ID = "1482105326021906432";
const DEFAULT_CHANNEL_ID = "1481902621005713530";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_RENAMES_PER_WINDOW = 2;
const RATE_LIMIT_SAFETY_MS = 1000;

const renameTimestamps: number[] = [];
let pendingName: string | null = null;
let pendingRenameTimer: NodeJS.Timeout | null = null;

function extractOnlinePlayersFromActivities(activities: readonly Activity[]): number | null {
    const patterns = [
        /(\d+)\s*\/\s*\d+\s*(?:players?|joueurs?)/i,
        /(?:online|en\s+ligne)\s*[:\-]?\s*(\d+)/i,
        /(\d+)\s*(?:players?|joueurs?)\s*(?:online|en\s+ligne)?/i,
    ];

    for (const activity of activities) {
        const candidates = [activity.name, activity.state, activity.details];
        for (const value of candidates) {
            if (!value) continue;
            for (const pattern of patterns) {
                const match = value.match(pattern);
                if (!match) continue;
                const onlinePlayers = parseInt(match[1], 10);
                if (!Number.isNaN(onlinePlayers) && onlinePlayers >= 0) {
                    return onlinePlayers;
                }
            }
        }
    }

    return null;
}

async function updateMinecraftOnlineChannel(client: Client, onlinePlayers: number): Promise<void> {
    const expectedName = `👥 En ligne : ${onlinePlayers}`;
    await tryRenameMinecraftChannel(client, expectedName);
}

function pruneRenameTimestamps(now: number): void {
    while (renameTimestamps.length > 0 && now - renameTimestamps[0] >= RATE_LIMIT_WINDOW_MS) {
        renameTimestamps.shift();
    }
}

function getRequiredDelayBeforeRename(now: number): number {
    pruneRenameTimestamps(now);

    if (renameTimestamps.length < MAX_RENAMES_PER_WINDOW) {
        return 0;
    }

    const oldestRenameTs = renameTimestamps[0];
    return Math.max(0, (oldestRenameTs + RATE_LIMIT_WINDOW_MS + RATE_LIMIT_SAFETY_MS) - now);
}

function recordRename(now: number): void {
    renameTimestamps.push(now);
    pruneRenameTimestamps(now);
}

async function getTargetGuildChannel(client: Client): Promise<GuildChannel | null> {
    const channelId = EnvConfig.MINECRAFT_ONLINE_CHANNEL_ID || DEFAULT_CHANNEL_ID;

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
        logger.warn(`[Minecraft] Channel ${channelId} introuvable`);
        return null;
    }

    if (!("guild" in channel) || typeof (channel as any).setName !== "function") {
        logger.warn(`[Minecraft] Channel ${channelId} n'est pas renommable`);
        return null;
    }

    return channel as GuildChannel;
}

async function resolveOnlinePlayersFromSourcePresence(client: Client): Promise<number | null> {
    const guildChannel = await getTargetGuildChannel(client);
    if (!guildChannel) return null;

    const sourceUserId = EnvConfig.MINECRAFT_STATUS_SOURCE_USER_ID || DEFAULT_STATUS_SOURCE_USER_ID;
    const sourceMember = await guildChannel.guild.members.fetch(sourceUserId).catch(() => null);
    if (!sourceMember) {
        logger.warn(`[Minecraft] Source presence introuvable (userId: ${sourceUserId})`);
        return null;
    }

    const activities = sourceMember.presence?.activities ?? [];
    if (activities.length === 0) {
        logger.warn(`[Minecraft] Aucune activité de présence détectée pour ${sourceMember.user.username} (${sourceUserId})`);
        return null;
    }

    const onlinePlayers = extractOnlinePlayersFromActivities(activities);
    if (onlinePlayers === null) {
        logger.warn(`[Minecraft] Impossible d'extraire X depuis les activités de présence de ${sourceMember.user.username}`);
        return null;
    }

    return onlinePlayers;
}

function schedulePendingRename(client: Client, delayMs: number): void {
    if (pendingRenameTimer) return;

    pendingRenameTimer = setTimeout(() => {
        pendingRenameTimer = null;
        void flushPendingRename(client);
    }, delayMs);
}

async function flushPendingRename(client: Client): Promise<void> {
    if (!pendingName) return;

    const nextName = pendingName;
    pendingName = null;

    const guildChannel = await getTargetGuildChannel(client);
    if (!guildChannel) return;
    if (guildChannel.name === nextName) return;

    const now = Date.now();
    const delay = getRequiredDelayBeforeRename(now);
    if (delay > 0) {
        pendingName = nextName;
        schedulePendingRename(client, delay);
        return;
    }

    await guildChannel.setName(nextName);
    recordRename(Date.now());
    logger.info(`[Minecraft] Salon renommé: ${nextName}`);
}

async function tryRenameMinecraftChannel(client: Client, expectedName: string): Promise<void> {
    const guildChannel = await getTargetGuildChannel(client);
    if (!guildChannel) return;

    if (guildChannel.name === expectedName) return;

    const now = Date.now();
    const delay = getRequiredDelayBeforeRename(now);
    if (delay > 0) {
        pendingName = expectedName;
        schedulePendingRename(client, delay);
        logger.info(`[Minecraft] Rename différé pour respecter la limite Discord (dans ${Math.ceil(delay / 1000)}s)`);
        return;
    }

    await guildChannel.setName(expectedName);
    recordRename(now);
    logger.info(`[Minecraft] Salon renommé: ${expectedName}`);
}

export function startMinecraftOnlineChannelUpdater(client: Client): void {
    const intervalMs = EnvConfig.MINECRAFT_ONLINE_UPDATE_INTERVAL_MS;

    if (intervalMs <= 0) {
        logger.warn("[Minecraft] Updater désactivé (interval <= 0)");
        return;
    }

    const tick = async () => {
        try {
            const onlinePlayers = await resolveOnlinePlayersFromSourcePresence(client);
            if (onlinePlayers === null) return;
            await updateMinecraftOnlineChannel(client, onlinePlayers);
        } catch (error) {
            logger.warn("[Minecraft] Erreur pendant la mise à jour du salon:", error);
        }
    };

    void tick();
    setInterval(() => {
        void tick();
    }, intervalMs);

    logger.info(`[Minecraft] Updater démarré (interval ${intervalMs / 1000}s)`);
}


