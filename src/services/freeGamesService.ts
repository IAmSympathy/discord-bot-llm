import {AttachmentBuilder, Client, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SectionBuilder, TextChannel, TextDisplayBuilder, ThumbnailBuilder} from "discord.js";
import {EnvConfig} from "../utils/envConfig";
import {createLogger} from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

const logger = createLogger("FreeGamesService");

const API_BASE_URL = "https://api.freestuffbot.xyz/v2";
const COMPATIBILITY_DATE = "2025-03-01";
const STATE_FILE = path.join(process.cwd(), "data", "free_games_state.json");
const CONFIG_FILE = path.join(process.cwd(), "data", "free_games_config.json");

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
    currentGames: Product[]; // Produits actifs complets (pour /freegames)
}

interface FreeGamesConfig {
    allowedTypes: string[];
    allowedChannels: string[];
    minRating: number;
    allowedStores: string[];
}


/**
 * Charge la configuration des filtres
 */
function loadFilterConfig(): FreeGamesConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, "utf-8").trim();
            if (data) {
                return JSON.parse(data);
            }
        }
    } catch (error) {
        logger.error("Error loading filter config:", error);
    }
    // Configuration par défaut : jeux uniquement, à conserver, toutes plateformes
    const defaultConfig = {
        allowedTypes: ["game"],
        allowedChannels: ["keep"],
        minRating: 0,
        allowedStores: ["steam", "epic", "gog", "humble", "origin", "ubi", "itch", "prime", "other"]
    };
    // Sauvegarder la config par défaut
    saveFilterConfig(defaultConfig);
    return defaultConfig;
}

/**
 * Charge l'état du service
 */
function loadState(): FreeGamesState {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, "utf-8").trim();
            if (data) {
                return JSON.parse(data);
            }
        }
    } catch (error) {
        logger.error("Error loading state:", error);
    }
    const defaultState = {notifiedGames: [], lastCheck: null, currentGames: []};
    // Sauvegarder l'état par défaut
    saveState(defaultState);
    return defaultState;
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
 * Sauvegarde la configuration des filtres
 */
