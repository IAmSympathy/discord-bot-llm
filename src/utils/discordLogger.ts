import {Client, EmbedBuilder, TextChannel} from "discord.js";
import {EnvConfig} from "./envConfig";
import {createErrorEmbed, createInfoEmbed, createLowPowerEmbed, createStandbyEmbed, createSuccessEmbed, createWarningEmbed} from "./embedBuilder";
import {formatTimeFromMs} from "./timeFormat";

let clientInstance: Client | null = null;

// Map des couleurs pour chaque commande
const COMMAND_COLORS: { [key: string]: number } = {
    // Commandes fun
    "cucumber": 0x71aa51,
    "coinflip": 0xffcc4d,
    "choose": 0xdd2e44,
    "crystalball": 0xA589D2,
    "rollthedice": 0xea596e,
    "slots": 0x30363c,
    "ship": 0xFFC0CB,
    "ascii": 0x357bb0,

    // Commandes de jeu
    "games": 0x14171A,

    // Commandes d'image
    "imagine": 0xd99e82,
    "reimagine": 0x4fa0dd,
    "upscale": 0xff9800,
    "prompt-maker": 0xccd6dd,

    // Commandes Netricsa
    "ask-netricsa": 0x5865f2,
    "repondre": 0xdd2e44,

    // Commandes système/admin
    "reset": 0xdd2e44,
    "reset-dm": 0xf39c12,
    "reset-counter": 0xdd2e44,
    "stop": 0xdd2e44,
    "stop-event": 0xdd2e44,
    "lowpower": 0xdd2e44,
    "auto-lowpower": 0xdd2e44,
    "standby-status": 0x7f8c8d,
    "set-status": 0x1abc9c,

    // Commandes profil/stats
    "profile": 0x397d86,
    "leaderboard": 0x397d86,
    "challenges": 0x397d86,
    "daily": 0x397d86,

    // Commandes notes/anniversaire
    "add-note": 0x397d86,
    "remove-note": 0x397d86,
    "set-birthday": 0x397d86,
    "remove-birthday": 0x397d86,

    // Commandes diverses
    "harvest": 0x66757f,
    "findmeme": 0x2fb62f,
    "blacklist-game": 0xdd2e44,

    // Commandes de test
    "test-event": 0xdd2e44,
    "test-mission": 0xdd2e44,
    "test-rewind": 0xdd2e44,
};

/**
 * Obtenir la couleur d'une commande
 */
