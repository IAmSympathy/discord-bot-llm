import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP} from "../../services/xpSystem";
import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../../utils/logger";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

const logger = createLogger("DailyCmd");
const DAILY_FILE = path.join(process.cwd(), "data", "daily_streaks.json");

interface DailyData {
    [userId: string]: {
        lastClaim: number;
        streak: number;
        totalClaims: number;
    };
}

/**
 * Charge les données des streaks quotidiens
 */
function loadDailyData(): DailyData {
    try {
        if (fs.existsSync(DAILY_FILE)) {
            const data = fs.readFileSync(DAILY_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading daily data:", error);
    }
    return {};
}

/**
 * Sauvegarde les données des streaks quotidiens
 */
function saveDailyData(data: DailyData): void {
    try {
        fs.writeFileSync(DAILY_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving daily data:", error);
    }
}

/**
 * Vérifie si deux timestamps sont le même jour
 */
function isSameDay(timestamp1: number, timestamp2: number): boolean {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Vérifie si deux timestamps sont des jours consécutifs
 */
function isConsecutiveDay(lastClaim: number, now: number): boolean {
    const lastDate = new Date(lastClaim);
    const nowDate = new Date(now);

    // Créer une date pour "hier"
    const yesterday = new Date(nowDate);
    yesterday.setDate(yesterday.getDate() - 1);

    return (
        lastDate.getFullYear() === yesterday.getFullYear() &&
        lastDate.getMonth() === yesterday.getMonth() &&
        lastDate.getDate() === yesterday.getDate()
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("📅 Récupère ta récompense quotidienne et maintiens ta série !"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const now = Date.now();

            const dailyData = loadDailyData();
            const userData = dailyData[userId] || {lastClaim: 0, streak: 0, totalClaims: 0};
            const alreadyClaimed = isSameDay(userData.lastClaim, now);

            // Vérifier si déjà réclamé aujourd'hui
            if (isSameDay(userData.lastClaim, now)) {
                const nextClaim = new Date(userData.lastClaim);
                nextClaim.setDate(nextClaim.getDate() + 1);
                nextClaim.setHours(0, 0, 0, 0);

                const timeUntilNext = nextClaim.getTime() - now;
                const hoursLeft = Math.floor(timeUntilNext / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));

                const embed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle("⏰ Déjà réclamé aujourd'hui")
                    .setDescription(
                        `Tu as déjà récupéré ta récompense quotidienne !\n\n` +
                        `🔥 Série actuelle : **${userData.streak} jour${userData.streak > 1 ? 's' : ''}**\n` +
                        `⏳ Prochaine récompense dans : **${hoursLeft}h ${minutesLeft}m**`
                    )
                    .setFooter({text: `Total réclamé : ${userData.totalClaims} fois`})
                    .setTimestamp();

                await interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Calculer le nouveau streak
            let newStreak: number;
            if (userData.lastClaim === 0) {
                // Première fois
                newStreak = 1;
            } else if (isConsecutiveDay(userData.lastClaim, now)) {
                // Jour consécutif
                newStreak = userData.streak + 1;
            } else {
                // Série brisée
                newStreak = 1;
            }

            // Calculer la récompense d'XP (bonus selon le streak)
            const baseXP = 50;
            let bonusXP = 0;

            if (newStreak >= 7) bonusXP = 50; // +50 XP pour 7 jours
            if (newStreak >= 30) bonusXP = 150; // +150 XP pour 30 jours
            if (newStreak >= 100) bonusXP = 500; // +500 XP pour 100 jours

            const totalXP = baseXP + bonusXP;

            // Mettre à jour les données
            dailyData[userId] = {
                lastClaim: now,
                streak: newStreak,
                totalClaims: userData.totalClaims + 1
            };
            saveDailyData(dailyData);

            // Ajouter l'XP
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    totalXP,
                    interaction.channel as TextChannel,
                    false
                );
            }

            // Donner un objet de protection saisonnier (garanti à 100%)
            let rewardMessage = "";
            try {
                const {rewardSeasonalItem} = require("../../services/rewardService");
                const {getCurrentSeasonItems, ITEM_CATALOG} = require("../../services/userInventoryService");

                // Déterminer la récompense selon le streak
                const seasonItems = getCurrentSeasonItems();
                let rewardItem;

                if (newStreak >= 30) {
                    // Streak de 30+ jours = item Large (rare)
                    rewardItem = seasonItems.large;
                } else if (newStreak >= 7) {
                    // Streak de 7-29 jours = item Medium (uncommon)
                    rewardItem = seasonItems.medium;
                } else {
                    // Streak de 1-6 jours = item Small (common)
                    rewardItem = seasonItems.small;
                }

                rewardSeasonalItem(interaction.user.id, interaction.user.username, "daily_streak", rewardItem);

                const itemInfo = ITEM_CATALOG[rewardItem];
                rewardMessage = `\n${itemInfo.emoji} **+1 ${itemInfo.name}** !`;
            } catch (error) {
                logger.error("Error giving seasonal reward:", error);
            }

            // Messages spéciaux pour les milestones
            let milestoneMessage = "";
            if (newStreak === 7) milestoneMessage = "\n\n🎉 **7 jours de suite !** Continue comme ça !";
            if (newStreak === 30) milestoneMessage = "\n\n🌟 **30 jours de suite !** Incroyable !";
            if (newStreak === 100) milestoneMessage = "\n\n👑 **100 jours de suite !** Tu es une légende !";
            if (newStreak === 365) milestoneMessage = "\n\n🏆 **1 AN DE SUITE !** ABSOLUMENT INCROYABLE !";

            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🗓️ Récompense quotidienne réclamée !")
                .setDescription(
                    `Tu as récupéré ta récompense quotidienne !\n\n` +
                    `💫 **+${totalXP} XP** gagné ! ${bonusXP > 0 ? `(${baseXP} + ${bonusXP} bonus)` : ''}` +
                    `${rewardMessage}\n\n` +
                    `🔥 Série : **${newStreak} jour${newStreak > 1 ? 's' : ''}**${milestoneMessage}`
                )
                .setFooter({text: `Total réclamé : ${userData.totalClaims + 1} fois`})
                .setTimestamp();

            // Ajouter des infos sur le prochain palier
            if (newStreak < 7) {
                embed.addFields({
                    name: "Prochain palier",
                    value: `Encore **${7 - newStreak} jour${7 - newStreak > 1 ? 's' : ''}** pour le bonus de 7 jours (+50 XP 💫)`,
                    inline: false
                });
            } else if (newStreak < 30) {
                embed.addFields({
                    name: "🎯 Prochain palier",
                    value: `Encore **${30 - newStreak} jours** pour le bonus de 30 jours (+150 XP 💫)`,
                    inline: false
                });
            } else if (newStreak < 100) {
                embed.addFields({
                    name: "🎯 Prochain palier",
                    value: `Encore **${100 - newStreak} jours** pour le bonus de 100 jours (+500 XP 💫)`,
                    inline: false
                });
            }

            await interaction.reply({embeds: [embed]});

            // Logger la commande
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                "📅 Daily Reward",
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "💰 XP gagné", value: `${totalXP}`, inline: true},
                    {name: "🔥 Série", value: `${newStreak} jours`, inline: true}
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
            );

        } catch (error) {
            console.error("Error in daily command:", error);
            await interaction.reply({
                content: "Une erreur s'est produite lors de la réclamation de la récompense quotidienne.",
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
