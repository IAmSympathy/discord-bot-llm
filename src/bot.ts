require("dotenv").config();
import path from "path";
import fs from "fs";
import {ActivityType, ChannelType, Client, Collection, EmbedBuilder, Events, GatewayIntentBits, MessageFlags, Partials, PresenceStatusData} from "discord.js";
import {registerWatchedChannelResponder} from "./watchChannel";
import {registerForumThreadHandler} from "./forumThreadHandler";
import {registerCitationsThreadHandler} from "./citationsThreadHandler";
import {registerRoleReactionHandler} from "./roleReactionHandler";
import {registerVoiceTracker} from "./voiceTracker";
import deployCommands from "./deploy/deployCommands";
import {initializeDiscordLogger, logServerBan, logServerChannelCreate, logServerChannelDelete, logServerMemberJoin, logServerMemberLeave, logServerMemberTimeout, logServerMemberTimeoutRemove, logServerMessageDelete, logServerMessageEdit, logServerNicknameChange, logServerRoleUpdate, logServerUnban, logServerVoiceDeaf, logServerVoiceMove, logServerVoiceMute} from "./utils/discordLogger";
import {createErrorEmbed} from "./utils/interactionUtils";
import {sendGoodbyeMessage, sendWelcomeMessage} from "./services/welcomeService";
import {isLowPowerMode, OWNER_ID} from "./services/botStateService";
import {setLowPowerStatus, setNormalStatus} from "./services/statusService";
import {initializeMemeScheduler} from "./services/memeScheduler";
import {initializeBirthdayService} from "./services/birthdayService";
import {initializeYearlyRewindService} from "./services/yearlyRewindService";
import {initializeCounter} from "./services/counterService";
import {initializeActivityMonitor} from "./services/activityMonitor";
import {EnvConfig} from "./utils/envConfig";
import {createLogger} from "./utils/logger";
import {recordCommandStats, recordReactionAddedStats, recordReactionReceivedStats} from "./services/statsRecorder";
import {canExecuteCommand, getCommandRestrictionMessage} from "./utils/commandPermissions";
import {getAllXP} from "./services/xpSystem";
import {initializeLevelRolesForGuild} from "./services/levelRoleService";
import {initializeRandomEventsService} from "./services/randomEventsService";

const logger = createLogger("Bot");

export async function setBotPresence(client: Client, status: PresenceStatusData, activityName?: string) {
    if (!client.user) return;

    if (!activityName) activityName = "";

    await client.user.setPresence({
        status: status,
        activities: [{name: activityName, type: ActivityType.Playing}],
    });
}

// Load environment variables
const BOT_TOKEN = EnvConfig.DISCORD_BOT_TOKEN;

// Create an instance of Client and set the intents to listen for messages.
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,      // Pour les événements de membres
        GatewayIntentBits.GuildModeration,   // Pour les bans/unbans
        GatewayIntentBits.GuildVoiceStates,  // Pour les événements vocaux
        GatewayIntentBits.GuildPresences,    // Pour voir les activités (jeux en cours)
        GatewayIntentBits.GuildMessageReactions, // Pour les réactions aux messages (role reaction)
        GatewayIntentBits.DirectMessages,    // Pour recevoir les messages privés (DM)
        GatewayIntentBits.DirectMessageTyping, // Pour voir quand quelqu'un écrit en DM
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.Channel,  // Important pour les DMs
    ],
});

client.commands = new Collection();

