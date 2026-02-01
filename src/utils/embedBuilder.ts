import {EmbedBuilder} from "discord.js";

/**
 * Utilitaires centralisés pour créer des embeds Discord standardisés
 * Évite la duplication entre interactionUtils et discordLogger
 */

/**
 * Crée un embed de succès standardisé
 */
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x2ecc71) // Vert
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Crée un embed d'erreur standardisé
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xe74c3c) // Rouge
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Crée un embed d'information standardisé
 */
export function createInfoEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x3498db) // Bleu
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Crée un embed d'avertissement standardisé
 */
export function createWarningEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xf39c12) // Orange
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}