function saveFilterConfig(config: FreeGamesConfig): void {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    } catch (error) {
        logger.error("Error saving filter config:", error);
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
        .filter(img => (img.flags & (1 << 4)) || (img.flags & (1 << 5))) // TP_PROMO ou TP_LOGO
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
 * Obtient le chemin local du logo de la plateforme
 */
function getStoreLogoPath(store: Store): string | null {
    const storeLogos: Record<Store, string> = {
        steam: "steam.png",
        epic: "epic.png",
        humble: "humble.png",
        gog: "gog.png",
        origin: "origin.png",
        ubi: "ubisoft.png",
        itch: "itch.png",
        prime: "prime.png",
        other: "default.png"
    };

    const logoFile = storeLogos[store] || "default.png";
    const logoPath = path.join(process.cwd(), "assets", "store_logos", logoFile);

    // Vérifier si le fichier existe
    if (fs.existsSync(logoPath)) {
        return logoPath;
    }

    // Fallback sur default.png
    const defaultPath = path.join(process.cwd(), "assets", "store_logos", "default.png");
    if (fs.existsSync(defaultPath)) {
        return defaultPath;
    }

    // Si aucun logo n'existe, retourner null
    return null;
}

/**
 * Retourne les jeux gratuits actuellement actifs (non expirés)
 */
export function getCurrentFreeGames(): { container: ContainerBuilder; logoAttachment: AttachmentBuilder | null }[] {
    const state = loadState();
    if (!state.currentGames || state.currentGames.length === 0) return [];

    const now = Math.floor(Date.now() / 1000);
    const activeGames = state.currentGames.filter(p => p.until === 0 || p.until > now);

    return activeGames.map(product => createFreeGameEmbed(product));
}

/**
 * Crée un message Components v2 pour afficher un jeu/loot gratuit.
 * Structure : Container (couleur) → Section (texte + thumbnail) + MediaGallery (grande image) + TextDisplay (footer)
 */
export function createFreeGameEmbed(product: Product): { container: ContainerBuilder; logoAttachment: AttachmentBuilder | null } {
    const tagEmojis: Record<string, string> = {
        'action': '⚔️', 'adventure': '🗺️', 'rpg': '🎭', 'strategy': '♟️',
        'simulation': '🎮', 'shooter': '🔫', 'puzzle': '🧩', 'horror': '👻',
        'racing': '🏎️', 'sports': '⚽', 'fighting': '🥊', 'platformer': '🪜',
        '2d': '🔲', '3d': '🎲', '2d platformer': '🪜', '3d platformer': '🎲',
        'indie': '💎', 'casual': '🎯', 'arcade': '🕹️', 'retro': '👾',
        'pixel graphics': '🟦', 'minimalist': '⬜', 'hand-drawn': '✏️',
        'action rpg': '⚔️', 'action-adventure': '🗡️', 'fps': '🎯', 'stealth': '🥷',
        'swordplay': '⚔️', 'fast-paced': '⚡', 'jrpg': '🎌', 'party-based rpg': '👥',
        'dark fantasy': '🌑', 'fantasy': '🧙', 'magic': '✨', 'medieval': '🏰',
        'creature collector': '🦋', 'psychological horror': '🧠', 'survival horror': '🔦',
        'dark': '🌙', 'multiplayer': '👥', 'co-op': '🤝', 'online co-op': '🌐',
        'co-op campaign': '👫', 'competitive': '🏆', 'pvp': '⚔️',
        'massively multiplayer': '👨‍👩‍👧‍👦', 'mmorpg': '🌍', 'team-based': '👥',
        'social deduction': '🕵️', 'party': '🎉', 'trivia': '❓', 'single player': '👤',
        'open world': '🌍', 'open world survival craft': '🏕️', 'sandbox': '🏖️',
        'exploration': '🧭', 'metroidvania': '🗺️', 'rogue-lite': '🎲',
        'turn-based strategy': '♟️', 'rts': '🏛️', 'story rich': '📖',
        'choices matter': '🔀', 'visual novel': '📚', 'interactive fiction': '📜',
        'noir': '🎩', 'investigation': '🔍', 'mystery': '❓', 'comic book': '📕',
        'sci-fi': '🚀', 'cyberpunk': '🤖', 'steampunk': '⚙️', 'space': '🌌',
        'post-apocalyptic': '☢️', 'western': '🤠', 'historical': '📜', 'war': '💣',
        'crime': '🔫', 'building': '🏗️', 'crafting': '🔨', 'resource management': '📊',
        'trading': '💰', 'hacking': '💻', 'puzzle platformer': '🧩', 'hidden object': '🔍',
        'point & click': '🖱️', 'controller support': '🎮', 'first-person': '👁️',
        'side scroller': '➡️', 'runner': '🏃', 'realistic': '🎥', 'relaxing': '😌',
        'comedy': '😂', 'immersive sim': '🎭', 'female protagonist': '👩',
        'early access': '🚧', 'cross platform': '🔄', 'life sim': '🏡',
        'games workshop': '🎲', 'rpgmaker': '🎮', 'snow': '❄️', 'nature': '🌲',
        'underwater': '🌊', 'desert': '🏜️'
    };

    const storeColors: Record<Store, number> = {
        steam: 0x1b2838, epic: 0x313131, humble: 0xcc2929, gog: 0x86328a,
        origin: 0xf56c2d, ubi: 0x0080ff, itch: 0xfa5c5c, prime: 0x9146ff, other: 0x00cc66
    };
    const kindColors: Record<ProductKind, number> = {
        game: 0x00cc66, dlc: 0x5865F2, loot: 0xffc83c, software: 0x0db2ff,
        art: 0xffe2b8, ost: 0x76c2af, book: 0x35495e, storeitem: 0x7cabbc, other: 0xffdc64
    };
    const kindIconPaths: Record<ProductKind, string> = {
        game: "", dlc: "dlc.png", loot: "loot.png", software: "software.png",
        art: "art.png", ost: "ost.png", book: "book.png", storeitem: "storeitem.png", other: "other.png"
    };

    const color = product.kind === "game"
        ? (storeColors[product.store] ?? 0x00cc66)
        : (kindColors[product.kind] ?? 0x95A5A6);

    // --- Thumbnail (logo plateforme ou icône de type) ---
    let logoAttachment: AttachmentBuilder | null = null;
    let thumbnailUrl: string | null = null;

    if (product.kind === "game") {
        const logoPath = getStoreLogoPath(product.store);
        if (logoPath) {
            const logoFileName = `${product.store}_logo_${product.id}.png`;
            logoAttachment = new AttachmentBuilder(logoPath, {name: logoFileName});
            thumbnailUrl = `attachment://${logoFileName}`;
        }
    } else {
        const iconFileName = kindIconPaths[product.kind];
        if (iconFileName) {
            const iconPath = path.join(process.cwd(), "assets", "product_icons", iconFileName);
            if (fs.existsSync(iconPath)) {
                const attachmentName = `${product.kind}_icon_${product.id}.png`;
                logoAttachment = new AttachmentBuilder(iconPath, {name: attachmentName});
                thumbnailUrl = `attachment://${attachmentName}`;
            }
        }
    }

    // --- Construction du texte principal ---
    // until : l'API FreeStuff v2 retourne des millisecondes
    const untilSeconds = product.until > 9999999999 ? Math.floor(product.until / 1000) : product.until;

    let textContent = `### ${product.title}\n`;

    if (product.description) {
        const shortDesc = product.description.length > 200
            ? product.description.substring(0, 197) + "..."
            : product.description;
        textContent += `> ${shortDesc}\n\n`;
    }

    if (product.prices && product.prices.length > 0) {
        const price = product.prices[0];
        if (price.oldValue > 0) {
            const oldPrice = (price.oldValue / 100).toFixed(2).replace('.', ',');
            const currency = price.currency.toUpperCase();
            textContent += `~~${oldPrice} $${currency}~~ **Gratuit**`;
        } else {
            textContent += `**Gratuit**`;
        }
    } else {
        textContent += `**Gratuit**`;
    }

    if (untilSeconds > 0) {
        textContent += ` jusqu'au <t:${untilSeconds}:D>`;
    }

    if (product.rating > 0) {
        const rating = (product.rating * 10).toFixed(1);
        textContent += `⠀⠀${rating}/10 ★`;
    }

    // Tags
    if (product.tags && product.tags.length > 0) {
        const tagList = product.tags.slice(0, 4).map(tag => {
            const emoji = tagEmojis[tag.toLowerCase()] || '🔵';
            return `${emoji} ${tag.toUpperCase()}`;
        }).join('⠀⠀');
        textContent += `\n${tagList}`;
    }

    // Liens
    const productUrl = getBestUrl(product);
    if (productUrl) {
        let gameIdentifier = "";
        if (product.store === "steam") {
            const m = productUrl.match(/\/app\/(\d+)/);
            if (m) gameIdentifier = m[1];
        } else if (product.store === "epic") {
            const m = productUrl.match(/\/p\/([^?#]+)/);
            if (m) gameIdentifier = m[1];
        }
        const browserLink = `**[Ouvrir dans le navigateur ↗](${productUrl})**`;
        let clientLink = "";
        if (product.store === "steam" && gameIdentifier) {
            clientLink = `⠀⠀**[Ouvrir dans le client Steam ↗](https://freestuffbot.xyz/ext/open-client/steam/${gameIdentifier})**`;
        } else if (product.store === "epic" && gameIdentifier) {
            clientLink = `⠀⠀**[Ouvrir dans le client Epic Games ↗](https://freestuffbot.xyz/ext/open-client/epic/${gameIdentifier})**`;
        }
        textContent += `\n\n${browserLink}${clientLink}`;
    }

    // --- Assemblage des composants ---
    const textDisplay = new TextDisplayBuilder().setContent(textContent);

    const section = new SectionBuilder().addTextDisplayComponents(textDisplay);
    if (thumbnailUrl) {
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
    }

    const container = new ContainerBuilder().setAccentColor(color).addSectionComponents(section);

    // Grande image du jeu
    const imageUrl = getBestImage(product);
    if (imageUrl) {
        const gallery = new MediaGalleryBuilder()
            .addItems(new MediaGalleryItemBuilder().setURL(imageUrl));
        container.addMediaGalleryComponents(gallery);
    }

    // Footer
    const footerText = `via freestuffbot.xyz⠀⠀© ${product.copyright || 'TakeThemGames (Creative)'}`;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footerText}`));

    return {container, logoAttachment};
}

/**
 * Traite une nouvelle annonce de jeux gratuits
 */
export async function processAnnouncement(client: Client, announcement: ResolvedAnnouncement): Promise<void> {
    const state = loadState();
    const channelId = EnvConfig.FREE_GAMES_CHANNEL_ID;
    const gamesRoleId = EnvConfig.ROLE_REACTION_ROLE_ID;
    const lootRoleId = EnvConfig.FREE_GAMES_LOOT_ROLE_ID;

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

        const products: { container: ContainerBuilder; file: AttachmentBuilder | null; id: number }[] = [];

        // Créer tous les containers et attachments
        for (const product of announcement.resolvedProducts) {
            // Filtrer les jeux trash ou non approuvés si souhaité
            const isTrash = product.flags & (1 << 0); // TRASH flag
            if (isTrash) {
                logger.debug(`Skipping trash product: ${product.title} (ID: ${product.id})`);
                continue;
            }

            const {container, logoAttachment} = createFreeGameEmbed(product);
            products.push({container, file: logoAttachment, id: product.id});

            // Ajouter à la liste des jeux notifiés (pour historique seulement)
            if (!state.notifiedGames.includes(product.id)) {
                state.notifiedGames.push(product.id);
            }
        }

        // Envoyer un message séparé par produit (components v2 avec flag IsComponentsV2)
        if (products.length > 0) {
            for (let i = 0; i < products.length; i++) {
                const {container, file, id} = products[i];

                // Déterminer le rôle selon le type de CE produit spécifique
                const product = announcement.resolvedProducts.find(p => p.id === id)!;
                const productRoleId = product.kind === "game" ? gamesRoleId : (lootRoleId || gamesRoleId);

                const message: any = {
                    content: productRoleId ? `<@&${productRoleId}>` : undefined,
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                };

                if (file) {
                    message.files = [file];
                }

                await channel.send(message);
            }

            logger.info(`Notified ${products.length} free game(s) in ${products.length} separate message(s)`);
        }

        // Sauvegarder l'état
        state.lastCheck = new Date().toISOString();

        // Mettre à jour les produits actifs : purger les expirés + ajouter les nouveaux
        if (!state.currentGames) state.currentGames = [];
        const now = Math.floor(Date.now() / 1000);
        state.currentGames = state.currentGames.filter(p => p.until === 0 || p.until > now);
        for (const product of announcement.resolvedProducts) {
            const isTrash = product.flags & (1 << 0);
            if (!isTrash && !state.currentGames.find(p => p.id === product.id)) {
                state.currentGames.push(product);
            }
        }

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
        logger.info(`ℹ️ Your webhook URL: http://151.145.51.189:3000/webhooks/freestuff`);

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





