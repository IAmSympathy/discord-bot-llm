import {Client, Events, MessageReaction, PartialMessageReaction, PartialUser, User} from "discord.js";
import {logCommand} from "./utils/discordLogger";

const ROLE_REACTION_MESSAGE_ID = process.env.ROLE_REACTION_MESSAGE_ID;
const ROLE_REACTION_EMOJI_ID = process.env.ROLE_REACTION_EMOJI_ID;
const ROLE_TO_GIVE_ID = process.env.ROLE_TO_GIVE_ID;
const ROLE_REACTION_CHANNEL_ID = process.env.ROLE_REACTION_CHANNEL_ID || "1158184382679498832";

/**
 * Ajoute automatiquement la réaction de base au message
 * pour qu'elle reste toujours visible
 */
async function addBaseReaction(client: Client) {
    if (!ROLE_REACTION_MESSAGE_ID || !ROLE_REACTION_EMOJI_ID) {
        console.warn(`[RoleReaction] Missing MESSAGE_ID or EMOJI_ID in .env`);
        return;
    }

    try {
        console.log(`[RoleReaction] Fetching message ${ROLE_REACTION_MESSAGE_ID} from channel ${ROLE_REACTION_CHANNEL_ID}...`);

        // Récupérer le canal directement
        const channel = await client.channels.fetch(ROLE_REACTION_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
            console.error(`[RoleReaction] ❌ Channel ${ROLE_REACTION_CHANNEL_ID} not found or not text-based`);
            return;
        }

        // Récupérer le message
        const message = await channel.messages.fetch(ROLE_REACTION_MESSAGE_ID);

        if (!message) {
            console.error(`[RoleReaction] ❌ Message ${ROLE_REACTION_MESSAGE_ID} not found in channel`);
            return;
        }

        console.log(`[RoleReaction] ✅ Message found in #${(channel as any).name || channel.id}`);

        // Vérifier si Netricsa a déjà réagi
        const botReaction = message.reactions.cache.find(
            r => r.emoji.id === ROLE_REACTION_EMOJI_ID && r.me
        );

        if (!botReaction) {
            // Ajouter la réaction
            await message.react(`<:zzzRole_Netricsa:${ROLE_REACTION_EMOJI_ID}>`);
            console.log(`[RoleReaction] ✅ Base reaction added to message`);
        } else {
            console.log(`[RoleReaction] ✅ Base reaction already present`);
        }

    } catch (error: any) {
        console.error(`[RoleReaction] ❌ Error adding base reaction:`, error.message);
    }
}

export function registerRoleReactionHandler(client: Client) {
    if (!ROLE_REACTION_MESSAGE_ID || !ROLE_REACTION_EMOJI_ID || !ROLE_TO_GIVE_ID) {
        console.warn("[RoleReaction] Missing configuration in .env - handler disabled");
        return;
    }

    console.log(`[RoleReaction] Handler registered for message ${ROLE_REACTION_MESSAGE_ID}`);

    // Ajouter la réaction de base au démarrage du bot
    client.once(Events.ClientReady, async () => {
        await addBaseReaction(client);
    });

    // Événement: Réaction ajoutée
    client.on(Events.MessageReactionAdd, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            // Ignorer les réactions du bot lui-même
            if (user.bot) return;

            // Si la réaction est partielle, fetch les données complètes
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.error("[RoleReaction] Error fetching reaction:", error);
                    return;
                }
            }

            // Vérifier si c'est le bon message
            if (reaction.message.id !== ROLE_REACTION_MESSAGE_ID) {
                return;
            }

            // Vérifier si c'est le bon emoji
            const emojiId = reaction.emoji.id;
            if (emojiId !== ROLE_REACTION_EMOJI_ID) {
                console.log(`[RoleReaction] Wrong emoji: ${emojiId} (expected ${ROLE_REACTION_EMOJI_ID})`);
                return;
            }

            console.log(`[RoleReaction] Valid reaction from ${user.username} - giving role`);

            // Récupérer le membre
            const guild = reaction.message.guild;
            if (!guild) {
                console.error("[RoleReaction] No guild found");
                return;
            }

            const member = await guild.members.fetch(user.id);
            if (!member) {
                console.error("[RoleReaction] Could not fetch member");
                return;
            }

            // Vérifier si le membre a déjà le rôle
            if (member.roles.cache.has(ROLE_TO_GIVE_ID)) {
                console.log(`[RoleReaction] ${user.username} already has the role`);
                return;
            }

            // Donner le rôle
            await member.roles.add(ROLE_TO_GIVE_ID);
            console.log(`[RoleReaction] ✅ Role given to ${user.username}`);

            // Logger dans Discord
            await logCommand("🎭 Rôle attribué par réaction", undefined, [
                {name: "👤 Membre", value: user.username || user.id, inline: true},
                {name: "📝 Rôle", value: `<@&${ROLE_TO_GIVE_ID}>`, inline: true},
                {name: "💬 Message", value: ROLE_REACTION_MESSAGE_ID, inline: true}
            ]);

        } catch (error) {
            console.error("[RoleReaction] Error handling reaction add:", error);
        }
    });

    // Événement: Réaction retirée
    client.on(Events.MessageReactionRemove, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            // Ignorer les réactions du bot lui-même
            if (user.bot) return;

            // Si la réaction est partielle, fetch les données complètes
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.error("[RoleReaction] Error fetching reaction:", error);
                    return;
                }
            }

            // Vérifier si c'est le bon message
            if (reaction.message.id !== ROLE_REACTION_MESSAGE_ID) {
                return;
            }

            // Vérifier si c'est le bon emoji
            const emojiId = reaction.emoji.id;
            if (emojiId !== ROLE_REACTION_EMOJI_ID) {
                return;
            }

            console.log(`[RoleReaction] Reaction removed from ${user.username} - removing role`);

            // Récupérer le membre
            const guild = reaction.message.guild;
            if (!guild) {
                console.error("[RoleReaction] No guild found");
                return;
            }

            const member = await guild.members.fetch(user.id);
            if (!member) {
                console.error("[RoleReaction] Could not fetch member");
                return;
            }

            // Vérifier si le membre a le rôle
            if (!member.roles.cache.has(ROLE_TO_GIVE_ID)) {
                console.log(`[RoleReaction] ${user.username} doesn't have the role`);
                return;
            }

            // Retirer le rôle
            await member.roles.remove(ROLE_TO_GIVE_ID);
            console.log(`[RoleReaction] ✅ Role removed from ${user.username}`);

            // Logger dans Discord
            await logCommand("🎭 Rôle retiré par réaction", undefined, [
                {name: "👤 Membre", value: user.username || user.id, inline: true},
                {name: "📝 Rôle", value: `<@&${ROLE_TO_GIVE_ID}>`, inline: true},
                {name: "💬 Message", value: ROLE_REACTION_MESSAGE_ID, inline: true}
            ]);

        } catch (error) {
            console.error("[RoleReaction] Error handling reaction remove:", error);
        }
    });
}
