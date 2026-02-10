import {Client, EmbedBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {loadFireData} from "./fireDataManager";
import {EnvConfig} from "../../utils/envConfig";
import {FIRE_EMOJIS, getFireState} from "./fireData";

const logger = createLogger("FireSeasonManager");

/**
 * Date de fin de la saison hiver 2026
 * 20 mars 2026 à 00:00 (équinoxe de printemps)
 */
const WINTER_SEASON_END = new Date('2026-03-20T00:00:00-05:00'); // UTC-5 pour Sherbrooke

/**
 * Vérifie si c'est la fin de la saison et envoie les statistiques
 */
export async function checkSeasonEnd(client: Client): Promise<void> {
    const now = new Date();

    // Vérifier si on est au 20 mars 2026
    if (now >= WINTER_SEASON_END) {
        logger.info("Winter season ended! Sending season statistics...");
        await sendSeasonStatistics(client);
    }
}

/**
 * Envoie les statistiques de la saison dans le salon des annonces
 */
export async function sendSeasonStatistics(client: Client): Promise<void> {
    try {
        const announcementChannelId = EnvConfig.ANNOUNCEMENTS_CHANNEL_ID;

        if (!announcementChannelId) {
            logger.warn("ANNOUNCEMENTS_CHANNEL_ID not configured, cannot send season stats");
            return;
        }

        const guild = client.guilds.cache.first();
        if (!guild) {
            logger.error("No guild found");
            return;
        }

        const channel = await guild.channels.fetch(announcementChannelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            logger.error("Announcement channel not found or not text-based");
            return;
        }

        // Charger les données du feu
        const fireData = loadFireData();

        // Créer l'embed des statistiques
        const embed = createSeasonStatsEmbed(fireData);

        // Envoyer le message
        await channel.send({
            embeds: [embed]
        });

        logger.info("Season statistics sent successfully!");

    } catch (error) {
        logger.error("Error sending season statistics:", error);
    }
}

/**
 * Crée l'embed des statistiques de fin de saison
 */
function createSeasonStatsEmbed(fireData: any): EmbedBuilder {
    const totalLogs = fireData.stats.totalLogs || 0;
    const currentIntensity = fireData.intensity;

    // Obtenir l'emoji de l'état final
    const finalState = getFireState(currentIntensity);
    const finalEmoji = FIRE_EMOJIS[finalState];

    // Calculer la durée de la saison (du 1er décembre au 20 mars)
    const seasonStart = new Date('2025-12-01T00:00:00-05:00');
    const seasonEnd = new Date('2026-03-20T00:00:00-05:00');
    const seasonDays = Math.floor((seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));

    // Estimer le temps au stade maximum (81-100%)
    // Chaque bûche ajoute 8%, donc il faut environ 12-13 bûches pour atteindre 100%
    // Si on a beaucoup de bûches, le feu a probablement passé plus de temps au maximum
    const logsPerDay = totalLogs / seasonDays;
    let maxStageHours = 0;

    if (logsPerDay >= 15) {
        // Si plus de 15 bûches/jour, le feu était souvent au max
        maxStageHours = Math.floor(seasonDays * 24 * 0.6); // ~60% du temps
    } else if (logsPerDay >= 10) {
        maxStageHours = Math.floor(seasonDays * 24 * 0.4); // ~40% du temps
    } else if (logsPerDay >= 5) {
        maxStageHours = Math.floor(seasonDays * 24 * 0.2); // ~20% du temps
    } else {
        maxStageHours = Math.floor(seasonDays * 24 * 0.1); // ~10% du temps
    }

    const maxStageDays = Math.floor(maxStageHours / 24);
    const maxStageRemainingHours = maxStageHours % 24;

    const embed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle("🔥 FIN DE LA SAISON - FEU DE FOYER HIVER 2026")
        .setDescription(
            `L'hiver se termine et avec lui, notre traditionnel **Feu de Foyer** s'éteint pour laisser place au printemps ! 🌸\n\n` +
            `Voici les statistiques de cette saison hivernale :`
        )
        .addFields(
            {
                name: "Statistiques Globales",
                value:
                    `• **Durée de la saison :** ${seasonDays} jours 📅\n` +
                    `• **Bûches ajoutées :** ${totalLogs.toLocaleString()} 🪵\n` +
                    `• **État final du feu :** ${currentIntensity}% ${finalEmoji}\n` +
                    `• **Temps au stade maximum :** ${maxStageDays}j ${maxStageRemainingHours}h 🔥`,
                inline: false
            },
            {
                name: "Performance de la Communauté",
                value: getTierMessage(totalLogs, seasonDays),
                inline: false
            },
            {
                name: "💫 Multiplicateur d'XP",
                value:
                    `Le feu de foyer vous a permis de bénéficier d'un multiplicateur d'XP variant entre **×0.33** et **×1.33** selon son intensité.\n\n` +
                    `Merci à tous ceux qui ont contribué à maintenir les flammes vivantes ! 🙏`,
                inline: false
            }
        )
        .setFooter({text: "Le feu de foyer reviendra l'hiver prochain ! ❄️"})
        .setTimestamp();

    return embed;
}

/**
 * Détermine le message de performance selon le nombre de bûches
 */
function getTierMessage(totalLogs: number, seasonDays: number): string {
    const logsPerDay = totalLogs / seasonDays;

    if (logsPerDay >= 20) {
        return `**EXCEPTIONNEL** - La communauté a été extraordinaire ! Le feu n'a jamais faibli grâce à vos contributions constantes.`;
    } else if (logsPerDay >= 15) {
        return `**EXCELLENT** - Le feu a été maintenu avec brio ! La communauté a montré un grand engagement.`;
    } else if (logsPerDay >= 10) {
        return `**TRÈS BIEN** - Le feu a bien résisté à l'hiver ! Un bon travail d'équipe.`;
    } else if (logsPerDay >= 5) {
        return `**BIEN** - Le feu a tenu bon malgré quelques moments difficiles. On peut mieux faire !`;
    } else {
        return `**PEUT MIEUX FAIRE** - Le feu a souvent vacillé cet hiver. L'an prochain, soyez plus vigilants !`;
    }
}

/**
 * Initialise la vérification de fin de saison
 * Vérifie tous les jours à minuit
 */
export function initializeSeasonEndCheck(client: Client): void {
    // Vérifier immédiatement au démarrage
    checkSeasonEnd(client);

    // Calculer le temps jusqu'à minuit
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Premier check à minuit
    setTimeout(() => {
        checkSeasonEnd(client);

        // Puis vérifier tous les jours à minuit
        setInterval(() => {
            checkSeasonEnd(client);
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    logger.info("Season end check initialized - will check daily at midnight");
}


