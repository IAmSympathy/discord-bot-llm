import {Client, Events, MessageReaction, PartialMessageReaction, PartialUser, User} from "discord.js";
import {logCommand} from "./utils/discordLogger";
import {EnvConfig} from "./utils/envConfig";
import {createLogger} from "./utils/logger";

const logger = createLogger("RoleReaction");
const ROLE_REACTION_MESSAGE_ID = EnvConfig.ROLE_REACTION_MESSAGE_ID;
const ROLE_REACTION_CHANNEL_ID = EnvConfig.ROLE_REACTION_CHANNEL_ID || "1158184382679498832";

/**
 * Map des emoji → rôle à donner
 * Chaque entrée représente une réaction possible sur le message info
 */
function getRoleReactionMap(): { emojiId: string; roleId: string; label: string }[] {
    const map: { emojiId: string; roleId: string; label: string }[] = [];

    const gamesEmojiId = EnvConfig.ROLE_REACTION_EMOJI_ID;
    const gamesRoleId = EnvConfig.ROLE_REACTION_ROLE_ID;
    if (gamesEmojiId && gamesRoleId) {
        map.push({emojiId: gamesEmojiId, roleId: gamesRoleId, label: "Jeux gratuits"});
    }

    const lootEmojiId = EnvConfig.FREE_GAMES_LOOT_EMOJI_ID;
    const lootRoleId = EnvConfig.FREE_GAMES_LOOT_ROLE_ID;
    if (lootEmojiId && lootRoleId) {
        map.push({emojiId: lootEmojiId, roleId: lootRoleId, label: "Loots & DLC"});
    }

    return map;
}

/**
 * Ajoute automatiquement les réactions de base au message
 * pour qu'elles restent toujours visibles
 */
async function addBaseReactions(client: Client) {
    if (!ROLE_REACTION_MESSAGE_ID) {
        logger.warn(`Missing ROLE_REACTION_MESSAGE_ID in .env`);
        return;
    }

    try {
        logger.info(`Fetching message ${ROLE_REACTION_MESSAGE_ID} from channel ${ROLE_REACTION_CHANNEL_ID}...`);

        const channel = await client.channels.fetch(ROLE_REACTION_CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
            logger.error(`❌ Channel ${ROLE_REACTION_CHANNEL_ID} not found or not text-based`);
            return;
        }

        const message = await channel.messages.fetch(ROLE_REACTION_MESSAGE_ID);
        if (!message) {
            logger.error(`❌ Message ${ROLE_REACTION_MESSAGE_ID} not found in channel`);
            return;
        }

        logger.info(`✅ Message found in #${(channel as any).name || channel.id}`);

        const reactionMap = getRoleReactionMap();
        for (const entry of reactionMap) {
            const botReaction = message.reactions.cache.find(
                r => r.emoji.id === entry.emojiId && r.me
            );
            if (!botReaction) {
                await message.react(`<:role_emoji:${entry.emojiId}>`);
                logger.info(`✅ Reaction added for role "${entry.label}" (emoji ${entry.emojiId})`);
            } else {
                logger.info(`✅ Reaction already present for role "${entry.label}"`);
            }
        }

    } catch (error: any) {
        logger.error(`❌ Error adding base reactions:`, error.message);
    }
}

export function registerRoleReactionHandler(client: Client) {
    if (!ROLE_REACTION_MESSAGE_ID) {
        logger.warn("Missing ROLE_REACTION_MESSAGE_ID in .env - handler disabled");
        return;
    }

    const reactionMap = getRoleReactionMap();
    if (reactionMap.length === 0) {
        logger.warn("No valid emoji/role pairs configured - handler disabled");
        return;
    }

    logger.info(`Handler registered for message ${ROLE_REACTION_MESSAGE_ID} with ${reactionMap.length} reaction(s)`);

    // Ajouter les réactions de base au démarrage du bot
    client.once(Events.ClientReady, async () => {
        await addBaseReactions(client);
    });

    // Événement: Réaction ajoutée
    client.on(Events.MessageReactionAdd, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    logger.error("Error fetching reaction:", error);
                    return;
                }
            }

            if (reaction.message.id !== ROLE_REACTION_MESSAGE_ID) return;

            // Trouver la paire emoji → rôle correspondante
            const entry = reactionMap.find(e => e.emojiId === reaction.emoji.id);
            if (!entry) {
                logger.debug(`Unknown emoji reaction: ${reaction.emoji.id}`);
                return;
            }

            logger.info(`Valid reaction "${entry.label}" from ${user.username} - giving role`);

            const guild = reaction.message.guild;
            if (!guild) {
                logger.error("No guild found");
                return;
            }

            const member = await guild.members.fetch(user.id);
            if (!member) {
                logger.error("Could not fetch member");
                return;
            }

            if (member.roles.cache.has(entry.roleId)) {
                logger.info(`${user.username} already has role "${entry.label}"`);
                return;
            }

            await member.roles.add(entry.roleId);
            logger.info(`✅ Role "${entry.label}" given to ${user.username}`);

            const channelName = (reaction.message.channel as any).name || "Unknown";
            await logCommand("🎭 Rôle attribué par réaction", undefined, [
                {name: "👤 Membre", value: user.username || user.id, inline: true},
                {name: "📝 Rôle", value: `<@&${entry.roleId}> (${entry.label})`, inline: true},
                {name: "💬 Message", value: ROLE_REACTION_MESSAGE_ID, inline: true}
            ], undefined, channelName, user.displayAvatarURL());

        } catch (error) {
            logger.error("Error handling reaction add:", error);
        }
    });

    // Événement: Réaction retirée
    client.on(Events.MessageReactionRemove, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    logger.error("Error fetching reaction:", error);
                    return;
                }
            }

            if (reaction.message.id !== ROLE_REACTION_MESSAGE_ID) return;

            // Trouver la paire emoji → rôle correspondante
            const entry = reactionMap.find(e => e.emojiId === reaction.emoji.id);
            if (!entry) return;

            logger.info(`Reaction "${entry.label}" removed from ${user.username} - removing role`);

            const guild = reaction.message.guild;
            if (!guild) {
                logger.error("No guild found");
                return;
            }

            const member = await guild.members.fetch(user.id);
            if (!member) {
                logger.error("Could not fetch member");
                return;
            }

            if (!member.roles.cache.has(entry.roleId)) {
                logger.info(`${user.username} doesn't have role "${entry.label}"`);
                return;
            }

            await member.roles.remove(entry.roleId);
            logger.info(`✅ Role "${entry.label}" removed from ${user.username}`);

            const channelName = (reaction.message.channel as any).name || "Unknown";
            await logCommand("🎭 Rôle retiré par réaction", undefined, [
                {name: "👤 Membre", value: user.username || user.id, inline: true},
                {name: "📝 Rôle", value: `<@&${entry.roleId}> (${entry.label})`, inline: true},
                {name: "💬 Message", value: ROLE_REACTION_MESSAGE_ID, inline: true}
            ], undefined, channelName, user.displayAvatarURL());

        } catch (error) {
            logger.error("Error handling reaction remove:", error);
        }
    });
}
