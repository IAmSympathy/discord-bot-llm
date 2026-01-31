import {Client, EmbedBuilder, TextChannel} from "discord.js";

let clientInstance: Client | null = null;

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
    BOT_COMMAND = "BOT_COMMAND"
}

export interface LogOptions {
    level: LogLevel;
    title: string;
    description?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: string;
    imageUrl?: string;
}

export function initializeDiscordLogger(client: Client) {
    clientInstance = client;
    const logChannelId = process.env.LOG_CHANNEL_ID;
    console.log("[DiscordLogger] Initialized with LOG_CHANNEL_ID:", logChannelId || "(not set)");
}

export async function logToDiscord(options: LogOptions) {
    const isServerEvent = options.level.startsWith("SERVER_");
    const isBotLog = options.level.startsWith("BOT_");

    // Choisir le bon canal selon le type de log
    const LOG_CHANNEL_ID = isServerEvent
        ? process.env.LOG_CHANNEL_ID
        : (isBotLog ? process.env.NETRICSA_LOG_CHANNEL_ID : process.env.LOG_CHANNEL_ID);

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
                embed.setColor(0x1abc9c); // Turquoise
                break;
            case LogLevel.COMMAND:
                embed.setColor(0x34495e); // Gris foncé
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
                embed.setColor(0xfaa61a); // Jaune Discord
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
                embed.setColor(0xfee75c); // Jaune
                break;
            case LogLevel.BOT_COMMAND:
                embed.setColor(0x5865f2); // Blurple Discord
                break;
        }

        if (options.description) {
            embed.setDescription(options.description);
        }

        if (options.fields) {
            embed.addFields(options.fields);
        }

        if (options.imageUrl) {
            embed.setThumbnail(options.imageUrl);
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

export async function logCommand(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]) {
    await logToDiscord({level: LogLevel.BOT_COMMAND, title, description, fields});
}

// Fonctions helper pour les événements serveur Discord
export async function logServerMemberJoin(username: string, userId: string, memberCount: number) {
    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_JOIN,
        title: "👋 Nouveau membre",
        fields: [
            {name: "👤 Utilisateur", value: `${username}`, inline: true},
            {name: "🆔 ID", value: userId, inline: true},
            {name: "👥 Total membres", value: `${memberCount}`, inline: true}
        ]
    });
}

export async function logServerMemberLeave(username: string, userId: string, memberCount: number) {
    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_LEAVE,
        title: "👋 Membre parti",
        fields: [
            {name: "👤 Utilisateur", value: `${username}`, inline: true},
            {name: "🆔 ID", value: userId, inline: true},
            {name: "👥 Membres restants", value: `${memberCount}`, inline: true}
        ]
    });
}

export async function logServerBan(username: string, userId: string, moderator?: string, reason?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `${username}`, inline: true},
        {name: "🆔 ID", value: userId, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: moderator, inline: true});
    }

    if (reason) {
        fields.push({name: "📝 Raison", value: reason, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_BAN,
        title: "🔨 Membre banni",
        fields
    });
}

export async function logServerUnban(username: string, userId: string, moderator?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `${username}`, inline: true},
        {name: "🆔 ID", value: userId, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: moderator, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_UNBAN,
        title: "✅ Membre débanni",
        fields
    });
}

export async function logServerKick(username: string, userId: string, moderator?: string, reason?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: `${username}`, inline: true},
        {name: "🆔 ID", value: userId, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: moderator, inline: true});
    }

    if (reason) {
        fields.push({name: "📝 Raison", value: reason, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_KICK,
        title: "👢 Membre expulsé",
        fields
    });
}

