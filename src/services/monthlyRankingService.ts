import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR, MODERATOR_ROLES, MONTHLY_RANKING_ROLES, OWNER_ROLES} from "../utils/constants";
import {Client, EmbedBuilder, Guild, GuildMember, TextChannel} from "discord.js";
import {cleanupOldMonths, getMonthlyXP} from "./monthlyXPService";
import {EnvConfig} from "../utils/envConfig";

const logger = createLogger("MonthlyRanking");
const MONTHLY_RANKING_FILE = path.join(DATA_DIR, "monthly_ranking_state.json");

interface MonthlyRankingState {
    lastProcessedMonth: string; // Format: "YYYY-MM"
    lastGoldUserId?: string;
    lastSilverUserId?: string;
    lastBronzeUserId?: string;
    lastCelestialUserId?: string;
}

/**
 * Charge l'état du classement mensuel
 */
function loadState(): MonthlyRankingState {
    try {
        if (fs.existsSync(MONTHLY_RANKING_FILE)) {
            const data = fs.readFileSync(MONTHLY_RANKING_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading monthly ranking state:", error);
    }
    return {lastProcessedMonth: ""};
}

/**
 * Sauvegarde l'état du classement mensuel
 */
function saveState(state: MonthlyRankingState): void {
    try {
        const dir = path.dirname(MONTHLY_RANKING_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(MONTHLY_RANKING_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        logger.error("Error saving monthly ranking state:", error);
    }
}

/**
 * Obtient le mois précédent au format YYYY-MM
 */
function getPreviousMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    if (month === 0) {
        // Janvier -> Décembre de l'année précédente
        return `${year - 1}-12`;
    } else {
        return `${year}-${String(month).padStart(2, '0')}`;
    }
}

/**
 * Obtient le mois actuel au format YYYY-MM
 */
function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Vérifie si un utilisateur est owner, admin, ou le bot lui-même
 */
async function isOwnerOrAdminOrBot(guild: Guild, userId: string): Promise<boolean> {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;

        // Vérifier si c'est un bot (incluant Netricsa)
        if (member.user.bot) return true;

        // Vérifier les rôles owner et modérateur
        const ownerAndAdminRoles: readonly string[] = [...OWNER_ROLES, ...MODERATOR_ROLES];
        return member.roles.cache.some(role => ownerAndAdminRoles.includes(role.id));
    } catch {
        return false;
    }
}

/**
 * Retire tous les rôles de classement mensuel d'un membre
 */
async function removeAllRankingRoles(member: GuildMember): Promise<void> {
    const rolesToRemove = [
        MONTHLY_RANKING_ROLES.GOLD,
        MONTHLY_RANKING_ROLES.SILVER,
        MONTHLY_RANKING_ROLES.BRONZE,
        MONTHLY_RANKING_ROLES.CELESTIAL
    ];

    for (const roleId of rolesToRemove) {
        if (roleId.startsWith("ROLE_ID_")) continue; // Skip placeholder IDs
        try {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
            }
        } catch (error) {
            logger.error(`Error removing role ${roleId} from ${member.user.username}:`, error);
        }
    }
}

/**
 * Traite le classement mensuel
 */
export async function processMonthlyRanking(client: Client): Promise<void> {
    try {
        const state = loadState();
        const currentMonth = getCurrentMonth();

        // Vérifier si on a déjà traité ce mois
        if (state.lastProcessedMonth === currentMonth) {
            logger.info(`Monthly ranking already processed for ${currentMonth}`);
            return;
        }

        logger.info(`Processing monthly ranking for ${currentMonth}...`);

        // Récupérer le serveur
        const guildId = EnvConfig.GUILD_ID;
        if (!guildId) {
            logger.error("GUILD_ID not configured");
            return;
        }

        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            logger.error("Guild not found");
            return;
        }

        // Récupérer le salon d'annonces
        const announcementChannelId = EnvConfig.ANNOUNCEMENTS_CHANNEL_ID;
        if (!announcementChannelId) {
            logger.error("ANNOUNCEMENTS_CHANNEL_ID not configured");
            return;
        }

        const announcementChannel = await guild.channels.fetch(announcementChannelId) as TextChannel;
        if (!announcementChannel) {
            logger.error("Announcement channel not found");
            return;
        }

        // Récupérer les XP du mois précédent
        const previousMonth = getPreviousMonth();
        const monthlyData = getMonthlyXP(previousMonth);

        if (!monthlyData || Object.keys(monthlyData).length === 0) {
            logger.warn(`No XP data for ${previousMonth}`);
            return;
        }

        // Filtrer les bots, owners et admins
        const eligibleUsers: Array<{ userId: string; username: string; xpGained: number }> = [];

        for (const [userId, data] of Object.entries(monthlyData)) {
            const userData = data as any;

            // Vérifier si c'est un bot
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member || member.user.bot) continue;

            // Vérifier si c'est owner ou admin
            if (await isOwnerOrAdminOrBot(guild, userId)) continue;

            eligibleUsers.push({
                userId,
                username: userData.username,
                xpGained: userData.xpGained
            });
        }

        // Trier par XP décroissant
        eligibleUsers.sort((a, b) => b.xpGained - a.xpGained);

        if (eligibleUsers.length === 0) {
            logger.warn("No eligible users for monthly ranking");
            return;
        }

        // Retirer les anciens rôles de classement de tout le monde
        logger.info("Removing old ranking roles...");
        const allMembers = await guild.members.fetch();
        for (const [_, member] of allMembers) {
            if (member.user.bot) continue;
            await removeAllRankingRoles(member);
        }

        // Attribuer les nouveaux rôles
        const top3 = eligibleUsers.slice(0, 3);
        const winners: Array<{ position: string; userId: string; username: string; xpGained: number; role: string }> = [];

        // Gold (1er)
        if (top3.length >= 1) {
            const goldUser = top3[0];
            const goldMember = await guild.members.fetch(goldUser.userId).catch(() => null);
            // Double vérification : pas un bot, pas owner/admin
            if (goldMember &&
                !(await isOwnerOrAdminOrBot(guild, goldUser.userId)) &&
                !MONTHLY_RANKING_ROLES.GOLD.startsWith("ROLE_ID_")) {
                await goldMember.roles.add(MONTHLY_RANKING_ROLES.GOLD);
                winners.push({position: "🥇", userId: goldUser.userId, username: goldUser.username, xpGained: goldUser.xpGained, role: "Gold"});
                state.lastGoldUserId = goldUser.userId;
                logger.info(`Awarded Gold role to ${goldUser.username}`);
            } else {
                logger.warn(`Skipped Gold role for ${goldUser.username} (bot/admin/owner or role not configured)`);
            }
        }

        // Silver (2ème)
        if (top3.length >= 2) {
            const silverUser = top3[1];
            const silverMember = await guild.members.fetch(silverUser.userId).catch(() => null);
            // Double vérification : pas un bot, pas owner/admin
            if (silverMember &&
                !(await isOwnerOrAdminOrBot(guild, silverUser.userId)) &&
                !MONTHLY_RANKING_ROLES.SILVER.startsWith("ROLE_ID_")) {
                await silverMember.roles.add(MONTHLY_RANKING_ROLES.SILVER);
                winners.push({position: "🥈", userId: silverUser.userId, username: silverUser.username, xpGained: silverUser.xpGained, role: "Silver"});
                state.lastSilverUserId = silverUser.userId;
                logger.info(`Awarded Silver role to ${silverUser.username}`);
            } else {
                logger.warn(`Skipped Silver role for ${silverUser.username} (bot/admin/owner or role not configured)`);
            }
        }

        // Bronze (3ème)
        if (top3.length >= 3) {
            const bronzeUser = top3[2];
            const bronzeMember = await guild.members.fetch(bronzeUser.userId).catch(() => null);
            // Double vérification : pas un bot, pas owner/admin
            if (bronzeMember &&
                !(await isOwnerOrAdminOrBot(guild, bronzeUser.userId)) &&
                !MONTHLY_RANKING_ROLES.BRONZE.startsWith("ROLE_ID_")) {
                await bronzeMember.roles.add(MONTHLY_RANKING_ROLES.BRONZE);
                winners.push({position: "🥉", userId: bronzeUser.userId, username: bronzeUser.username, xpGained: bronzeUser.xpGained, role: "Bronze"});
                state.lastBronzeUserId = bronzeUser.userId;
                logger.info(`Awarded Bronze role to ${bronzeUser.username}`);
            } else {
                logger.warn(`Skipped Bronze role for ${bronzeUser.username} (bot/admin/owner or role not configured)`);
            }
        }

        // Celestial (random parmi les autres)
        let celestialWinner: { userId: string; username: string } | null = null;
        const eligibleForCelestial = eligibleUsers.slice(3); // Exclure le top 3

        if (eligibleForCelestial.length > 0 && !MONTHLY_RANKING_ROLES.CELESTIAL.startsWith("ROLE_ID_")) {
            const randomIndex = Math.floor(Math.random() * eligibleForCelestial.length);
            const celestialUser = eligibleForCelestial[randomIndex];
            const celestialMember = await guild.members.fetch(celestialUser.userId).catch(() => null);

            // Double vérification : pas un bot, pas owner/admin
            if (celestialMember &&
                !(await isOwnerOrAdminOrBot(guild, celestialUser.userId))) {
                await celestialMember.roles.add(MONTHLY_RANKING_ROLES.CELESTIAL);
                celestialWinner = {userId: celestialUser.userId, username: celestialUser.username};
                state.lastCelestialUserId = celestialUser.userId;
                logger.info(`Awarded Celestial role to ${celestialUser.username}`);
            } else {
                logger.warn(`Skipped Celestial role for ${celestialUser.username} (bot/admin/owner)`);
            }
        }

        // Créer l'embed d'annonce
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        const [year, month] = previousMonth.split('-');
        const monthName = monthNames[parseInt(month) - 1];

        const embed = new EmbedBuilder()
            .setColor(0xFFD700) // Gold
            .setTitle(`🏆 Classement Mensuel - ${monthName} ${year}`)
            .setDescription(`Voici les champions du mois dernier ! 👑\n\nFélicitations aux gagnants qui reçoivent leurs rôles exclusifs !`)
            .setTimestamp();

        // Ajouter le top 3
        if (winners.length > 0) {
            let top3Description = "";
            for (const winner of winners) {
                top3Description += `${winner.position}. <@${winner.userId}> - 💫 ${winner.xpGained.toLocaleString()} XP\n`;
            }
            embed.addFields({name: "🏅 Top 3 du mois", value: top3Description, inline: false});
        }

        // Ajouter le Celestial
        if (celestialWinner) {
            embed.addFields({
                name: "✨ Bonus",
                value: `Un membre chanceux reçoit le rôle <@&${MONTHLY_RANKING_ROLES.CELESTIAL}>: <@${celestialWinner.userId}> ! 🌌`,
                inline: false
            });
        }

        embed.setFooter({text: "Les rôles sont réinitialisés chaque mois. Continuez à accumuler de l'XP !"});

        // Construire les mentions réelles (hors embed) pour que les pings fonctionnent
        const mentionParts: string[] = winners.map(w => `<@${w.userId}>`);
        if (celestialWinner) mentionParts.push(`<@${celestialWinner.userId}>`);
        const mentions = mentionParts.join(" ");

        // Envoyer l'annonce — les mentions dans `content` génèrent de vrais pings
        await announcementChannel.send({
            content: mentions,
            embeds: [embed]
        });

        // Mettre à jour l'état
        state.lastProcessedMonth = currentMonth;
        saveState(state);

        // Nettoyer les vieux mois (garder seulement les 3 derniers)
        cleanupOldMonths();

        logger.info(`Monthly ranking processed successfully for ${currentMonth}`);
        logger.info(`Winners: ${winners.map(w => w.username).join(", ")}${celestialWinner ? ` + ${celestialWinner.username} (Celestial)` : ""}`);

    } catch (error) {
        logger.error("Error processing monthly ranking:", error);
    }
}

/**
 * Vérifie si on doit traiter le classement mensuel (début du mois)
 */
export function shouldProcessMonthlyRanking(): boolean {
    const state = loadState();
    const currentMonth = getCurrentMonth();
    return state.lastProcessedMonth !== currentMonth;
}

/**
 * Initialise le service de classement mensuel
 * Vérifie chaque jour à 12h00 si on doit traiter le classement
 */
export function initializeMonthlyRankingService(client: Client): void {
    logger.info("Monthly Ranking Service initialized");

    // Vérifier immédiatement au démarrage
    if (shouldProcessMonthlyRanking()) {
        logger.info("Processing monthly ranking at startup...");
        processMonthlyRanking(client).catch(error => {
            logger.error("Error processing monthly ranking at startup:", error);
        });
    }

    // Vérifier tous les jours à 12h00
    const checkInterval = 60 * 60 * 1000; // 1 heure
    setInterval(async () => {
        const now = new Date();
        // Vérifier si c'est midi (12h)
        if (now.getHours() === 12 && now.getMinutes() === 0) {
            if (shouldProcessMonthlyRanking()) {
                logger.info("Processing monthly ranking (scheduled check)...");
                await processMonthlyRanking(client);
            }
        }
    }, checkInterval);
}
