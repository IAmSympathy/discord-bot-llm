import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction} from "discord.js";
import {createLogger} from "../../utils/logger";
import {getFireProtectionItems, InventoryItemType, ITEM_CATALOG, removeItemFromInventory} from "../userInventoryService";
import {activateWeatherProtection, getWeatherProtectionInfo} from "./fireDataManager";

const logger = createLogger("FireProtectionHandler");

/**
 * Gère l'interaction du bouton "Utiliser Stuff à Feu"
 */
export async function handleUseProtectionButton(interaction: ButtonInteraction): Promise<void> {
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
                    `• Utilise les fonctionnalités de Netricsa` +
                    `• Gagne des parties de jeux\n` +
                    `• Débloque des achievements\n`
                )
                .setFooter({text: "Les objets de protection te permettent de bloquer les effets météo"})
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
}

/**
 * Affiche un menu de sélection pour choisir quel objet utiliser
 */
async function showSelectionMenu(
    interaction: ButtonInteraction,
    userId: string,
    items: Array<{ type: InventoryItemType, quantity: number, info: any }>,
    stackingInfo: string = ""
): Promise<void> {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`fire_protection_select_${userId}`)
        .setPlaceholder("Choisis un objet à utiliser")
        .addOptions(
            items.map(item => ({
                label: `${item.info.emoji} ${item.info.name} (×${item.quantity})`,
                description: item.info.description,
                value: item.type
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🛡️ Sélectionne une protection climatique")
        .setDescription(
            `\n${stackingInfo}`
        )
        .setTimestamp();

    await interaction.reply({embeds: [embed], components: [row], ephemeral: true});

    // Collecter la réponse du menu
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000 // 1 minute
    });

    collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
        if (selectInteraction.user.id !== userId) {
            await selectInteraction.reply({
                content: "Ce n'est pas ton menu !",
                ephemeral: true
            });
            return;
        }

        const selectedType = selectInteraction.values[0] as InventoryItemType;
        await selectInteraction.deferUpdate();
        await showConfirmation(selectInteraction, userId, selectInteraction.user.username, selectedType);
        collector.stop();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle("⏱️ Temps écoulé")
                .setDescription("La sélection a expiré.")
                .setTimestamp();

            await interaction.editReply({embeds: [timeoutEmbed], components: []});
        }
    });
}

/**
 * Affiche une confirmation avant d'utiliser l'objet
 */
async function showConfirmation(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    userId: string,
    username: string,
    itemType: InventoryItemType,
    stackingInfo: string = ""
): Promise<void> {
    const itemInfo = ITEM_CATALOG[itemType];
    const duration = itemInfo.duration || 0;
    const durationMinutes = Math.floor(duration / 60000);

    // Vérifier s'il y a une protection active pour calculer le temps total
    const currentProtection = getWeatherProtectionInfo();
    let timeInfo = `⏱️ Durée : **${durationMinutes} minutes**`;

    if (currentProtection.active && currentProtection.remainingTime > 0) {
        const currentMinutes = Math.ceil(currentProtection.remainingTime / 60000);
        const totalMinutes = currentMinutes + durationMinutes;
        timeInfo = `⏱️ Durée actuelle : **${currentMinutes} min**\n⏱️ Ajout : **+${durationMinutes} min**\n✨ **Total : ${totalMinutes} min**`;
    }

    const confirmButton = new ButtonBuilder()
        .setCustomId(`fire_protection_confirm_${itemType}_${userId}`)
        .setLabel("✅ Confirmer")
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`fire_protection_cancel_${userId}`)
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const confirmEmbed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle("🛡️ Confirmation d'utilisation")
        .setDescription(
            `Tu es sur le point d'utiliser :\n\n` +
            `${itemInfo.emoji} **${itemInfo.name}**\n` +
            `${timeInfo}\n\n` +
            `Cette protection empêchera la température d'affecter le feu.`
        )
        .setFooter({text: "Es-tu sûr de vouloir utiliser cet objet ?"})
        .setTimestamp();

    // Gérer le type d'interaction
    let message;
    if (interaction.replied || interaction.deferred) {
        // Si l'interaction a déjà été replied ou deferred, on utilise editReply
        message = await interaction.editReply({embeds: [confirmEmbed], components: [row]});
    } else {
        // Sinon, on reply normalement
        await interaction.reply({embeds: [confirmEmbed], components: [row], ephemeral: true});
        message = await interaction.fetchReply();
    }
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000 // 30 secondes
    });

    collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== userId) {
            await btnInteraction.reply({
                content: "Ce n'est pas ton menu !",
                ephemeral: true
            });
            return;
        }

        await btnInteraction.deferUpdate();

        if (btnInteraction.customId.startsWith('fire_protection_confirm_')) {
            // Utiliser l'objet
            const success = removeItemFromInventory(userId, itemType, 1);

            if (!success) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle("❌ Objet introuvable")
                    .setDescription("Tu ne possèdes plus cet objet.")
                    .setTimestamp();

                await interaction.editReply({embeds: [errorEmbed], components: []});
                collector.stop();
                return;
            }

            // Activer la protection
            activateWeatherProtection(userId, username, duration);

            const successEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle("Protection activée !")
                .setDescription(
                    `${itemInfo.emoji} **${itemInfo.name}** utilisé avec succès !\n` +
                    `Le feu est maintenant protégé des effets météo pendant **${durationMinutes} minutes** !\n\n` +
                    `⏱️ La protection se terminera <t:${Math.floor((Date.now() + duration) / 1000)}:R>`
                )
                .setFooter({text: "Le feu ne sera pas affecté par la température extérieure"})
                .setTimestamp();

            await interaction.editReply({embeds: [successEmbed], components: []});

            logger.info(`${username} activated ${itemInfo.name} for ${durationMinutes} minutes`);
        } else {
            // Annuler
            const cancelEmbed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle("❌ Annulé")
                .setDescription("L'utilisation de l'objet a été annulée.")
                .setTimestamp();

            await interaction.editReply({embeds: [cancelEmbed], components: []});
        }

        collector.stop();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
                .setColor(0x95A5A6)
                .setTitle("⏱️ Temps écoulé")
                .setDescription("La confirmation a expiré.")
                .setTimestamp();

            await interaction.editReply({embeds: [timeoutEmbed], components: []});
        }
    });
}