export async function logServerRoleUpdate(username: string, userId: string, addedRoles: string[], removedRoles: string[]) {
    const fields = [
        {name: "👤 Utilisateur", value: `${username}`, inline: true},
        {name: "🆔 ID", value: userId, inline: true}
    ];

    if (addedRoles.length > 0) {
        fields.push({name: "➕ Rôles ajoutés", value: addedRoles.join(", "), inline: false});
    }

    if (removedRoles.length > 0) {
        fields.push({name: "➖ Rôles retirés", value: removedRoles.join(", "), inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_ROLE_UPDATE,
        title: "🎭 Rôles modifiés",
        fields
    });
}

export async function logServerChannelCreate(channelName: string, channelType: string, channelId: string, createdBy?: string) {
    const fields = [
        {name: "📝 Nom", value: channelName, inline: true},
        {name: "📋 Type", value: channelType, inline: true},
        {name: "🆔 ID", value: channelId, inline: true}
    ];

    if (createdBy) {
        fields.push({name: "👤 Créé par", value: createdBy, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_CHANNEL_CREATE,
        title: "➕ Salon créé",
        fields
    });
}

export async function logServerChannelDelete(channelName: string, channelType: string, channelId: string, deletedBy?: string) {
    const fields = [
        {name: "📝 Nom", value: channelName, inline: true},
        {name: "📋 Type", value: channelType, inline: true},
        {name: "🆔 ID", value: channelId, inline: true}
    ];

    if (deletedBy) {
        fields.push({name: "🗑️ Supprimé par", value: deletedBy, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_CHANNEL_DELETE,
        title: "🗑️ Salon supprimé",
        fields
    });
}

export async function logServerMessageDelete(username: string, channelName: string, messageContent: string, attachments: number, deletedBy?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "📺 Salon", value: `#${channelName}`, inline: true}
    ];

    if (deletedBy) {
        fields.push({name: "🗑️ Supprimé par", value: deletedBy, inline: true});
    }

    if (attachments > 0) {
        fields.push({name: "📎 Pièces jointes", value: `${attachments}`, inline: true});
    }

    if (messageContent && messageContent.length > 0) {
        const content = messageContent.length > 1000 ? messageContent.substring(0, 1000) + "..." : messageContent;
        fields.push({name: "💬 Contenu", value: content, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MESSAGE_DELETE,
        title: "🗑️ Message supprimé",
        fields
    });
}

export async function logServerMessageEdit(username: string, channelName: string, oldContent: string, newContent: string, attachments: number, editedBy?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "📺 Salon", value: `#${channelName}`, inline: true}
    ];

    if (editedBy && editedBy !== username) {
        fields.push({name: "✏️ Édité par", value: editedBy, inline: true});
    }

    if (attachments > 0) {
        fields.push({name: "📎 Pièces jointes", value: `${attachments}`, inline: true});
    }

    if (oldContent && oldContent.length > 0) {
        const content = oldContent.length > 500 ? oldContent.substring(0, 500) + "..." : oldContent;
        fields.push({name: "📝 Ancien contenu", value: content, inline: false});
    }

    if (newContent && newContent.length > 0) {
        const content = newContent.length > 500 ? newContent.substring(0, 500) + "..." : newContent;
        fields.push({name: "✏️ Nouveau contenu", value: content, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MESSAGE_EDIT,
        title: "✏️ Message édité",
        fields
    });
}

export async function logServerMemberTimeout(username: string, userId: string, duration: string, moderator?: string, reason?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "🆔 ID", value: userId, inline: true},
        {name: "⏰ Durée", value: duration, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: moderator, inline: true});
    }

    if (reason) {
        fields.push({name: "📝 Raison", value: reason, inline: false});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_TIMEOUT,
        title: "⏸️ Membre en timeout",
        fields
    });
}

export async function logServerMemberTimeoutRemove(username: string, userId: string, moderator?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "🆔 ID", value: userId, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Modérateur", value: moderator, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_MEMBER_TIMEOUT_REMOVE,
        title: "▶️ Timeout retiré",
        fields
    });
}