// Load commands
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            // Utiliser le nom de la commande pour les commandes contextuelles et slash
            const commandName = command.data.name;
            client.commands.set(commandName, command);
        } else {
            logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Deploy commands
deployCommands();

// Register the watched channel responder
registerWatchedChannelResponder(client);

// Register the forum thread handler
registerForumThreadHandler(client);

// Register the citations thread handler
registerCitationsThreadHandler(client);

// Register the role reaction handler
registerRoleReactionHandler(client);

// Register the voice tracker
registerVoiceTracker(client);

// Once the WebSocket is connected, log a message to the console.
client.once(Events.ClientReady, async () => {
    logger.info("Bot is online!");
    initializeDiscordLogger(client);

    // Initialiser le statut Discord en fonction du mode Low Power
    if (isLowPowerMode()) {
        await setLowPowerStatus(client);
        logger.info("Bot started in Low Power Mode");
    } else {
        await setNormalStatus(client);
        logger.info("Bot started in Normal Mode");
    }

    // Initialiser les rôles de niveau pour tous les utilisateurs
    try {
        const allXP = getAllXP();
        for (const guild of client.guilds.cache.values()) {
            await initializeLevelRolesForGuild(guild, allXP);
        }
        logger.info("Level roles initialized for all guilds");
    } catch (error) {
        logger.error("Error initializing level roles:", error);
    }


    // Initialiser le planificateur de memes automatiques
    initializeMemeScheduler(client);

    // Initialiser le service de vérification des anniversaires
    initializeBirthdayService(client);

    // Initialiser le service de rewind annuel
    initializeYearlyRewindService(client);

    // Initialiser le service de classement mensuel
    const {initializeMonthlyRankingService} = require("./services/monthlyRankingService");
    initializeMonthlyRankingService(client);

    // Initialiser le compteur
    const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
    if (COUNTER_CHANNEL_ID) {
        try {
            const counterChannel = await client.channels.fetch(COUNTER_CHANNEL_ID);
            if (counterChannel && counterChannel.isTextBased()) {
                await initializeCounter(counterChannel as any);
            }
        } catch (error) {
            logger.error("Error initializing counter:", error);
        }
    }

    // Initialiser le moniteur d'activité vocale
    initializeActivityMonitor(client);

    // Initialiser le service d'événements aléatoires
    initializeRandomEventsService(client);
});

// === ÉVÉNEMENTS SERVEUR DISCORD ===

// Nouveau membre rejoint le serveur
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        logger.info(`${member.user.username} joined the server`);
        await logServerMemberJoin(
            member.user.username,
            member.user.id,
            member.guild.memberCount
        );
        console.log(`[Server Event] ${member.user.username} joined the server`);

        // Générer et envoyer un message de bienvenue personnalisé
        await sendWelcomeMessage(member, client);
    } catch (error) {
        logger.error(`Error processing GuildMemberAdd event for ${member.user.username}: ${error}`);
    }
});

// Membre quitte le serveur
client.on(Events.GuildMemberRemove, async (member) => {
    try {
        logger.info(`${member.user.username} left the server`);
        await logServerMemberLeave(
            member.user.username,
            member.user.id,
            member.guild.memberCount
        );
        console.log(`[Server Event] ${member.user.username} left the server`);

        // Générer et envoyer un message d'au revoir personnalisé
        await sendGoodbyeMessage(member, client);
    } catch (error) {
        logger.error(`Error processing GuildMemberRemove event for ${member.user.username}: ${error}`);
    }
});

// Membre banni
client.on(Events.GuildBanAdd, async (ban) => {
    try {
        const auditLogs = await ban.guild.fetchAuditLogs({
            type: 22, // MEMBER_BAN_ADD
            limit: 1
        });

        const banLog = auditLogs.entries.first();
        const moderator = banLog?.executor?.username;
        const reason = ban.reason || "Aucune raison spécifiée";

        await logServerBan(
            ban.user.username,
            ban.user.id,
            moderator,
            reason
        );
        if (moderator) {
            logger.info(`${ban.user.username} was banned by ${moderator}`);
        } else {
            logger.info(`${ban.user.username} was banned`);
        }
        console.log(`[Server Event] ${ban.user.username} was banned by ${moderator || "Unknown"}`);
    } catch (error) {
        await logServerBan(ban.user.username, ban.user.id);
        logger.error(`Error processing GuildBanAdd event for ${ban.user.username}: ${error}`);
    }
});

