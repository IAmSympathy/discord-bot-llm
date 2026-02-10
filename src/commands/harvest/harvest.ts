import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {createLogger} from "../../utils/logger";

const logger = createLogger("HarvestCmd");

// Cooldown de 6 heures (en millisecondes)
const HARVEST_COOLDOWN = 6 * 60 * 60 * 1000;

// Stocker les cooldowns en mémoire (ou utiliser un fichier JSON si nécessaire)
const cooldowns = new Map<string, number>();

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
        .setDescription("⛏️ Récolte une ressource de saison (cooldown: 6h)"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;
            const now = Date.now();

            // Déterminer la ressource saisonnière
            const resource = getSeasonalResource();

            // Vérifier le cooldown
            const lastHarvest = cooldowns.get(userId);
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
                        .setFooter({text: "Tu peux récolter une ressource toutes les 6 heures"})
                        .setTimestamp();

                    await interaction.reply({embeds: [cooldownEmbed], flags: MessageFlags.Ephemeral});
                    return;
                }
            }

            // Donner la ressource
            const {addItemToInventory} = require("../../services/userInventoryService");
            const success = addItemToInventory(userId, username, resource.itemType, 1);

            if (!success) {
                // Erreur lors de l'ajout
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle("❌ Erreur")
                    .setDescription("Une erreur est survenue lors de l'ajout de la ressource à ton inventaire.")
                    .setTimestamp();

                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Succès ! Enregistrer le cooldown
            cooldowns.set(userId, now);

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
                    `${resource.itemEmoji} Tu as récolté une **${resource.itemName}** !\n\n` +
                    `📦 Elle a été ajoutée à ton inventaire.\n` +
                    `🔥 ${resource.itemType === require("../../services/userInventoryService").InventoryItemType.FIREWOOD_LOG ?
                        "Va l'utiliser au feu de foyer pour augmenter son intensité !" :
                        "Cette ressource sera utile pour la saison en cours."}\n\n` +
                    `⏱️ Prochaine récolte disponible <t:${Math.floor((now + HARVEST_COOLDOWN) / 1000)}:R>`
                )
                .setFooter({text: "Vérifie ton inventaire avec /profile → 🎒 Inventaire"})
                .setTimestamp();

            await interaction.reply({embeds: [successEmbed], flags: MessageFlags.Ephemeral});

            // Logger la commande
            await logCommand(
                "⛏️ Harvest",
                undefined,
                [
                    {name: "👤 Utilisateur", value: username, inline: true},
                    {name: "🎁 Ressource", value: resource.itemName, inline: true},
                    {name: "🌍 Saison", value: resource.seasonName, inline: true}
                ]
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
