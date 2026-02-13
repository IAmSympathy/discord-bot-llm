import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addXP} from "../../services/xpSystem";
import {logCommand} from "../../utils/discordLogger";
import * as fs from "fs";
import * as path from "path";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

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

// Configuration centralisée des gains et messages
interface PayoutConfig {
    xp: number;
    message: string;
}

const PAYOUT_CONFIG: { [key: string]: PayoutConfig } = {
    // 🔥 JACKPOTS LÉGENDAIRES (3 symboles identiques)
    "7️⃣7️⃣7️⃣": {xp: 1000, message: "🎰💥 **JACKPOT ULTIME ! TU VIENS DE CASSER LE JEU !** 💥🎰"},
    "⭐⭐⭐": {xp: 600, message: "✨🌟 **IMMENSE GAIN ! LA FOULE T'ACCLAME !** 🌟✨"},
    "💎💎💎": {xp: 300, message: "💎💰 **GROS GAIN ! TU ES RICHE !** 💰💎"},
    "🍇🍇🍇": {xp: 150, message: "🍇🎉 **Belle victoire !** 🎉🍇"},
    "🍊🍊🍊": {xp: 100, message: "🍊🎊 **Beau gain !** 🎊🍊"},
    "🍋🍋🍋": {xp: 75, message: "🍋✨ **Bon gain !** ✨🍋"},
    "🍒🍒🍒": {xp: 50, message: "🍒🎉 **Petit gain !** 🎉🍒"},

    // Gains moyens (2 symboles identiques)
    "7️⃣7️⃣": {xp: 100, message: "✅ **Excellent ! Deux 7 !**"},
    "⭐⭐": {xp: 75, message: "✅ **Super ! Deux étoiles !**"},
    "💎💎": {xp: 50, message: "✅ **Bien joué ! Deux diamants !**"},
    "🍇🍇": {xp: 25, message: "✅ **Bon gain ! Continue comme ça !**"},
    "🍊🍊": {xp: 15, message: "✅ **Pas mal ! Deux oranges !**"},
    "🍋🍋": {xp: 10, message: "✅ **Petit gain ! Deux citrons !**"},
    "🍒🍒": {xp: 5, message: "✅ **Mini gain ! Deux cerises !**"},

    // Défaut (aucune combinaison)
    "default": {xp: -25, message: "❌ **Pas de chance, tu as perdu !** ❌"}
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

    // Cas 1 : Trois symboles identiques (JACKPOT !)
    if (s1 === s2 && s2 === s3) {
        const key = `${s1}${s2}${s3}`;
        return PAYOUT_CONFIG[key] || PAYOUT_CONFIG["default"];
    }

    // Cas 2 : Deux symboles identiques (gain moyen)
    // Vérifier s1 === s2, s2 === s3, ou s1 === s3
    let matchKey: string | null = null;

    if (s1 === s2) {
        matchKey = `${s1}${s2}`;
    } else if (s2 === s3) {
        matchKey = `${s2}${s3}`;
    } else if (s1 === s3) {
        matchKey = `${s1}${s3}`;
    }

    if (matchKey && PAYOUT_CONFIG[matchKey]) {
        return PAYOUT_CONFIG[matchKey];
    }

    // Cas 3 : Aucune combinaison (perte)
    return PAYOUT_CONFIG["default"];
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
                    `[ <a:znSlots:1471942669394509975> | <a:znSlots:1471942669394509975> | <a:znSlots:1471942669394509975> ] 📍`
                )
                .setTimestamp();

            await interaction.reply({embeds: [animationEmbed]});

            // Animation étape 1
            await new Promise(resolve => setTimeout(resolve, 800));
            animationEmbed.setDescription(
                `<@${userId}> lance sa machine !\n\n` +
                `[ ${finalSymbols[0]} | <a:znSlots:1471942669394509975> | <a:znSlots:1471942669394509975> ] 📍`
            );
            await interaction.editReply({embeds: [animationEmbed]});

            // Animation étape 2
            await new Promise(resolve => setTimeout(resolve, 800));
            animationEmbed.setDescription(
                `<@${userId}> lance sa machine !\n\n` +
                `[ ${finalSymbols[0]} | ${finalSymbols[1]} | <a:znSlots:1471942669394509975> ] 📍`
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
                    false,
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
                    `[ ${finalSymbols[0]} | ${finalSymbols[1]} | ${finalSymbols[2]} ] 📍\n\n` +
                    `${resultMessage}\n` +
                    `💫 ${xp > 0 ? '+' : ''}${xp} XP`
                )
                .setTimestamp();

            await interaction.editReply({embeds: [resultEmbed]});

            // Logger la commande
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                "🎰 Slots",
                undefined,
                [
                    {name: "👤 Utilisateur", value: username, inline: true},
                    {name: "🎲 Résultat", value: finalSymbols.join(" "), inline: true},
                    {name: "💫 XP", value: `${xp > 0 ? '+' : ''}${xp}`, inline: true}
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
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
                } else if (interaction.replied) {
                    // Si déjà replied, utiliser editReply au lieu de followUp
                    await interaction.editReply({
                        content: "❌ Une erreur s'est produite lors du lancement de la machine à sous.",
                        embeds: []
                    });
                } else {
                    // Si deferred mais pas replied
                    await interaction.editReply({
                        content: "❌ Une erreur s'est produite lors du lancement de la machine à sous."
                    });
                }
            } catch (replyError) {
                logger.error("Failed to send error message:", replyError);
            }
        }
    },
};
