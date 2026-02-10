import {ButtonInteraction, EmbedBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {addLog, updateFireChannel, updateFireEmbed} from "./fireManager";
import {handleUseProtectionButton} from "./fireProtectionHandler";

const logger = createLogger("FireButtonHandler");

/**
 * Gère l'interaction du bouton "Ajouter une bûche"
 */
export async function handleAddLogButton(interaction: ButtonInteraction): Promise<void> {
    try {
        await interaction.deferReply({ephemeral: true});

        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Vérifier si l'utilisateur a une bûche dans son inventaire
        const {hasItem, InventoryItemType, removeItemFromInventory} = require("../userInventoryService");

        if (!hasItem(userId, InventoryItemType.FIREWOOD_LOG, 1)) {
            const noBucheEmbed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle("🪵 Pas de bûche !")
                .setDescription(
                    `Tu n'as pas de bûche dans ton inventaire !\n\n` +
                    `🎁 **Comment obtenir une bûche ?**\n` +
                    `Utilise la commande \`/harvest\` (cooldown: 6h)`
                )
                .setTimestamp();

            await interaction.editReply({embeds: [noBucheEmbed]});
            return;
        }

        // Ajouter la bûche au feu
        const result = await addLog(userId, username);

        if (!result.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xF39C12)
                .setTitle("🔥 Feu au maximum")
                .setDescription(result.message + "\n\n💡 Tu as toujours ta bûche 🪵 dans ton inventaire !")
                .setTimestamp();

            await interaction.editReply({embeds: [errorEmbed]});
            return;
        }

        // Consommer la bûche de l'inventaire
        removeItemFromInventory(userId, InventoryItemType.FIREWOOD_LOG, 1);


        // Réponse de succès
        const successEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("✅ Bûche ajoutée !")
            .setDescription(
                result.message +
                "\n\n🪵 Ta bûche a été consommée et ajoutée au feu !" +
                "\n💡 Tu peux obtenir une nouvelle bûche en participant aux activités."
            )
            .setFooter({text: "Merci de contribuer au feu de foyer !"})
            .setTimestamp();

        await interaction.editReply({embeds: [successEmbed]});

        // Mettre à jour l'interface
        await updateFireChannel(interaction.client);
        await updateFireEmbed(interaction.client);

        logger.info(`${username} (${userId}) added a log. New intensity: ${result.newIntensity}%`);

    } catch (error) {
        logger.error("Error handling add log button:", error);

        try {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle("❌ Erreur")
                .setDescription("Une erreur est survenue lors de l'ajout de la bûche.")
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        } catch (replyError) {
            logger.error("Could not send error message:", replyError);
        }
    }
}

// Exporter aussi le handler de protection
export {handleUseProtectionButton};
