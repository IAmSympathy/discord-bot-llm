import {Client, TextChannel} from "discord.js";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

/**
 * Service pour gérer les memes de Reddit
 * Publie des memes aléatoires et garde en mémoire ceux déjà publiés
 * Supporte plusieurs subreddits configurables
 */

const logger = createLogger("MemeService");
const MEME_HISTORY_FILE = path.join(process.cwd(), "data", "posted_memes.json");
const SUBREDDITS = EnvConfig.MEME_SUBREDDITS;

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
        logger.error("Error loading meme history:", error);
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
        logger.error("Error saving meme history:", error);
    }
}

/**
 * Récupère les posts d'un subreddit (top posts de la journée)
 */
async function fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
    try {
        // Récupérer les posts les plus upvotés de la journée (top daily)
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=100`, {
            headers: {
                "User-Agent": "DiscordBot/1.0"
            }
        });

        if (!response.ok) {
            logger.error(`Reddit API error for r/${subreddit}: ${response.status}`);
            return [];
        }

        const json = await response.json();
        return json.data?.children || [];
    } catch (error) {
        logger.error(`Error fetching memes from r/${subreddit}:`, error);
        return [];
    }
}

/**
 * Récupère tous les memes disponibles de tous les subreddits
 */
export async function fetchMemesFromReddit(): Promise<RedditPost[]> {
    try {
        // Fetch de tous les subreddits en parallèle
        const allPostsArrays = await Promise.all(
            SUBREDDITS.map(subreddit => fetchSubredditPosts(subreddit))
        );

        // Combiner tous les posts
        const allPosts = allPostsArrays.flat();

        // Filtrer pour garder seulement les images et vidéos non stickied
        return allPosts.filter(post => {
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
        logger.error("Error fetching memes from Reddit:", error);
        return [];
    }
}

/**
 * Récupère un meme aléatoire qui n'a pas encore été posté
 */
export async function getRandomMeme(): Promise<{ id: string; title: string; url: string } | null> {
    try {
        const history = loadMemeHistory();
        const postedIds = new Set(history.map(m => m.id));

        const memes = await fetchMemesFromReddit();
        const availableMemes = memes.filter(post => !postedIds.has(post.data.id));

        if (availableMemes.length === 0) {
            logger.warn("No new memes available (all have been posted)");
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
        logger.error("Error getting random meme:", error);
        return null;
    }
}

/**
 * Poste un meme automatiquement dans le salon configuré
 */
export async function postMemeToChannel(client: Client): Promise<boolean> {
    try {
        const memeChannelId = EnvConfig.MEME_CHANNEL_ID;
        if (!memeChannelId) {
            logger.error("Invalid channel or channel not found");
            return false;
        }

        const channel = await client.channels.fetch(memeChannelId);
        if (!channel || !(channel instanceof TextChannel)) {
            logger.error("Invalid channel or channel not found");
            return false;
        }

        const meme = await getRandomMeme();
        if (!meme) {
            logger.warn("No new memes available to post");
            return false;
        }

        await channel.send(`> ${meme.title}\n${meme.url}`);
        logger.info(`Posted meme: "${meme.title}" (${meme.id})`);

        // Enregistrer dans l'historique
        const history = loadMemeHistory();
        history.push({
            id: meme.id,
            title: meme.title,
            url: meme.url,
            postedAt: Date.now()
        });
        saveMemeHistory(history);

        return true;
    } catch (error) {
        logger.error("Error posting meme:", error);
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
            logger.info(`Cleaned up meme history: ${history.length} -> ${cleaned.length}`);
        }
    } catch (error) {
        logger.error("Error cleaning up meme history:", error);
    }
}
