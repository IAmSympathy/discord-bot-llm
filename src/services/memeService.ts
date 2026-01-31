import {Client, TextChannel} from "discord.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Service pour gérer les memes de Reddit
 * Publie des memes aléatoires et garde en mémoire ceux déjà publiés
 * Supporte plusieurs subreddits configurables
 */

const MEME_HISTORY_FILE = path.join(process.cwd(), "data", "posted_memes.json");
// Subreddits séparés par des virgules dans la variable d'environnement
// Exemple: "shitposting,memes,dankmemes"
const SUBREDDITS = process.env.MEME_SUBREDDITS?.split(',').map(s => s.trim()) || ['shitposting'];

interface PostedMeme {
    id: string;
    title: string;
    url: string;
    postedAt: number;
}

interface RedditPost {
    data: {
        id: string;
        title: string;
        url: string;
        post_hint?: string;
        is_video?: boolean;
        stickied?: boolean;
    };
}

/**
 * Charge l'historique des memes déjà postés
 */
function loadMemeHistory(): PostedMeme[] {
    try {
        if (fs.existsSync(MEME_HISTORY_FILE)) {
            const data = fs.readFileSync(MEME_HISTORY_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("[MemeService] Error loading meme history:", error);
    }
    return [];
}

/**
 * Sauvegarde l'historique des memes postés
 */
function saveMemeHistory(history: PostedMeme[]): void {
    try {
        const dir = path.dirname(MEME_HISTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(MEME_HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
    } catch (error) {
        console.error("[MemeService] Error saving meme history:", error);
    }
}

/**
 * Récupère les memes depuis un subreddit spécifique
 */
async function fetchMemesFromSubreddit(subreddit: string): Promise<RedditPost[]> {
    try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=100`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "DiscordBot:Netricsa:v1.0.0 (by /u/NetricsaBot)"
            }
        });

        if (!response.ok) {
            console.error(`[MemeService] Reddit API error for r/${subreddit}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.data.children.filter((post: RedditPost) => {
            const postData = post.data;
            // Filtrer pour garder les images et vidéos (pas les posts épinglés)
            return (
                !postData.stickied &&
                (postData.post_hint === "image" ||
                    postData.post_hint === "hosted:video" ||
                    postData.is_video ||
                    postData.url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i) ||
                    postData.url.includes('v.redd.it'))
            );
        });
    } catch (error) {
        console.error(`[MemeService] Error fetching memes from r/${subreddit}:`, error);
        return [];
    }
}

/**
 * Récupère les memes depuis tous les subreddits configurés
 */
async function fetchMemesFromReddit(): Promise<RedditPost[]> {
    try {
        console.log(`[MemeService] Fetching memes from subreddits: ${SUBREDDITS.join(', ')}`);

        // Récupérer les memes de tous les subreddits en parallèle
        const allMemesPromises = SUBREDDITS.map(subreddit => fetchMemesFromSubreddit(subreddit));
        const allMemesArrays = await Promise.all(allMemesPromises);

        // Fusionner tous les memes
        const allMemes = allMemesArrays.flat();

        console.log(`[MemeService] Found ${allMemes.length} total memes from all subreddits`);
        return allMemes;
    } catch (error) {
        console.error("[MemeService] Error fetching memes from Reddit:", error);
        return [];
    }
}

/**
 * Sélectionne un meme aléatoire non encore posté
 */
export async function getRandomMeme(): Promise<{ id: string; title: string; url: string } | null> {
    try {
        const history = loadMemeHistory();
        const postedIds = new Set(history.map(m => m.id));

        const memes = await fetchMemesFromReddit();
        const availableMemes = memes.filter(post => !postedIds.has(post.data.id));

        if (availableMemes.length === 0) {
            console.log("[MemeService] No new memes available, all have been posted");
            return null;
        }

        const randomMeme = availableMemes[Math.floor(Math.random() * availableMemes.length)];
        const memeData = randomMeme.data;

        return {
            id: memeData.id,
            title: memeData.title,
            url: memeData.url
        };
    } catch (error) {
        console.error("[MemeService] Error getting random meme:", error);
        return null;
    }
}

/**
 * Poste un meme dans le salon spécifié
 */
export async function postMeme(client: Client, channelId: string): Promise<boolean> {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !(channel instanceof TextChannel)) {
            console.error("[MemeService] Invalid channel or channel not found");
            return false;
        }

        const meme = await getRandomMeme();
        if (!meme) {
            return false;
        }

        // Poster le meme (seulement l'URL)
        await channel.send(meme.url);

        // Enregistrer dans l'historique
        const history = loadMemeHistory();
        history.push({
            id: meme.id,
            title: meme.title,
            url: meme.url,
            postedAt: Date.now()
        });
        saveMemeHistory(history);

        console.log(`[MemeService] Posted meme: "${meme.title}" (${meme.id})`);
        return true;
    } catch (error) {
        console.error("[MemeService] Error posting meme:", error);
        return false;
    }
}

/**
 * Nettoie l'historique des memes (garde seulement les 500 derniers)
 */
export function cleanupMemeHistory(): void {
    try {
        const history = loadMemeHistory();
        if (history.length > 500) {
            const cleaned = history.slice(-500); // Garder les 500 derniers
            saveMemeHistory(cleaned);
            console.log(`[MemeService] Cleaned up meme history: ${history.length} -> ${cleaned.length}`);
        }
    } catch (error) {
        console.error("[MemeService] Error cleaning up meme history:", error);
    }
}
