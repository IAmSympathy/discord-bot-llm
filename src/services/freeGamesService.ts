import {Client, EmbedBuilder, TextChannel} from "discord.js";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

const logger = createLogger("FreeGamesService");

const API_BASE_URL = "https://api.freestuffbot.xyz/v2";
const COMPATIBILITY_DATE = "2025-03-01";
const STATE_FILE = path.join(process.cwd(), "data", "free_games_state.json");

/**
 * Types basés sur la documentation FreeStuff API
 */

type ProductKind = "game" | "dlc" | "loot" | "software" | "art" | "ost" | "book" | "storeitem" | "other";
type Channel = "keep" | "timed" | "other" | "prime" | "gamepass" | "mobile" | "news" | "unknown" | "debug";
type Store = "other" | "steam" | "epic" | "humble" | "gog" | "origin" | "ubi" | "itch" | "prime";
type Platform = "windows" | "mac" | "linux" | "android" | "ios" | "xbox" | "playstation";

interface ProductPrice {
    currency: string;
    oldValue: number;
    newValue: number;
    converted: boolean;
}

interface ProductImage {
    url: string;
    flags: number;
    priority: number;
}

interface ProductUrl {
    url: string;
    flags: number;
    priority: number;
}

interface Product {
    id: number;
    title: string;
    prices: ProductPrice[];
    kind: ProductKind;
    tags: string[];
    images: ProductImage[];
    description: string;
    rating: number;
    copyright: string;
    until: number;
    type: Channel;
    urls: ProductUrl[];
    store: Store;
    flags: number;
    notice: string;
    staffApproved: boolean;
    platforms?: Platform[];
}

interface ResolvedAnnouncement {
    id: number;
    products: number[];
    resolvedProducts: Product[];
}

interface FreeGamesState {
    notifiedGames: number[];
    lastCheck: string | null;
}

interface FreeGamesConfig {
    allowedTypes: string[];
    allowedChannels: string[];
    minRating: number;
    allowedStores: string[];
}

const CONFIG_FILE = path.join(process.cwd(), "data", "free_games_config.json");

/**
 * Charge la configuration des filtres
 */
function loadFilterConfig(): FreeGamesConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading filter config:", error);
    }
    // Configuration par défaut : jeux uniquement, à conserver, toutes plateformes
    return {
        allowedTypes: ["game"],
        allowedChannels: ["keep"],
        minRating: 0,
        allowedStores: ["steam", "epic", "gog", "humble", "origin", "ubi", "itch", "prime", "other"]
    };
}

/**
 * Charge l'état du service
 */
function loadState(): FreeGamesState {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading state:", error);
    }
    return {notifiedGames: [], lastCheck: null};
}

/**
 * Sauvegarde l'état du service
 */
function saveState(state: FreeGamesState): void {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving state:", error);
    }
}

/**
 * Vérifie que la clé API est configurée
 * Note: Le tier gratuit FreeStuff ne permet pas d'accéder à /v2/ping
 * Le service fonctionne uniquement via webhooks sur le tier gratuit
 */
function isAPIKeyConfigured(): boolean {
    const apiKey = EnvConfig.FREESTUFF_API_KEY;
    return !!(apiKey && apiKey !== "YOUR_API_KEY_HERE");
}

/**
 * Obtient le nom de la plateforme en français
 */
function getStoreName(store: Store): string {
    const storeNames: Record<Store, string> = {
        steam: "Steam",
        epic: "Epic Games Store",
        humble: "Humble Bundle",
        gog: "GOG",
        origin: "Origin",
        ubi: "Ubisoft Connect",
        itch: "itch.io",
        prime: "Prime Gaming",
        other: "Autre"
    };
    return storeNames[store] || store;
}

/**
 * Obtient le type de produit en français
 */
function getProductKindName(kind: ProductKind): string {
    const kindNames: Record<ProductKind, string> = {
        game: "Jeu",
        dlc: "DLC",
        loot: "Butin",
        software: "Logiciel",
        art: "Art",
        ost: "Bande sonore",
        book: "Livre",
        storeitem: "Article",
        other: "Autre"
    };
    return kindNames[kind] || kind;
}

