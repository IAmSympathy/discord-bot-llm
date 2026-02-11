import {ChatInputCommandInteraction, Client, EmbedBuilder, User} from "discord.js";
import {createLogger} from "./logger";

const logger = createLogger("ServerCheck");

// ID du serveur The Not So Serious Lands
const REQUIRED_GUILD_ID = process.env.GUILD_ID || "827364829567647774";
const SERVER_NAME = "The Not So Serious Lands";

/**
 * Vérifie si l'utilisateur est membre du serveur requis
 * @param interaction L'interaction de la commande
 * @returns true si l'utilisateur est membre, false sinon
 */
export async function isUserInRequiredServer(interaction: ChatInputCommandInteraction): Promise<boolean> {
    try {
        // Si on est déjà dans le bon serveur, pas besoin de vérifier
        if (interaction.guildId === REQUIRED_GUILD_ID) {
            return true;
        }

        // Récupérer le client
        const client = interaction.client;

        // Récupérer le serveur requis
        const guild = await client.guilds.fetch(REQUIRED_GUILD_ID).catch(() => null);

        if (!guild) {
            logger.error("Required guild not found");
            return false;
        }

        // Vérifier si l'utilisateur est membre
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);

        return member !== null;
    } catch (error) {
        logger.error("Error checking server membership:", error);
        return false;
    }
}

/**
 * Crée un embed d'erreur avec la photo du serveur pour les utilisateurs non-membres
 */
async function createNotMemberErrorEmbed(interaction: ChatInputCommandInteraction): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔒 Accès Restreint")
        .setDescription(
            `Désolé, cette fonctionnalité n'est disponible que pour les membres du serveur **${SERVER_NAME}**.\n\n`
        )
        .setTimestamp();

    // Tenter de récupérer l'icône du serveur
    try {
        const client = interaction.client;
        const guild = await client.guilds.fetch(REQUIRED_GUILD_ID).catch(() => null);

        if (guild && guild.iconURL()) {
            embed.setThumbnail(guild.iconURL()!);
        }
    } catch (error) {
        logger.debug("Could not fetch guild icon for error embed");
    }

    return embed;
}

/**
 * Vérifie si l'utilisateur est membre et envoie un message d'erreur si ce n'est pas le cas
 * @param interaction L'interaction de la commande
 * @returns true si l'utilisateur est membre, false sinon
 */
export async function checkServerMembershipOrReply(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const isMember = await isUserInRequiredServer(interaction);

    if (!isMember) {
        const errorEmbed = await createNotMemberErrorEmbed(interaction);
        await interaction.reply({
            embeds: [errorEmbed]
        });
    }

    return isMember;
}

/**
 * Vérifie si un utilisateur (depuis un DM) est membre du serveur requis
 * @param client Le client Discord
 * @param user L'utilisateur à vérifier
 * @returns true si l'utilisateur est membre, false sinon
 */
export async function isUserInRequiredServerFromDM(client: Client, user: User): Promise<boolean> {
    try {
        // Récupérer le serveur requis
        const guild = await client.guilds.fetch(REQUIRED_GUILD_ID).catch(() => null);

        if (!guild) {
            logger.error("Required guild not found");
            return false;
        }

        // Vérifier si l'utilisateur est membre
        const member = await guild.members.fetch(user.id).catch(() => null);

        return member !== null;
    } catch (error) {
        logger.error("Error checking server membership from DM:", error);
        return false;
    }
}

/**
 * Crée un embed d'erreur pour les utilisateurs qui tentent de parler en DM sans être membres du serveur
 * @param client Le client Discord
 * @returns Un embed d'erreur
 */
export async function createDMNotMemberErrorEmbed(client: Client): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔒 Accès aux Conversations Privées Restreint")
        .setDescription(
            `Désolé, les conversations privées avec Netricsa sont réservées aux membres du serveur **${SERVER_NAME}**.`
        )
        .setTimestamp();

    // Tenter de récupérer l'icône du serveur
    try {
        const guild = await client.guilds.fetch(REQUIRED_GUILD_ID).catch(() => null);

        if (guild && guild.iconURL()) {
            embed.setThumbnail(guild.iconURL()!);
        }
    } catch (error) {
        logger.debug("Could not fetch guild icon for DM error embed");
    }

    return embed;
}


