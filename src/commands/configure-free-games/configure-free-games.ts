import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction} from "discord.js";
import {createLogger} from "../../utils/logger";
import {createErrorEmbed, createSuccessEmbed} from "../../utils/embedBuilder";
import {handleInteractionError, safeReply} from "../../utils/interactionUtils";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";
import {OWNER_ROLES} from "../../utils/constants";
import * as fs from "fs";
import * as path from "path";

const logger = createLogger("ConfigureFreeGamesCmd");
const CONFIG_FILE = path.join(process.cwd(), "data", "free_games_config.json");

interface FreeGamesConfig {
    allowedTypes: string[];
    allowedChannels: string[];
    minRating: number;
    allowedStores: string[];
}

/**
 * Charge la configuration
 */
function loadConfig(): FreeGamesConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading config:", error);
    }
    // Configuration par défaut
    return {
        allowedTypes: ["game"],
        allowedChannels: ["keep"],
        minRating: 0,
        allowedStores: ["steam", "epic", "gog", "humble", "origin", "ubi", "itch", "prime", "other"]
    };
}

/**
 * Sauvegarde la configuration
 */
function saveConfig(config: FreeGamesConfig): void {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
        logger.info("Configuration saved");
    } catch (error) {
        logger.error("Error saving config:", error);
    }
}

/**
 * Crée l'embed de configuration
 */
function createConfigEmbed(config: FreeGamesConfig): EmbedBuilder {
    const typeEmojis: Record<string, string> = {
        game: "🎮",
        dlc: "📦",
        loot: "🎁",
        software: "💿",
        art: "🎨",
        ost: "🎵",
        book: "📚",
        storeitem: "🛒",
        other: "✨"
    };

    const channelEmojis: Record<string, string> = {
        keep: "💎",
        timed: "⏱️",
        other: "❓",
        prime: "👑",
        gamepass: "🎯",
        mobile: "📱",
        news: "📰"
    };

    const storeEmojis: Record<string, string> = {
        steam: "🎮",
        epic: "🏪",
        gog: "🦅",
        humble: "📦",
        origin: "🔶",
        ubi: "🎯",
        itch: "🕹️",
        prime: "👑",
        other: "❓"
    };

    const typesDisplay = config.allowedTypes.map(t => `${typeEmojis[t] || "❓"} ${t}`).join(", ") || "Aucun";
    const channelsDisplay = config.allowedChannels.map(c => `${channelEmojis[c] || "❓"} ${c}`).join(", ") || "Aucun";
    const storesDisplay = config.allowedStores.length === 9
        ? "Toutes les plateformes"
        : config.allowedStores.map(s => `${storeEmojis[s] || "❓"} ${s}`).join(", ");

    return new EmbedBuilder()
        .setTitle("⚙️ Configuration - Notifications Jeux Gratuits")
        .setDescription("Configurez les types de jeux et plateformes que vous souhaitez recevoir.")
        .setColor(0x00a8e1)
        .addFields(
            {
                name: "🎮 Types de produits",
                value: typesDisplay,
                inline: false
            },
            {
                name: "📢 Types d'offres",
                value: channelsDisplay,
                inline: false
            },
            {
                name: "🏪 Plateformes",
                value: storesDisplay,
                inline: false
            },
            {
                name: "⭐ Note minimale",
                value: config.minRating > 0 ? `${config.minRating}/5` : "Désactivé",
                inline: true
            }
        )
        .setFooter({text: "Utilisez les menus ci-dessous pour configurer les filtres"})
        .setTimestamp();
}

/**
 * Crée les composants interactifs
 */