export async function logServerNicknameChange(username: string, userId: string, oldNickname: string | null, newNickname: string | null) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "🆔 ID", value: userId, inline: true}
    ];

    fields.push({name: "📝 Ancien surnom", value: oldNickname || "(aucun)", inline: true});
    fields.push({name: "✏️ Nouveau surnom", value: newNickname || "(aucun)", inline: true});

    await logToDiscord({
        level: LogLevel.SERVER_NICKNAME_CHANGE,
        title: "✏️ Surnom modifié",
        fields
    });
}

export async function logServerVoiceMove(username: string, userId: string, oldChannel: string, newChannel: string, moderator?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "🔊 De", value: oldChannel, inline: true},
        {name: "🔊 Vers", value: newChannel, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Déplacé par", value: moderator, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_VOICE_MOVE,
        title: "🔀 Vocal - Déplacement forcé",
        fields
    });
}

export async function logServerVoiceMute(username: string, userId: string, isMuted: boolean, isSelfMuted: boolean, moderator?: string) {
    // Ne pas logger si c'est un self-mute
    if (isSelfMuted) {
        return;
    }

    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Par", value: moderator, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_VOICE_MUTE,
        title: isMuted ? "🔇 Vocal - Muté par serveur" : "🔊 Vocal - Démuté par serveur",
        fields
    });
}

export async function logServerVoiceDeaf(username: string, userId: string, isDeafened: boolean, isSelfDeafened: boolean, moderator?: string) {
    // Ne pas logger si c'est un self-deaf
    if (isSelfDeafened) {
        return;
    }

    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true}
    ];

    if (moderator) {
        fields.push({name: "👮 Par", value: moderator, inline: true});
    }

    await logToDiscord({
        level: LogLevel.SERVER_VOICE_DEAF,
        title: isDeafened ? "🔇 Vocal - Rendu sourd par serveur" : "🔊 Vocal - Entend à nouveau",
        fields
    });
}

// Logs de Netricsa (IA)
export async function logBotResponse(username: string, userId: string, channelName: string, prompt: string, response: string, tokensUsed: number, hasImages: boolean, hasWebSearch: boolean, reaction?: string, responseTime?: number, savedInMemory?: boolean) {
    // Détecter si c'est un DM (commence par "DM avec ")
    const isDM = channelName.startsWith("DM avec ");

    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {
            name: isDM ? "📧 DM" : "📺 Salon",
            value: isDM ? channelName : `#${channelName}`,
            inline: true
        },
        {name: "🎯 Tokens", value: `${tokensUsed}`, inline: true}
    ];

    // Réaction dans un champ séparé si présente
    if (reaction) {
        fields.push({name: "👍 Réaction", value: reaction, inline: true});
    }

    // Temps de réponse si fourni
    if (responseTime !== undefined) {
        fields.push({name: "⏱️ Temps", value: `${(responseTime / 1000).toFixed(2)}s`, inline: true});
    }

    // Statut de la mémoire
    if (savedInMemory !== undefined) {
        fields.push({name: "💾 Mémoire", value: savedInMemory ? "✅ Enregistré" : "⏭️ Ignoré", inline: true});
    }

    // Fonctionnalités utilisées
    const features: string[] = [];
    if (hasImages) features.push("🖼️ Analyse d'image");
    if (hasWebSearch) features.push("🌐 Recherche Web");
    if (features.length > 0) {
        fields.push({name: "✨ Fonctionnalités", value: features.join(" • "), inline: false});
    }

    const promptPreview = prompt.length > 200 ? prompt.substring(0, 200) + "..." : prompt;
    fields.push({name: "💬 Prompt utilisateur", value: promptPreview, inline: false});

    const responsePreview = response.length > 300 ? response.substring(0, 300) + "..." : response;
    fields.push({name: "💭 Réponse générée", value: responsePreview, inline: false});

    await logToDiscord({
        level: LogLevel.BOT_RESPONSE,
        title: "🤖 Réponse de Netricsa",
        fields
    });
}

