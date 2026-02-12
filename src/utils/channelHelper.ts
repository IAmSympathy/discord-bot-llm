import {ChannelType, ChatInputCommandInteraction, DMChannel} from "discord.js";

/**
 * Obtient le nom du canal avec le contexte approprié pour une interaction
 * @param interaction L'interaction de commande
 * @returns Le nom du canal formaté avec le contexte (DM, Groupe DM, Serveur externe, etc.)
 */
export function getChannelNameFromInteraction(interaction: ChatInputCommandInteraction): string {
    const channel = interaction.channel;
    if (!channel) {
        return "canal-inconnu";
    }

    const REQUIRED_GUILD_ID = process.env.REQUIRED_GUILD_ID;
    const isExternalServer = interaction.guild && interaction.guildId !== REQUIRED_GUILD_ID;
    const isDM = channel.type === ChannelType.DM;
    const isGroupDM = channel.type === 1; // GroupDM

    if (isDM) {
        // Pour un DM 1-1, récupérer le nom du destinataire
        const dmChannel = channel as DMChannel;
        const recipientName = dmChannel.recipient?.displayName || dmChannel.recipient?.username || interaction.user.displayName;
        return `DM avec ${recipientName}`;
    } else if (isGroupDM) {
        // Pour un groupe DM
        return `Groupe DM${(channel as any).name ? ` (${(channel as any).name})` : ''}`;
    } else if (isExternalServer && interaction.guild) {
        // UserApp utilisé dans un serveur externe
        const guildName = interaction.guild.name;
        const channelNameInGuild = (channel as any).name || 'canal-inconnu';
        return `#${channelNameInGuild} (Serveur externe: ${guildName})`;
    } else {
        // Serveur normal
        return (channel as any).name || `channel-${channel.id}`;
    }
}

