import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../../services/xpSystem";
import {logCommand} from "../../utils/discordLogger";
import * as fs from "fs";
import * as path from "path";
import {tryRewardAndNotify} from "../../services/rewardNotifier";

const logger = createLogger("SlotsCmd");
const COOLDOWN_FILE = path.join(process.cwd(), "data", "slots_cooldown.json");
const COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes de cooldown

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
    // 3 symboles identiques
    "7️⃣7️⃣7️⃣": 100,   // JACKPOT
    "⭐⭐⭐": 75,
    "💎💎💎": 50,
    "🍇🍇🍇": 30,
    "🍊🍊🍊": 20,
    "🍋🍋🍋": 15,
    "🍒🍒🍒": 10,

    // 2 symboles identiques
    "7️⃣7️⃣": 25,
    "⭐⭐": 20,
    "💎💎": 15,
    "🍇🍇": 10,
    "🍊🍊": 5,
    "🍋🍋": 3,
    "🍒🍒": 2,

    // Aucune correspondance
    "default": -10  // Perte de 10 XP
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

function saveCooldowns(cooldowns: CooldownData): void {
    try {
        const dataDir = path.dirname(COOLDOWN_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {recursive: true});
        }
        fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(cooldowns, null, 2));
    } catch (error) {
        logger.error("Error saving cooldowns:", error);
    }
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

    // 3 symboles identiques
    if (s1 === s2 && s2 === s3) {
        const key = `${s1}${s2}${s3}`;
        const xp = PAYOUTS[key] || 10;

        if (s1 === "7️⃣") {
            return {xp, message: "🎰 **JACKPOT LÉGENDAIRE !** 🎰"};
        } else if (s1 === "⭐") {
            return {xp, message: "✨ **SUPER GROS GAIN !** ✨"};
        } else if (s1 === "💎") {
            return {xp, message: "💎 **GROS GAIN !** 💎"};
        } else {
            return {xp, message: "🎉 **Triple combo !** 🎉"};
        }
    }

    // 2 symboles identiques
    if (s1 === s2 || s2 === s3) {
        const matchSymbol = s1 === s2 ? s1 : s2;
        const key = `${matchSymbol}${matchSymbol}`;
        const xp = PAYOUTS[key] || 5;
        return {xp, message: "✅ **Petit gain !**"};
    }

    if (s1 === s3) {
        const key = `${s1}${s3}`;
        const xp = PAYOUTS[key] || 5;
        return {xp, message: "✅ **Petit gain !**"};
    }

    // Aucune correspondance
    return {xp: PAYOUTS.default, message: "❌ **Aucun gain...**"};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slots")
        .setDescription("🎰 Joue à la machine à sous (gagne ou perd de l'XP)"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Vérifier le cooldown
            const cooldowns = loadCooldowns();
            const now = Date.now();
            const userCooldown = cooldowns[userId] || 0;
            const remainingTime = userCooldown - now;

            if (remainingTime > 0) {
                const minutes = Math.floor(remainingTime / 60000);
                const seconds = Math.floor((remainingTime % 60000) / 1000);

                const cooldownEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("💥 Ta machine est en panne !")
                    .setDescription(
                        `Tu dois les réparations avant de rejouer !\n\n` +
                        `**Temps restant :** ${minutes}m ${seconds}s`
                    )
                    .setTimestamp();

                await interaction.reply({embeds: [cooldownEmbed], ephemeral: true});
                return;
            }

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

            // Chance d'obtenir un objet saisonnier (3% - commande Netricsa)
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
                .setFooter({text: `La machine provient de TEMU et brise à chaque utilisation.`})
                .setTimestamp();

            await interaction.editReply({embeds: [resultEmbed]});

            // Enregistrer le cooldown
            cooldowns[userId] = now + COOLDOWN_DURATION;
            saveCooldowns(cooldowns);

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