// Membre débanni
client.on(Events.GuildBanRemove, async (ban) => {
    try {
        const auditLogs = await ban.guild.fetchAuditLogs({
            type: 23, // MEMBER_BAN_REMOVE
            limit: 1
        });

        const unbanLog = auditLogs.entries.first();
        const moderator = unbanLog?.executor?.username;

        await logServerUnban(
            ban.user.username,
            ban.user.id,
            moderator
        );
        if (moderator) {
            logger.info(`${ban.user.username} was unbanned by ${moderator}`);
        } else {
            logger.info(`${ban.user.username} was unbanned`);
        }
        console.log(`[Server Event] ${ban.user.username} was unbanned by ${moderator || "Unknown"}`);
    } catch (error) {
        await logServerUnban(ban.user.username, ban.user.id);
        logger.error(`Error processing GuildBanRemove event for ${ban.user.username}: ${error}`);
    }
});

// Membre mis à jour (rôles, timeout, nickname)
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id)).map(role => role.name);
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id)).map(role => role.name);

        // Changement de rôles
        if (addedRoles.length > 0 || removedRoles.length > 0) {
            await logServerRoleUpdate(
                newMember.user.username,
                newMember.user.id,
                addedRoles,
                removedRoles
            );
            logger.info(`Roles updated for ${newMember.user.username}`);
            console.log(`[Server Event] Roles updated for ${newMember.user.username}`);
        }

        // Changement de timeout
        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (oldTimeout !== newTimeout) {
            if (newTimeout && newTimeout > Date.now()) {
                // Timeout ajouté
                const duration = Math.floor((newTimeout - Date.now()) / 1000 / 60); // en minutes
                const durationStr = duration > 60 ? `${Math.floor(duration / 60)}h ${duration % 60}min` : `${duration}min`;

                try {
                    const auditLogs = await newMember.guild.fetchAuditLogs({
                        type: 24, // MEMBER_UPDATE (timeout)
                        limit: 1
                    });
                    const timeoutLog = auditLogs.entries.first();
                    const moderator = timeoutLog?.executor?.username;
                    const reason = timeoutLog?.reason;

                    await logServerMemberTimeout(
                        newMember.user.username,
                        newMember.user.id,
                        durationStr,
                        moderator,
                        reason || undefined
                    );
                } catch (error) {
                    await logServerMemberTimeout(newMember.user.username, newMember.user.id, durationStr);
                }
                logger.info(`${newMember.user.username} timed out for ${durationStr}`);
                console.log(`[Server Event] ${newMember.user.username} timed out for ${durationStr}`);
            } else if (oldTimeout && (!newTimeout || newTimeout <= Date.now())) {
                // Timeout retiré
                try {
                    const auditLogs = await newMember.guild.fetchAuditLogs({
                        type: 24,
                        limit: 1
                    });
                    const timeoutLog = auditLogs.entries.first();
                    const moderator = timeoutLog?.executor?.username;

                    await logServerMemberTimeoutRemove(
                        newMember.user.username,
                        newMember.user.id,
                        moderator
                    );
                } catch (error) {
                    await logServerMemberTimeoutRemove(newMember.user.username, newMember.user.id);
                }
                logger.info(`${newMember.user.username} timeout removed`);
                console.log(`[Server Event] ${newMember.user.username} timeout removed`);
            }
        }

        // Changement de surnom
        if (oldMember.nickname !== newMember.nickname) {
            await logServerNicknameChange(
                newMember.user.username,
                newMember.user.id,
                oldMember.nickname,
                newMember.nickname
            );
            logger.info(`Nickname changed for ${newMember.user.username}`);
            console.log(`[Server Event] Nickname changed for ${newMember.user.username}`);
        }
    } catch (error) {
        logger.error(`Error processing GuildMemberUpdate event for ${newMember.user.username}: ${error}`);
    }
});

