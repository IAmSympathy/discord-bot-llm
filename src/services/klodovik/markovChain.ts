import * as fs from "fs";
import * as path from "path";

/**
 * Classe implémentant une chaîne de Markov pour la génération de texte
 */
export class MarkovChain {
    private chain: Map<string, Map<string, number>> = new Map();
    private order: number;
    private readonly dataPath: string;

    constructor(order: number = 2) {
        this.order = order;
        this.dataPath = path.join(process.cwd(), "data", "klodovik_markov.json");
        this.loadFromDisk();
    }

    /**
     * Ajoute un texte au modèle de Markov
     * Adapté pour les messages courts et informels
     */
    public addText(text: string): void {
        // Nettoyer le texte
        const cleaned = this.cleanText(text);

        // Pour les messages très courts/informels, accepter dès 2 caractères
        // Exemples valides: "ok", "gg", "mdr", "lol"
        if (cleaned.length < 2) return;

        const words = cleaned.split(/\s+/).filter(w => w.length > 0);

        // Pour les messages courts (1-2 mots), on les garde quand même
        // Ils seront utilisés pour les transitions
        if (words.length === 0) return;

        // Si on a moins de mots que l'ordre, créer quand même une entrée
        // avec un état plus petit (utile pour messages courts)
        if (words.length < this.order + 1) {
            // Pour un message de 1-2 mots, créer une entrée simple
            if (words.length === 1) {
                // Entrée single-word (état vide → mot)
                const state = "_START_";
                if (!this.chain.has(state)) {
                    this.chain.set(state, new Map());
                }
                const transitions = this.chain.get(state)!;
                transitions.set(words[0], (transitions.get(words[0]) || 0) + 1);
            } else if (words.length === 2) {
                // Paire de mots
                const state = words[0];
                const next = words[1];
                if (!this.chain.has(state)) {
                    this.chain.set(state, new Map());
                }
                const transitions = this.chain.get(state)!;
                transitions.set(next, (transitions.get(next) || 0) + 1);
            }
            return;
        }

        // Construire les n-grammes normalement pour messages plus longs
        for (let i = 0; i < words.length - this.order; i++) {
            const state = words.slice(i, i + this.order).join(" ");
            const next = words[i + this.order];

            if (!this.chain.has(state)) {
                this.chain.set(state, new Map());
            }

            const transitions = this.chain.get(state)!;
            transitions.set(next, (transitions.get(next) || 0) + 1);
        }
    }

    /**
     * Génère un texte basé sur le modèle
     */
    public generate(maxLength: number = 100, seed?: string): string {
        if (this.chain.size === 0) {
            return "Je n'ai pas encore assez appris pour générer du texte ! 🤖";
        }

        // Choisir un état de départ
        let currentState: string;
        if (seed) {
            // Essayer de trouver un état qui contient le seed
            const possibleStates = Array.from(this.chain.keys()).filter(s =>
                s.toLowerCase().includes(seed.toLowerCase())
            );
            currentState = possibleStates.length > 0
                ? possibleStates[Math.floor(Math.random() * possibleStates.length)]
                : this.getRandomState();
        } else {
            currentState = this.getRandomState();
        }

        const words = currentState.split(" ");
        let generatedText = [...words];

        // Générer jusqu'à atteindre la longueur max ou ne plus avoir de transitions
        for (let i = 0; i < maxLength - this.order; i++) {
            const state = generatedText.slice(-this.order).join(" ");
            const transitions = this.chain.get(state);

            if (!transitions || transitions.size === 0) break;

            const nextWord = this.weightedRandom(transitions);
            generatedText.push(nextWord);

            // Pour les messages courts/informels, arrêter plus tôt et plus naturellement
            // Arrêter si on trouve une fin de phrase naturelle OU si message assez long
            if (nextWord.match(/[.!?]$/)) {
                // Pour messages informels, accepter phrases courtes (>5 mots au lieu de 10)
                if (generatedText.length > 5) {
                    break;
                }
            }

            // Arrêter aussi si le message devient trop long pour du contenu informel
            if (generatedText.length > 30) {
                break;
            }
        }

        let result = generatedText.join(" ");

        // Si le résultat est trop court, on réessaye une fois
        if (result.split(" ").length < 3 && this.chain.size > 0) {
            const newState = this.getRandomState();
            const retryWords = newState.split(" ");
            result = [...retryWords, ...generatedText.slice(this.order)].join(" ");
        }

        return result;
    }

