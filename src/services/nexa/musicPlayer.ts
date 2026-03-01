/**
 * Nexa - Lecteur audio
 * Gère la connexion vocale et la lecture avec @discordjs/voice + play-dl
 */

import {AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnection,} from "@discordjs/voice";
import {VoiceBasedChannel} from "discord.js";
import playdl from "play-dl";
import * as fs from "fs";
import * as path from "path";
import {spawn} from "child_process";
import {Readable} from "stream";
import {advanceQueue, formatDuration, getCurrentTrack, getQueue, TrackInfo,} from "./musicQueue";

/**
 * Parse un fichier cookies au format Netscape → "key=value; key2=value2"
 */
function parseNetscapeCookies(content: string): string {
    return content
        .split("\n")
        .filter(line => line && !line.startsWith("#") && !line.startsWith(" "))
        .map(line => {
            const parts = line.split("\t");
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

/**
 * Initialise les cookies YouTube — retourne une Promise résolue quand c'est prêt.
 * Doit être await-ée dans NexaBot.start() avant toute recherche.
 */
export async function initializeCookies(): Promise<void> {
    const cookieEnv = process.env.YOUTUBE_COOKIE;
    if (!cookieEnv) return;

    try {
        let rawContent = cookieEnv;

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

        const cookieString = parseNetscapeCookies(rawContent);
        if (!cookieString) {
            console.warn("[Nexa] Aucun cookie valide trouvé dans le fichier");
            return;
        }

        await playdl.setToken({youtube: {cookie: cookieString}});
        console.log(`[Nexa] ✓ ${cookieString.split(";").length} cookies YouTube initialisés`);
    } catch (err) {
        console.warn("[Nexa] Impossible d'initialiser les cookies YouTube:", err);
    }
}

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
        if (existing.joinConfig.channelId !== channel.id) {
            existing.destroy();
        } else {
            return existing;
        }
    }

    return joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
        selfDeaf: true,
    });
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

/**
 * Recherche YouTube — utilise search() pour les textes et video_info() uniquement
 * pour les URLs directes (évite le blocage anti-bot sur les recherches texte).
 */
export async function searchYouTube(query: string): Promise<TrackInfo | null> {
    try {
        const isUrl = query.startsWith("http://") || query.startsWith("https://");

        if (isUrl && playdl.yt_validate(query) === "video") {
            // URL directe → video_info
            const info = await playdl.video_info(query);
            const v = info.video_details;
            const durationSec = v.durationInSec ?? 0;
            return {
                url: v.url,
                title: v.title ?? "Titre inconnu",
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                thumbnail: v.thumbnails?.[0]?.url ?? "",
                requestedBy: "",
                requestedById: "",
                isLive: v.live ?? false,
                channelName: v.channel?.name ?? "",
            };
        }

        // Recherche textuelle (ou URL non-vidéo) → search() uniquement, pas de video_info
        const results = await playdl.search(query, {source: {youtube: "video"}, limit: 1});
        if (!results.length) return null;

        const v = results[0];
        const durationSec = v.durationInSec ?? 0;
        return {
            url: v.url,
            title: v.title ?? "Titre inconnu",
            durationSeconds: durationSec,
            durationFormatted: formatDuration(durationSec),
            thumbnail: v.thumbnails?.[0]?.url ?? "",
            requestedBy: "",
            requestedById: "",
            isLive: v.live ?? false,
            channelName: v.channel?.name ?? "",
        };
    } catch (error) {
        console.error("[Nexa] Erreur lors de la recherche YouTube:", error);
        return null;
    }
}

/**
 * Résout le chemin absolu vers cookies.txt de façon fiable.
 * Priorité : YOUTUBE_COOKIE absolu > relatif à PROJECT_ROOT > relatif à cwd
 */
function resolveCookiesPath(): string | undefined {
    const cookieEnv = process.env.YOUTUBE_COOKIE;
    if (!cookieEnv) return undefined;

    // Déjà un chemin absolu
    if (path.isAbsolute(cookieEnv)) {
        return fs.existsSync(cookieEnv) ? cookieEnv : undefined;
    }

    // Chercher depuis __dirname en remontant jusqu'à trouver package.json
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, cookieEnv.replace(/^\.\//, ""));
        if (fs.existsSync(candidate)) {
            console.log(`[Nexa] Cookies résolus: ${candidate}`);
            return candidate;
        }
        if (fs.existsSync(path.join(dir, "package.json"))) {
            // On est à la racine, essayer ici
            const rootCandidate = path.join(dir, cookieEnv.replace(/^\.\//, ""));
            return fs.existsSync(rootCandidate) ? rootCandidate : undefined;
        }
        dir = path.dirname(dir);
    }
    return undefined;
}

// Résoudre une seule fois au démarrage du module
const COOKIES_PATH = resolveCookiesPath();
console.log(`[Nexa] Chemin cookies au démarrage: ${COOKIES_PATH ?? "non trouvé"}`);

/**
 * Crée un stream audio via yt-dlp.
 * yt-dlp pipe le stream audio directement sur stdout → createAudioResource.
 */
function createYtDlpStream(url: string): Readable {
    const ytDlpArgs: string[] = [];

    if (COOKIES_PATH) {
        ytDlpArgs.push("--cookies", COOKIES_PATH);
    } else {
        console.warn("[Nexa yt-dlp] ⚠️ Aucun fichier cookies disponible");
    }

    ytDlpArgs.push(
        "--no-playlist",
        "--js-runtimes", "node",
        "--downloader", "ffmpeg",
        "-f", "bestaudio/best",
        "--downloader-args", "ffmpeg:-vn -acodec libopus -f opus pipe:1",
        "--no-warnings",
        "-o", "-",
        url,
    );

    console.log(`[Nexa yt-dlp] Commande: yt-dlp ${ytDlpArgs.slice(0, 4).join(" ")} ... ${url}`);

    const ytDlp = spawn("yt-dlp", ytDlpArgs, {stdio: ["ignore", "pipe", "pipe"]});

    ytDlp.stderr.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg && !msg.startsWith("[download]") && !msg.startsWith("[info]")) {
            console.error(`[Nexa yt-dlp] ${msg}`);
        }
    });

    ytDlp.on("error", (err) => {
        console.error("[Nexa yt-dlp] Erreur spawn:", err.message);
    });

    return ytDlp.stdout as unknown as Readable;
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
                behaviors: {noSubscriber: NoSubscriberBehavior.Pause},
            });
            players.set(guildId, player);
            connection.subscribe(player);

            // Track terminé
            player.on(AudioPlayerStatus.Idle, async () => {
                const hasNext = advanceQueue(guildId);
                if (hasNext) {
                    await playCurrentTrack(guildId);
                } else {
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
                const hasNext = advanceQueue(guildId);
                if (hasNext) await playCurrentTrack(guildId);
            });
        }

        const stream = createYtDlpStream(track.url);
        const resource = createAudioResource(stream, {
            inputType: StreamType.OggOpus,
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

/** Stoppe la lecture */
export function stopPlayback(guildId: string): void {
    const player = players.get(guildId);
    if (player) player.stop(true);
}

/** Skip le track courant */
export function skipTrack(guildId: string): void {
    const player = players.get(guildId);
    if (player) player.stop();
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
