/**
 * Service de recherche web
 */

export interface WebContext {
    query: string;
    facts: string[];
}

/**
 * Raccourcit et nettoie un extrait de texte
 */
function sanitizeSnippet(text: string, maxLength = 240): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength - 1)}…`;
}

/**
 * Effectue une recherche avec l'API Brave
 */
export async function searchBrave(query: string): Promise<string | null> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) return null;

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");
    url.searchParams.set("search_lang", "fr");
    url.searchParams.set("country", "CA");
    url.searchParams.set("safesearch", "moderate");
    url.searchParams.set("text_decorations", "0");

    try {
        const response = await fetch(url.toString(), {
            headers: {
                Accept: "application/json",
                "X-Subscription-Token": apiKey,
            },
        });

        if (!response.ok) {
            console.warn(`[SearchService] Error ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const results: Array<{ title?: string; url?: string; description?: string }> = data?.web?.results || [];
        if (!results.length) return null;

        const lines = results.slice(0, 5).map((r, i) => {
            const title = r.title ? sanitizeSnippet(r.title, 120) : "Sans titre";
            const desc = r.description ? sanitizeSnippet(r.description, 240) : "";
            const link = r.url || "";
            return `${i + 1}. ${title}${desc ? ` — ${desc}` : ""}${link ? ` (${link})` : ""}`;
        });

        const joined = lines.join("\n");
        return joined.length > 1200 ? joined.slice(0, 1199) + "…" : joined;
    } catch (error) {
        console.warn("[SearchService] Request failed:", error);
        return null;
    }
}

/**
 * Détecte si une recherche web est nécessaire
 */
export function detectSearchIntent(prompt: string): boolean {
    if (prompt.length < 15) return false;

    const p = prompt.toLowerCase();

    // Questions factuelles explicites
    if (/(source|sources|lien|liens|référence|références|documentation|wiki|wikipédia)/i.test(p)) {
        return true;
    }

    // Actualité / temps réel
    if (/(actualité|news|aujourd'hui|cette semaine|récemment|dernier|dernière|mise à jour)/i.test(p)) {
        return true;
    }

    // Prix / comparaisons
    if (/(prix|coût|combien|review|avis|comparatif|vs)/i.test(p)) {
        return true;
    }

    // Faits datés / évolutifs
    if (/(version|sorti|date|quand|maintenant|actuel|au canada|en france|au québec|au quebec)/i.test(p)) {
        return true;
    }

    return false;
}

/**
 * Normalise une requête de recherche
 */
export function normalizeSearchQuery(prompt: string): string {
    let query = prompt.toLowerCase();

    query = query.replace(/c'est combien|est-ce que|dis moi|svp|c'est quoi|s'il te plaît/gi, "");
    query = query.replace(/[?!.]/g, "");

    query = query
        .split(" ")
        .map((w) => w.trim())
        .filter(Boolean)
        .join(" ");

    return query;
}

/**
 * Effectue une recherche web et retourne le contexte
 */
export async function getWebContext(prompt: string): Promise<WebContext | null> {
    if (!process.env.BRAVE_SEARCH_API_KEY || !detectSearchIntent(prompt)) {
        return null;
    }

    const webResults = await searchBrave(prompt);
    if (!webResults) return null;

    const facts = webResults
        .split("\n")
        .slice(0, 3)
        .map((l) => l.replace(/^\d+\.\s*/, "").slice(0, 200));

    return {
        query: normalizeSearchQuery(prompt),
        facts,
    };
}