/**
 * Obtient le type de canal en français
 */
function getChannelName(channel: Channel): string {
    const channelNames: Record<Channel, string> = {
        keep: "À conserver",
        timed: "Temporaire",
        other: "Autre",
        prime: "Prime Gaming",
        gamepass: "Game Pass",
        mobile: "Mobile",
        news: "Actualités",
        unknown: "Inconnu",
        debug: "Debug"
    };
    return channelNames[channel] || channel;
}

/**
 * Obtient la meilleure image pour un produit
 */
function getBestImage(product: Product): string | null {
    if (!product.images || product.images.length === 0) {
        return null;
    }

    // Chercher une image logo ou promo en priorité
    const priorityImages = product.images
        .filter(img => (img.flags & (1 << 5)) || (img.flags & (1 << 4))) // TP_LOGO ou TP_PROMO
        .sort((a, b) => b.priority - a.priority);

    if (priorityImages.length > 0) {
        return priorityImages[0].url;
    }

    // Sinon prendre la première image disponible
    return product.images[0].url;
}

/**
 * Obtient le meilleur lien pour un produit
 */
function getBestUrl(product: Product): string | null {
    if (!product.urls || product.urls.length === 0) {
        return null;
    }

    // Chercher un lien original en priorité
    const priorityUrls = product.urls
        .filter(url => url.flags & (1 << 0)) // ORIGINAL
        .sort((a, b) => b.priority - a.priority);

    if (priorityUrls.length > 0) {
        return priorityUrls[0].url;
    }

    // Sinon prendre le premier lien disponible
    return product.urls[0].url;
}

/**
 * Crée un embed pour afficher un jeu gratuit
 */
function createFreeGameEmbed(product: Product): EmbedBuilder {
    const kindEmoji: Record<ProductKind, string> = {
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

    const storeColors: Record<Store, number> = {
        steam: 0x1b2838,
        epic: 0x313131,
        humble: 0xcc2929,
        gog: 0x86328a,
        origin: 0xf56c2d,
        ubi: 0x0080ff,
        itch: 0xfa5c5c,
        prime: 0x00a8e1,
        other: 0x00ff00
    };

    const emoji = kindEmoji[product.kind] || "🎮";
    const color = storeColors[product.store] || 0x00ff00;

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${product.title} - GRATUIT !`)
        .setColor(color)
        .setFooter({text: `FreeStuff • ${getStoreName(product.store)}`})
        .setTimestamp();

    // Description
    if (product.description) {
        const shortDesc = product.description.length > 300
            ? product.description.substring(0, 297) + "..."
            : product.description;
        embed.setDescription(shortDesc);
    }

    // Image
    const imageUrl = getBestImage(product);
    if (imageUrl) {
        embed.setImage(imageUrl);
    }

    // URL
    const productUrl = getBestUrl(product);
    if (productUrl) {
        embed.setURL(productUrl);
    }

    // Fields
    const fields: { name: string; value: string; inline: boolean }[] = [];

    // Type et Plateforme
    fields.push({
        name: "Type",
        value: getProductKindName(product.kind),
        inline: true
    });

    fields.push({
        name: "Plateforme",
        value: getStoreName(product.store),
        inline: true
    });

    // Prix
    if (product.prices && product.prices.length > 0) {
        const price = product.prices[0]; // On prend le premier prix
        if (price.oldValue > 0) {
            const oldPrice = (price.oldValue / 100).toFixed(2);
            const newPrice = price.newValue === 0 ? "GRATUIT" : `${(price.newValue / 100).toFixed(2)} ${price.currency}`;
            fields.push({
                name: "💰 Prix",
                value: `~~${oldPrice} ${price.currency}~~ → **${newPrice}**`,
                inline: true
            });
        }
    }

    // Date de fin
    if (product.until > 0) {
        fields.push({
            name: "⏰ Disponible jusqu'à",
            value: `<t:${product.until}:R> (<t:${product.until}:F>)`,
            inline: false
        });
    }

    // Type de canal
    fields.push({
        name: "📢 Type d'offre",
        value: getChannelName(product.type),
        inline: true
    });

    // Plateformes supportées
    if (product.platforms && product.platforms.length > 0) {
        const platformEmojis: Record<Platform, string> = {
            windows: "🪟",
            mac: "🍎",
            linux: "🐧",
            android: "🤖",
            ios: "📱",
            xbox: "🎮",
            playstation: "🎮"
        };
        const platformIcons = product.platforms.map(p => platformEmojis[p] || p).join(" ");
        fields.push({
            name: "💻 Systèmes",
            value: platformIcons,
            inline: true
        });
    }

    // Note
    if (product.rating > 0) {
        const stars = "⭐".repeat(Math.round(product.rating));
        fields.push({
            name: "Note",
            value: stars,
            inline: true
        });
    }

    // Tags
    if (product.tags && product.tags.length > 0) {
        const tagList = product.tags.slice(0, 5).map(tag => `\`${tag}\``).join(" ");
        fields.push({
            name: "🏷️ Tags",
            value: tagList,
            inline: false
        });
    }

    // Notice spéciale
    if (product.notice) {
        fields.push({
            name: "⚠️ Important",
            value: product.notice,
            inline: false
        });
    }

    // Staff Pick
    if (product.staffApproved) {
        fields.push({
            name: "✨",
            value: "**Recommandé par l'équipe FreeStuff**",
            inline: false
        });
    }

    embed.addFields(fields);

    return embed;
}