function getCommandColor(commandName?: string): number {
    if (!commandName) return 0x397d86; // Netricsa par défaut
    const normalized = commandName.toLowerCase().replace(/^\//, '');
    return COMMAND_COLORS[normalized] || 0x397d86;
}

export enum LogLevel {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    SUCCESS = "SUCCESS",
    MEMORY = "MEMORY",
    PROFILE = "PROFILE",
    COMMAND = "COMMAND",
    // Événements serveur Discord (style différent)
    SERVER_MEMBER_JOIN = "SERVER_MEMBER_JOIN",
    SERVER_MEMBER_LEAVE = "SERVER_MEMBER_LEAVE",
    SERVER_BAN = "SERVER_BAN",
    SERVER_UNBAN = "SERVER_UNBAN",
    SERVER_KICK = "SERVER_KICK",
    SERVER_ROLE_UPDATE = "SERVER_ROLE_UPDATE",
    SERVER_CHANNEL_CREATE = "SERVER_CHANNEL_CREATE",
    SERVER_CHANNEL_DELETE = "SERVER_CHANNEL_DELETE",
    SERVER_MESSAGE_DELETE = "SERVER_MESSAGE_DELETE",
    SERVER_MESSAGE_EDIT = "SERVER_MESSAGE_EDIT",
    SERVER_MESSAGE_REACTION_ADD = "SERVER_MESSAGE_REACTION_ADD",
    SERVER_MEMBER_TIMEOUT = "SERVER_MEMBER_TIMEOUT",
    SERVER_MEMBER_TIMEOUT_REMOVE = "SERVER_MEMBER_TIMEOUT_REMOVE",
    SERVER_NICKNAME_CHANGE = "SERVER_NICKNAME_CHANGE",
    SERVER_VOICE_MOVE = "SERVER_VOICE_MOVE",
    SERVER_VOICE_MUTE = "SERVER_VOICE_MUTE",
    SERVER_VOICE_DEAF = "SERVER_VOICE_DEAF",
    // Logs de Netricsa (IA)
    BOT_RESPONSE = "BOT_RESPONSE",
    BOT_IMAGE_ANALYSIS = "BOT_IMAGE_ANALYSIS",
    BOT_WEB_SEARCH = "BOT_WEB_SEARCH",
    BOT_COMMAND = "BOT_COMMAND",
    BOT_IMAGE_GENERATION = "BOT_IMAGE_GENERATION",
    BOT_IMAGE_REIMAGINE = "BOT_IMAGE_REIMAGINE",
    BOT_IMAGE_UPSCALE = "BOT_IMAGE_UPSCALE"
}

export interface LogOptions {
    level: LogLevel;
    title: string;
    description?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    commandName?: string; // Nom de la commande pour les logs de commandes
}

export function initializeDiscordLogger(client: Client) {
    clientInstance = client;
    const logChannelId = EnvConfig.LOG_CHANNEL_ID;
    console.log("[DiscordLogger] Initialized with LOG_CHANNEL_ID:", logChannelId || "(not set)");
}

export async function logToDiscord(options: LogOptions) {
    const isServerEvent = options.level.startsWith("SERVER_");
    const isBotLog = options.level.startsWith("BOT_");
    const isCommand = options.level === LogLevel.COMMAND;

    // Choisir le bon canal selon le type de log
    // - Événements serveur (SERVER_*) → LOG_CHANNEL_ID (server-logs)
    // - Logs bot (BOT_*) et commandes → NETRICSA_LOG_CHANNEL_ID (netricsa-logs)
    // - Autres (INFO, WARNING, ERROR, etc.) → LOG_CHANNEL_ID (server-logs)
    const LOG_CHANNEL_ID = isServerEvent
        ? EnvConfig.LOG_CHANNEL_ID
        : (isBotLog || isCommand ? EnvConfig.NETRICSA_LOG_CHANNEL_ID : EnvConfig.LOG_CHANNEL_ID);

    if (!LOG_CHANNEL_ID) {
        console.log("[DiscordLogger] Appropriate LOG_CHANNEL_ID not configured, skipping log");
        return;
    }

    if (!clientInstance) {
        console.log("[DiscordLogger] Client not initialized, skipping log");
        return;
    }

    try {
        const channel = await clientInstance.channels.fetch(LOG_CHANNEL_ID);
        if (!channel || !(channel instanceof TextChannel)) {
            console.log("[DiscordLogger] Channel not found or not a text channel:", LOG_CHANNEL_ID);
            return;
        }


        const embed = new EmbedBuilder()
            .setTitle(options.title)
            .setTimestamp();

        // Couleur selon le niveau
        switch (options.level) {
            case LogLevel.INFO:
                embed.setColor(0x3498db); // Bleu
                break;
            case LogLevel.WARNING:
                embed.setColor(0xf39c12); // Orange
                break;
            case LogLevel.ERROR:
                embed.setColor(0xe74c3c); // Rouge
                break;
            case LogLevel.SUCCESS:
                embed.setColor(0x2ecc71); // Vert
                break;
            case LogLevel.MEMORY:
                embed.setColor(0x9b59b6); // Violet
                break;
            case LogLevel.PROFILE:
                embed.setColor(0x397d86); // Turquoise
                break;
            case LogLevel.COMMAND:
                // Utiliser la couleur spécifique de la commande
                embed.setColor(getCommandColor(options.commandName));
                break;
            // Événements serveur - couleurs différentes et plus vives
            case LogLevel.SERVER_MEMBER_JOIN:
                embed.setColor(0x00ff00); // Vert vif
                break;
            case LogLevel.SERVER_MEMBER_LEAVE:
                embed.setColor(0xff6b6b); // Rouge pastel
                break;
            case LogLevel.SERVER_BAN:
                embed.setColor(0xff0000); // Rouge vif
                break;
            case LogLevel.SERVER_UNBAN:
                embed.setColor(0xffaa00); // Orange vif
                break;
            case LogLevel.SERVER_KICK:
                embed.setColor(0xff4500); // Orange rouge
                break;
            case LogLevel.SERVER_ROLE_UPDATE:
                embed.setColor(0x7289da); // Blurple Discord
                break;
            case LogLevel.SERVER_CHANNEL_CREATE:
                embed.setColor(0x43b581); // Vert Discord
                break;
            case LogLevel.SERVER_CHANNEL_DELETE:
                embed.setColor(0xf04747); // Rouge Discord
                break;
            case LogLevel.SERVER_MESSAGE_DELETE:
                embed.setColor(0xf04747); // Jaune Discord
                break;
            case LogLevel.SERVER_MESSAGE_EDIT:
                embed.setColor(0xf26522); // Orange
                break;
            case LogLevel.SERVER_MESSAGE_REACTION_ADD:
                embed.setColor(0xffc107); // Jaune doré
                break;
            case LogLevel.SERVER_MEMBER_TIMEOUT:
                embed.setColor(0xff6600); // Orange foncé
                break;
            case LogLevel.SERVER_MEMBER_TIMEOUT_REMOVE:
                embed.setColor(0x00cc99); // Cyan
                break;
            case LogLevel.SERVER_NICKNAME_CHANGE:
                embed.setColor(0x88c9f9); // Bleu clair
                break;
            case LogLevel.SERVER_VOICE_MOVE:
                embed.setColor(0x3498db); // Bleu
                break;
            case LogLevel.SERVER_VOICE_MUTE:
                embed.setColor(0x95a5a6); // Gris
                break;
            case LogLevel.SERVER_VOICE_DEAF:
                embed.setColor(0x7f8c8d); // Gris foncé
                break;
            // Logs de Netricsa
            case LogLevel.BOT_RESPONSE:
                embed.setColor(0x5865f2); // Blurple (couleur Discord)
                break;
            case LogLevel.BOT_IMAGE_ANALYSIS:
                embed.setColor(0xeb459e); // Rose
                break;
            case LogLevel.BOT_WEB_SEARCH:
                embed.setColor(0x3498db); // Jaune
                break;
            case LogLevel.BOT_COMMAND:
                embed.setColor(0x397d86); // Blurple Discord
                break;
            case LogLevel.BOT_IMAGE_GENERATION:
                embed.setColor(0xd99e82); // Violet
                break;
            case LogLevel.BOT_IMAGE_REIMAGINE:
                embed.setColor(0x4fa0dd); // Cyan/Bleu
                break;
            case LogLevel.BOT_IMAGE_UPSCALE:
                embed.setColor(0xe67e22); // Orange
                break;
        }

        if (options.description) {
            embed.setDescription(options.description);
        }

        if (options.fields) {
            embed.addFields(options.fields);
        }

        if (options.thumbnailUrl) {
            embed.setThumbnail(options.thumbnailUrl);
        }

        if (options.imageUrl) {
            embed.setImage(options.imageUrl);
        }

        if (options.footer) {
            embed.setFooter({text: options.footer});
        } else if (isServerEvent) {
            embed.setFooter({text: "Événement serveur Discord"});
        }

        await channel.send({
            embeds: [embed],
            flags: [4096] // SUPPRESS_NOTIFICATIONS flag
        });

        console.log("[DiscordLogger] Log sent successfully:", options.title);
    } catch (error) {
        // Ne pas logger les erreurs de log pour éviter la récursion infinie
        console.error("[DiscordLogger] Failed to send log:", error);
    }
}

// Fonctions helper pour différents types de logs
export async function logInfo(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.INFO, title, description, fields});
}

