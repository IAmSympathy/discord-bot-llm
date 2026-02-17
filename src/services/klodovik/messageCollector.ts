import {Client, Message, TextChannel} from "discord.js";
import {MarkovChain} from "./markovChain";
import * as fs from "fs";
import * as path from "path";

/**
 * Service de collecte et d'analyse des messages pour Klodovik
 */
export class MessageCollector {
    private markov: MarkovChain;
    private userModels: Map<string, MarkovChain> = new Map();
    private messagesAnalyzed: number = 0;
    private readonly statsPath: string;
    private readonly userModelsPath: string;
    private isCollecting: boolean = false;

    constructor(markovOrder: number = 2) {
        this.markov = new MarkovChain(markovOrder);
        this.statsPath = path.join(process.cwd(), "data", "klodovik_stats.json");
        this.userModelsPath = path.join(process.cwd(), "data", "klodovik_user_models.json");
        this.loadStats();
        this.loadUserModels();
    }

    /**
     * Démarre la collecte de messages depuis l'historique du serveur
     * Implémente des délais pour respecter les rate limits Discord
     */
    public async collectFromGuild(client: Client, guildId: string, maxMessages: number = 10000): Promise<void> {
        if (this.isCollecting) {
            console.log("[Klodovik] Collecte déjà en cours...");
            return;
        }

        this.isCollecting = true;
        console.log("[Klodovik] Démarrage de la collecte de messages...");
        console.log("[Klodovik] ⚠️ Rate Limiting Discord: La collecte sera lente pour éviter les blocages");

        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                console.error("[Klodovik] Serveur non trouvé");
                return;
            }

            const channels = guild.channels.cache.filter(c => c.isTextBased() && c.type === 0); // TextChannel only
            let totalCollected = 0;

