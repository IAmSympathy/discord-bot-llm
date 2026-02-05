import {ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder} from "discord.js";

/**
 * Crée un bouton "Rejoindre la partie"
 */
export function createJoinButton(gameId: string, gamePrefix: string): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`${gamePrefix}_join_${gameId}`)
        .setLabel("Rejoindre la partie")
        .setStyle(ButtonStyle.Success)
        .setEmoji("⚔️");
}

/**
 * Crée un bouton "Annuler"
 */
export function createCancelButton(gameId: string, gamePrefix: string): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`${gamePrefix}_cancel_${gameId}`)
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌");
}

/**
 * Crée un bouton "Rematch"
 */
export function createRematchButton(channelId: string, gamePrefix: string): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`${gamePrefix}_rematch_${channelId}_${Date.now()}`)
        .setLabel("Rematch")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄");
}

/**
 * Crée un bouton "Retour au menu"
 */
export function createBackToMenuButton(): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`game_back_to_menu_${Date.now()}`)
        .setLabel("Retour au menu")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🏠");
}

/**
 * Crée l'embed de recherche d'adversaire
 */
export function createWaitingEmbed(playerId: string, gameTitle: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎮 ${gameTitle}`)
        .setDescription(`<@${playerId}> cherche un adversaire !\n\nClique sur le bouton pour rejoindre la partie.`)
        .setTimestamp();
}

/**
 * Crée l'embed de timeout
 */
export function createTimeoutEmbed(gameTitle: string, message: string = "Aucun joueur n'a rejoint."): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🎮 ${gameTitle}`)
        .setDescription(`⏱️ Temps écoulé ! ${message}`)
        .setTimestamp();
}

/**
 * Crée l'embed d'annulation
 */
export function createCancelEmbed(gameTitle: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🎮 ${gameTitle}`)
        .setDescription("❌ Partie annulée.")
        .setTimestamp();
}

/**
 * Configuration commune pour les collectors
 */
export const COLLECTOR_CONFIG = {
    WAITING_TIME: 60000, // 1 minute pour rejoindre
    GAME_TIME: 300000,   // 5 minutes pour jouer
    REMATCH_TIME: 120000 // 2 minutes pour rematch
};

/**
 * Gère l'annulation d'une partie
 */
export async function handleGameCancellation(
    interaction: any,
    playerId: string,
    activeGames: Map<string, any>,
    gameId: string,
    gameTitle: string
): Promise<boolean> {
    if (interaction.user.id !== playerId) {
        await interaction.reply({content: "❌ Seul le créateur peut annuler la partie.", ephemeral: true});
        return false;
    }

    activeGames.delete(gameId);
    const embed = createCancelEmbed(gameTitle);
    await interaction.update({embeds: [embed], components: []});
    return true;
}

/**
 * Vérifie si un joueur peut rejoindre (pas contre soi-même)
 */
export function canJoinGame(joinerId: string, creatorId: string): { canJoin: boolean; error?: string } {
    if (joinerId === creatorId) {
        return {canJoin: false, error: "❌ Tu ne peux pas jouer contre toi-même !"};
    }
    return {canJoin: true};
}
