import {Client, Events, GatewayIntentBits, GuildMember, REST, Routes} from "discord.js";
import {MessageCollector} from "./messageCollector";
import * as dotenv from "dotenv";
import {hasOwnerPermission} from "../../utils/permissions";
import {replyWithError} from "../../utils/interactionUtils";

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
                description: "Génère un message aléatoire basé sur l'historique du serveur",
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
                description: "Affiche les statistiques de Klodovik",
            },
            {
                name: "klodovik-collect",
                description: "[TAH-UM] Lance la collecte de messages historiques",
            },
            {
                name: "klodovik-reset",
                description: "[TAH-UM] Réinitialise le modèle",
            },
            {
                name: "klodovik-config",
                description: "[TAH-UM] Configure les réponses spontanées",
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

        const targetUser = interaction.options.getUser("utilisateur");
        const seed = interaction.options.getString("seed");

        let generated: string;

        if (targetUser) {
            generated = this.messageCollector.generateFromUser(targetUser.id);
            if (generated.includes("pas encore assez de messages")) {
                await interaction.editReply(`❌ ${generated}`);
                return;
            }
            await interaction.editReply(`🎭 **${targetUser.username}** dit:\n\n${generated}`);
        } else {
            generated = this.messageCollector.generate(100, seed || undefined);
            if (generated.includes("pas encore assez appris")) {
                await interaction.editReply(`❌ ${generated}`);
                return;
            }
            await interaction.editReply(`🤖 **Klodovik** génère:\n\n${generated}`);
        }
    }

    /**
     * Gère la commande /markov-stats
     */
    private async handleStatsCommand(interaction: any): Promise<void> {
        const stats = this.messageCollector.getStats();

        const message = `📊 **Statistiques de Klodovik**\n\n` +
            `📝 Messages analysés: **${stats.messagesAnalyzed.toLocaleString()}**\n` +
            `🔗 États du modèle: **${stats.globalStates.toLocaleString()}**\n` +
            `➡️ Transitions: **${stats.globalTransitions.toLocaleString()}**\n` +
            `👥 Utilisateurs suivis: **${stats.usersTracked}**`;

        await interaction.reply({content: message, ephemeral: true});
    }

    /**
     * Gère la commande /markov-collect
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

        await interaction.reply({content: "🔄 Collecte de messages en cours... Cela peut prendre plusieurs minutes.", ephemeral: true});

        // Lancer la collecte en arrière-plan
        this.messageCollector.collectFromGuild(this.client, interaction.guildId, 50000)
            .then(() => {
                interaction.followUp({content: "✅ Collecte terminée !", ephemeral: true});
            })
            .catch((error) => {
                console.error("[Klodovik] Erreur lors de la collecte:", error);
                interaction.followUp({content: "❌ Erreur lors de la collecte.", ephemeral: true});
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
        await interaction.reply({content: "✅ Modèle réinitialisé !", ephemeral: true});
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

                await interaction.reply({
                    content: `✅ Configuration mise à jour !\n\n` +
                        `🎲 Probabilité de réponse spontanée : **${probability}%**\n` +
                        `📊 Environ **1 réponse toutes les ${Math.round(100 / probability)} messages**`,
                    ephemeral: true
                });

                console.log(`[Klodovik] Probabilité de réponse spontanée mise à jour : ${probability}%`);
            } catch (error) {
                console.error("[Klodovik] Erreur lors de la sauvegarde de la config:", error);
                await interaction.reply({
                    content: "❌ Erreur lors de la sauvegarde de la configuration.",
                    ephemeral: true
                });
            }
        } else {
            // Afficher la config actuelle
            const currentChance = parseFloat(process.env.KLODOVIK_REPLY_CHANCE || "0.02");
            const currentPercent = Math.round(currentChance * 100);

            await interaction.reply({
                content: `⚙️ **Configuration actuelle de Klodovik**\n\n` +
                    `🎲 Probabilité de réponse spontanée : **${currentPercent}%**\n` +
                    `📊 Environ **1 réponse toutes les ${Math.round(100 / currentPercent)} messages**\n\n` +
                    `💡 Pour modifier : \`/klodovik-config probabilite:<0-100>\``,
                ephemeral: true
            });
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