export async function logWarning(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.WARNING, title, description, fields});
}

export async function logError(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.ERROR, title, description, fields});
}

export async function logSuccess(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.SUCCESS, title, description, fields});
}

export async function logMemory(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.MEMORY, title, description, fields});
}

export async function logProfile(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.PROFILE, title, description, fields});
}

export async function logCommand(
    title: string,
    description?: string,
    fields?: { name: string; value: string; inline?: boolean }[],
    imageUrl?: string,
    channelName?: string,
    avatarUrl?: string
) {
    // Détecter si c'est un DM ou un Groupe DM
    const isDM = channelName?.startsWith("DM avec ");
    const isGroupDM = channelName?.startsWith("Groupe DM");
    const isExternalServer = channelName?.includes("(Serveur externe:");

    // Ajouter le champ de localisation aux fields existants si channelName est fourni
    let enhancedFields = fields ? [...fields] : [];
    if (channelName) {
        enhancedFields.push({
            name: isDM ? "📍 Localisation" : (isGroupDM ? "📍 Localisation" : (isExternalServer ? "📍 Localisation" : "📍 Localisation")),
            value: isDM ? `💬 ${channelName}` : (isGroupDM ? `👥 ${channelName}` : (isExternalServer ? `🌐 ${channelName}` : `#${channelName}`)),
            inline: true
        });
    }

    // Extraire le nom de la commande du titre (format: "🥒 Cucumber" -> "cucumber")
    const commandName = title.replace(/^[^\s]+\s+/, '').toLowerCase();

    await logToDiscord({
        level: LogLevel.COMMAND,
        title: `${title}`,
        description,
        fields: enhancedFields,
        imageUrl,
        thumbnailUrl: avatarUrl,
        commandName
    });
}