    /**
     * Sauvegarde le modèle sur disque
     */
    public saveToDisk(): void {
        try {
            const dataDir = path.dirname(this.dataPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, {recursive: true});
            }

            // Convertir Map en objet pour JSON
            const data: any = {};
            for (const [state, transitions] of this.chain) {
                data[state] = Object.fromEntries(transitions);
            }

            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
            console.log(`[Klodovik] Modèle sauvegardé : ${this.chain.size} états`);
        } catch (error) {
            console.error("[Klodovik] Erreur lors de la sauvegarde du modèle:", error);
        }
    }

    /**
     * Obtient les statistiques du modèle
     */
    public getStats(): { states: number; totalTransitions: number } {
        let totalTransitions = 0;
        for (const transitions of this.chain.values()) {
            for (const count of transitions.values()) {
                totalTransitions += count;
            }
        }

        return {
            states: this.chain.size,
            totalTransitions
        };
    }

    /**
     * Réinitialise le modèle
     */
    public reset(): void {
        this.chain.clear();
        if (fs.existsSync(this.dataPath)) {
            fs.unlinkSync(this.dataPath);
        }
        console.log("[Klodovik] Modèle réinitialisé");
    }

    /**
     * Nettoie le texte (enlève URLs, emojis custom, etc.)
     * Adapté pour les messages informels et courts
     * [MODIFICATION] Garde maintenant les mentions d'utilisateurs pour que le bot puisse ping
     */
    private cleanText(text: string): string {
        let cleaned = text
            // Enlever les URLs
            .replace(/https?:\/\/\S+/g, "")
            // ✅ GARDER les mentions d'utilisateurs <@!?123456> pour que le bot puisse ping
            // .replace(/<@!?\d+>/g, "") // ← COMMENTÉ : On garde les mentions !
            // Enlever les emojis custom Discord
            .replace(/<a?:\w+:\d+>/g, "")
            // Enlever les canaux (on garde pas les mentions de canaux)
            .replace(/<#\d+>/g, "")
            // Enlever les rôles (on garde pas les mentions de rôles pour éviter les pings @everyone)
            .replace(/<@&\d+>/g, "")
            // Enlever les emojis Unicode (optionnel, mais garde les émotions textuelles)
            // On garde :) :( :D etc. mais enlève les vrais emojis Unicode
            .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Emoticons
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, "") // Symboles & pictographes
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport & map
            .replace(/[\u{2600}-\u{26FF}]/gu, "")   // Symboles divers
            .replace(/[\u{2700}-\u{27BF}]/gu, "")   // Dingbats
            // Normaliser les espaces multiples
            .replace(/\s+/g, " ")
            .trim();

        // Pour les messages très courts, garder même les abréviations
        // Exemple: "mdr", "ptdr", "jsp", "oklm" sont valides
        // Et maintenant : <@123456> est aussi gardé !

        return cleaned;
    }

    /**
     * Choisit un état de départ aléatoire (préférence pour début de phrase)
     * Adapté pour les messages informels
     */
    private getRandomState(): string {
        const states = Array.from(this.chain.keys()).filter(s => s !== "_START_");

        if (states.length === 0) {
            // Si seulement _START_ existe, l'utiliser
            return "_START_";
        }

        // Pour les messages informels, la casse est moins importante
        // 70% du temps, prendre un état aléatoire
        // 30% du temps, essayer de trouver un début avec majuscule
        if (Math.random() < 0.7) {
            return states[Math.floor(Math.random() * states.length)];
        }

        // Essayer de trouver un état qui commence par une majuscule
        const sentenceStarts = states.filter(s => /^[A-Z]/.test(s));

        if (sentenceStarts.length > 0) {
            return sentenceStarts[Math.floor(Math.random() * sentenceStarts.length)];
        }

        return states[Math.floor(Math.random() * states.length)];
    }

    /**
     * Sélection pondérée aléatoire
     */
    private weightedRandom(transitions: Map<string, number>): string {
        const total = Array.from(transitions.values()).reduce((sum, count) => sum + count, 0);
        let random = Math.random() * total;

        for (const [word, count] of transitions) {
            random -= count;
            if (random <= 0) {
                return word;
            }
        }

        // Fallback
        return Array.from(transitions.keys())[0];
    }

    /**
     * Charge le modèle depuis le disque
     */
    private loadFromDisk(): void {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));

                this.chain.clear();
                for (const [state, transitions] of Object.entries(data)) {
                    this.chain.set(state, new Map(Object.entries(transitions as any)));
                }

                console.log(`[Klodovik] Modèle chargé : ${this.chain.size} états`);
            } else {
                console.log("[Klodovik] Aucun modèle existant, démarrage avec un modèle vide");
            }
        } catch (error) {
            console.error("[Klodovik] Erreur lors du chargement du modèle:", error);
        }
    }
}