// Salon créé
client.on(Events.ChannelCreate, async (channel) => {
    try {
        if (!channel.isDMBased()) {
            let channelType = "Inconnu";
            if (channel.type === ChannelType.GuildText) channelType = "Textuel";
            else if (channel.type === ChannelType.GuildVoice) channelType = "Vocal";
            else if (channel.type === ChannelType.GuildCategory) channelType = "Catégorie";
            else if (channel.type === ChannelType.GuildAnnouncement) channelType = "Annonces";
            else if (channel.type === ChannelType.GuildForum) channelType = "Forum";

            let createdBy: string | undefined;

            // Tenter de récupérer qui a créé le salon
            try {
                const auditLogs = await channel.guild.fetchAuditLogs({
                    type: 10, // CHANNEL_CREATE
                    limit: 1
                });

                const createLog = auditLogs.entries.first();
                if (createLog && createLog.targetId === channel.id) {
                    const timeDiff = Date.now() - createLog.createdTimestamp;
                    // Vérifier que le log est récent (moins de 5 secondes)
                    if (timeDiff < 5000) {
                        createdBy = createLog.executor?.username;
                    }
                }
            } catch (error) {
                logger.warn(`Could not fetch audit logs for channel creation`);
            }

            await logServerChannelCreate(
                channel.name || "Sans nom",
                channelType,
                channel.id,
                createdBy
            );
            logger.info(`Channel created: ${channel.name}${createdBy ? ` by ${createdBy}` : ''}`);
            console.log(`[Server Event] Channel created: ${channel.name}${createdBy ? ` by ${createdBy}` : ''}`);
        }
    } catch (error) {
        logger.error(`Error processing ChannelCreate event for ${channel.name}: ${error}`);
    }
});

// Salon supprimé
client.on(Events.ChannelDelete, async (channel) => {
    try {
        if (!channel.isDMBased()) {
            let channelType = "Inconnu";
            if (channel.type === ChannelType.GuildText) channelType = "Textuel";
            else if (channel.type === ChannelType.GuildVoice) channelType = "Vocal";
            else if (channel.type === ChannelType.GuildCategory) channelType = "Catégorie";
            else if (channel.type === ChannelType.GuildAnnouncement) channelType = "Annonces";
            else if (channel.type === ChannelType.GuildForum) channelType = "Forum";

            let deletedBy: string | undefined;

            // Tenter de récupérer qui a supprimé le salon
            try {
                const auditLogs = await channel.guild.fetchAuditLogs({
                    type: 12, // CHANNEL_DELETE
                    limit: 1
                });

                const deleteLog = auditLogs.entries.first();
                if (deleteLog && deleteLog.targetId === channel.id) {
                    const timeDiff = Date.now() - deleteLog.createdTimestamp;
                    // Vérifier que le log est récent (moins de 5 secondes)
                    if (timeDiff < 5000) {
                        deletedBy = deleteLog.executor?.username;
                    }
                }
            } catch (error) {
                logger.warn(`Could not fetch audit logs for channel deletion`);
            }

            await logServerChannelDelete(
                channel.name || "Sans nom",
                channelType,
                channel.id,
                deletedBy
            );
            logger.info(`Channel deleted: ${channel.name}${deletedBy ? ` by ${deletedBy}` : ''}`);
            console.log(`[Server Event] Channel deleted: ${channel.name}${deletedBy ? ` by ${deletedBy}` : ''}`);
        }
    } catch (error) {
        const channelName = 'name' in channel ? channel.name : 'DM';
        logger.error(`Error processing ChannelDelete event for ${channelName}: ${error}`);
    }
});

// Message supprimé
client.on(Events.MessageDelete, async (message) => {
    try {
        if (message.author?.bot) return;

        // Ne pas logger les suppressions dans le salon compteur
        const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
        if (COUNTER_CHANNEL_ID && message.channelId === COUNTER_CHANNEL_ID) {
            return; // Skip logging pour le compteur
        }

        if (message.content || message.attachments.size > 0) {
            let deletedBy: string | undefined;

            // Tenter de récupérer qui a supprimé le message
            if (message.guild) {
                try {
                    const auditLogs = await message.guild.fetchAuditLogs({
                        type: 72, // MESSAGE_DELETE
                        limit: 1
                    });

                    const deleteLog = auditLogs.entries.first();
                    if (deleteLog && deleteLog.targetId === message.author?.id) {
                        const timeDiff = Date.now() - deleteLog.createdTimestamp;
                        // Vérifier que le log est récent (moins de 5 secondes)
                        if (timeDiff < 5000) {
                            deletedBy = deleteLog.executor?.username;
                        }
                    }
                } catch (error) {
                    logger.warn(`Could not fetch audit logs for message deletion`);
                }
            }

            await logServerMessageDelete(
                message.author?.username || "Utilisateur inconnu",
                message.channel.isDMBased() ? "DM" : (message.channel.name || "Salon inconnu"),
                message.content || "(pas de contenu texte)",
                message.attachments.size,
                deletedBy
            );
            logger.info(`Message deleted from ${message.author?.username || "Unknown"}${deletedBy ? ` by ${deletedBy}` : ''}`);
            console.log(`[Server Event] Message deleted from ${message.author?.username || "Unknown"}${deletedBy ? ` by ${deletedBy}` : ''}`);
        }
    } catch (error) {
        logger.error(`Error processing MessageDelete event: ${error}`);
    }
});

