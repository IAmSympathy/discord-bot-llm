import {Client, EmbedBuilder, Events, GatewayIntentBits, GuildMember, REST, Routes} from "discord.js";
import {MessageCollector} from "./messageCollector";
import {KlodovikVoiceService} from "./voiceService";
import * as dotenv from "dotenv";
import {hasOwnerPermission} from "../../utils/permissions";
import {replyWithError} from "../../utils/interactionUtils";
import {initializeKlodovikLogger, logKlodovikCollect, logKlodovikConfig, logKlodovikGenerate, logKlodovikReset, logKlodovikWhitelist} from "../../utils/discordLogger";

dotenv.config();

/**
 * Bot Klodovik - Génération de texte par chaînes de Markov
 * Fonctionne dans le même processus Node que Netricsa
 */
export class KlodovikBot {
    public client: Client;
    private messageCollector: MessageCollector;
    private ready: boolean = false;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates, // Pour détecter les salons vocaux
            ],
        });

        this.messageCollector = new MessageCollector(2); // Ordre 2 pour la chaîne de Markov
        this.loadConfig(); // Charger la config sauvegardée
        this.setupEventHandlers();
    }

    /**
     * Démarre le bot
     */
    public async start(): Promise<void> {
        const token = process.env.KLODOVIK_TOKEN;
        if (!token) {
            console.error("[Klodovik] KLODOVIK_TOKEN manquant dans .env");
            return;
        }

        try {
            await this.client.login(token);
        } catch (error) {
            console.error("[Klodovik] Erreur lors de la connexion:", error);
        }
    }

    /**
     * Arrête le bot proprement
     */
    public async stop(): Promise<void> {
        console.log("[Klodovik] Arrêt du bot...");
        this.messageCollector.saveAll();
        await this.client.destroy();
    }

    /**
     * Vérifie si le bot est prêt
     */
    public isReady(): boolean {
        return this.ready;
    }

    /**
     * Charge la configuration depuis le fichier
     */
    private loadConfig(): void {
        try {
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "data", "klodovik_config.json");

            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
                if (config.spontaneousReplyChance !== undefined) {
                    process.env.KLODOVIK_REPLY_CHANCE = config.spontaneousReplyChance.toString();
                    const percent = Math.round(config.spontaneousReplyChance * 100);
                    console.log(`[Klodovik] Config chargée: ${percent}% de réponses spontanées`);
                }
            }
        } catch (error) {
            console.error("[Klodovik] Erreur lors du chargement de la config:", error);
        }
    }

    /**
     * Configure les event handlers
     */
    private setupEventHandlers(): void {
        this.client.once(Events.ClientReady, async (c) => {
            console.log(`[Klodovik] ✓ Bot connecté: ${c.user.tag}`);
            this.ready = true;

            // Initialiser le logger Discord pour Klodovik
            initializeKlodovikLogger(this.client);

            // Enregistrer les commandes slash
            await this.registerCommands();

            // Collecter les messages historiques au démarrage (optionnel)
            // await this.collectHistoricalMessages();
        });

        // Analyser les nouveaux messages en temps réel
        this.client.on(Events.MessageCreate, async (message) => {
            // Ignorer les bots (y compris Klodovik lui-même)
            if (message.author.bot) return;
            if (message.content.length === 0) return;

            // Analyser le message pour l'apprentissage
            this.messageCollector.processMessage(message);

            // Réponse spontanée aléatoire (comme nMarkov)
            // Probabilité: 2% par défaut (ajustable)
            const SPONTANEOUS_REPLY_CHANCE = parseFloat(process.env.KLODOVIK_REPLY_CHANCE || "0.02");

            if (Math.random() < SPONTANEOUS_REPLY_CHANCE) {
                try {
                    // Attendre un peu pour sembler plus naturel (1-3 secondes)
                    const delay = 1000 + Math.random() * 2000;
                    await new Promise(resolve => setTimeout(resolve, delay));

                    // Générer une réponse basée sur le message (utiliser des mots-clés)
                    const words = message.content.split(/\s+/).filter(w => w.length > 3);
                    const seed = words.length > 0 && Math.random() < 0.5
                        ? words[Math.floor(Math.random() * words.length)]
                        : undefined;

                    const generated = this.messageCollector.generate(100, seed);

                    // Ne pas répondre si le modèle n'est pas prêt
                    if (generated.includes("pas encore assez appris")) {
                        return;
                    }

                    // Ne pas envoyer de message dans le salon compteur
                    const COUNTER_CHANNEL_ID = process.env.COUNTER_CHANNEL_ID;
                    if (message.channel.id === COUNTER_CHANNEL_ID) {
                        console.log(`[Klodovik] Réponse spontanée bloquée dans le salon compteur`);
                        return;
                    }

                    // Envoyer le message
                    await message.channel.send(generated);
                    const channelName = 'name' in message.channel ? message.channel.name : 'DM';
                    console.log(`[Klodovik] Réponse spontanée dans #${channelName}`);
                } catch (error) {
                    console.error("[Klodovik] Erreur lors de la réponse spontanée:", error);
                }
            }
        });

        // Gérer les commandes slash
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const {commandName} = interaction;

            try {
                switch (commandName) {
                    case "klodovik":
                    case "markov":
                        await this.handleMarkovCommand(interaction);
                        break;
                    case "klodovik-stats":
                    case "markov-stats":
                        await this.handleStatsCommand(interaction);
                        break;
                    case "klodovik-collect":
                    case "markov-collect":
                        await this.handleCollectCommand(interaction);
                        break;
                    case "klodovik-reset":
                    case "markov-reset":
                        await this.handleResetCommand(interaction);
                        break;
                    case "klodovik-config":
                        await this.handleConfigCommand(interaction);
                        break;
                    case "klodovik-whitelist":
                        await this.handleWhitelistCommand(interaction);
                        break;
                }
            } catch (error) {
                console.error(`[Klodovik] Erreur dans la commande ${commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({content: "Une erreur est survenue !", ephemeral: true});
                } else {
                    await interaction.reply({content: "Une erreur est survenue !", ephemeral: true});
                }
            }
        });

        // Système de vérification périodique des salons vocaux
        this.startVoiceChannelMonitoring();
    }

    /**
     * Démarre la surveillance périodique des salons vocaux
     * Vérifie à intervalle régulier s'il y a des gens dans les vocaux
     */
    private startVoiceChannelMonitoring(): void {
        // Intervalle de vérification configurable (défaut: 60 secondes)
        const CHECK_INTERVAL = parseInt(process.env.KLODOVIK_VOICE_CHECK_INTERVAL || "60000");

        setInterval(async () => {
            try {
                // Récupérer tous les serveurs du bot
                for (const [_, guild] of this.client.guilds.cache) {
                    // Récupérer tous les salons vocaux avec des membres
                    const voiceChannels = guild.channels.cache.filter(channel => {
                        if (!channel.isVoiceBased()) return false;

                        // Vérifier qu'il y a au moins 1 membre non-bot
                        const members = channel.members.filter(m => !m.user.bot);
                        return members.size > 0;
                    });

                    // Pour chaque salon vocal avec des membres
                    for (const [_, channel] of voiceChannels) {
                        // Probabilité : 0.5% par défaut (1/200 par minute)
                        const VOICE_JOIN_CHANCE = parseFloat(process.env.KLODOVIK_VOICE_CHANCE || "0.005");

                        if (Math.random() < VOICE_JOIN_CHANCE) {
                            // Attendre un délai aléatoire (5-30 secondes)
                            const delay = 5000 + Math.random() * 25000;
                            await new Promise(resolve => setTimeout(resolve, delay));

                            // Vérifier que le salon a toujours des membres
                            const updatedChannel = await this.client.channels.fetch(channel.id);
                            if (updatedChannel?.isVoiceBased()) {
                                const voiceService = KlodovikVoiceService.getInstance();
                                const played = await voiceService.playRandomSound(updatedChannel);

                                if (played) {
                                    console.log(`[Klodovik Voice] 🎲 Son joué dans ${updatedChannel.name}`);
                                }
                            }

                            // Sortir de la boucle après avoir joué un son
                            // (ne joue qu'un seul son par cycle même s'il y a plusieurs vocaux)
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error("[Klodovik Voice] Erreur lors de la vérification périodique:", error);
            }
        }, CHECK_INTERVAL);

        const intervalMinutes = CHECK_INTERVAL / 60000;
        console.log(`[Klodovik Voice] 🔄 Surveillance périodique activée (vérification toutes les ${intervalMinutes} minute${intervalMinutes > 1 ? 's' : ''})`);
    }

    /**
     * Enregistre les commandes slash
     */
    private async registerCommands(): Promise<void> {
        const token = process.env.KLODOVIK_TOKEN;
        const clientId = process.env.KLODOVIK_CLIENT_ID;

        if (!token || !clientId) {
            console.error("[Klodovik] Token ou Client ID manquant dans .env");
            return;
        }

        const commands = [
            {
                name: "klodovik",
                description: " 🦜 Demande à Klodovik d'imiter un message basé sur ce qu'il a appris",
                contexts: [0, 1, 2], // Disponible en serveur, DM et groupe DM
                integration_types: [0, 1], // Guild install + User install
                options: [
                    {
                        name: "user",
                        description: "Imiter un utilisateur spécifique",
                        type: 6, // USER
                        required: false,
                    },
                    {
                        name: "seed",
                        description: "Mot-clé pour démarrer la génération",
                        type: 3, // STRING
                        required: false,
                    },
                ],
            },
            {
                name: "klodovik-stats",
                description: "📊 Affiche les statistiques d'apprentissage de Klodovik",
                contexts: [0, 1, 2], // Disponible en serveur, DM et groupe DM
                integration_types: [0, 1], // Guild install + User install
            },
            {
                name: "klodovik-collect",
                description: "[TAH-UM] 🔄 Collecte les messages du canal actuel pour entraîner Klodovik (limité à 10 000 messages)",
            },
            {
                name: "klodovik-reset",
                description: "[TAH-UM] ⚠️ Réinitialise la mémoire de Klodovik",
            },
            {
                name: "klodovik-config",
                description: "[TAH-UM] ⚙️ Configure le cerveau de Klodovik",
                options: [
                    {
                        name: "probabilite",
                        description: "Probabilité de réponse spontanée (0-100%, défaut: 2%)",
                        type: 4, // INTEGER
                        required: false,
                        min_value: 0,
                        max_value: 100,
                    },
                ],
            },
            {
                name: "klodovik-whitelist",
                description: "[TAH-UM] ✅ Gère la whitelist des canaux d'apprentissages pour Klodovik",
                options: [
                    {
                        name: "action",
                        description: "Action à effectuer",
                        type: 3, // STRING
                        required: true,
                        choices: [
                            {name: "➕ Ajouter ce canal", value: "add"},
                            {name: "➖ Retirer ce canal", value: "remove"},
                            {name: "👀 Voir la liste", value: "list"},
                            {name: "🧹 Tout effacer (accepter tous)", value: "clear"},
                        ],
                    },
                ],
            },
        ];

        try {
            const rest = new REST().setToken(token);
            console.log("[Klodovik] Enregistrement des commandes slash...");

            await rest.put(Routes.applicationCommands(clientId), {body: commands});

            console.log("[Klodovik] ✓ Commandes slash enregistrées");
        } catch (error) {
            console.error("[Klodovik] Erreur lors de l'enregistrement des commandes:", error);
        }
    }

    /**
     * Gère la commande /markov
     */
    private async handleMarkovCommand(interaction: any): Promise<void> {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser("user");
        const seed = interaction.options.getString("seed");
        const username = interaction.user?.username || "Utilisateur inconnu";
        const avatarUrl = interaction.user?.displayAvatarURL();
        const channelName = interaction.channel?.name || "DM";

        let generated: string;

        if (targetUser) {
            generated = this.messageCollector.generateFromUser(targetUser.id);
            if (generated.includes("pas encore assez de messages")) {
                await interaction.editReply(`${generated}`);
                return;
            }
            await interaction.editReply(`${generated}`);

            // Log Discord
            await logKlodovikGenerate(
                username,
                channelName,
                seed || undefined,
                targetUser.username,
                generated,
                avatarUrl
            );
        } else {
            generated = this.messageCollector.generate(100, seed || undefined);
            if (generated.includes("pas encore assez appris")) {
                await interaction.editReply(`${generated}`);
                return;
            }
            await interaction.editReply(`${generated}`);

            // Log Discord
            await logKlodovikGenerate(
                username,
                channelName,
                seed || undefined,
                undefined,
                generated,
                avatarUrl
            );
        }
    }

    /**
     * Gère la commande /markov-stats
     */
    private async handleStatsCommand(interaction: any): Promise<void> {
        const stats = this.messageCollector.getStats();

        const embed = new EmbedBuilder()
            .setColor(0x56fd0d)
            .setTitle("📊 Statistiques de Klodovik")
            .setDescription(
                `📝 **Messages analysés :** ${stats.messagesAnalyzed.toLocaleString()}\n` +
                `🔗 **États du modèle :** ${stats.globalStates.toLocaleString()}\n` +
                `➡️ **Transitions :** ${stats.globalTransitions.toLocaleString()}\n` +
                `👥 **Utilisateurs suivis :** ${stats.usersTracked}`
            )
            .setTimestamp();

        await interaction.reply({embeds: [embed], ephemeral: true});
    }

    /**
     * Gère la commande /markov-collect
     * Collecte uniquement le canal où la commande est lancée
     */
    private async handleCollectCommand(interaction: any): Promise<void> {
        // Vérifier les permissions admin
        const member = interaction.member instanceof GuildMember ? interaction.member : null;

        if (!hasOwnerPermission(member)) {
            await replyWithError(
                interaction,
                "Permission refusée",
                "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                true
            );
            return;
        }

        const channelId = interaction.channelId;
        const channelName = interaction.channel?.name || "ce canal";
        const username = interaction.user?.username || "Utilisateur inconnu";
        const avatarUrl = interaction.user?.displayAvatarURL();

        const startEmbed = new EmbedBuilder()
            .setColor(0x56fd0d)
            .setTitle("🔄 Collecte en cours")
            .setDescription(
                `Collecte des messages de **#${channelName}**...\n\n` +
                `⏱️ Cela peut prendre quelques minutes selon la quantité de messages.\n` +
                `📊 **Limite :** 10 000 messages`
            );

        await interaction.reply({embeds: [startEmbed], ephemeral: true});

        // Lancer la collecte du canal actuel
        this.messageCollector.collectFromChannel(channelId, this.client, 10000)
            .then(async (count) => {
                const successEmbed = new EmbedBuilder()
                    .setColor(0x56fd0d)
                    .setTitle("✅ Collecte terminée")
                    .setDescription(
                        `📝 **${count.toLocaleString()}** messages collectés dans **#${channelName}**`
                    )
                    .setTimestamp();

                await interaction.followUp({embeds: [successEmbed], ephemeral: true});

                // Log Discord
                await logKlodovikCollect(username, channelName, count, avatarUrl);
            })
            .catch((error) => {
                console.error("[Klodovik] Erreur lors de la collecte:", error);

                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("❌ Erreur lors de la collecte")
                    .setDescription(`Détails : ${error.message || "Erreur inconnue"}`);

                interaction.followUp({embeds: [errorEmbed], ephemeral: true});
            });
    }

    /**
     * Gère la commande /markov-reset
     */
    private async handleResetCommand(interaction: any): Promise<void> {
        // Vérifier les permissions admin
        const member = interaction.member instanceof GuildMember ? interaction.member : null;

        if (!hasOwnerPermission(member)) {
            await replyWithError(
                interaction,
                "Permission refusée",
                "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                true
            );
            return;
        }

        this.messageCollector.reset();

        const username = interaction.user?.username || "Utilisateur inconnu";
        const avatarUrl = interaction.user?.displayAvatarURL();

        const embed = new EmbedBuilder()
            .setColor(0x56fd0d)
            .setTitle("✅ Modèle réinitialisé")
            .setDescription("Le modèle de Klodovik a été complètement réinitialisé.")
            .setTimestamp();

        await interaction.reply({embeds: [embed], ephemeral: true});

        // Log Discord
        await logKlodovikReset(username, avatarUrl);
    }

    /**
     * Gère la commande /klodovik-config
     */
    private async handleConfigCommand(interaction: any): Promise<void> {
        // Vérifier les permissions admin
        const member = interaction.member instanceof GuildMember ? interaction.member : null;

        if (!hasOwnerPermission(member)) {
            await replyWithError(
                interaction,
                "Permission refusée",
                "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                true
            );
            return;
        }

        const probability = interaction.options.getInteger("probabilite");

        if (probability !== null && probability !== undefined) {
            // Sauvegarder dans un fichier de config
            const fs = require("fs");
            const path = require("path");
            const configPath = path.join(process.cwd(), "data", "klodovik_config.json");

            const config = {
                spontaneousReplyChance: probability / 100, // Convertir en décimal
                lastUpdate: Date.now()
            };

            try {
                const dataDir = path.dirname(configPath);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, {recursive: true});
                }
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

                // Mettre à jour la variable d'environnement en mémoire
                process.env.KLODOVIK_REPLY_CHANCE = (probability / 100).toString();

                const username = interaction.user?.username || "Utilisateur inconnu";
                const avatarUrl = interaction.user?.displayAvatarURL();

                const successEmbed = new EmbedBuilder()
                    .setColor(0x56fd0d)
                    .setTitle("✅ Configuration mise à jour")
                    .setDescription(
                        `🎲 **Probabilité de réponse spontanée :** ${probability}%\n` +
                        `📊 Environ **1 réponse toutes les ${Math.round(100 / probability)} messages**`
                    )
                    .setTimestamp();

                await interaction.reply({embeds: [successEmbed], ephemeral: true});

                // Log Discord
                await logKlodovikConfig(username, probability, avatarUrl);

                console.log(`[Klodovik] Probabilité de réponse spontanée mise à jour : ${probability}%`);
            } catch (error) {
                console.error("[Klodovik] Erreur lors de la sauvegarde de la config:", error);

                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("❌ Erreur")
                    .setDescription("Erreur lors de la sauvegarde de la configuration.");

                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        } else {
            // Afficher la config actuelle
            const currentChance = parseFloat(process.env.KLODOVIK_REPLY_CHANCE || "0.02");
            const currentPercent = Math.round(currentChance * 100);

            const configEmbed = new EmbedBuilder()
                .setColor(0x56fd0d)
                .setTitle("⚙️ Configuration cervicale actuelle de Klodovik")
                .setDescription(
                    `🎲 **Probabilité de réponse spontanée :** ${currentPercent}%\n` +
                    `📊 Environ **1 réponse toutes les ${Math.round(100 / currentPercent)} messages**\n\n` +
                    `💡 Pour modifier : \`/klodovik-config probabilite:<0-100>\``
                )
                .setTimestamp();

            await interaction.reply({embeds: [configEmbed], ephemeral: true});
        }
    }

    /**
     * Gère la commande /klodovik-whitelist
     */
    private async handleWhitelistCommand(interaction: any): Promise<void> {
        // Vérifier les permissions admin
        const member = interaction.member instanceof GuildMember ? interaction.member : null;

        if (!hasOwnerPermission(member)) {
            await replyWithError(
                interaction,
                "Permission refusée",
                "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                true
            );
            return;
        }

        const action = interaction.options.getString("action");
        const channelId = interaction.channelId;
        const channelName = interaction.channel?.name || "ce canal";
        const username = interaction.user?.username || "Utilisateur inconnu";
        const avatarUrl = interaction.user?.displayAvatarURL();

        switch (action) {
            case "add":
                this.messageCollector.addChannelToWhitelist(channelId);
                const addEmbed = new EmbedBuilder()
                    .setColor(0x56fd0d)
                    .setTitle("✅ Canal ajouté à la whitelist")
                    .setDescription(
                        `**#${channelName}** a été ajouté à la liste des canaux autorisés.\n\n` +
                        `Klodovik apprendra maintenant des messages de ce canal en temps réel.`
                    )
                    .setTimestamp();
                await interaction.reply({embeds: [addEmbed], ephemeral: true});

                // Log Discord
                await logKlodovikWhitelist(username, "add", channelName, this.messageCollector.getWhitelist().length, avatarUrl);
                break;

            case "remove":
                this.messageCollector.removeChannelFromWhitelist(channelId);
                const removeEmbed = new EmbedBuilder()
                    .setColor(0x56fd0d)
                    .setTitle("✅ Canal retiré de la whitelist")
                    .setDescription(
                        `**#${channelName}** a été retiré de la liste des canaux autorisés.\n\n` +
                        `Klodovik n'apprendra plus des messages de ce canal.`
                    )
                    .setTimestamp();
                await interaction.reply({embeds: [removeEmbed], ephemeral: true});

                // Log Discord
                await logKlodovikWhitelist(username, "remove", channelName, this.messageCollector.getWhitelist().length, avatarUrl);
                break;

            case "list":
                const whitelist = this.messageCollector.getWhitelist();
                let description: string;

                if (whitelist.length === 0) {
                    description = "🌍 **Tous les canaux sont acceptés**\n\n" +
                        "Aucune whitelist configurée. Klodovik apprend de tous les canaux textuels du serveur.\n\n" +
                        "💡 Utilisez `/klodovik-whitelist action:Ajouter ce canal` pour créer une whitelist.";
                } else {
                    const channelMentions = whitelist.map(id => `<#${id}>`).join("\n");
                    description = `📝 **${whitelist.length} canal(aux) autorisé(s) :**\n\n${channelMentions}\n\n` +
                        `Klodovik apprend uniquement des messages de ces canaux.`;
                }

                const listEmbed = new EmbedBuilder()
                    .setColor(0x56fd0d)
                    .setTitle("📋 Whitelist des Canaux")
                    .setDescription(description)
                    .setTimestamp();
                await interaction.reply({embeds: [listEmbed], ephemeral: true});

                // Log Discord (consultation)
                await logKlodovikWhitelist(username, "list", undefined, whitelist.length, avatarUrl);
                break;

            case "clear":
                this.messageCollector.clearWhitelist();
                const clearEmbed = new EmbedBuilder()
                    .setColor(0x56fd0d)
                    .setTitle("✅ Whitelist effacée")
                    .setDescription(
                        `La whitelist a été vidée.\n\n` +
                        `🌍 Klodovik accepte maintenant **tous les canaux** du serveur.`
                    )
                    .setTimestamp();
                await interaction.reply({embeds: [clearEmbed], ephemeral: true});

                // Log Discord
                await logKlodovikWhitelist(username, "clear", undefined, 0, avatarUrl);
                break;
        }
    }

    /**
     * Collecte les messages historiques au démarrage
     */
    private async collectHistoricalMessages(): Promise<void> {
        const guildId = this.client.guilds.cache.first()?.id;
        if (guildId) {
            console.log("[Klodovik] Collecte des messages historiques...");
            await this.messageCollector.collectFromGuild(this.client, guildId, 10000);
        }
    }
}

// Exporter une instance unique
let klodovikInstance: KlodovikBot | null = null;

export function getKlodovikBot(): KlodovikBot {
    if (!klodovikInstance) {
        klodovikInstance = new KlodovikBot();
    }
    return klodovikInstance;
}

