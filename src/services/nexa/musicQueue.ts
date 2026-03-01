/**
 * Nexa - Gestionnaire de file d'attente musicale
 * Gère les tracks par guilde (multi-serveur)
 */

export interface TrackInfo {
    url: string;
    title: string;
    durationFormatted: string;        // ex: "3:45"
    durationSeconds: number;
    thumbnail: string;
    requestedBy: string;              // display name de l'auteur
    requestedById: string;
    isLive: boolean;
    channelName: string;              // nom de la chaîne YouTube
}

export interface GuildQueue {
    guildId: string;
    voiceChannelId: string;
    textChannelId: string;            // salon dédié (messages de contrôle)
    tracks: TrackInfo[];
    currentIndex: number;
    loop: "none" | "track" | "queue";
    isPaused: boolean;
    controlMessageId: string | null;  // ID du message component v2 persistant
    volume: number;                   // 0.0 - 1.0
}

const queues = new Map<string, GuildQueue>();

/** Récupère ou crée la file d'une guilde */
export function getOrCreateQueue(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string
): GuildQueue {
    if (!queues.has(guildId)) {
        queues.set(guildId, {
            guildId,
            voiceChannelId,
            textChannelId,
            tracks: [],
            currentIndex: 0,
            loop: "none",
            isPaused: false,
            controlMessageId: null,
            volume: 0.8,
        });
    }
    return queues.get(guildId)!;
}

export function getQueue(guildId: string): GuildQueue | undefined {
    return queues.get(guildId);
}

export function deleteQueue(guildId: string): void {
    queues.delete(guildId);
}

/** Ajoute un track à la fin de la file */
export function enqueue(guildId: string, track: TrackInfo): void {
    const q = queues.get(guildId);
    if (q) q.tracks.push(track);
}

/** Retourne le track en cours de lecture */
export function getCurrentTrack(guildId: string): TrackInfo | null {
    const q = queues.get(guildId);
    if (!q || q.tracks.length === 0) return null;
    return q.tracks[q.currentIndex] ?? null;
}

/** Avance au track suivant selon le mode loop. Retourne false si la file est terminée */
export function advanceQueue(guildId: string): boolean {
    const q = queues.get(guildId);
    if (!q) return false;

    if (q.loop === "track") {
        // Même index → rejouer
        return true;
    }

    if (q.loop === "queue") {
        q.currentIndex = (q.currentIndex + 1) % q.tracks.length;
        return true;
    }

    // mode none
    q.currentIndex += 1;
    return q.currentIndex < q.tracks.length;
}

/** Supprime un track par son index dans la liste */
export function removeTrack(guildId: string, index: number): boolean {
    const q = queues.get(guildId);
    if (!q || index < 0 || index >= q.tracks.length) return false;
    q.tracks.splice(index, 1);
    // Ajuster l'index courant si nécessaire
    if (index < q.currentIndex) q.currentIndex--;
    if (q.currentIndex >= q.tracks.length) q.currentIndex = Math.max(0, q.tracks.length - 1);
    return true;
}

/** Vide la file (sauf le track en cours si skipCurrent = false) */
export function clearQueue(guildId: string, keepCurrent = false): void {
    const q = queues.get(guildId);
    if (!q) return;
    if (keepCurrent && q.tracks.length > 0) {
        const current = q.tracks[q.currentIndex];
        q.tracks = current ? [current] : [];
        q.currentIndex = 0;
    } else {
        q.tracks = [];
        q.currentIndex = 0;
    }
}

/** Formate la durée en MM:SS ou HH:MM:SS */
export function formatDuration(seconds: number): string {
    if (seconds <= 0) return "🔴 LIVE";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

