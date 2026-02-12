import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../../services/xpSystem";
import {logCommand} from "../../utils/discordLogger";
import * as fs from "fs";
import * as path from "path";
import {tryRewardAndNotify} from "../../services/rewardNotifier";

const logger = createLogger("SlotsCmd");
const COOLDOWN_FILE = path.join(process.cwd(), "data", "slots_cooldown.json");

// Symboles de la machine à sous
const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "💎", "⭐", "7️⃣"];

// Probabilités (plus le nombre est élevé, plus c'est rare)
const SYMBOL_WEIGHTS = {
    "🍒": 30,  // Commun
    "🍋": 25,  // Commun
    "🍊": 20,  // Assez commun
    "🍇": 15,  // Moins commun
    "💎": 6,   // Rare
    "⭐": 3,   // Très rare
    "7️⃣": 1   // Ultra rare
};

// Gains/pertes selon les combinaisons
const PAYOUTS: { [key: string]: number } = {
    // 🔥 JACKPOTS LÉGENDAIRES
    "7️⃣7️⃣7️⃣": 1000,  // ULTIME
    "⭐⭐⭐": 600,      // ÉNORME
    "💎💎💎": 300,      // GROS
    "🍇🍇🍇": 150,      // SOLIDE
    "🍊🍊🍊": 100,      // BON
    "🍋🍋🍋": 75,       // PETIT
    "🍒🍒🍒": 50,       // MINI

    // Gains moyens
    "7️⃣7️⃣": 100,
    "⭐⭐": 75,
    "💎💎": 50,
    "🍇🍇": 25,
    "🍊🍊": 15,
    "🍋🍋": 10,
    "🍒🍒": 5,

    // 🔥 HIGH RISK
    "default": -50
};


interface CooldownData {
    [userId: string]: number;
}

function loadCooldowns(): CooldownData {
    try {
        if (fs.existsSync(COOLDOWN_FILE)) {
            const data = fs.readFileSync(COOLDOWN_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading cooldowns:", error);
    }
    return {};
}


function getWeightedRandomSymbol(): string {
    const totalWeight = Object.values(SYMBOL_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
        random -= weight;
        if (random <= 0) {
            return symbol;
        }
    }

    return SYMBOLS[0]; // Fallback
}

function calculatePayout(symbols: string[]): { xp: number; message: string } {
    const [s1, s2, s3] = symbols;

    if (s1 === s2 && s2 === s3) {
        const key = `${s1}${s2}${s3}`;
        const xp = PAYOUTS[key] || 10;

        if (s1 === "7️⃣") {
            return {xp, message: "🎰💥 **JACKPOT ULTIME ! TU VIENS DE CASSER LE JEU !** 💥🎰"};
        } else if (s1 === "⭐") {
            return {xp, message: "✨🌟 **IMMENSE GAIN ! LA FOULE T'ACCLAME !** 🌟✨"};
        } else if (s1 === "💎") {
            return {xp, message: "💎💰 **GROS GAIN ! TU ES RICHE !** 💰💎"};
        } else if (s1 === "🍇") {
            return {xp, message: "🍇🎉 **Belle victoire !** 🎉🍇"};
        } else {
            return {xp, message: "🎉 Tu repars gagnant !** 🎉"};
        }
    }

    if (s1 === s2 || s2 === s3) {
        const matchSymbol = s1 === s2 ? s1 : s2;
        const key = `${matchSymbol}${matchSymbol}`;
        const xp = PAYOUTS[key] || 5;
        return {xp, message: "✅ **Bon gain ! Continue comme ça !**"};
    }

    if (s1 === s3) {
        const key = `${s1}${s3}`;
        const xp = PAYOUTS[key] || 5;
        return {xp, message: "✅ **Petit gain !**"};
    }

    return {xp: PAYOUTS.default, message: "❌ **Pas de chance, tu as perdu** ❌"};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slots")
        .setDescription("🎰 Joue à la machine à sous (gagne ou perd de l'XP)"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Générer les symboles
            const finalSymbols = [
                getWeightedRandomSymbol(),
                getWeightedRandomSymbol(),
                getWeightedRandomSymbol()
            ];

            // Animation de la machine à sous
            const animationEmbed = new EmbedBuilder()
                .setColor(0x30363c)
                .setTitle("🎰 Machine à Sous")
                .setDescription(
                    `<@${userId}> lance sa machine !\n\n` +
                    `🎰 [ ❔ | ❔ | ❔ ]`
                )
                .setTimestamp();

            await interaction.reply({embeds: [animationEmbed]});

            // Animation étape 1
            await new Promise(resolve => setTimeout(resolve, 800));
            animationEmbed.setDescription(
                `<@${userId}> lance sa machine !\n\n` +
                `🎰 [ ${finalSymbols[0]} | ❔ | ❔ ]`
            );
            await interaction.editReply({embeds: [animationEmbed]});

            // Animation étape 2
            await new Promise(resolve => setTimeout(resolve, 800));
            animationEmbed.setDescription(
                `<@${userId}> lance sa machine !\n\n` +
                `🎰 [ ${finalSymbols[0]} | ${finalSymbols[1]} | ❔ ]`
            );
            await interaction.editReply({embeds: [animationEmbed]});

            // Animation étape 3 - Résultat final
            await new Promise(resolve => setTimeout(resolve, 800));

            const {xp, message: resultMessage} = calculatePayout(finalSymbols);

            // Appliquer le gain/perte d'XP
            if (interaction.channel) {
                await addXP(
                    userId,
                    username,
                    xp,
                    interaction.channel as TextChannel,
                    false
                );
            }

            // Chance d'obtenir un objet saisonnier (3% - commande)
            const {tryRewardAndNotify} = require("../../services/rewardNotifier");
            await tryRewardAndNotify(interaction, interaction.user.id, interaction.user.username, "command");

            // Tracker les achievements de slots
            const {trackSlotsAchievements} = require("../../services/achievementService");
            await trackSlotsAchievements(userId, username, finalSymbols, interaction.client, interaction.channelId);

            // Enregistrer l'utilisation d'une commande fun (pour les défis quotidiens)
            const {recordFunCommandStats} = require("../../services/statsRecorder");
            recordFunCommandStats(userId, username);

            const resultEmbed = new EmbedBuilder()
                .setColor(0x30363c)
                .setTitle("🎰 Machine à Sous")
                .setDescription(
                    `<@${userId}> lance la machine !\n\n` +
                    `🎰 [ ${finalSymbols[0]} | ${finalSymbols[1]} | ${finalSymbols[2]} ]\n\n` +
                    `${resultMessage}\n` +
                    `${xp > 0 ? '+' : ''}${xp} XP 💫`
                )
                .setTimestamp();

            await interaction.editReply({embeds: [resultEmbed]});

            // Logger la commande
            await logCommand(
                "🎰 Slots",
                undefined,
                [
                    {name: "👤 Utilisateur", value: username, inline: true},
                    {name: "🎲 Résultat", value: finalSymbols.join(" "), inline: true},
                    {name: "💫 XP", value: `${xp > 0 ? '+' : ''}${xp}`, inline: true}
                ]
            );

            logger.info(`${username} played slots: ${finalSymbols.join("")} = ${xp} XP`);

        } catch (error) {
            logger.error("Error in slots command:", error);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ Une erreur s'est produite lors du lancement de la machine à sous.",
                        ephemeral: true
                    });
                } else {
                    await interaction.followUp({
                        content: "❌ Une erreur s'est produite lors du lancement de la machine à sous.",
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error("Failed to send error message:", replyError);
            }
        }
    },
};
