import {Client} from "discord.js";
import {unlockAchievement} from "./achievementService";
import {getUserStats} from "./userStatsService";
import {createLogger} from "../utils/logger";

const logger = createLogger("NetricsaAchievementChecker");

/**
 * Vérifie et débloque les achievements Netricsa pour un utilisateur
 */
export async function checkNetricsaAchievements(
    userId: string,
    username: string,
    client?: Client,
    channelId?: string
): Promise<void> {
    try {
        // Ne pas vérifier les achievements pour les bots
        if (client) {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user?.bot) {
                return; // Skip bots
            }
        }

        const stats = getUserStats(userId);
        if (!stats) return;

        const netricsa = stats.netricsa;

        // === GÉNÉRATION D'IMAGES ===
        if (netricsa.imagesGenerees >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_gen_first", client, channelId);
            }
        }

        if (netricsa.imagesGenerees >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_gen_10", client, channelId);
            }
        }

        if (netricsa.imagesGenerees >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_gen_50", client, channelId);
            }
        }

        if (netricsa.imagesGenerees >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_gen_200", client, channelId);
            }
        }

        if (netricsa.imagesGenerees >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_gen_500", client, channelId);
            }
        }

        // === RÉIMAGINATION ===
        if (netricsa.imagesReimaginee >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_reimagine_first", client, channelId);
            }
        }

        if (netricsa.imagesReimaginee >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_reimagine_10", client, channelId);
            }
        }

        if (netricsa.imagesReimaginee >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_reimagine_50", client, channelId);
            }
        }

        if (netricsa.imagesReimaginee >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_reimagine_200", client, channelId);
            }
        }

        // === UPSCALING ===
        if (netricsa.imagesUpscalee >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_upscale_first", client, channelId);
            }
        }

        if (netricsa.imagesUpscalee >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_upscale_10", client, channelId);
            }
        }

        if (netricsa.imagesUpscalee >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_upscale_50", client, channelId);
            }
        }

        if (netricsa.imagesUpscalee >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_upscale_200", client, channelId);
            }
        }

        // === CONVERSATIONS IA ===
        if (netricsa.conversationsIA >= 5) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_conv_5", client, channelId);
            }
        }

        if (netricsa.conversationsIA >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_conv_50", client, channelId);
            }
        }

        if (netricsa.conversationsIA >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_conv_200", client, channelId);
            }
        }

        if (netricsa.conversationsIA >= 500) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_conv_500", client, channelId);
            }
        }

        // === PROMPTS ===
        if (netricsa.promptsCrees >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_prompt_first", client, channelId);
            }
        }

        if (netricsa.promptsCrees >= 5) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_prompt_5", client, channelId);
            }
        }

        if (netricsa.promptsCrees >= 20) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_prompt_20", client, channelId);
            }
        }

        if (netricsa.promptsCrees >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_prompt_50", client, channelId);
            }
        }

        // === MEMES ===
        if (netricsa.memesRecherches >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "fun_meme_10", client, channelId);
            }
        }

        if (netricsa.memesRecherches >= 50) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "fun_meme_50", client, channelId);
            }
        }

        if (netricsa.memesRecherches >= 200) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "fun_meme_200", client, channelId);
            }
        }

        // === ACHIEVEMENTS COMBINÉS ===

        // Touche-à-tout : avoir utilisé toutes les fonctions images
        if (netricsa.imagesGenerees >= 1 && netricsa.imagesReimaginee >= 1 && netricsa.imagesUpscalee >= 1) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_all_features", client, channelId);
            }
        }

        // Créateur Complet : 100 générations + 10 prompts
        if (netricsa.imagesGenerees >= 100 && netricsa.promptsCrees >= 10) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_creator", client, channelId);
            }
        }

        // Maître Netricsa : 200 générations + 100 conversations + 20 prompts
        if (netricsa.imagesGenerees >= 200 && netricsa.conversationsIA >= 100 && netricsa.promptsCrees >= 20) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_master", client, channelId);
            }
        }

        // Artiste Total : 500 générations + 200 réimages + 100 upscales
        if (netricsa.imagesGenerees >= 500 && netricsa.imagesReimaginee >= 200 && netricsa.imagesUpscalee >= 100) {
            if (client && channelId) {
                await unlockAchievement(userId, username, "netricsa_total_artist", client, channelId);
            }
        }

    } catch (error) {
        logger.error(`Error checking Netricsa achievements for ${username}:`, error);
    }
}