// Message édité
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
        if (newMessage.author?.bot) return;

        // Ignorer les messages partiels (cache miss)
        if (oldMessage.partial || newMessage.partial) return;

        // Ignorer si le contenu n'a pas changé (embed auto-génération, etc.)
        if (oldMessage.content === newMessage.content) return;

        await logServerMessageEdit(
            newMessage.author?.username || "Utilisateur inconnu",
            newMessage.channel.isDMBased() ? "DM" : (newMessage.channel.name || "Salon inconnu"),
            oldMessage.content || "(pas de contenu texte)",
            newMessage.content || "(pas de contenu texte)",
            newMessage.attachments.size,
            newMessage.author?.username // L'auteur est celui qui édite son propre message
        );
        logger.info(`Message edited by ${newMessage.author?.username || "Unknown"}`);
        console.log(`[Server Event] Message edited by ${newMessage.author?.username || "Unknown"}`);
    } catch (error) {
        logger.error(`Error processing MessageUpdate event: ${error}`);
    }
});

// État vocal mis à jour (join, leave, move, mute, deaf)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member;
    if (!member) return;

    // Déplacement entre salons vocaux (seulement les déplacements forcés par un modérateur)
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        try {
            const auditLogs = await newState.guild.fetchAuditLogs({
                type: 26, // MEMBER_MOVE
                limit: 1
            });
            const moveLog = auditLogs.entries.first();

            // Vérifier si c'est un déplacement forcé (par un modérateur) ou volontaire
            if (moveLog && moveLog.targetId === member.user.id) {
                const timeDiff = Date.now() - moveLog.createdTimestamp;
                const moderator = moveLog.executor?.username;

                // Logger seulement si c'est récent (< 5 secondes) ET par quelqu'un d'autre
                if (timeDiff < 5000 && moderator && moderator !== member.user.username) {
                    await logServerVoiceMove(
                        member.user.username,
                        member.user.id,
                        oldState.channel.name,
                        newState.channel.name,
                        moderator
                    );
                    logger.info(`${member.user.username} moved from ${oldState.channel.name} to ${newState.channel.name} by ${moderator}`);
                    console.log(`[Server Event] ${member.user.username} moved from ${oldState.channel.name} to ${newState.channel.name} by ${moderator}`);
                }
                // Sinon, c'est un déplacement volontaire - ne pas logger
            }
        } catch (error) {
            // En cas d'erreur des audit logs, ne pas logger pour éviter les faux positifs
        }
    }

    // Changement de mute (seulement les mutes serveur par modérateur)
    if (oldState.serverMute !== newState.serverMute) {
        const isMuted = !!newState.serverMute;

        try {
            const auditLogs = await newState.guild.fetchAuditLogs({
                type: 24, // MEMBER_UPDATE
                limit: 1
            });
            const muteLog = auditLogs.entries.first();

            // Vérifier que c'est une action récente (dans les 2 dernières secondes) et que ça concerne bien ce membre
            if (muteLog &&
                muteLog.target?.id === member.id &&
                Date.now() - muteLog.createdTimestamp < 2000 &&
                muteLog.executor?.id !== member.id) { // Pas un self-action

                const moderator = muteLog.executor?.username;

                await logServerVoiceMute(
                    member.user.username,
                    member.user.id,
                    isMuted,
                    false,
                    moderator
                );
                logger.info(`${member.user.username} ${isMuted ? 'muted' : 'unmuted'} by server (by ${moderator})`);
                console.log(`[Server Event] ${member.user.username} ${isMuted ? 'muted' : 'unmuted'} by server (by ${moderator})`);
            }
            // Sinon, c'est probablement un changement automatique lors de la connexion - ne pas logger
        } catch (error) {
            // En cas d'erreur des audit logs, ne pas logger pour éviter les faux positifs
        }
    }

    // Changement de deaf (seulement les deafs serveur par modérateur)
    if (oldState.serverDeaf !== newState.serverDeaf) {
        const isDeafened = !!newState.serverDeaf;

        try {
            const auditLogs = await newState.guild.fetchAuditLogs({
                type: 24, // MEMBER_UPDATE
                limit: 1
            });
            const deafLog = auditLogs.entries.first();

            // Vérifier que c'est une action récente (dans les 2 dernières secondes) et que ça concerne bien ce membre
            if (deafLog &&
                deafLog.target?.id === member.id &&
                Date.now() - deafLog.createdTimestamp < 2000 &&
                deafLog.executor?.id !== member.id) { // Pas un self-action

                const moderator = deafLog.executor?.username;

                await logServerVoiceDeaf(
                    member.user.username,
                    member.user.id,
                    isDeafened,
                    false,
                    moderator
                );
                logger.info(`${member.user.username} ${isDeafened ? 'deafened' : 'undeafened'} by server (by ${moderator})`);
                console.log(`[Server Event] ${member.user.username} ${isDeafened ? 'deafened' : 'undeafened'} by server (by ${moderator})`);
            }
            // Sinon, c'est probablement un changement automatique lors de la connexion - ne pas logger
        } catch (error) {
            // En cas d'erreur des audit logs, ne pas logger pour éviter les faux positifs
        }
    }
});