/**
 * Envoie une notification pour un jeu gratuit
 */
async function notifyFreeGame(client: Client, product: Product): Promise<void> {
    const channelId = EnvConfig.FREE_GAMES_CHANNEL_ID;
    const roleId = EnvConfig.ROLE_REACTION_ROLE_ID;

    if (!channelId) {
        logger.warn("Free games channel ID not configured");
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);

        if (!channel || !(channel instanceof TextChannel)) {
            logger.error(`Channel ${channelId} not found or is not a text channel`);
            return;
        }

        const embed = createFreeGameEmbed(product);

        // Construire le message avec mention du rôle et URL
        const productUrl = getBestUrl(product);
        let messageContent = "";

        // Ajouter la mention du rôle si configuré
        if (roleId) {
            messageContent = `<@&${roleId}> `;
        }

        // Ajouter le texte
        messageContent += "**🎮 Nouveau jeu gratuit disponible !**";

        // Ajouter l'URL si disponible
        if (productUrl) {
            messageContent += `\n${productUrl}`;
        }

        const message: any = {
            embeds: [embed],
            content: messageContent || undefined
        };

        await channel.send(message);

        logger.info(`Notified free game: ${product.title} (ID: ${product.id})`);
    } catch (error) {
        logger.error(`Error sending free game notification for ${product.title}:`, error);
    }
}

/**
 * Traite une nouvelle annonce de jeux gratuits
 */
export async function processAnnouncement(client: Client, announcement: ResolvedAnnouncement): Promise<void> {
    const state = loadState();

    try {
        for (const product of announcement.resolvedProducts) {
            // Vérifier si ce jeu a déjà été notifié
            if (state.notifiedGames.includes(product.id)) {
                logger.debug(`Game already notified: ${product.title} (ID: ${product.id})`);
                continue;
            }

            // Filtrer les jeux trash ou non approuvés si souhaité
            const isTrash = product.flags & (1 << 0); // TRASH flag
            if (isTrash) {
                logger.debug(`Skipping trash product: ${product.title} (ID: ${product.id})`);
                continue;
            }

            // Notifier le jeu
            await notifyFreeGame(client, product);

            // Ajouter à la liste des jeux notifiés
            state.notifiedGames.push(product.id);
        }

        // Sauvegarder l'état
        state.lastCheck = new Date().toISOString();
        saveState(state);

        logger.info(`Processed announcement ${announcement.id} with ${announcement.resolvedProducts.length} product(s)`);
    } catch (error) {
        logger.error(`Error processing announcement ${announcement.id}:`, error);
    }
}

/**
 * Traite une mise à jour de produit
 */
