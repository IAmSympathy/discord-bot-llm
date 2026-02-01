import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags} from "discord.js";
import {createLogger} from "./logger";
import {createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed} from "./embedBuilder";

const logger = createLogger("InteractionUtils");

/**
 * Utilitaires pour gérer les interactions Discord et leurs erreurs
 * Évite la duplication de code dans les commandes
 */

// Ré-exporter les fonctions embed pour les commandes
export {createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed} from "./embedBuilder";

/**
 * Répond à une interaction avec gestion automatique des erreurs
 * Gère les cas d'interaction expirée et de réponse déjà envoyée
 */
export async function safeReply(
    interaction: ChatInputCommandInteraction,
    content: string | { embeds: EmbedBuilder[]; flags?: MessageFlags },
    ephemeral: boolean = false
): Promise<void> {
    try {
        const replyOptions: any = typeof content === 'string'
            ? {content, flags: ephemeral ? MessageFlags.Ephemeral : undefined}
            : content;

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    } catch (error: any) {
        if (error?.code === 10062) {
            logger.warn(`Interaction expired for command ${interaction.commandName}`);
            return;
        }
        logger.error(`Error replying to interaction:`, error);
    }
}

/**
 * Répond avec un embed d'erreur, gère automatiquement les cas d'erreur
 */
export async function replyWithError(
    interaction: ChatInputCommandInteraction,
    title: string,
    description: string,
    ephemeral: boolean = true
): Promise<void> {
    const errorEmbed = createErrorEmbed(title, description);
    await safeReply(interaction, {embeds: [errorEmbed], flags: ephemeral ? MessageFlags.Ephemeral : undefined}, ephemeral);
}

/**
 * Répond avec un embed de succès
 */
export async function replyWithSuccess(
    interaction: ChatInputCommandInteraction,
    title: string,
    description: string,
    ephemeral: boolean = false
): Promise<void> {
    const successEmbed = createSuccessEmbed(title, description);
    await safeReply(interaction, {embeds: [successEmbed], flags: ephemeral ? MessageFlags.Ephemeral : undefined}, ephemeral);
}

/**
 * Répond avec un embed d'information
 */
export async function replyWithInfo(
    interaction: ChatInputCommandInteraction,
    title: string,
    description: string,
    ephemeral: boolean = false
): Promise<void> {
    const infoEmbed = createInfoEmbed(title, description);
    await safeReply(interaction, {embeds: [infoEmbed], flags: ephemeral ? MessageFlags.Ephemeral : undefined}, ephemeral);
}

/**
 * Vérifie si une erreur est due à une interaction expirée
 */
export function isInteractionExpired(error: any): boolean {
    return error?.code === 10062;
}

/**
 * Gère les erreurs d'interaction de manière centralisée
 * Retourne true si l'erreur a été gérée, false sinon
 */
export async function handleInteractionError(
    interaction: ChatInputCommandInteraction,
    error: any,
    commandName: string
): Promise<void> {
    logger.error(`[${commandName}] Error:`, error);

    if (error?.code === 10062 || error?.rawError?.code === 10062) {
        logger.warn(`[${commandName}] Interaction expired`);
        return;
    }

    try {
        await replyWithError(
            interaction,
            "❌ Erreur",
            "Une erreur s'est produite lors de l'exécution de la commande.",
            true
        );
    } catch (replyError: any) {
        if (replyError?.code === 10062) {
            logger.warn(`[${commandName}] Could not send error message - interaction expired`);
        } else {
            logger.error(`[${commandName}] Error sending error message:`, replyError);
        }
    }
}
