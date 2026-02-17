import {ButtonInteraction, EmbedBuilder} from "discord.js";
// [DÉSACTIVÉ] Imports commentés car l'événement du feu de foyer est terminé
// import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuInteraction} from "discord.js";
import {createLogger} from "../../utils/logger";
// import {getFireProtectionItems, InventoryItemType, ITEM_CATALOG, removeItemFromInventory} from "../userInventoryService";
// import {getWeatherProtectionInfo} from "./fireDataManager";
// import {updateFireEmbed} from "./fireManager";

const logger = createLogger("FireProtectionHandler");

/**
 * Gère l'interaction du bouton "Utiliser Stuff à Feu"
 * [DÉSACTIVÉ] - L'événement du feu de foyer est terminé
 */
export async function handleUseProtectionButton(interaction: ButtonInteraction): Promise<void> {
    try {
        // Répondre que l'événement est désactivé
        const disabledEmbed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle("🔒 Fonctionnalité désactivée")
            .setDescription(
                `L'événement du **Feu de Foyer** est actuellement désactivé.\n\n` +
                `Cette fonctionnalité reviendra lors d'une prochaine saison hivernale ! ❄️`
            )
            .setFooter({text: "Restez à l'écoute pour les prochains événements !"})
            .setTimestamp();

        await interaction.reply({embeds: [disabledEmbed], ephemeral: true});

        logger.info(`${interaction.user.username} attempted to use disabled fire protection button`);
    } catch (error) {
        logger.error("Error handling disabled use protection button:", error);
    }

    // Code original commenté pour référence future
    /*
    try {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Afficher le temps restant si une protection est déjà active (mais permettre le stacking)
        const currentProtection = getWeatherProtectionInfo();
        let stackingInfo = "";
        if (currentProtection.active && currentProtection.remainingTime > 0) {
            const minutesRemaining = Math.ceil(currentProtection.remainingTime / 60000);
            stackingInfo = `\n⏱️ **Protection actuelle :** ${minutesRemaining} min restantes\n💡 Tu peux ajouter du temps en utilisant un autre objet !\n`;
        }

        // Récupérer les objets de protection de l'utilisateur
        const protectionItems = getFireProtectionItems(userId);

        if (protectionItems.length === 0) {
            const noItemsEmbed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle("❌ Aucun objet de protection trouvé")
                .setDescription(
                    `Tu n'as aucun objet de protection dans ton inventaire !\n\n` +
                    `🎁 **Comment en obtenir ?**\n` +
                    `• Tape des commandes\n` +
                    `• Utilise les fonctionnalités de Netricsa\n` +
                    `• Gagne des parties de jeux\n`
                )
                .setFooter({text: "Les protections ajoutent du temps à la bûche qui brûle"})
                .setTimestamp();

            await interaction.reply({embeds: [noItemsEmbed], ephemeral: true});
            return;
        }

        // Afficher un menu de sélection
        await showSelectionMenu(interaction, userId, protectionItems, stackingInfo)

    } catch (error) {
        logger.error("Error handling use protection button:", error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle("❌ Erreur")
            .setDescription("Une erreur est survenue. Réessaye plus tard.")
            .setTimestamp();

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({embeds: [errorEmbed]});
        } else {
            await interaction.reply({embeds: [errorEmbed], ephemeral: true});
        }
    }
    */
}

// [DÉSACTIVÉ] Toutes les autres fonctions ont été supprimées car l'événement est terminé
// Pour réactiver, consulter l'historique git avant cette désactivation
