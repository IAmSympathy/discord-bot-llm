import {EmbedBuilder} from "discord.js";
import {loadFireCooldowns, loadFireData} from "../services/seasonal/fireDataManager";
import {FIRE_COLORS, FIRE_CONFIG, FIRE_EMOJIS, FIRE_NAMES, getFireMultiplier, getFireState} from "../services/seasonal/fireData";

/**
 * Crée l'embed des statistiques saisonnières (Feu de Foyer) - VERSION COMPLÈTE
 */
export function createSeasonalStatsEmbed(userId: string, username: string, displayAvatarURL: string): EmbedBuilder {
    const fireData = loadFireData();
    const cooldowns = loadFireCooldowns();

    const userLastLog = cooldowns[userId];
    const hasAddedLog = userLastLog !== undefined;

    const state = getFireState(fireData.intensity);
    const multiplier = getFireMultiplier(fireData.intensity);
    const emoji = FIRE_EMOJIS[state];
    const stateName = FIRE_NAMES[state];
    const color = FIRE_COLORS[state];

    // Compter le nombre de bûches ajoutées par cet utilisateur
    const userLogsCount = fireData.logs.filter((log: any) => log.userId === userId).length;

    // Récupérer l'inventaire pour compter les items de la saison
    const {getUserInventory, ITEM_CATALOG, getCurrentSeason} = require("../services/userInventoryService");
    const inventory = getUserInventory(userId, username);
    const currentSeason = getCurrentSeason();

    // Compter le nombre total d'items de la saison actuelle
    let seasonalItemsCount = 0;
    for (const [itemType, quantity] of Object.entries(inventory.items) as Array<[string, number]>) {
        const itemInfo = ITEM_CATALOG[itemType];
        if (itemInfo && itemInfo.season === currentSeason && typeof quantity === 'number') {
            seasonalItemsCount += quantity;
        }
    }

    let description = `**Mes Contributions**\n\n`;
    description += `🪵 **Bûches ajoutées :** ${userLogsCount}\n`;
    description += `🎁 **Items gagnés:** ${seasonalItemsCount}\n\n`;

    if (hasAddedLog) {
        const cooldownRemaining = FIRE_CONFIG.USER_COOLDOWN - (Date.now() - userLastLog);
        const timestampSeconds = Math.floor(userLastLog / 1000);

        description += `**Dernière bûche**\n`;
        description += `⏰ Ajoutée : <t:${timestampSeconds}:R>\n`;

        if (cooldownRemaining > 0) {
            const cooldownEndTimestamp = Math.floor((userLastLog + FIRE_CONFIG.USER_COOLDOWN) / 1000);
            description += `🔄 Disponible : <t:${cooldownEndTimestamp}:R>\n`;
        } else {
            description += `✅ Prêt à ajouter une bûche !\n`;
        }
    } else {
        description += `Tu n'as pas encore contribué au feu. Utilise \`/harvest\` pour obtenir des bûches !\n`;
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} Feu de Foyer - ${username}`)
        .setDescription(description)
        .setThumbnail(displayAvatarURL)
        .setFooter({text: "Hiver 2026"})
        .setTimestamp();

    return embed;
}
