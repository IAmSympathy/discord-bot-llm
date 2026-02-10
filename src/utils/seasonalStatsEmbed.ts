import {EmbedBuilder} from "discord.js";
import {loadFireCooldowns, loadFireData} from "../services/seasonal/fireDataManager";
import {FIRE_COLORS, FIRE_CONFIG, FIRE_EMOJIS, FIRE_NAMES, getFireMultiplier, getFireState} from "../services/seasonal/fireData";

/**
 * Crée l'embed des statistiques saisonnières (Feu de Foyer) - VERSION SIMPLIFIÉE
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
    let description = `#### 🪵 Mes Contributions\n`;

    if (hasAddedLog) {
        const cooldownRemaining = FIRE_CONFIG.USER_COOLDOWN - (Date.now() - userLastLog);
        const timestampSeconds = Math.floor(userLastLog / 1000);

        description += `Dernière bûche : <t:${timestampSeconds}:R>\n`;

        if (cooldownRemaining > 0) {
            const cooldownEndTimestamp = Math.floor((userLastLog + FIRE_CONFIG.USER_COOLDOWN) / 1000);
            description += `⏰ Cooldown : <t:${cooldownEndTimestamp}:R>\n`;
        } else {
            description += `✅ Prêt à ajouter une bûche !\n`;
        }
    } else {
        description += `Aucune contribution\n`;
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
