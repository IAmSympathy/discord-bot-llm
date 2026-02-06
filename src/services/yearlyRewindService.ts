import {Client, EmbedBuilder, TextChannel} from "discord.js";
import {createLogger} from "../utils/logger";
import {EnvConfig} from "../utils/envConfig";
import {getServerMostUsedEmoji, NETRICSA_USER_ID} from "./userStatsService";
import {getYearlyServerStats, getYearlyStats} from "./yearlyStatsService";
import {getYearlyXP} from "./yearlyXPService";
import * as fs from "fs";
import * as path from "path";

const logger = createLogger("YearlyRewind");
const REWIND_STATE_FILE = path.join(process.cwd(), "data", "rewind_state.json");
const ANNOUNCEMENTS_CHANNEL_ID = EnvConfig.ANNOUNCEMENTS_CHANNEL_ID;
const GUILD_ID = EnvConfig.GUILD_ID;

interface RewindState {
    lastRewind: string; // Année au format YYYY
}

/**
 * Charge l'état du rewind
 */
function loadRewindState(): RewindState {
    try {
        if (fs.existsSync(REWIND_STATE_FILE)) {
            const data = fs.readFileSync(REWIND_STATE_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading rewind state:", error);
    }
    return {
        lastRewind: ""
    };
}

/**
 * Sauvegarde l'état du rewind
 */
function saveRewindState(state: RewindState): void {
    try {
        const dir = path.dirname(REWIND_STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(REWIND_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving rewind state:", error);
    }
}

/**
 * Obtient l'année actuelle au format YYYY
 */
function getCurrentYear(): string {
    const now = new Date();
    return now.getFullYear().toString();
}

/**
 * Vérifie si on est à mi-décembre (entre le 10 et le 20 décembre)
 */
function isMidDecember(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();

    return month === 11 && day >= 10 && day <= 20; // Décembre = 11
}

/**
 * Charge les stats de jeux depuis le fichier JSON
 */
function loadGameStats(): any {
    try {
        const gameStatsFile = path.join(process.cwd(), "data", "game_stats.json");
        if (fs.existsSync(gameStatsFile)) {
            const data = fs.readFileSync(gameStatsFile, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading game stats:", error);
    }
    return {};
}

/**
 * Catégories de récompenses fun
 */
interface RewindAward {
    emoji: string;
    title: string;
    userId: string;
    username: string;
    value: string;
}

/**
 * Génère les awards fun basés sur les stats
 */
function generateFunAwards(client: Client, year: string): RewindAward[] {
    const awards: RewindAward[] = [];
    const allStats = getYearlyStats(year);
    const gameStats = loadGameStats();

    // Exclure Netricsa des awards
    const userStats = Object.entries(allStats)
        .filter(([userId]) => userId !== NETRICSA_USER_ID)
        .map(([userId, stats]) => ({userId, ...(stats as any)}));

    if (userStats.length === 0) return awards;

    // 🏆 Le plus actif (messages + réactions + commandes)
    const mostActive = userStats.reduce((prev, current) => {
        const prevScore = prev.discord.messagesEnvoyes + prev.discord.reactionsAjoutees + prev.discord.commandesUtilisees;
        const currentScore = current.discord.messagesEnvoyes + current.discord.reactionsAjoutees + current.discord.commandesUtilisees;
        return currentScore > prevScore ? current : prev;
    });
    awards.push({
        emoji: "🏆",
        title: "Le no-life",
        userId: mostActive.userId,
        username: mostActive.username,
        value: `${mostActive.discord.messagesEnvoyes + mostActive.discord.reactionsAjoutees + mostActive.discord.commandesUtilisees} actions`
    });

    // 💬 Le bavard (messages)
    const mostTalkative = userStats.reduce((prev, current) => {
        return current.discord.messagesEnvoyes > prev.discord.messagesEnvoyes ? current : prev;
    });
    if (mostTalkative.discord.messagesEnvoyes > 0) {
        awards.push({
            emoji: "💬",
            title: "Le moulin à paroles",
            userId: mostTalkative.userId,
            username: mostTalkative.username,
            value: `${mostTalkative.discord.messagesEnvoyes} messages`
        });
    }

    // 😂 Le roi des réactions
    const mostReactive = userStats.reduce((prev, current) => {
        return current.discord.reactionsAjoutees > prev.discord.reactionsAjoutees ? current : prev;
    });
    if (mostReactive.discord.reactionsAjoutees > 0) {
        awards.push({
            emoji: "😂",
            title: "L'emoji spammer",
            userId: mostReactive.userId,
            username: mostReactive.username,
            value: `${mostReactive.discord.reactionsAjoutees} réactions`
        });
    }

    // 🤖 Le bot wannabe (commandes)
    const mostCommands = userStats.reduce((prev, current) => {
        return current.discord.commandesUtilisees > prev.discord.commandesUtilisees ? current : prev;
    });
    if (mostCommands.discord.commandesUtilisees > 0) {
        awards.push({
            emoji: "🤖",
            title: "Tony Stark",
            userId: mostCommands.userId,
            username: mostCommands.username,
            value: `${mostCommands.discord.commandesUtilisees} commandes utilisées`
        });
    }

    // 🎤 Le vocal addict (temps en vocal)
    const mostVocal = userStats.reduce((prev, current) => {
        return current.discord.tempsVocalMinutes > prev.discord.tempsVocalMinutes ? current : prev;
    });
    if (mostVocal.discord.tempsVocalMinutes > 0) {
        const hours = Math.floor(mostVocal.discord.tempsVocalMinutes / 60);
        awards.push({
            emoji: "🎤",
            title: "Le gooner du vocal",
            userId: mostVocal.userId,
            username: mostVocal.username,
            value: `${hours}h en vocal`
        });
    }

    // 🎨 Le créatif (images générées + réimaginées)
    const mostCreative = userStats.reduce((prev, current) => {
        const prevImages = prev.netricsa.imagesGenerees + prev.netricsa.imagesReimaginee;
        const currentImages = current.netricsa.imagesGenerees + current.netricsa.imagesReimaginee;
        return currentImages > prevImages ? current : prev;
    });
    // Vérifier que ce n'est pas Netricsa et qu'il y a des images
    if ((mostCreative.netricsa.imagesGenerees + mostCreative.netricsa.imagesReimaginee) > 0 && mostCreative.userId !== NETRICSA_USER_ID) {
        awards.push({
            emoji: "🎨",
            title: "Le Picasso du prompt",
            userId: mostCreative.userId,
            username: mostCreative.username,
            value: `${mostCreative.netricsa.imagesGenerees + mostCreative.netricsa.imagesReimaginee} images IA`
        });
    }

    // 🎮 Le gamer (victoires globales)
    let maxWins = 0;
    let topGamer: { userId: string; username: string; wins: number } | null = null;

    for (const [userId, stats] of Object.entries(gameStats)) {
        if (userId === NETRICSA_USER_ID) continue;
        const globalStats = (stats as any).global;
        if (globalStats && globalStats.wins > maxWins) {
            maxWins = globalStats.wins;
            const userStat = allStats[userId];
            // Double vérification: userStat existe ET ce n'est pas Netricsa
            if (userStat && userId !== NETRICSA_USER_ID) {
                topGamer = {
                    userId: userId,
                    username: userStat.username,
                    wins: globalStats.wins
                };
            }
        }
    }

    if (topGamer && topGamer.wins > 0) {
        awards.push({
            emoji: "🎮",
            title: "Le tryhard",
            userId: topGamer.userId,
            username: topGamer.username,
            value: `${topGamer.wins} victoires de jeux`
        });
    }

    // 🧠 L'intellectuel (conversations IA)
    const mostIntellectual = userStats.reduce((prev, current) => {
        return current.netricsa.conversationsIA > prev.netricsa.conversationsIA ? current : prev;
    });
    // Vérifier que ce n'est pas Netricsa et qu'il y a des conversations
    if (mostIntellectual.netricsa.conversationsIA > 0 && mostIntellectual.userId !== NETRICSA_USER_ID) {
        awards.push({
            emoji: "🧠",
            title: "Le AI addict",
            userId: mostIntellectual.userId,
            username: mostIntellectual.username,
            value: `${mostIntellectual.netricsa.conversationsIA} conversations avec Netricsa`
        });
    }

    // 📈 Le gagnant (meilleure série de victoires)
    let maxStreak = 0;
    let streakMaster: { userId: string; username: string; streak: number } | null = null;

    for (const [userId, stats] of Object.entries(gameStats)) {
        if (userId === NETRICSA_USER_ID) continue;
        const globalStats = (stats as any).global;
        if (globalStats && globalStats.highestStreak > maxStreak) {
            maxStreak = globalStats.highestStreak;
            const userStat = allStats[userId];
            // Double vérification: userStat existe ET ce n'est pas Netricsa
            if (userStat && userId !== NETRICSA_USER_ID) {
                streakMaster = {
                    userId: userId,
                    username: userStat.username,
                    streak: globalStats.highestStreak
                };
            }
        }
    }

    if (streakMaster && streakMaster.streak > 1) {
        awards.push({
            emoji: "📈",
            title: "L'inarrêtable",
            userId: streakMaster.userId,
            username: streakMaster.username,
            value: `${streakMaster.streak} wins d'affilée`
        });
    }

    // 🎯 Le plus chanceux (meilleur ratio victoires/défaites aux jeux)
    let bestRatio = 0;
    let luckyPlayer: { userId: string; username: string; ratio: number; wins: number; losses: number } | null = null;

    for (const [userId, stats] of Object.entries(gameStats)) {
        if (userId === NETRICSA_USER_ID) continue;
        const globalStats = (stats as any).global;
        if (globalStats && globalStats.wins > 0 && globalStats.losses > 0) {
            const ratio = globalStats.wins / (globalStats.wins + globalStats.losses);
            if (ratio > bestRatio && globalStats.wins >= 3) { // Au moins 3 victoires pour être éligible
                bestRatio = ratio;
                const userStat: any = allStats[userId];
                // Double vérification: userStat existe ET ce n'est pas Netricsa
                if (userStat && userId !== NETRICSA_USER_ID) {
                    luckyPlayer = {
                        userId: userId,
                        username: userStat.username,
                        ratio: ratio,
                        wins: globalStats.wins,
                        losses: globalStats.losses
                    };
                }
            }
        }
    }

    if (luckyPlayer) {
        const percentage = Math.round(luckyPlayer.ratio * 100);
        awards.push({
            emoji: "🎯",
            title: "RNG Jesus",
            userId: luckyPlayer.userId,
            username: luckyPlayer.username,
            value: `${percentage}% de victoires (${luckyPlayer.wins}W-${luckyPlayer.losses}L)`
        });
    }

    // 💪 Le grindeur (plus de parties jouées aux jeux)
    let maxGamesPlayed = 0;
    let grinder: { userId: string; username: string; gamesPlayed: number } | null = null;

    for (const [userId, stats] of Object.entries(gameStats)) {
        if (userId === NETRICSA_USER_ID) continue;
        const globalStats = (stats as any).global;
        if (globalStats) {
            const gamesPlayed = globalStats.wins + globalStats.losses + globalStats.draws;
            if (gamesPlayed > maxGamesPlayed) {
                maxGamesPlayed = gamesPlayed;
                const userStat: any = allStats[userId];
                // Double vérification: userStat existe ET ce n'est pas Netricsa
                if (userStat && userId !== NETRICSA_USER_ID) {
                    grinder = {
                        userId: userId,
                        username: userStat.username,
                        gamesPlayed: gamesPlayed
                    };
                }
            }
        }
    }

    if (grinder && grinder.gamesPlayed > 0) {
        awards.push({
            emoji: "💪",
            title: "Le hardcore gamer",
            userId: grinder.userId,
            username: grinder.username,
            value: `${grinder.gamesPlayed} parties jouées`
        });
    }

    // 👑 Le plus progressif (XP gagné dans l'année)
    const yearlyXPData = getYearlyXP(year);
    let maxXPGained = 0;
    let mostProgressive: { userId: string; username: string; xpGained: number } | null = null;

    for (const [userId, data] of Object.entries(yearlyXPData)) {
        if (userId === NETRICSA_USER_ID) continue;
        const xpData = data as any;
        if (xpData.xpGained > maxXPGained) {
            maxXPGained = xpData.xpGained;
            mostProgressive = {
                userId: userId,
                username: xpData.username,
                xpGained: xpData.xpGained
            };
        }
    }

    if (mostProgressive && mostProgressive.xpGained > 0) {
        awards.push({
            emoji: "👑",
            title: "Le XP farmer",
            userId: mostProgressive.userId,
            username: mostProgressive.username,
            value: `${mostProgressive.xpGained.toLocaleString()} XP gagnés (sigma grindset)`
        });
    }

    // 🔢 Le mathématicien (plus de contributions au compteur)
    let maxCounterContributions = 0;
    let topCounter: { userId: string; username: string; contributions: number } | null = null;

    for (const userStat of userStats) {
        if (userStat.discord.compteurContributions && userStat.discord.compteurContributions > maxCounterContributions) {
            maxCounterContributions = userStat.discord.compteurContributions;
            topCounter = {
                userId: userStat.userId,
                username: userStat.username,
                contributions: userStat.discord.compteurContributions
            };
        }
    }

    if (topCounter && topCounter.contributions > 0) {
        awards.push({
            emoji: "🔢",
            title: "Le mathématicien",
            userId: topCounter.userId,
            username: topCounter.username,
            value: `${topCounter.contributions} contributions au compteur (1+1=2 ez)`
        });
    }

    return awards;
}

/**
 * Publie le rewind annuel
 */
export async function publishYearlyRewind(client: Client): Promise<void> {
    if (!GUILD_ID || !ANNOUNCEMENTS_CHANNEL_ID) {
        logger.info("GUILD_ID or ANNOUNCEMENTS_CHANNEL_ID not configured, skipping rewind");
        return;
    }

    try {
        const channel = await client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID);
        if (!(channel instanceof TextChannel)) {
            logger.warn("Announcements channel not found or not a text channel");
            return;
        }

        const currentYear = getCurrentYear();

        logger.info(`📊 Publishing yearly rewind for ${currentYear}...`);

        // Récupérer le serveur pour obtenir l'icône
        const guild = await client.guilds.fetch(GUILD_ID);
        const guildIconURL = guild.iconURL({size: 256}) || null;

        // Récupérer les stats du serveur de l'année en cours (en excluant les bots)
        const serverStats = getYearlyServerStats(currentYear, true);
        const awards = generateFunAwards(client, currentYear);

        // Créer l'embed principal
        const rewindEmbed = new EmbedBuilder()
            .setColor(0xFF1744) // Rouge vif moderne
            .setTitle(`🎬 The Not So Serious Rewind ${currentYear}`)
            .setDescription(
                `**Voici le récap de l'année la plus déjantée du serveur !**\n` +
                `> Qui sera couronné ? Qui devrait avoir honte ? 😏`
            )
            .setThumbnail(guildIconURL)
            .setTimestamp();

        // Stats globales
        const serverMostUsedEmoji = getServerMostUsedEmoji();
        let emojiLine = "";
        if (serverMostUsedEmoji) {
            emojiLine = `├ 😄 Emoji le plus utilisé : **${serverMostUsedEmoji.emoji}** (×${serverMostUsedEmoji.count.toLocaleString()})\n`;
        }

        rewindEmbed.addFields({
            name: "📊 **L'année en chiffres**",
            value:
                `╭ 💬 Messages : **${serverStats.totalMessages.toLocaleString()}**\n` +
                `├ 😂 Réactions : **${serverStats.totalReactions.toLocaleString()}**\n` +
                `├ 🖼️ Images IA : **${serverStats.totalImages.toLocaleString()}**\n` +
                `├ 🤖 Conversations : **${serverStats.totalConversations.toLocaleString()}**\n` +
                emojiLine +
                `╰ ⚡ Commandes : **${serverStats.totalCommands.toLocaleString()}**`,
            inline: false
        });

        // Ajouter les awards par catégories
        if (awards.length > 0) {
            // Séparer les awards par catégorie
            // Discord: no-life, moulin, emoji spammer, bot wannabe, sans-abri (5)
            // Netricsa: Picasso, ChatGPT addict, XP farmer (3)
            // Jeux: tryhard, inarrêtable, RNG Jesus, gooner absolu, mathématicien (5)
            const discordAwards = awards.slice(0, 5);
            const netricsaAwards = awards.slice(5, 8);
            const gameAwards = awards.slice(8); // Inclut maintenant le mathématicien

            // Awards Discord
            if (discordAwards.length > 0) {
                rewindEmbed.addFields({
                    name: "💬 **Awards Discord**",
                    value: "━━━━━━━━━━━━━━━━━━━━",
                    inline: false
                });

                for (const award of discordAwards) {
                    rewindEmbed.addFields({
                        name: `${award.emoji} ${award.title}`,
                        value: `<@${award.userId}>\n*${award.value}*`,
                        inline: true
                    });
                }

                // Ajouter un field vide si nécessaire pour forcer le passage à la ligne
                if (discordAwards.length % 3 !== 0) {
                    const fieldsNeeded = 3 - (discordAwards.length % 3);
                    for (let i = 0; i < fieldsNeeded; i++) {
                        rewindEmbed.addFields({
                            name: "\u200B",
                            value: "\u200B",
                            inline: true
                        });
                    }
                }
            }

            // Awards Netricsa
            if (netricsaAwards.length > 0) {
                rewindEmbed.addFields({
                    name: "🤖 **Awards Netricsa**",
                    value: "━━━━━━━━━━━━━━━━━━━━",
                    inline: false
                });

                for (const award of netricsaAwards) {
                    rewindEmbed.addFields({
                        name: `${award.emoji} ${award.title}`,
                        value: `<@${award.userId}>\n*${award.value}*`,
                        inline: true
                    });
                }

                // Ajouter un field vide si nécessaire pour forcer le passage à la ligne
                if (netricsaAwards.length % 3 !== 0) {
                    const fieldsNeeded = 3 - (netricsaAwards.length % 3);
                    for (let i = 0; i < fieldsNeeded; i++) {
                        rewindEmbed.addFields({
                            name: "\u200B",
                            value: "\u200B",
                            inline: true
                        });
                    }
                }
            }

            // Awards Jeux
            if (gameAwards.length > 0) {
                rewindEmbed.addFields({
                    name: "🎮 **Awards Jeux**",
                    value: "━━━━━━━━━━━━━━━━━━━━",
                    inline: false
                });

                for (const award of gameAwards) {
                    rewindEmbed.addFields({
                        name: `${award.emoji} ${award.title}`,
                        value: `<@${award.userId}>\n*${award.value}*`,
                        inline: true
                    });
                }

                // Ajouter un field vide si nécessaire pour forcer le passage à la ligne
                if (gameAwards.length % 3 !== 0) {
                    const fieldsNeeded = 3 - (gameAwards.length % 3);
                    for (let i = 0; i < fieldsNeeded; i++) {
                        rewindEmbed.addFields({
                            name: "\u200B",
                            value: "\u200B",
                            inline: true
                        });
                    }
                }
            }
        }

        // Footer
        rewindEmbed.setFooter({
            text: `${currentYear} • Propulsé par Netricsa 🤖`,
            iconURL: guild.iconURL({size: 64}) || undefined
        });

        // Message d'introduction fun
        const introMessages = [
            `# 🎬 REWIND ${currentYear} — LES RÉSULTATS SONT LÀ\n*Qui va être exposé ? Qui va briller ? Scrollez pour le découvrir...*`,
            `# 📊 C'EST L'HEURE DU BILAN ${currentYear}\n*Spoiler : certains d'entre vous ont passé BEAUCOUP trop de temps ici...*`,
            `# 🏆 THE NOT SO SERIOUS REWIND ${currentYear}\n*Préparez-vous à découvrir qui règne sur ce serveur (et qui devrait sortir dehors)*`,
            `# 🎊 ANNÉE ${currentYear} : LE RÉCAP\n*Vous avez été actifs... un peu TROP actifs même. Voici les preuves.*`
        ];

        const introMessage = introMessages[Math.floor(Math.random() * introMessages.length)];

        await channel.send({
            content: `||@everyone||\n\n${introMessage}`,
            embeds: [rewindEmbed],
            allowedMentions: {parse: ['everyone']}
        });

        logger.info(`✅ Yearly rewind published for ${currentYear}`);

        // Sauvegarder qu'on a publié le rewind cette année
        const state = loadRewindState();
        state.lastRewind = currentYear;
        saveRewindState(state);

    } catch (error) {
        logger.error("Error publishing yearly rewind:", error);
    }
}

/**
 * Vérifie et publie le rewind si nécessaire
 */
async function checkAndPublishRewind(client: Client): Promise<void> {
    if (!isMidDecember()) {
        return; // Pas encore mi-décembre
    }

    const state = loadRewindState();
    const currentYear = getCurrentYear();

    // Vérifier si on a déjà publié le rewind cette année
    if (state.lastRewind === currentYear) {
        return; // Déjà publié cette année
    }

    logger.info("🎬 Time for yearly rewind!");
    await publishYearlyRewind(client);
}

/**
 * Initialise le service de rewind annuel
 * Vérifie tous les jours
 */
export function initializeYearlyRewindService(client: Client): void {
    if (!ANNOUNCEMENTS_CHANNEL_ID) {
        logger.info("ANNOUNCEMENTS_CHANNEL_ID not configured, yearly rewind disabled");
        return;
    }

    if (!GUILD_ID) {
        logger.info("GUILD_ID not configured, yearly rewind disabled");
        return;
    }

    logger.info("✅ Yearly rewind service initialized");

    // Vérification immédiate au démarrage (après 10 secondes)
    setTimeout(() => {
        checkAndPublishRewind(client).catch(error => {
            logger.error("Error in initial rewind check:", error);
        });
    }, 10000); // 10 secondes

    // Vérification toutes les 24 heures
    setInterval(() => {
        checkAndPublishRewind(client).catch(error => {
            logger.error("Error in scheduled rewind check:", error);
        });
    }, 24 * 60 * 60 * 1000); // 24 heures
}
