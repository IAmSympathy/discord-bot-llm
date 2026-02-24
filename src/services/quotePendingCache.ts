/**
 * Cache en mémoire pour associer un message bot (citation postée) à son texte.
 * Les commandes /quote et "Créer une citation" y déposent le texte juste avant
 * d'envoyer le message, et le citationsThreadHandler le consomme à la réception.
 *
 * Clé   : channelId  (on ne connaît pas encore l'ID du message au moment du dépôt)
 * Valeur: texte de la citation + TTL pour éviter les fuites mémoire
 */

interface PendingQuote {
    text: string;
    expiresAt: number;
}

// channelId → citation en attente
const cache = new Map<string, PendingQuote>();

const TTL_MS = 30_000; // 30 secondes max d'attente

/** Dépose le texte d'une citation pour un salon donné. */
export function registerPendingQuote(channelId: string, text: string): void {
    cache.set(channelId, {text, expiresAt: Date.now() + TTL_MS});
}

/**
 * Consomme la citation en attente pour un salon.
 * Retourne le texte si disponible et non expiré, sinon null.
 */
export function consumePendingQuote(channelId: string): string | null {
    const entry = cache.get(channelId);
    if (!entry) return null;
    cache.delete(channelId);
    if (Date.now() > entry.expiresAt) return null;
    return entry.text;
}

