/**
 * Nexa - Lecteur audio via Lavalink + Kazagumo
 * Kazagumo gère la connexion vocale, la file d'attente et la lecture.
 * Ce fichier expose une interface simple utilisée par nexaBot.ts
 */

import {Kazagumo, KazagumoPlayer, KazagumoTrack} from "kazagumo";
import {Connectors} from "shoukaku";
import {Client} from "discord.js";

// ── Configuration Lavalink (depuis .env)
export function getLavalinkNodes() {
    return [{
        name: "main",
        url: `${process.env.LAVALINK_HOST ?? "localhost"}:${process.env.LAVALINK_PORT ?? "2333"}`,
        auth: process.env.LAVALINK_PASSWORD ?? "youshallnotpass",
        secure: false,
    }];
}

let kazagumo: Kazagumo | null = null;

/** Initialise Kazagumo avec le client Discord. Doit être appelé dans NexaBot.start() */
export function initKazagumo(client: Client): Kazagumo {
    if (kazagumo) return kazagumo;

    kazagumo = new Kazagumo(
        {
            defaultSearchEngine: "youtube",
            // Spotify plugin optionnel
            plugins: [],
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            },
        },
        new Connectors.DiscordJS(client),
        getLavalinkNodes(),
        {
            resume: true,
            resumeTimeout: 60,
            reconnectTries: 20,
            reconnectInterval: 5000,
            restTimeout: 60000,
            moveOnDisconnect: false,
        }
    );

    kazagumo.shoukaku.on("ready", (name) => {
        console.log(`[Nexa] ✅ Lavalink node "${name}" connecté`);
    });
    kazagumo.shoukaku.on("disconnect", (name, count) => {
        console.warn(`[Nexa] ⚠️ Lavalink node "${name}" déconnecté (players: ${count})`);
    });
    kazagumo.shoukaku.on("error", (name, error) => {
        console.error(`[Nexa] ❌ Lavalink node "${name}" erreur: ${error.message}`);
    });

    return kazagumo;
}

/** Vérifie si au moins un node Lavalink est disponible */
export function isLavalinkReady(): boolean {
    if (!kazagumo) return false;
    return kazagumo.shoukaku.nodes.size > 0 &&
        [...kazagumo.shoukaku.nodes.values()].some(n => n.state === 1); // 1 = CONNECTED
}

export function getKazagumo(): Kazagumo {
    if (!kazagumo) throw new Error("[Nexa] Kazagumo non initialisé");
    return kazagumo;
}

// ── Re-exports de types utiles
export type {KazagumoPlayer, KazagumoTrack};

/** Recherche YouTube et retourne le premier résultat */
export async function searchYouTube(query: string): Promise<KazagumoTrack | null> {
    try {
        const k = getKazagumo();
        const isUrl = query.startsWith("http://") || query.startsWith("https://");
        const result = await k.search(isUrl ? query : `ytsearch:${query}`);
        if (!result || result.tracks.length === 0) return null;
        return result.tracks[0];
    } catch (err) {
        console.error("[Nexa] Erreur recherche:", err);
        return null;
    }
}

/** Crée ou récupère le player Lavalink pour une guilde */
export async function getOrCreatePlayer(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string
): Promise<KazagumoPlayer> {
    const k = getKazagumo();
    const existing = k.players.get(guildId);
    if (existing) return existing;

    return await k.createPlayer({
        guildId,
        voiceId: voiceChannelId,
        textId: textChannelId,
        deaf: true,
        volume: 80,
    });
}

/** Stoppe la lecture et détruit le player */
export async function destroyPlayer(guildId: string): Promise<void> {
    const k = getKazagumo();
    const player = k.players.get(guildId);
    if (player) await player.destroy();
}

/** Pause / Reprend */
export async function togglePause(guildId: string): Promise<"paused" | "resumed" | "no_player"> {
    const k = getKazagumo();
    const player = k.players.get(guildId);
    if (!player) return "no_player";

    if (player.paused) {
        await player.pause(false);
        return "resumed";
    } else {
        await player.pause(true);
        return "paused";
    }
}

/** Skip le track courant */
export async function skipTrack(guildId: string): Promise<void> {
    const k = getKazagumo();
    const player = k.players.get(guildId);
    if (player) await player.skip();
}

/** Stop (vide la queue + arrête) */
export async function stopPlayback(guildId: string): Promise<void> {
    await destroyPlayer(guildId);
}

/** Vérifie si le bot joue */
export function isPlaying(guildId: string): boolean {
    const k = getKazagumo();
    const player = k.players.get(guildId);
    return player?.playing ?? false;
}