function createComponents(config: FreeGamesConfig) {
    // Menu pour les types de produits
    const typeMenu = new StringSelectMenuBuilder()
        .setCustomId("freegames_types")
        .setPlaceholder("Sélectionner les types de produits")
        .setMinValues(1)
        .setMaxValues(9)
        .addOptions([
            {label: "🎮 Jeux", value: "game", description: "Jeux complets gratuits", default: config.allowedTypes.includes("game")},
            {label: "📦 DLC", value: "dlc", description: "Extensions et contenus additionnels", default: config.allowedTypes.includes("dlc")},
            {label: "🎁 Butin", value: "loot", description: "Game Pass, Prime Gaming, etc.", default: config.allowedTypes.includes("loot")},
            {label: "💿 Logiciels", value: "software", description: "Programmes et outils", default: config.allowedTypes.includes("software")},
            {label: "🎨 Art", value: "art", description: "Assets artistiques", default: config.allowedTypes.includes("art")},
            {label: "🎵 OST", value: "ost", description: "Bandes sonores", default: config.allowedTypes.includes("ost")},
            {label: "📚 Livres", value: "book", description: "Livres numériques", default: config.allowedTypes.includes("book")},
            {label: "🛒 Articles", value: "storeitem", description: "Articles de boutique", default: config.allowedTypes.includes("storeitem")},
            {label: "✨ Autres", value: "other", description: "Autres types", default: config.allowedTypes.includes("other")}
        ]);

    // Menu pour les types d'offres
    const channelMenu = new StringSelectMenuBuilder()
        .setCustomId("freegames_channels")
        .setPlaceholder("Sélectionner les types d'offres")
        .setMinValues(1)
        .setMaxValues(7)
        .addOptions([
            {label: "💎 À conserver", value: "keep", description: "Jeux à garder définitivement", default: config.allowedChannels.includes("keep")},
            {label: "⏱️ Temporaire", value: "timed", description: "Accès temporaire uniquement", default: config.allowedChannels.includes("timed")},
            {label: "👑 Prime Gaming", value: "prime", description: "Amazon Prime Gaming", default: config.allowedChannels.includes("prime")},
            {label: "🎯 Game Pass", value: "gamepass", description: "Xbox Game Pass", default: config.allowedChannels.includes("gamepass")},
            {label: "📱 Mobile", value: "mobile", description: "Jeux mobiles", default: config.allowedChannels.includes("mobile")},
            {label: "📰 Actualités", value: "news", description: "News et annonces", default: config.allowedChannels.includes("news")},
            {label: "❓ Autres", value: "other", description: "Autres types d'offres", default: config.allowedChannels.includes("other")}
        ]);

    // Menu pour les plateformes
    const storeMenu = new StringSelectMenuBuilder()
        .setCustomId("freegames_stores")
        .setPlaceholder("Sélectionner les plateformes")
        .setMinValues(1)
        .setMaxValues(9)
        .addOptions([
            {label: "🎮 Steam", value: "steam", description: "Steam Store", default: config.allowedStores.includes("steam")},
            {label: "🏪 Epic Games", value: "epic", description: "Epic Games Store", default: config.allowedStores.includes("epic")},
            {label: "🦅 GOG", value: "gog", description: "GOG.com", default: config.allowedStores.includes("gog")},
            {label: "📦 Humble", value: "humble", description: "Humble Bundle", default: config.allowedStores.includes("humble")},
            {label: "🔶 Origin", value: "origin", description: "EA Origin", default: config.allowedStores.includes("origin")},
            {label: "🎯 Ubisoft", value: "ubi", description: "Ubisoft Connect", default: config.allowedStores.includes("ubi")},
            {label: "🕹️ itch.io", value: "itch", description: "itch.io indie games", default: config.allowedStores.includes("itch")},
            {label: "👑 Prime", value: "prime", description: "Prime Gaming", default: config.allowedStores.includes("prime")},
            {label: "❓ Autres", value: "other", description: "Autres plateformes", default: config.allowedStores.includes("other")}
        ]);

    // Boutons
    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("freegames_rating")
                .setLabel(`Note min: ${config.minRating}/5`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("⭐"),
            new ButtonBuilder()
                .setCustomId("freegames_reset")
                .setLabel("Réinitialiser")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🔄"),
            new ButtonBuilder()
                .setCustomId("freegames_save")
                .setLabel("Sauvegarder")
                .setStyle(ButtonStyle.Success)
                .setEmoji("💾")
        );

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeMenu),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(channelMenu),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(storeMenu),
        buttons
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("configure-free-games")
        .setDescription("[TAH-UM] 💸 Configure les filtres de notifications de jeux gratuits")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        const channelName = getChannelNameFromInteraction(interaction);

        try {
            // Vérifier les permissions
            const member = interaction.member;
            if (!member) {
                const embed = createErrorEmbed("Erreur", "Impossible de vérifier vos permissions.");
                await safeReply(interaction, {embeds: [embed], flags: 1 << 6});
                return;
            }

            const hasPermission = OWNER_ROLES.some(roleId =>
                (member as any).roles?.cache?.has(roleId)
            );

            if (!hasPermission && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                const embed = createErrorEmbed(
                    "Permission refusée",
                    "Vous devez être administrateur pour utiliser cette commande."
                );
                await safeReply(interaction, {embeds: [embed], flags: 1 << 6});
                return;
            }

            // Charger la configuration actuelle
            let config = loadConfig();

            // Créer l'embed et les composants
            const embed = createConfigEmbed(config);
            const components = createComponents(config);

            await interaction.reply({
                embeds: [embed],
                components: components as any
            });

            const response = await interaction.fetchReply();

            // Créer un collector pour les interactions
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 300000 // 5 minutes
            });

            const buttonCollector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000
            });

            collector.on("collect", async (i: StringSelectMenuInteraction) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({content: "❌ Vous ne pouvez pas modifier cette configuration.", ephemeral: true});
                    return;
                }

                // Mettre à jour la config selon le menu
                if (i.customId === "freegames_types") {
                    config.allowedTypes = i.values;
                } else if (i.customId === "freegames_channels") {
                    config.allowedChannels = i.values;
                } else if (i.customId === "freegames_stores") {
                    config.allowedStores = i.values;
                }

                // Mettre à jour l'affichage
                const newEmbed = createConfigEmbed(config);
                const newComponents = createComponents(config);
                await i.update({embeds: [newEmbed], components: newComponents as any});
            });

            buttonCollector.on("collect", async (i: ButtonInteraction) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({content: "❌ Vous ne pouvez pas modifier cette configuration.", ephemeral: true});
                    return;
                }

                if (i.customId === "freegames_rating") {
                    // Cycle entre 0, 1, 2, 3, 4, 5
                    config.minRating = (config.minRating + 1) % 6;

                    const newEmbed = createConfigEmbed(config);
                    const newComponents = createComponents(config);
                    await i.update({embeds: [newEmbed], components: newComponents as any});

                } else if (i.customId === "freegames_reset") {
                    // Réinitialiser aux valeurs par défaut
                    config = {
                        allowedTypes: ["game"],
                        allowedChannels: ["keep"],
                        minRating: 0,
                        allowedStores: ["steam", "epic", "gog", "humble", "origin", "ubi", "itch", "prime", "other"]
                    };

                    const newEmbed = createConfigEmbed(config);
                    const newComponents = createComponents(config);
                    await i.update({embeds: [newEmbed], components: newComponents as any});

                } else if (i.customId === "freegames_save") {
                    // Sauvegarder la configuration
                    saveConfig(config);

                    const successEmbed = createSuccessEmbed(
                        "Configuration sauvegardée",
                        `**Types:** ${config.allowedTypes.join(", ")}\n` +
                        `**Offres:** ${config.allowedChannels.join(", ")}\n` +
                        `**Plateformes:** ${config.allowedStores.length === 9 ? "Toutes" : config.allowedStores.join(", ")}\n` +
                        `**Note min:** ${config.minRating > 0 ? config.minRating + "/5" : "Désactivé"}\n\n` +
                        `Les nouvelles notifications respecteront ces filtres.`
                    );

                    await i.update({embeds: [successEmbed], components: []});
                    collector.stop();
                    buttonCollector.stop();
                }
            });

            collector.on("end", () => {
                logger.info(`Configuration session ended for ${interaction.user.tag}`);
            });

            logger.info(`Configuration panel opened by ${interaction.user.tag}`);

        } catch (error: any) {
            logger.error("Error in configure-free-games command:", error);
            await handleInteractionError(interaction, error, channelName);
        }
    },
};


