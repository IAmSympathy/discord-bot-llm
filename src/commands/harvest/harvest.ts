import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {createLogger} from "../../utils/logger";
import * as fs from "fs";
import * as path from "path";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

const logger = createLogger("HarvestCmd");

// Cooldown de 8 heures (en millisecondes)
const HARVEST_COOLDOWN = 7 * 60 * 60 * 1000;

// Fichier de sauvegarde des cooldowns
const COOLDOWN_FILE = path.join(process.cwd(), "data", "harvest_cooldowns.json");

interface CooldownData {
    [userId: string]: number;
}

/**
 * Charge les cooldowns depuis le fichier JSON
 */
function loadCooldowns(): CooldownData {
    try {
        if (fs.existsSync(COOLDOWN_FILE)) {
            const data = fs.readFileSync(COOLDOWN_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading harvest cooldowns:", error);
    }
    return {};
}

/**
 * Sauvegarde les cooldowns dans le fichier JSON
 */
function saveCooldowns(cooldowns: CooldownData): void {
    try {
        const dataDir = path.dirname(COOLDOWN_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {recursive: true});
        }
        fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(cooldowns, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving harvest cooldowns:", error);
    }
}

/**
 * Détermine quelle ressource donner selon la saison
 */
function getSeasonalResource(): {
    itemType: any;
    itemName: string;
    itemEmoji: string;
    seasonName: string;
} {
    const {getCurrentSeason, Season, InventoryItemType} = require("../../services/userInventoryService");
    const currentSeason = getCurrentSeason();

    switch (currentSeason) {
        case Season.WINTER:
            return {
                itemType: InventoryItemType.FIREWOOD_LOG,
                itemName: "Bûche de Bois",
                itemEmoji: "🪵",
                seasonName: "hiver"
            };

        case Season.SPRING:
            // TODO: Ajouter ressource de printemps
            return {
                itemType: InventoryItemType.FIREWOOD_LOG, // Temporaire
                itemName: "Ressource de Printemps",
                itemEmoji: "🌸",
                seasonName: "printemps"
            };

        case Season.SUMMER:
            // TODO: Ajouter ressource d'été
            return {
                itemType: InventoryItemType.FIREWOOD_LOG, // Temporaire
                itemName: "Ressource d'Été",
                itemEmoji: "☀️",
                seasonName: "été"
            };

        case Season.FALL:
            // TODO: Ajouter ressource d'automne
            return {
                itemType: InventoryItemType.FIREWOOD_LOG, // Temporaire
                itemName: "Ressource d'Automne",
                itemEmoji: "🍂",
                seasonName: "automne"
            };

        default:
            // Par défaut, donner une bûche
            return {
                itemType: InventoryItemType.FIREWOOD_LOG,
                itemName: "Bûche de Bois",
                itemEmoji: "🪵",
                seasonName: "hiver"
            };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("harvest")
        .setDescription("⛏️ Récolte une ressource de saison (cooldown: 7h)"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;
            const now = Date.now();

            // Charger les cooldowns
            const cooldowns = loadCooldowns();

            // Déterminer la ressource saisonnière
            const resource = getSeasonalResource();

            // Message d'animation
            await interaction.reply({content: `<a:zznHarvest:1471951869025714226> *Recherche de ressources...*`, flags: MessageFlags.Ephemeral});

            // Attendre un peu pour l'effet d'animation
            await new Promise(resolve => setTimeout(resolve, 1500));


            // Vérifier le cooldown
            const lastHarvest = cooldowns[userId];
            if (lastHarvest) {
                const timeSinceLastHarvest = now - lastHarvest;
                const cooldownRemaining = HARVEST_COOLDOWN - timeSinceLastHarvest;

                if (cooldownRemaining > 0) {
                    const nextHarvestTime = Math.floor((lastHarvest + HARVEST_COOLDOWN) / 1000);

                    const cooldownEmbed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle("⏰ Ressources épuisés !")
                        .setDescription(
                            `Tu as déjà récolté une ressource récemment !\n\n` +
                            `Prochaine récolte disponible <t:${nextHarvestTime}:R>`
                        )
                        .setFooter({text: "Tu peux récolter une ressource toutes les 7 heures"})
                        .setTimestamp();

                    await interaction.editReply({content: "", embeds: [cooldownEmbed]});
                    return;
                }
            }

            const doubleChance = 0.15; // 15%
            const quantity = Math.random() < doubleChance ? 2 : 1;


            // Donner la ressource
            const {addItemToInventory} = require("../../services/userInventoryService");
            const success = addItemToInventory(userId, username, resource.itemType, quantity);

            if (!success) {
                // Erreur lors de l'ajout
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle("❌ Erreur")
                    .setDescription("Une erreur est survenue lors de l'ajout de la ressource à ton inventaire.")
                    .setTimestamp();

                await interaction.editReply({content: "", embeds: [errorEmbed]});
                return;
            }

            // Succès ! Enregistrer le cooldown et sauvegarder
            cooldowns[userId] = now;
            saveCooldowns(cooldowns);

            // Ajouter XP
            if (interaction.channel) {
                await addXP(
                    userId,
                    username,
                    XP_REWARDS.commandeUtilisee,
                    interaction.channel as TextChannel,
                    false
                );
            }


            const successEmbed = new EmbedBuilder()
                .setColor(0x5D6A74)
                .setTitle("⛏️ Ressource récoltée !")
                .setDescription(
                    `${resource.itemEmoji} Tu as récolté **${quantity} ${resource.itemName}${quantity > 1 ? "s" : ""}** !\n\n` +
                    `📦 Elle a été ajoutée à ton inventaire.\n` +
                    `🔥 ${resource.itemType === require("../../services/userInventoryService").InventoryItemType.FIREWOOD_LOG ?
                        "Va l'utiliser au feu de foyer pour augmenter son intensité !" :
                        "Cette ressource sera utile pour la saison en cours."}\n\n` +
                    `⏱️ Prochaine récolte disponible <t:${Math.floor((now + HARVEST_COOLDOWN) / 1000)}:R>`
                )
                .setFooter({text: "Vérifie ton inventaire avec /profile → 🎒 Inventaire"})
                .setTimestamp();

            await interaction.editReply({content: "", embeds: [successEmbed]});

            // Logger la commande
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                "⛏️ Harvest",
                undefined,
                [
                    {name: "👤 Utilisateur", value: username, inline: true},
                    {name: "🎁 Ressource", value: resource.itemName, inline: true},
                    {name: "🌍 Saison", value: resource.seasonName, inline: true}
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
            );

        } catch (error) {
            logger.error("Error in harvest command:", error);
            await interaction.reply({
                content: "Une erreur s'est produite lors de la récolte.",
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
