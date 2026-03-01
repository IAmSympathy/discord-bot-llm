/**
 * Nexa - Lecteur audio
 * Gère la connexion vocale et la lecture avec @discordjs/voice + play-dl
 */

import {AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, VoiceConnection,} from "@discordjs/voice";
import {VoiceBasedChannel} from "discord.js";
import playdl from "play-dl";
import * as fs from "fs";
import * as path from "path";
import {advanceQueue, formatDuration, getCurrentTrack, getQueue, TrackInfo,} from "./musicQueue";

/**
 * Parse un fichier cookies au format Netscape et retourne la chaîne "key=value; key2=value2"
 * attendue par play-dl / les headers HTTP.
 */
function parseNetscapeCookies(content: string): string {
    return content
        .split("\n")
        .filter(line => line && !line.startsWith("#") && !line.startsWith(" "))
        .map(line => {
            const parts = line.split("\t");
            // Format Netscape : domain flag path secure expiry name value
            if (parts.length >= 7) {
                const name = parts[5].trim();
                const value = parts[6].trim();
                return `${name}=${value}`;
            }
            return null;
        })
        .filter(Boolean)
        .join("; ");
}

// ── Initialisation des cookies YouTube si définis (contourne les restrictions anti-bot)
(async () => {
    const cookieEnv = process.env.YOUTUBE_COOKIE;
    if (!cookieEnv) return;

    try {
        let rawContent = cookieEnv;

        // Si c'est un chemin de fichier, lire le contenu
        if (cookieEnv.endsWith(".txt") || cookieEnv.startsWith("./") || cookieEnv.startsWith("/")) {
            const cookiePath = path.resolve(process.cwd(), cookieEnv);
            if (fs.existsSync(cookiePath)) {
                rawContent = fs.readFileSync(cookiePath, "utf-8");
                console.log(`[Nexa] Fichier cookies chargé depuis: ${cookiePath}`);
            } else {
                console.warn(`[Nexa] Fichier cookies introuvable: ${cookiePath}`);
                return;
            }
        }

        // Convertir le format Netscape → "key=value; key2=value2"
        const cookieString = parseNetscapeCookies(rawContent);
        if (!cookieString) {
            console.warn("[Nexa] Aucun cookie valide trouvé dans le fichier");
            return;
        }

        await playdl.setToken({
            youtube: {cookie: cookieString},
        });
        const cookieCount = cookieString.split(";").length;
        console.log(`[Nexa] ✓ ${cookieCount} cookies YouTube initialisés`);
    } catch (err) {
        console.warn("[Nexa] Impossible d'initialiser les cookies YouTube:", err);
    }
})();

// Map guildId → AudioPlayer actif
const players = new Map<string, AudioPlayer>();

/** Callback appelé quand un track se termine (pour mettre à jour le UI) */
type OnTrackEnd = (guildId: string) => Promise<void>;
type OnTrackError = (guildId: string, error: Error) => Promise<void>;

let onTrackEndCallback: OnTrackEnd | null = null;
let onTrackErrorCallback: OnTrackError | null = null;

export function setCallbacks(onEnd: OnTrackEnd, onError: OnTrackError) {
    onTrackEndCallback = onEnd;
    onTrackErrorCallback = onError;
}

/** Rejoint un salon vocal et renvoie la connexion */
export async function joinVoice(channel: VoiceBasedChannel): Promise<VoiceConnection> {
    const existing = getVoiceConnection(channel.guild.id);
    if (existing) {
        // Si on est déjà dans un salon, s'assurer qu'on est dans le bon
        if (existing.joinConfig.channelId !== channel.id) {
            existing.destroy();
        } else {
            return existing;
        }
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
        selfDeaf: true,
    });

    return connection;
}

/** Déconnecte le bot d'un salon vocal */
export function leaveVoice(guildId: string): void {
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
    const player = players.get(guildId);
    if (player) {
        player.stop(true);
        players.delete(guildId);
    }
}