// Fonctions helper pour les événements serveur Discord
export async function logServerMemberJoin(username: string, userId: string, memberCount: number, avatarUrl?: string) {
    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_JOIN,
        title: "✨ Nouveau membre",
        fields: [
            {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
            {name: "👥 Membres Totaux", value: `**${memberCount}**`, inline: true}
        ],
        thumbnailUrl: avatarUrl
    });
}

export async function logServerMemberLeave(username: string, userId: string, memberCount: number, avatarUrl?: string) {
    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_LEAVE,
        title: "👋 Départ d'un Membre",
        fields: [
            {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
            {name: "👥 Membres Restants", value: `**${memberCount}**`, inline: true}
        ],
        thumbnailUrl: avatarUrl
    });
}

export async function logServerBan(username: string, userId: string, moderator?: string, reason?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: `**${moderator}**`, inline: true});
    }

    if (reason) {
        fields.push({name: "\u200B", value: "\u200B", inline: false}); // Saut de ligne
        fields.push({name: "📝 Raison", value: `> ${reason}`, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_BAN,
        title: "🔨 Bannissement",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerUnban(username: string, userId: string, moderator?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: `**${moderator}**`, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_UNBAN,
        title: "✅ Débannissement",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerKick(username: string, userId: string, moderator?: string, reason?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: `**${moderator}**`, inline: true});
    }

    if (reason) {
        fields.push({name: "\u200B", value: "\u200B", inline: false}); // Saut de ligne
        fields.push({name: "📝 Raison", value: `> ${reason}`, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_KICK,
        title: "👢 Expulsion",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerRoleUpdate(username: string, userId: string, addedRoles: string[], removedRoles: string[], avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    // Ajouter un champ vide pour compléter la ligne si nécessaire
    if (addedRoles.length > 0 || removedRoles.length > 0) {
        fields.push({name: "\u200B", value: "\u200B", inline: false}); // Saut de ligne
    }

    if (addedRoles.length > 0) {
        fields.push({name: "✅ Rôles Ajoutés", value: addedRoles.map(r => `• ${r}`).join('\n'), inline: false});
    }

    if (removedRoles.length > 0) {
        fields.push({name: "❌ Rôles Retirés", value: removedRoles.map(r => `• ${r}`).join('\n'), inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_ROLE_UPDATE,
        title: "🎭 Modification de Rôles",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerChannelCreate(channelName: string, channelType: string, channelId: string, createdBy?: string, avatarUrl?: string) {
    const fields = [
        {name: "📝 Nom du Salon", value: `**#${channelName}**`, inline: true},
        {name: "📋 Type", value: `**${channelType}**`, inline: true}
    ];

    if (createdBy) {
        fields.push({name: "👤 Créé par", value: `**${createdBy}**`, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_CHANNEL_CREATE,
        title: "➕ Salon Créé",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerChannelDelete(channelName: string, channelType: string, channelId: string, deletedBy?: string, avatarUrl?: string) {
    const fields = [
        {name: "📝 Nom du Salon", value: `**#${channelName}**`, inline: true},
        {name: "📋 Type", value: `**${channelType}**`, inline: true}
    ];

    if (deletedBy) {
        fields.push({name: "👤 Supprimé par", value: `**${deletedBy}**`, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_CHANNEL_DELETE,
        title: "🗑️ Salon Supprimé",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerMessageDelete(username: string, channelName: string, messageContent: string, attachments: number, deletedBy?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Auteur du Message", value: `**${username}**`, inline: true},
        {name: "📺 Salon", value: `**#${channelName}**`, inline: true}
    ];

    if (deletedBy) {
        fields.push({name: "🗑️ Supprimé par", value: `**${deletedBy}**`, inline: true});
    } else {
        fields.push({name: "🗑️ Supprimé par", value: "*L'auteur lui-même*", inline: true});
    }

    if (attachments > 0) {
        fields.push({name: "📎 Pièces jointes", value: `**${attachments}** fichier${attachments > 1 ? 's' : ''}`, inline: true});
    }

    if (messageContent && messageContent.length > 0) {
        const content = messageContent.length > 1000 ? messageContent.substring(0, 1000) + "..." : messageContent;
        fields.push({name: "💬 Contenu du message", value: `\`\`\`\n${content}\n\`\`\``, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MESSAGE_DELETE,
        title: "🗑️ Message Supprimé",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerMessageEdit(username: string, channelName: string, oldContent: string, newContent: string, attachments: number, editedBy?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Auteur du Message", value: `**${username}**`, inline: true},
        {name: "📺 Salon", value: `**#${channelName}**`, inline: true}
    ];

    if (editedBy && editedBy !== username) {
        fields.push({name: "✏️ Édité par", value: `**${editedBy}**`, inline: true});
    }

    if (attachments > 0) {
        fields.push({name: "📎 Pièces jointes", value: `**${attachments}** fichier${attachments > 1 ? 's' : ''}`, inline: true});
    }

    if (oldContent && oldContent.length > 0) {
        const content = oldContent.length > 500 ? oldContent.substring(0, 500) + "..." : oldContent;
        fields.push({name: "📝 Ancien contenu", value: `\`\`\`\n${content}\n\`\`\``, inline: false});
    }

    if (newContent && newContent.length > 0) {
        const content = newContent.length > 500 ? newContent.substring(0, 500) + "..." : newContent;
        fields.push({name: "✏️ Nouveau contenu", value: `\`\`\`\n${content}\n\`\`\``, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MESSAGE_EDIT,
        title: "✏️ Message Édité",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerMemberTimeout(username: string, userId: string, duration: string, moderator?: string, reason?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "⏰ Durée", value: `**${duration}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: `**${moderator}**`, inline: true});
    }

    if (reason) {
        fields.push({name: "\u200B", value: "\u200B", inline: false}); // Saut de ligne
        fields.push({name: "📝 Raison", value: `> ${reason}`, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_TIMEOUT,
        title: "⏸️ Membre en Timeout",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerMemberTimeoutRemove(username: string, userId: string, moderator?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: `**${moderator}**`, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_TIMEOUT_REMOVE,
        title: "▶️ Timeout Retiré",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerNicknameChange(username: string, userId: string, oldNickname: string | null, newNickname: string | null, changedBy?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (changedBy) {
        fields.push({name: "👮 Modifié par", value: `**${changedBy}**`, inline: true});
    } else {
        fields.push({name: "👮 Modifié par", value: "*Lui-même*", inline: true});
    }

    fields.push({name: "\u200B", value: "\u200B", inline: false}); // Saut de ligne
    fields.push({name: "📝 Ancien", value: oldNickname ? `**${oldNickname}**` : "*Aucun surnom*", inline: true});
    fields.push({name: "✨ Nouveau", value: newNickname ? `**${newNickname}**` : "*Aucun surnom*", inline: true});

    await logToDiscord({
        level: LogLevel.SERVER_NICKNAME_CHANGE,
        title: "✏️ Surnom Modifié",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerVoiceMove(username: string, userId: string, oldChannel: string, newChannel: string, moderator?: string, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Déplacé par", value: `**${moderator}**`, inline: true});
    }

    fields.push({name: "\u200B", value: "\u200B", inline: false}); // Saut de ligne
    fields.push({name: "🔊 De", value: `**${oldChannel}**`, inline: true});
    fields.push({name: "➡️ Vers", value: `**${newChannel}**`, inline: true});

    await logToDiscord({
        level: LogLevel.SERVER_VOICE_MOVE,
        title: "🔀 Vocal - Déplacement Forcé",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerVoiceMute(username: string, userId: string, isMuted: boolean, isSelfMuted: boolean, moderator?: string, avatarUrl?: string) {
    // Ne pas logger si c'est un self-mute
    if (isSelfMuted) {
        return;
    }

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Action par", value: `**${moderator}**`, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_VOICE_MUTE,
        title: isMuted ? "🔇 Vocal - Muté par Serveur" : "🔊 Vocal - Démuté par Serveur",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logServerVoiceDeaf(username: string, userId: string, isDeafened: boolean, isSelfDeafened: boolean, moderator?: string, avatarUrl?: string) {
    // Ne pas logger si c'est un self-deaf
    if (isSelfDeafened) {
        return;
    }

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Action par", value: `**${moderator}**`, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_VOICE_DEAF,
        title: isDeafened ? "🔇 Vocal - Rendu Sourd par Serveur" : "🔊 Vocal - Entend à Nouveau",
        fields,
        thumbnailUrl: avatarUrl
    });
}

// Logs de Netricsa (IA)
export async function logBotResponse(username: string, userId: string, channelName: string, prompt: string, response: string, tokensUsed: number, hasImages: boolean, hasWebSearch: boolean, reaction?: string, responseTime?: number, savedInMemory?: boolean, avatarUrl?: string) {
    // Détecter si c'est un DM (commence par "DM avec ")
    const isDM = channelName.startsWith("DM avec ");

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {
            name: isDM ? "📧 DM" : "📺 Salon",
            value: isDM ? `**${channelName}**` : `**#${channelName}**`,
            inline: true
        },
        {name: "🎯 Tokens", value: `**${tokensUsed}**`, inline: true}
    ];

    // Réaction dans un champ séparé si présente
    if (reaction) {
        fields.push({name: "👍 Réaction", value: `**${reaction}**`, inline: true});
    }

    // Temps de réponse si fourni
    if (responseTime !== undefined) {
        fields.push({name: "⏱️ Temps", value: `**${formatTimeFromMs(responseTime)}**`, inline: true});
    }

    // Statut de la mémoire
    if (savedInMemory !== undefined) {
        fields.push({name: "💾 Mémoire", value: savedInMemory ? "✅ **Enregistré**" : "⏭️ **Ignoré**", inline: true});
    }

    // Fonctionnalités utilisées
    const features: string[] = [];
    if (hasImages) features.push("🖼️ Analyse d'image");
    if (hasWebSearch) features.push("🌐 Recherche Web");
    if (features.length > 0) {
        fields.push({name: "✨ Fonctionnalités", value: features.join(" • "), inline: false});
    }

    const promptPreview = prompt.length > 200 ? prompt.substring(0, 200) + "..." : prompt;
    fields.push({name: "💬 Prompt Utilisateur", value: `\`\`\`\n${promptPreview}\n\`\`\``, inline: false});

    const responsePreview = response.length > 300 ? response.substring(0, 300) + "..." : response;
    fields.push({name: "💭 Réponse Générée", value: `\`\`\`\n${responsePreview}\n\`\`\``, inline: false});

    await logToDiscord({
        level: LogLevel.BOT_RESPONSE,
        title: "<:zzzRole_NetricsaModule:1466997072564584631> Réponse de Netricsa",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logBotImageAnalysis(username: string, imageResults: any[], avatarUrl?: string) {
    for (const result of imageResults) {
        const sizeKB = (result.size / 1024).toFixed(2);
        const sizeMB = result.size > 1024 * 1024 ? ` (${(result.size / 1024 / 1024).toFixed(2)} MB)` : '';

        const fields = [
            {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
            {name: "📐 Résolution", value: `**${result.width}x${result.height}**`, inline: true},
            {name: "📦 Taille", value: `**${sizeKB} KB**${sizeMB}`, inline: true},
            {name: "🎨 Format", value: `**${result.format.toUpperCase()}**`, inline: true},
            {name: "🎯 Tokens", value: `**${result.tokens}**`, inline: true},
            {name: "⏱️ Temps", value: `**${formatTimeFromMs(result.processingTime)}**`, inline: true},
            {name: "📝 Description Générée", value: `\`\`\`\n${result.description.length > 500 ? result.description.substring(0, 500) + "..." : result.description}\n\`\`\``, inline: false}
        ];

        await logToDiscord({
            level: LogLevel.BOT_IMAGE_ANALYSIS,
            title: "🖼️ Analyse d'Image",
            fields,
            imageUrl: result.url,
            thumbnailUrl: avatarUrl
        });
    }
}

export async function logBotWebSearch(username: string, query: string, resultsCount: number, searchTime?: number, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "📊 Résultats", value: `**${resultsCount}**`, inline: true}
    ];

    if (searchTime !== undefined) {
        fields.push({name: "⏱️ Temps", value: `**${formatTimeFromMs(searchTime)}**`, inline: true});
    }

    fields.push({name: "🔍 Requête", value: `\`\`\`\n${query.length > 100 ? query.substring(0, 100) + "..." : query}\n\`\`\``, inline: false});

    await logToDiscord({
        level: LogLevel.BOT_WEB_SEARCH,
        title: "🌐 Recherche Web",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logBotImageGeneration(username: string, prompt: string, generationTime: string, imageUrls?: string[], channelName?: string, avatarUrl?: string) {
    const imageCount = imageUrls?.length || 1;

    // Détecter si c'est un DM ou un Groupe DM
    const isDM = channelName?.startsWith("DM avec ");
    const isGroupDM = channelName?.startsWith("Groupe DM");
    const isExternalServer = channelName?.includes("(Serveur externe:");

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "🎨 Mode", value: `**txt2img**`, inline: true},
        {name: "⏱️ Temps", value: `**${generationTime}**`, inline: true}
    ];

    // Ajouter le champ de localisation si channelName est fourni
    if (channelName) {
        fields.push({
            name: "📍 Localisation",
            value: isDM ? `💬 **${channelName}**` : (isGroupDM ? `👥 **${channelName}**` : (isExternalServer ? `🌐 **${channelName}**` : `**#${channelName}**`)),
            inline: true
        });
    }

    fields.push({name: "📝 Prompt", value: `\`\`\`\n${prompt.length > 1024 ? prompt.substring(0, 1024) + "..." : prompt}\n\`\`\``, inline: false});

    // Si plusieurs images, créer un message avec toutes les URLs
    let description = undefined;
    if (imageUrls && imageUrls.length > 1) {
        description = imageUrls.map((url, i) => `[Image ${i + 1}](${url})`).join(" • ");
    }

    await logToDiscord({
        level: LogLevel.BOT_IMAGE_GENERATION,
        title: "🎨 Images Générées",
        description,
        fields,
        imageUrl: imageUrls?.[0], // Afficher la première image comme preview
        thumbnailUrl: avatarUrl
    });
}

export async function logBotImageReimagine(username: string, prompt: string, generationTime: string, imageUrls?: string[], channelName?: string, avatarUrl?: string) {
    const imageCount = imageUrls?.length || 1;

    // Détecter si c'est un DM ou un Groupe DM
    const isDM = channelName?.startsWith("DM avec ");
    const isGroupDM = channelName?.startsWith("Groupe DM");
    const isExternalServer = channelName?.includes("(Serveur externe:");

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "🎨 Mode", value: `**img2img**`, inline: true},
        {name: "⏱️ Temps", value: `**${generationTime}**`, inline: true}
    ];

    // Ajouter le champ de localisation si channelName est fourni
    if (channelName) {
        fields.push({
            name: "📍 Localisation",
            value: isDM ? `💬 **${channelName}**` : (isGroupDM ? `👥 **${channelName}**` : (isExternalServer ? `🌐 **${channelName}**` : `**#${channelName}**`)),
            inline: true
        });
    }

    fields.push({name: "📝 Prompt", value: `\`\`\`\n${prompt.length > 1024 ? prompt.substring(0, 1024) + "..." : prompt}\n\`\`\``, inline: false});

    // Si plusieurs images, créer un message avec toutes les URLs
    let description = undefined;
    if (imageUrls && imageUrls.length > 1) {
        description = imageUrls.map((url, i) => `[Image ${i + 1}](${url})`).join(" • ");
    }

    await logToDiscord({
        level: LogLevel.BOT_IMAGE_REIMAGINE,
        title: "🎨 Images Réimaginées",
        description,
        fields,
        imageUrl: imageUrls?.[0], // Afficher la première image comme preview
        thumbnailUrl: avatarUrl
    });
}

export async function logBotImageUpscale(username: string, method: string, scale: number, generationTime: string, imageUrl?: string, channelName?: string, avatarUrl?: string) {
    // Détecter si c'est un DM ou un Groupe DM
    const isDM = channelName?.startsWith("DM avec ");
    const isGroupDM = channelName?.startsWith("Groupe DM");
    const isExternalServer = channelName?.includes("(Serveur externe:");

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "🔍 Méthode", value: `**${method.toUpperCase()}**`, inline: true},
        {name: "📏 Échelle", value: `**x${scale}**`, inline: true},
        {name: "⏱️ Temps", value: `**${generationTime}**`, inline: true}
    ];

    // Ajouter le champ de localisation si channelName est fourni
    if (channelName) {
        fields.push({
            name: "📍 Localisation",
            value: isDM ? `💬 **${channelName}**` : (isGroupDM ? `👥 **${channelName}**` : (isExternalServer ? `🌐 **${channelName}**` : `**#${channelName}**`)),
            inline: true
        });
    }

    await logToDiscord({
        level: LogLevel.BOT_IMAGE_UPSCALE,
        title: "🔍 Image Upscalée",
        fields,
        imageUrl,
        thumbnailUrl: avatarUrl
    });
}

export async function logBotCommand(username: string, commandName: string, channelName: string, options?: string, avatarUrl?: string) {
    // Détecter si c'est un DM ou un Groupe DM
    const isDM = channelName.startsWith("DM avec ");
    const isGroupDM = channelName.startsWith("Groupe DM");
    const isExternalServer = channelName.includes("(Serveur externe:");

    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "⚡ Commande", value: `**/${commandName}**`, inline: true},
        {
            name: "📍 Localisation",
            value: isDM ? `💬 **${channelName}**` : (isGroupDM ? `👥 **${channelName}**` : (isExternalServer ? `🌐 **${channelName}**` : `**#${channelName}**`)),
            inline: true
        }
    ];

    if (options) {
        fields.push({name: "📋 Options", value: `\`\`\`\n${options}\n\`\`\``, inline: false});
    }

    await logToDiscord({
        level: LogLevel.BOT_COMMAND,
        title: "⚡ Commande Exécutée",
        fields,
        thumbnailUrl: avatarUrl
    });
}

export async function logBotReaction(username: string, channelName: string, messageContent: string, reaction: string, savedInMemory?: boolean, avatarUrl?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `**${username}**`, inline: true},
        {name: "📺 Salon", value: `**#${channelName}**`, inline: true},
        {name: "👍 Réaction", value: `**${reaction}**`, inline: true}
    ];

    // Statut de la mémoire
    if (savedInMemory !== undefined) {
        fields.push({name: "💾 Mémoire", value: savedInMemory ? "✅ **Enregistré**" : "⏭️ **Ignoré**", inline: true});
    }

    const contentPreview = messageContent.length > 200 ? messageContent.substring(0, 200) + "..." : messageContent;
    fields.push({name: "💬 Message original", value: `\`\`\`\n${contentPreview}\n\`\`\``, inline: false});

    await logToDiscord({
        level: LogLevel.BOT_RESPONSE,
        title: "👍 Réaction de Netricsa (sans réponse)",
        fields,
        thumbnailUrl: avatarUrl
    });
}

// Note: Les fonctions createSuccessEmbed, createErrorEmbed, createInfoEmbed, createWarningEmbed,
// createStandbyEmbed et createLowPowerEmbed sont maintenant centralisées dans ./embedBuilder.ts
// et ré-exportées ici pour compatibilité
export {createSuccessEmbed, createErrorEmbed, createInfoEmbed, createWarningEmbed, createStandbyEmbed, createLowPowerEmbed} from "./embedBuilder";