export async function logBotImageAnalysis(username: string, imageResults: any[]) {
    for (const result of imageResults) {
        const sizeKB = (result.size / 1024).toFixed(2);
        const sizeMB = result.size > 1024 * 1024 ? ` (${(result.size / 1024 / 1024).toFixed(2)} MB)` : '';

        const fields = [
            {name: "👤 Utilisateur", value: username, inline: true},
            {name: "📐 Résolution", value: `${result.width}x${result.height}`, inline: true},
            {name: "📦 Taille", value: `${sizeKB} KB${sizeMB}`, inline: true},
            {name: "🎨 Format", value: result.format.toUpperCase(), inline: true},
            {name: "🎯 Tokens", value: `${result.tokens}`, inline: true},
            {name: "⏱️ Temps", value: `${(result.processingTime / 1000).toFixed(2)}s`, inline: true},
            {name: "📝 Description générée", value: result.description.length > 500 ? result.description.substring(0, 500) + "..." : result.description, inline: false}
        ];

        await logToDiscord({
            level: LogLevel.BOT_IMAGE_ANALYSIS,
            title: "🖼️ Analyse d'image",
            fields,
            imageUrl: result.url
        });
    }
}

export async function logBotWebSearch(username: string, query: string, resultsCount: number, searchTime?: number) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "📊 Résultats", value: `${resultsCount}`, inline: true}
    ];

    if (searchTime !== undefined) {
        fields.push({name: "⏱️ Temps", value: `${(searchTime / 1000).toFixed(2)}s`, inline: true});
    }

    fields.push({name: "🔍 Requête", value: query.length > 100 ? query.substring(0, 100) + "..." : query, inline: false});

    await logToDiscord({
        level: LogLevel.BOT_WEB_SEARCH,
        title: "🌐 Recherche web",
        fields
    });
}

export async function logBotCommand(username: string, commandName: string, channelName: string, options?: string) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "⚡ Commande", value: `/${commandName}`, inline: true},
        {name: "📺 Salon", value: `#${channelName}`, inline: true}
    ];

    if (options) {
        fields.push({name: "📋 Options", value: options, inline: false});
    }

    await logToDiscord({
        level: LogLevel.BOT_COMMAND,
        title: "⚡ Commande exécutée",
        fields
    });
}

export async function logBotReaction(username: string, channelName: string, messageContent: string, reaction: string, savedInMemory?: boolean) {
    const fields = [
        {name: "👤 Utilisateur", value: username, inline: true},
        {name: "📺 Salon", value: `#${channelName}`, inline: true},
        {name: "👍 Réaction", value: reaction, inline: true}
    ];

    // Statut de la mémoire
    if (savedInMemory !== undefined) {
        fields.push({name: "💾 Mémoire", value: savedInMemory ? "✅ Enregistré" : "⏭️ Ignoré", inline: true});
    }

    const contentPreview = messageContent.length > 200 ? messageContent.substring(0, 200) + "..." : messageContent;
    fields.push({name: "💬 Message original", value: contentPreview, inline: false});

    await logToDiscord({
        level: LogLevel.BOT_RESPONSE,
        title: "👍 Réaction de Netricsa (sans réponse)",
        fields
    });
}

// Fonctions helper pour créer des embeds de réponse éphémères
export function createSuccessEmbed(title: string, description: string) {
    return new EmbedBuilder()
        .setColor(0x2ecc71) // Vert
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

export function createErrorEmbed(title: string, description: string) {
    return new EmbedBuilder()
        .setColor(0xe74c3c) // Rouge
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

export function createInfoEmbed(title: string, description: string) {
    return new EmbedBuilder()
        .setColor(0x3498db) // Bleu
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

export function createWarningEmbed(title: string, description: string) {
    return new EmbedBuilder()
        .setColor(0xf39c12) // Orange
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