/** Recherche YouTube et retourne les infos du premier résultat */
export async function searchYouTube(query: string): Promise<TrackInfo | null> {
    try {
        let info: any;

        // URL directe (YouTube video ou playlist)
        if (playdl.yt_validate(query) === "video" || playdl.yt_validate(query) === "search") {
            const isUrl = query.startsWith("http://") || query.startsWith("https://");
            if (isUrl) {
                info = await playdl.video_info(query);
            } else {
                const results = await playdl.search(query, {source: {youtube: "video"}, limit: 1});
                if (!results.length) return null;
                info = await playdl.video_info(results[0].url);
            }
        } else {
            const results = await playdl.search(query, {source: {youtube: "video"}, limit: 1});
            if (!results.length) return null;
            info = await playdl.video_info(results[0].url);
        }

        const video = info.video_details;
        const durationSec = video.durationInSec ?? 0;

        return {
            url: video.url,
            title: video.title ?? "Titre inconnu",
            durationSeconds: durationSec,
            durationFormatted: formatDuration(durationSec),
            thumbnail: video.thumbnails?.[0]?.url ?? "",
            requestedBy: "",      // sera rempli par l'appelant
            requestedById: "",
            isLive: video.live ?? false,
            channelName: video.channel?.name ?? "",
        };
    } catch (error) {
        console.error("[Nexa] Erreur lors de la recherche YouTube:", error);
        return null;
    }
}

/** Lance la lecture du track actuel dans la file */
export async function playCurrentTrack(guildId: string): Promise<boolean> {
    const q = getQueue(guildId);
    const track = getCurrentTrack(guildId);
    if (!q || !track) return false;

    const connection = getVoiceConnection(guildId);
    if (!connection) return false;

    try {
        let player = players.get(guildId);
        if (!player) {
            player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });
            players.set(guildId, player);
            connection.subscribe(player);

            // Événement : track terminé
            player.on(AudioPlayerStatus.Idle, async () => {
                const hasNext = advanceQueue(guildId);
                if (hasNext) {
                    await playCurrentTrack(guildId);
                } else {
                    // File épuisée → déconnexion après 30s d'inactivité
                    setTimeout(() => {
                        const stillIdle = player?.state.status === AudioPlayerStatus.Idle;
                        if (stillIdle) leaveVoice(guildId);
                    }, 30_000);
                }
                if (onTrackEndCallback) await onTrackEndCallback(guildId);
            });

            // Erreur
            player.on("error", async (error) => {
                console.error(`[Nexa] Erreur audio [${guildId}]:`, error);
                if (onTrackErrorCallback) await onTrackErrorCallback(guildId, error);
                // Passer au suivant
                const hasNext = advanceQueue(guildId);
                if (hasNext) await playCurrentTrack(guildId);
            });
        }

        // Créer le stream play-dl
        const stream = await playdl.stream(track.url, {
            quality: 2, // 0=basse, 2=haute
        });

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
        });

        resource.volume?.setVolume(q.volume);

        player.play(resource);
        q.isPaused = false;

        console.log(`[Nexa] ▶️ Lecture: ${track.title}`);
        return true;
    } catch (error) {
        console.error(`[Nexa] Erreur lors de la lecture [${guildId}]:`, error);
        return false;
    }
}

/** Pause / Reprend la lecture */
export function togglePause(guildId: string): "paused" | "resumed" | "no_player" {
    const player = players.get(guildId);
    const q = getQueue(guildId);
    if (!player || !q) return "no_player";

    if (player.state.status === AudioPlayerStatus.Playing) {
        player.pause();
        q.isPaused = true;
        return "paused";
    } else if (player.state.status === AudioPlayerStatus.Paused) {
        player.unpause();
        q.isPaused = false;
        return "resumed";
    }
    return "no_player";
}

/** Stoppe la lecture et vide la file */
export function stopPlayback(guildId: string): void {
    const player = players.get(guildId);
    if (player) player.stop(true);
}

/** Skip le track courant */
export function skipTrack(guildId: string): void {
    const player = players.get(guildId);
    if (player) player.stop(); // déclenche l'événement Idle → advanceQueue
}

/** Vérifie si le bot joue actuellement */
export function isPlaying(guildId: string): boolean {
    const player = players.get(guildId);
    return player?.state.status === AudioPlayerStatus.Playing;
}

/** Retourne le player d'une guilde */
export function getPlayer(guildId: string): AudioPlayer | undefined {
    return players.get(guildId);
}


