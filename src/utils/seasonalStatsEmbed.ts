import {EmbedBuilder} from "discord.js";
import {loadFireCooldowns, loadFireData} from "../services/seasonal/fireDataManager";
import {FIRE_CONFIG, getFireState} from "../services/seasonal/fireData";

/**
 * Crée l'embed des statistiques saisonnières (Feu de Foyer) - VERSION COMPLÈTE
 */
export function createSeasonalStatsEmbed(userId: string, username: string, displayAvatarURL: string): EmbedBuilder {
    const fireData = loadFireData();
    const cooldowns = loadFireCooldowns();

    const userLastLog = cooldowns[userId];
    const hasAddedLog = userLastLog !== undefined;

    const state = getFireState(fireData.intensity);

    // Récupérer le nombre TOTAL de bûches ajoutées depuis le début de la saison (historique)
    const {getUserSeasonalStats} = require("../services/seasonal/seasonalUserStatsService");
    const seasonalStats = getUserSeasonalStats(userId);
    const totalLogsAdded = seasonalStats.totalLogsAdded;
    const totalProtectionsUsed = seasonalStats.totalProtectionsUsed;

    // Compter le nombre de bûches actuellement dans le feu
    const currentLogsInFire = fireData.logs.filter((log: any) => log.userId === userId).length;

    let description = `**Mes Contributions**\n\n`;
    description += `🪵 **Bûches ajoutées :** ${totalLogsAdded}\n`;
    description += `🔥 **Bûches dans le feu :** ${currentLogsInFire}\n`;
    description += `🛡️ **Protections utilisées :** ${totalProtectionsUsed}\n\n`;

    // Afficher les détails de la dernière bûche si l'utilisateur a déjà contribué
    const hasContributed = totalLogsAdded > 0 || hasAddedLog;

    if (hasContributed && hasAddedLog) {
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
    } else if (currentLogsInFire > 0 && !hasAddedLog) {
        // L'utilisateur a des bûches dans le feu mais pas de cooldown enregistré
        // (peut arriver après un redémarrage du bot ou migration)
        description += `✅ Tu as ${currentLogsInFire} bûche${currentLogsInFire > 1 ? 's' : ''} dans le feu !\n`;
        description += `Utilise \`/harvest\` pour en obtenir plus.\n`;
    } else {
        description += `Tu n'as pas encore contribué au feu. Utilise \`/harvest\` pour obtenir des bûches !\n`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle(`🔥 Feu de Foyer - ${username}`)
        .setDescription(description)
        .setThumbnail(displayAvatarURL)
        .setFooter({text: "Hiver 2026"})
        .setTimestamp();

    return embed;
}