// === FIN ÉVÉNEMENTS SERVEUR DISCORD ===

// === ÉVÉNEMENTS RÉACTIONS ===

// Réaction ajoutée
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        // Ne plus ignorer complètement les bots pour les stats

        // Si l'utilisateur est partiel, fetch les données complètes
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                logger.error("Error fetching user:", error);
                return;
            }
        }

        // Si la réaction est partielle, fetch les données complètes
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error("Error fetching reaction:", error);
                return;
            }
        }

        // Enregistrer la réaction ajoutée pour l'utilisateur qui réagit
        if (user.username) {
            recordReactionAddedStats(user.id, user.username);

            // Enregistrer l'emoji utilisé dans la réaction pour les stats d'emoji favori
            const {recordEmojisUsed} = require("./services/userStatsService");
            const emojiUsed = reaction.emoji.name || reaction.emoji.toString();
            recordEmojisUsed(user.id, user.username, emojiUsed);

            // Vérifier les achievements Discord (réactions)
            const {checkDiscordAchievements} = require("./services/discordAchievementChecker");
            await checkDiscordAchievements(user.id, user.username, reaction.client, reaction.message.channelId);

            // Ajouter XP (la fonction détecte automatiquement si c'est un bot)
            const {addXP, XP_REWARDS} = require("./services/xpSystem");
            if (reaction.message.channel) {
                await addXP(user.id, user.username, XP_REWARDS.reactionAjoutee, reaction.message.channel, user.bot);
            }
        }

        // Enregistrer la réaction reçue pour l'auteur du message
        if (reaction.message.author && reaction.message.author.username) {
            recordReactionReceivedStats(reaction.message.author.id, reaction.message.author.username);

            // Ajouter XP (la fonction détecte automatiquement si c'est un bot)
            const {addXP, XP_REWARDS} = require("./services/xpSystem");
            if (reaction.message.channel) {
                await addXP(
                    reaction.message.author.id,
                    reaction.message.author.username,
                    XP_REWARDS.reactionRecue,
                    reaction.message.channel,
                    reaction.message.author.bot
                );
            }
        }
    } catch (error) {
        logger.error("Error handling reaction add:", error);
    }
});

// === FIN ÉVÉNEMENTS RÉACTIONS ===