            for (const [_, channel] of channels) {
                if (totalCollected >= maxMessages) break;

                const textChannel = channel as TextChannel;
                console.log(`[Klodovik] Analyse du salon #${textChannel.name}...`);

                try {
                    let lastId: string | undefined;
                    let channelMessages = 0;

                    while (channelMessages < 1000 && totalCollected < maxMessages) {
                        const options: any = {limit: 100};
                        if (lastId) options.before = lastId;

                        // Attendre 1 seconde entre chaque requête pour respecter les rate limits
                        // Discord permet ~50 requêtes par seconde, mais on reste prudent
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const fetchedMessages: any = await textChannel.messages.fetch(options);
                        if (fetchedMessages.size === 0) break;

                        for (const [_, message] of fetchedMessages) {
                            if (!message.author.bot && message.content.length > 0) {
                                this.processMessage(message);
                                channelMessages++;
                                totalCollected++;
                            }
                        }

                        lastId = fetchedMessages.last()?.id;
                    }

                    console.log(`[Klodovik] ✓ #${textChannel.name}: ${channelMessages} messages`);
                } catch (error: any) {
                    if (error.code === 50013) {
                        console.log(`[Klodovik] ⚠️ #${textChannel.name}: Pas de permission`);
                    } else if (error.status === 429) {
                        console.log(`[Klodovik] ⚠️ Rate limit atteint, pause de 60 secondes...`);
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    } else {
                        console.error(`[Klodovik] Erreur sur #${textChannel.name}:`, error);
                    }
                }

                // Pause entre chaque salon (5 secondes)
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            console.log(`[Klodovik] ✓ Collecte terminée: ${totalCollected} messages analysés`);
            this.saveAll();
        } finally {
            this.isCollecting = false;
        }
    }

    /**
     * Traite un message et l'ajoute aux modèles
     * Adapté pour les messages courts et informels
     */
    public processMessage(message: Message): void {
        if (message.author.bot) return;

        // Accepter des messages plus courts (>=2 caractères au lieu de >=3)
        // Sur un serveur d'amis, même "ok", "mdr", "gg" sont valables
        if (message.content.length < 2) return;

        // Ignorer seulement les commandes avec prefix (! ou /)
        if (message.content.startsWith("!") || message.content.startsWith("/")) return;

        // Ignorer les messages qui sont UNIQUEMENT des nombres
        if (/^\d+$/.test(message.content.trim())) return;

        // Ajouter au modèle global
        this.markov.addText(message.content);

        // Ajouter au modèle de l'utilisateur
        const userId = message.author.id;
        if (!this.userModels.has(userId)) {
            this.userModels.set(userId, new MarkovChain(2));
        }
        this.userModels.get(userId)!.addText(message.content);

        this.messagesAnalyzed++;

        // Sauvegarder périodiquement
        if (this.messagesAnalyzed % 1000 === 0) {
            console.log(`[Klodovik] ${this.messagesAnalyzed} messages analysés...`);
            this.saveAll();
        }
    }

    /**
     * Génère un message aléatoire
     */
    public generate(maxLength: number = 100, seed?: string): string {
        return this.markov.generate(maxLength, seed);
    }

    /**
     * Génère un message imitant un utilisateur spécifique
     */
    public generateFromUser(userId: string, maxLength: number = 100): string {
        const userModel = this.userModels.get(userId);
        if (!userModel) {
            return "Je n'ai pas encore assez de messages de cet utilisateur pour l'imiter ! 🤷";
        }

        return userModel.generate(maxLength);
    }

    /**
     * Obtient les statistiques
     */
    public getStats(): {
        messagesAnalyzed: number;
        globalStates: number;
        globalTransitions: number;
        usersTracked: number;
    } {
        const globalStats = this.markov.getStats();
        return {
            messagesAnalyzed: this.messagesAnalyzed,
            globalStates: globalStats.states,
            globalTransitions: globalStats.totalTransitions,
            usersTracked: this.userModels.size
        };
    }

    /**
     * Sauvegarde tous les modèles
     */
    public saveAll(): void {
        this.markov.saveToDisk();
        this.saveStats();
        this.saveUserModels();
    }

    /**
     * Réinitialise tous les modèles
     */
    public reset(): void {
        this.markov.reset();
        this.userModels.clear();
        this.messagesAnalyzed = 0;
        this.saveStats();
        console.log("[Klodovik] Tous les modèles réinitialisés");
    }

    /**
     * Sauvegarde les statistiques
     */
    private saveStats(): void {
        try {
            const stats = {
                messagesAnalyzed: this.messagesAnalyzed,
                lastUpdate: Date.now()
            };

            const dataDir = path.dirname(this.statsPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, {recursive: true});
            }

            fs.writeFileSync(this.statsPath, JSON.stringify(stats, null, 2));
        } catch (error) {
            console.error("[Klodovik] Erreur lors de la sauvegarde des stats:", error);
        }
    }

    /**
     * Charge les statistiques
     */
    private loadStats(): void {
        try {
            if (fs.existsSync(this.statsPath)) {
                const stats = JSON.parse(fs.readFileSync(this.statsPath, "utf-8"));
                this.messagesAnalyzed = stats.messagesAnalyzed || 0;
                console.log(`[Klodovik] Stats chargées: ${this.messagesAnalyzed} messages`);
            }
        } catch (error) {
            console.error("[Klodovik] Erreur lors du chargement des stats:", error);
        }
    }

    /**
     * Sauvegarde les modèles utilisateurs
     */
    private saveUserModels(): void {
        try {
            const dataDir = path.dirname(this.userModelsPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, {recursive: true});
            }

            // Sauvegarder seulement les utilisateurs avec suffisamment de données (>100 messages)
            const userModelsData: any = {};
            let savedCount = 0;

            for (const [userId, model] of this.userModels.entries()) {
                const stats = model.getStats();
                if (stats.totalTransitions >= 100) { // Seuil minimum
                    // Sauvegarder le modèle de cet utilisateur
                    // Note: On doit accéder à la chaîne interne (on ajoutera une méthode export)
                    userModelsData[userId] = {
                        states: stats.states,
                        transitions: stats.totalTransitions
                    };
                    savedCount++;
                }
            }

            fs.writeFileSync(this.userModelsPath, JSON.stringify({
                count: savedCount,
                lastUpdate: Date.now(),
                users: Object.keys(userModelsData)
            }, null, 2));

            console.log(`[Klodovik] ${savedCount} modèles utilisateurs sauvegardés`);
        } catch (error) {
            console.error("[Klodovik] Erreur lors de la sauvegarde des modèles utilisateurs:", error);
        }
    }

    /**
     * Charge les modèles utilisateurs
     */
    private loadUserModels(): void {
        try {
            if (fs.existsSync(this.userModelsPath)) {
                const data = JSON.parse(fs.readFileSync(this.userModelsPath, "utf-8"));
                console.log(`[Klodovik] ${data.count || 0} modèles utilisateurs disponibles`);
                // Note: Les modèles seront reconstruits au fil du temps via les nouveaux messages
                // On pourrait implémenter un chargement complet plus tard si nécessaire
            }
        } catch (error) {
            console.error("[Klodovik] Erreur lors du chargement des modèles utilisateurs:", error);
        }
    }
}