export async function processProductUpdate(client: Client, product: Product): Promise<void> {
    try {
        logger.info(`Product updated: ${product.title} (ID: ${product.id})`);

        // On pourrait notifier les mises à jour importantes ici si souhaité
        // Pour l'instant on log seulement

    } catch (error) {
        logger.error(`Error processing product update for ${product.id}:`, error);
    }
}

/**
 * Vérifie et notifie les nouveaux jeux gratuits (pour test manuel)
 * Note: L'API FreeStuff fonctionne uniquement via webhooks sur le tier gratuit
 */
export async function checkAndNotifyFreeGames(client: Client): Promise<void> {
    try {
        logger.info("Manual check requested - verifying API key configuration...");

        const isConfigured = isAPIKeyConfigured();

        if (!isConfigured) {
            logger.error("❌ FreeStuff API key not configured. Check your .env file.");
            logger.error("   Get your API key at: https://dashboard.freestuffbot.xyz/");
            return;
        }

        logger.info("✅ FreeStuff API key is configured");
        logger.info("ℹ️ Note: FreeStuff API (free tier) works ONLY via webhooks.");
        logger.info("ℹ️ New games will be posted automatically when webhooks are configured.");
        logger.info("ℹ️ Configure your webhook URL at: https://dashboard.freestuffbot.xyz/");
        logger.info(`ℹ️ Your webhook URL: http://netricsa-bot.duckdns.org:3000/webhooks/freestuff`);

    } catch (error) {
        logger.error("Error checking free games:", error);
    }
}

/**
 * Initialise le service de surveillance des jeux gratuits
 * Note: L'API FreeStuff fonctionne principalement via webhooks
 */
export async function initializeFreeGamesService(client: Client): Promise<void> {
    const channelId = EnvConfig.FREE_GAMES_CHANNEL_ID;
    const apiKey = EnvConfig.FREESTUFF_API_KEY;

    if (!channelId) {
        logger.warn("Free games notifications disabled: FREE_GAMES_CHANNEL_ID not configured");
        return;
    }

    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
        logger.warn("Free games notifications disabled: FREESTUFF_API_KEY not configured");
        return;
    }

    logger.info("Initializing free games service...");

    // Vérifier que la clé API est configurée
    const isConfigured = isAPIKeyConfigured();

    if (!isConfigured) {
        logger.error("❌ FreeStuff API key not configured.");
        logger.error("   Get your API key at: https://dashboard.freestuffbot.xyz/");
        logger.error("   Add it to .env: FREESTUFF_API_KEY=your_key_here");
        return;
    }

    const config = loadFilterConfig();

    logger.info("✅ Free games service initialized (API key configured)");
    logger.info("ℹ️  FreeStuff API (free tier) works via webhooks ONLY");
    logger.info("ℹ️  Configure your webhook URL at: https://dashboard.freestuffbot.xyz/");
    logger.info(`ℹ️  Webhook URL: http://netricsa-bot.duckdns.org:3000/webhooks/freestuff`);
    logger.info(`ℹ️  Compatibility Date: ${COMPATIBILITY_DATE}`);
    logger.info(`ℹ️  Notifications channel: ${channelId}`);
    logger.info(`ℹ️  Active filters:`);
    logger.info(`     - Product types: ${config.allowedTypes.join(', ')}`);
    logger.info(`     - Offer types: ${config.allowedChannels.join(', ')}`);
    logger.info(`     - Stores: ${config.allowedStores.length === 9 ? 'all' : config.allowedStores.join(', ')}`);
    logger.info(`     - Min rating: ${config.minRating > 0 ? config.minRating + '/5' : 'disabled'}`);
    logger.info("ℹ️  Use /configure-free-games to change filters");
    logger.info("ℹ️  Use /check-free-games to verify configuration");

    // Nettoyer l'état des vieux jeux (garder seulement les 1000 derniers)
    const state = loadState();
    if (state.notifiedGames.length > 1000) {
        state.notifiedGames = state.notifiedGames.slice(-1000);
        saveState(state);
        logger.info(`Cleaned old game notifications (kept last 1000)`);
    }
}