if (client.user) {
    client.user.setPresence({
        status: "online",
    });
}

client.on(Events.InteractionCreate, async (interaction) => {
    // Gérer les commandes slash (ChatInputCommand)
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            // Vérifier si la commande peut être exécutée dans ce canal
            if (!canExecuteCommand(interaction)) {
                const errorMessage = getCommandRestrictionMessage(interaction);
                const errorEmbed = createErrorEmbed("Commande restreinte", errorMessage);

                await interaction.reply({
                    embeds: [errorEmbed],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Enregistrer l'utilisation de la commande dans les statistiques
            recordCommandStats(interaction.user.id, interaction.user.username);

            // Vérifier les achievements Discord (commandes)
            const {checkDiscordAchievements} = require("./services/discordAchievementChecker");
            await checkDiscordAchievements(interaction.user.id, interaction.user.username, interaction.client, interaction.channelId);

            // Ajouter XP avec notification pour l'utilisation de commande
            const {addXP, XP_REWARDS} = require("./services/xpSystem");
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.commandeUtilisee,
                    interaction.channel,
                    false // Les utilisateurs de commandes ne sont jamais des bots
                );
            }

            await command.execute(interaction);
        } catch (error: any) {
            console.error("[Command Error]", error);

            // Si l'interaction a expiré (Unknown interaction), on ne peut plus répondre
            if (error?.code === 10062 || error?.rawError?.code === 10062) {
                console.warn(`[Command] Interaction expired for ${interaction.commandName} - user took too long or network delay`);
                return;
            }

            // Essayer de répondre seulement si l'interaction est encore valide
            try {
                const errorEmbed = createErrorEmbed(
                    "Erreur de commande",
                    "Une erreur s'est produite lors de l'exécution de la commande.\n\n" +
                    "Veuillez réessayer plus tard."
                );

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                } else {
                    await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                }
            } catch (replyError: any) {
                // Si on ne peut pas répondre (interaction expirée), log seulement
                if (replyError?.code === 10062) {
                    console.warn(`[Command] Could not send error message - interaction already expired`);
                } else {
                    console.error("[Command] Error sending error message:", replyError);
                }
            }
        }
        return;
    }

    // Gérer les commandes de menu contextuel (User Context Menu)
    if (interaction.isUserContextMenuCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No context menu command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            // Les commandes de menu contextuel sont toujours autorisées (pas de restrictions)
            // Enregistrer l'utilisation dans les statistiques
            recordCommandStats(interaction.user.id, interaction.user.username);

            // Vérifier les achievements Discord (commandes)
            const {checkDiscordAchievements} = require("./services/discordAchievementChecker");
            await checkDiscordAchievements(interaction.user.id, interaction.user.username, interaction.client, interaction.channelId);

            // Ajouter XP pour l'utilisation de commande contextuelle
            const {addXP, XP_REWARDS} = require("./services/xpSystem");
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.commandeUtilisee,
                    interaction.channel,
                    false
                );
            }

            await command.execute(interaction);
        } catch (error: any) {
            console.error("[Context Menu Command Error]", error);

            if (error?.code === 10062 || error?.rawError?.code === 10062) {
                console.warn(`[Context Menu] Interaction expired for ${interaction.commandName}`);
                return;
            }

            try {
                const errorEmbed = createErrorEmbed(
                    "Erreur",
                    "Une erreur s'est produite lors de l'exécution de la commande.\n\n" +
                    "Veuillez réessayer plus tard."
                );

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                } else {
                    await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                }
            } catch (replyError: any) {
                if (replyError?.code === 10062) {
                    console.warn(`[Context Menu] Could not send error message - interaction already expired`);
                } else {
                    console.error("[Context Menu] Error sending error message:", replyError);
                }
            }
        }
        return;
    }

    // Les interactions des boutons sont maintenant toutes gérées dans userProfile.ts
    // Plus besoin de logique ici pour achievements ou stats

    // Gérer les menus de sélection (String Select Menu) pour l'imposteur
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'impostor_suspect_select') {
            try {
                if (!interaction.guild) {
                    await interaction.reply({
                        content: "❌ Cette action doit être effectuée dans un serveur.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const suspectId = interaction.values[0];
                const {handleImpostorGuess} = require("./services/randomEventsService");

                await interaction.deferReply({flags: MessageFlags.Ephemeral});

                const result = await handleImpostorGuess(
                    interaction.client,
                    interaction.user.id,
                    interaction.user.username,
                    suspectId,
                    interaction.guild
                );

                await interaction.editReply({
                    content: result.message
                });

            } catch (error) {
                console.error("[Impostor Suspect Select Error]", error);
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: "❌ Une erreur s'est produite. Réessaie plus tard."
                    }).catch(() => {
                    });
                } else {
                    await interaction.reply({
                        content: "❌ Une erreur s'est produite. Réessaie plus tard.",
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {
                    });
                }
            }
            return;
        }
    }

    // Gérer les boutons de validation de création
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // Bouton de guess d'imposteur
        if (customId === "impostor_guess") {
            try {
                if (!interaction.guild) {
                    await interaction.reply({
                        content: "❌ Cette action doit être effectuée dans un serveur.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                // Afficher un menu de sélection d'utilisateur
                const {StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder} = require("discord.js");

                // Récupérer les membres du serveur (limité aux 25 plus actifs pour le menu)
                const members = await interaction.guild.members.fetch();
                const activeMembers = members
                    .filter((m: any) => !m.user.bot) // Exclure les bots
                    .sort((a: any, b: any) => {
                        // Trier par présence (en ligne d'abord)
                        if (a.presence?.status === 'online' && b.presence?.status !== 'online') return -1;
                        if (a.presence?.status !== 'online' && b.presence?.status === 'online') return 1;
                        return 0;
                    })
                    .first(25); // Limiter à 25 (limite Discord)

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('impostor_suspect_select')
                    .setPlaceholder('🔍 Sélectionne le suspect...')
                    .addOptions(
                        activeMembers.map((member: any) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(member.user.username)
                                .setDescription(`ID: ${member.id}`)
                                .setValue(member.id)
                        )
                    );

                const row = new ActionRowBuilder()
                    .addComponents(selectMenu);

                await interaction.reply({
                    content: "🔍 **Qui est l'imposteur selon toi ?**\n\nChoisis un suspect ci-dessous :",
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });

            } catch (error) {
                console.error("[Impostor Guess Button Error]", error);
                await interaction.reply({
                    content: "❌ Une erreur s'est produite. Réessaie plus tard.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {
                });
            }
            return;
        }

        // Validation de création
        if (customId.startsWith("validate_creation_") || customId.startsWith("reject_creation_")) {
            const {validateCreation, rejectCreation} = require("./services/creationValidationService");

            // Vérifier que c'est l'owner qui clique
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({
                    content: "❌ Seul le propriétaire du serveur peut valider les créations.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const threadId = customId.split("_")[2];
            const isValidation = customId.startsWith("validate_creation_");

            try {
                await interaction.deferUpdate();

                let result;
                if (isValidation) {
                    result = await validateCreation(interaction.client, threadId, interaction.user.id);
                } else {
                    result = await rejectCreation(threadId, interaction.user.id);
                }

                if (result.success) {
                    // Modifier le message original pour indiquer que c'est traité
                    const originalEmbed = interaction.message.embeds[0];
                    const updatedEmbed = new EmbedBuilder(originalEmbed.data)
                        .setColor(isValidation ? 0x57F287 : 0xED4245) // Vert ou rouge
                        .setFooter({text: `${isValidation ? '✅ Validé' : '❌ Rejeté'} par ${interaction.user.username}`});

                    await interaction.editReply({
                        embeds: [updatedEmbed],
                        components: [] // Retirer les boutons
                    });

                    // Envoyer un message de confirmation
                    await interaction.followUp({
                        content: result.message,
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.followUp({
                        content: `❌ ${result.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (error) {
                logger.error("Error handling creation validation button:", error);
                await interaction.followUp({
                    content: "❌ Une erreur est survenue lors du traitement de la validation.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
});

// Log in with the bot's token.
client.login(BOT_TOKEN);
