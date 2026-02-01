import {Client} from "discord.js";
import {cleanupMemeHistory, postMemeToChannel} from "./memeService";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

/**
 * Service pour planifier la publication automatique de memes
 * Publie 1 fois par jour à 13h00
 */

const logger = createLogger("MemeScheduler");
const MEME_SCHEDULE_FILE = path.join(process.cwd(), "data", "meme_schedule.json");
const MEME_CHANNEL_ID = EnvConfig.MEME_CHANNEL_ID;

// Publication quotidienne
const POSTING_HOUR = 13; // 13h00
const POSTING_MINUTE = 0;

interface ScheduleData {
    lastPosted: number;
    nextScheduledPost: number;
}

/**
 * Charge les données de planification
 */
function loadScheduleData(): ScheduleData {
    try {
        if (fs.existsSync(MEME_SCHEDULE_FILE)) {
            const data = fs.readFileSync(MEME_SCHEDULE_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading schedule data:", error);
    }
    return {
        lastPosted: 0,
        nextScheduledPost: 0
    };
}

/**
 * Sauvegarde les données de planification
 */
function saveScheduleData(data: ScheduleData): void {
    try {
        const dir = path.dirname(MEME_SCHEDULE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(MEME_SCHEDULE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving schedule data:", error);
    }
}

/**
 * Calcule le prochain moment de publication (quotidien à 13h00)
 */
function getNextPostingDate(): Date {
    const now = new Date();
    const nextDate = new Date(now);

    // Définir l'heure de publication d'aujourd'hui
    nextDate.setHours(POSTING_HOUR, POSTING_MINUTE, 0, 0);

    // Si l'heure est déjà passée aujourd'hui, passer à demain
    if (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
}

/**
 * Vérifie s'il faut poster un meme maintenant
 */
async function checkAndPostMeme(client: Client): Promise<void> {
    if (!MEME_CHANNEL_ID) {
        logger.info("MEME_CHANNEL_ID not configured, skipping auto-post");
        return;
    }

    const scheduleData = loadScheduleData();
    const now = Date.now();

    // Si c'est le moment de poster (ou si on est en retard)
    if (scheduleData.nextScheduledPost === 0 || now >= scheduleData.nextScheduledPost) {
        logger.info("🎭 Time to post a meme!");

        const success = await postMemeToChannel(client);

        if (success) {
            // Mettre à jour la planification
            const nextPost = getNextPostingDate();
            scheduleData.lastPosted = now;
            scheduleData.nextScheduledPost = nextPost.getTime();
            saveScheduleData(scheduleData);

            logger.info(`✅ Meme posted! Next post scheduled for: ${nextPost.toLocaleString('fr-FR')}`);
        } else {
            // En cas d'échec, réessayer dans 1 heure
            scheduleData.nextScheduledPost = now + (60 * 60 * 1000);
            saveScheduleData(scheduleData);
            logger.warn("❌ Failed to post meme, will retry in 1 hour");
        }
    }
}

/**
 * Initialise le planificateur de memes
 */
export function initializeMemeScheduler(client: Client): void {
    if (!MEME_CHANNEL_ID) {
        logger.info("MEME_CHANNEL_ID not configured, auto-posting disabled");
        return;
    }

    // Initialiser la prochaine date de publication si nécessaire
    const scheduleData = loadScheduleData();
    if (scheduleData.nextScheduledPost === 0) {
        const nextPost = getNextPostingDate();
        scheduleData.nextScheduledPost = nextPost.getTime();
        saveScheduleData(scheduleData);
        logger.info(`📅 First meme post scheduled for: ${nextPost.toLocaleString('fr-FR')}`);
    } else {
        const nextPost = new Date(scheduleData.nextScheduledPost);
        logger.info(`📅 Next meme post scheduled for: ${nextPost.toLocaleString('fr-FR')}`);
    }

    // Vérifier toutes les 30 minutes si on doit poster
    setInterval(() => {
        checkAndPostMeme(client).catch(error => {
            logger.error("Error checking meme schedule:", error);
        });
    }, 30 * 60 * 1000); // 30 minutes

    // Vérification immédiate au démarrage (au cas où on aurait raté un post)
    setTimeout(() => {
        checkAndPostMeme(client).catch(error => {
            logger.error("Error checking meme schedule:", error);
        });
    }, 5000); // Attendre 5 secondes après le démarrage

    // Nettoyer l'historique une fois par jour
    setInterval(() => {
        cleanupMemeHistory();
    }, 24 * 60 * 60 * 1000); // 24 heures

    logger.info("✅ Meme scheduler initialized (posts daily at 13:00)");
}
