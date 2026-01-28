import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";

const PROFILES_DIR = join(process.cwd(), "data", "profiles");
// Système de locking pour éviter les race conditions lors des écritures parallèles
const profileLocks = new Map<string, Promise<void>>();

async function withLock<T>(userId: string, operation: () => Promise<T> | T): Promise<T> {
    // Attendre que le lock précédent soit libéré
    const existingLock = profileLocks.get(userId);
    if (existingLock) {
        await existingLock.catch(() => {
        }); // Ignorer les erreurs du lock précédent
    }

    // Créer un nouveau lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });
    profileLocks.set(userId, lockPromise);

    try {
        // Exécuter l'opération
        return await operation();
    } finally {
        // Libérer le lock
        releaseLock!();
        // Nettoyer si c'est toujours notre lock
        if (profileLocks.get(userId) === lockPromise) {
            profileLocks.delete(userId);
        }
    }
}

export interface UserFact {
    id: string;
    content: string; // ex: "Préfère TypeScript à JavaScript"
    context: string; // Contexte de découverte
    confidence: number; // 0-1, niveau de certitude (0.5 = tier, 1.0 = auto-déclaré)
    importance: number; // 0-10, score d'importance (calculé automatiquement)
    source: "self" | "other" | "inferred"; // Source de l'information
    timestamp: Date;
    lastUpdated: Date;
}

export interface UserProfile {
    userId: string;
    username: string;
    personality: {
        traits: string[]; // ex: ["humoristique", "technique"]
        communicationStyle: string; // ex: "direct", "amical"
        interests: string[]; // ex: ["jeux vidéo", "programmation"]
    };
    facts: UserFact[];
    preferences: {
        language?: string;
        responseStyle?: string;
    };
    lastInteraction: Date;
}

/**
 * Service de gestion des profils utilisateurs
 * Permet d'enregistrer des informations persistantes sur chaque utilisateur
 */
export class UserProfileService {
    /**
     * Récupère le profil d'un utilisateur
     */
    static getProfile(userId: string): UserProfile | null {
        this.ensureDirectoryExists();
        const filePath = join(PROFILES_DIR, `${userId}.json`);

        if (!existsSync(filePath)) return null;

        try {
            const data = readFileSync(filePath, "utf-8");
            const profile = JSON.parse(data);
            // Reconvertir les dates
            profile.lastInteraction = new Date(profile.lastInteraction);
            profile.facts = profile.facts.map((f: any) => ({
                ...f,
                timestamp: new Date(f.timestamp),
                lastUpdated: new Date(f.lastUpdated),
                // Valeurs par défaut pour la rétrocompatibilité
                importance: f.importance ?? 5,
                source: f.source ?? "other",
            }));
            return profile;
        } catch (error) {
            console.error(`[UserProfile] Error reading profile for ${userId}:`, error);
            return null;
        }
    }

    /**
     * Sauvegarde le profil d'un utilisateur
     */
    static saveProfile(userId: string, profile: UserProfile): void {
        this.ensureDirectoryExists();
        const filePath = join(PROFILES_DIR, `${userId}.json`);

        try {
            writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
            console.log(`[UserProfile] ✅ Profile saved for ${profile.username} (${userId})`);
        } catch (error) {
            console.error(`[UserProfile] Error saving profile for ${userId}:`, error);
        }
    }

    /**
     * Crée un nouveau profil vide pour un utilisateur
     */
    static createProfile(userId: string, username: string): UserProfile {
        return {
            userId,
            username,
            personality: {traits: [], communicationStyle: "", interests: []},
            facts: [],
            preferences: {},
            lastInteraction: new Date(),
        };
    }

    /**
     * Ajoute un fait sur un utilisateur
     */
    static async addFact(
        userId: string,
        username: string,
        fact: string,
        context: string,
        confidence: number = 0.8,
        source: "self" | "other" | "inferred" = "other"
    ): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            // Mettre à jour le nom d'utilisateur si nécessaire
            profile.username = username;
            profile.lastInteraction = new Date();

            // Calculer l'importance
            const importance = this.calculateImportance(fact, confidence);

            // Vérifier si un fait similaire existe déjà (éviter les doublons)
            const existingFact = profile.facts.find((f) => f.content.toLowerCase() === fact.toLowerCase());

            if (existingFact) {
                // Mettre à jour le fait existant
                existingFact.context = context;
                // Augmenter la confiance si la nouvelle source est plus fiable
                if (source === "self" || (source === "other" && existingFact.source === "inferred")) {
                    existingFact.confidence = Math.max(existingFact.confidence, confidence);
                    existingFact.source = source;
                }
                existingFact.importance = Math.max(existingFact.importance, importance);
                existingFact.lastUpdated = new Date();
                console.log(`[UserProfile] 🔄 Updated fact for ${username}: "${fact}" [confidence: ${existingFact.confidence.toFixed(2)}, importance: ${existingFact.importance.toFixed(1)}, source: ${existingFact.source}]`);
            } else {
                // Ajouter un nouveau fait
                profile.facts.push({
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    content: fact,
                    context,
                    confidence,
                    importance,
                    source,
                    timestamp: new Date(),
                    lastUpdated: new Date(),
                });
                console.log(`[UserProfile] ➕ Added fact for ${username}: "${fact}" [confidence: ${confidence.toFixed(2)}, importance: ${importance.toFixed(1)}, source: ${source}]`);
            }

            this.saveProfile(userId, profile);
        });
    }

    /**
     * Met à jour un fait existant
     */
    static async updateFact(
        userId: string,
        username: string,
        oldFactPattern: string,
        newFact: string,
        confidence: number = 0.8,
        source: "self" | "other" | "inferred" = "other"
    ): Promise<boolean> {
        return withLock(userId, () => {
            const profile = this.getProfile(userId);

            if (!profile) {
                console.log(`[UserProfile] ⚠️ No profile found for ${username} to update fact`);
                return false;
            }

            // Utiliser le système de similarité pour trouver le meilleur match
            const factIndex = this.findBestMatch(oldFactPattern, profile.facts);

            if (factIndex === -1) {
                console.log(`[UserProfile] ⚠️ Fact not found for update: "${oldFactPattern}"`);
                return false;
            }

            const oldFact = profile.facts[factIndex];
            const importance = this.calculateImportance(newFact, confidence);

            // Mettre à jour le fait
            profile.facts[factIndex] = {
                ...oldFact,
                content: newFact,
                confidence: Math.max(oldFact.confidence, confidence),
                importance,
                source: source === "self" ? source : oldFact.source, // Garder la source la plus fiable
                lastUpdated: new Date(),
            };

            profile.lastInteraction = new Date();
            this.saveProfile(userId, profile);

            console.log(`[UserProfile] 🔄 Updated fact for ${username}: "${oldFact.content}" → "${newFact}" [confidence: ${confidence.toFixed(2)}, importance: ${importance.toFixed(1)}]`);
            return true;
        });
    }

    /**
     * Supprime un fait
     */
    static async removeFact(userId: string, username: string, factPattern: string): Promise<boolean> {
        return withLock(userId, () => {
            const profile = this.getProfile(userId);

            if (!profile) {
                console.log(`[UserProfile] ⚠️ No profile found for ${username} to remove fact`);
                return false;
            }

            // Utiliser le système de similarité pour trouver le meilleur match
            const factIndex = this.findBestMatch(factPattern, profile.facts);

            if (factIndex === -1) {
                console.log(`[UserProfile] ⚠️ Fact not found for removal: "${factPattern}"`);
                return false;
            }

            const removedFact = profile.facts[factIndex];
            profile.facts.splice(factIndex, 1);

            profile.lastInteraction = new Date();
            this.saveProfile(userId, profile);

            console.log(`[UserProfile] 🗑️ Removed fact for ${username}: "${removedFact.content}"`);
            return true;
        });
    }

    /**
     * Ajoute un trait de personnalité
     */
    static async addPersonalityTrait(userId: string, username: string, trait: string): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            profile.username = username;
            profile.lastInteraction = new Date();

            if (!profile.personality.traits.includes(trait)) {
                profile.personality.traits.push(trait);
                console.log(`[UserProfile] 🎭 Added personality trait for ${username}: "${trait}"`);
                this.saveProfile(userId, profile);
            }
        });
    }

    /**
     * Ajoute un centre d'intérêt
     */
    static async addInterest(userId: string, username: string, interest: string): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            profile.username = username;
            profile.lastInteraction = new Date();

            if (!profile.personality.interests.includes(interest)) {
                profile.personality.interests.push(interest);
                console.log(`[UserProfile] 💡 Added interest for ${username}: "${interest}"`);
                this.saveProfile(userId, profile);
            }
        });
    }

    /**
     * Définit le style de communication
     */
    static async setCommunicationStyle(userId: string, username: string, style: string): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            profile.username = username;
            profile.lastInteraction = new Date();
            profile.personality.communicationStyle = style;

            console.log(`[UserProfile] 💬 Set communication style for ${username}: "${style}"`);
            this.saveProfile(userId, profile);
        });
    }

    /**
     * Récupère un résumé formaté du profil pour l'injecter dans le contexte
     */
    static getProfileSummary(userId: string): string | null {
        const profile = this.getProfile(userId);
        if (!profile) return null;

        const lines: string[] = [];

        // Traits de personnalité
        if (profile.personality.traits.length > 0) {
            lines.push(`Personnalité: ${profile.personality.traits.join(", ")}`);
        }

        // Style de communication
        if (profile.personality.communicationStyle) {
            lines.push(`Style: ${profile.personality.communicationStyle}`);
        }

        // Intérêts
        if (profile.personality.interests.length > 0) {
            lines.push(`Intérêts: ${profile.personality.interests.join(", ")}`);
        }

        // Faits récents (max 8) triés par importance ET récence
        if (profile.facts.length > 0) {
            const recentFacts = profile.facts
                // Calculer un score combiné : importance + récence
                .map((f) => ({
                    fact: f,
                    score: f.importance + (Date.now() - f.lastUpdated.getTime() < 7 * 24 * 60 * 60 * 1000 ? 2 : 0), // Bonus si < 7 jours
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 8)
                .map((item) => item.fact);

            lines.push(`Faits connus:`);
            recentFacts.forEach((f) => {
                // Ajouter un indicateur de confiance si faible
                const confidenceTag = f.confidence < 0.7 ? " [?]" : "";
                lines.push(`- ${f.content}${confidenceTag}`);
            });
        }

        if (lines.length === 0) return null;

        return lines.join("\n");
    }

    /**
     * Récupère tous les profils (pour debug)
     */
    static getAllProfiles(): UserProfile[] {
        this.ensureDirectoryExists();

        const files = readdirSync(PROFILES_DIR).filter((f) => f.endsWith(".json"));
        const profiles: UserProfile[] = [];

        for (const file of files) {
            const userId = file.replace(".json", "");
            const profile = this.getProfile(userId);
            if (profile) profiles.push(profile);
        }

        return profiles;
    }

    /**
     * Supprime un profil
     */
    static deleteProfile(userId: string): boolean {
        this.ensureDirectoryExists();
        const filePath = join(PROFILES_DIR, `${userId}.json`);

        if (!existsSync(filePath)) return false;

        try {
            const {unlinkSync} = require("fs");
            unlinkSync(filePath);
            console.log(`[UserProfile] 🗑️ Profile deleted for ${userId}`);
            return true;
        } catch (error) {
            console.error(`[UserProfile] Error deleting profile for ${userId}:`, error);
            return false;
        }
    }

    /**
     * Supprime TOUS les profils utilisateurs
     */
    static deleteAllProfiles(): number {
        this.ensureDirectoryExists();

        try {
            const files = readdirSync(PROFILES_DIR);
            let deletedCount = 0;

            for (const file of files) {
                if (file.endsWith('.json') && !file.endsWith('.example')) {
                    const filePath = join(PROFILES_DIR, file);
                    try {
                        const {unlinkSync} = require("fs");
                        unlinkSync(filePath);
                        deletedCount++;
                    } catch (error) {
                        console.error(`[UserProfile] Error deleting profile ${file}:`, error);
                    }
                }
            }

            console.log(`[UserProfile] 🗑️ Deleted ${deletedCount} profile(s)`);
            return deletedCount;
        } catch (error) {
            console.error(`[UserProfile] Error deleting all profiles:`, error);
            return 0;
        }
    }

    /**
     * Calcule la similarité entre deux textes (0-1)
     */
    private static calculateSimilarity(searchTerm: string, factContent: string): number {
        const searchLower = searchTerm.toLowerCase().trim();
        const factLower = factContent.toLowerCase().trim();

        // Score 1 : Inclusion exacte (très fort)
        if (factLower.includes(searchLower) || searchLower.includes(factLower)) {
            return 1.0;
        }

        // Score 2 : Mots-clés communs
        const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 2); // Ignorer mots courts
        const factWords = factLower.split(/\s+/).filter((w) => w.length > 2);

        if (searchWords.length === 0 || factWords.length === 0) {
            return 0;
        }

        const commonWords = searchWords.filter((w) => factWords.some((fw) => fw.includes(w) || w.includes(fw)));

        // Ratio de mots communs
        const ratio = commonWords.length / Math.max(searchWords.length, factWords.length);

        return ratio;
    }

    /**
     * Trouve le meilleur fait correspondant à un pattern
     */
    private static findBestMatch(searchPattern: string, facts: UserFact[]): number {
        let bestIndex = -1;
        let bestScore = 0;

        facts.forEach((fact, index) => {
            const score = this.calculateSimilarity(searchPattern, fact.content);

            // Logs pour debugging
            if (score > 0.2) {
                console.log(`[UserProfile] Match candidate: "${fact.content}" (score: ${score.toFixed(2)})`);
            }

            if (score > bestScore && score > 0.4) {
                // Seuil minimum de 0.4
                bestScore = score;
                bestIndex = index;
            }
        });

        if (bestIndex !== -1) {
            console.log(`[UserProfile] Best match found: "${facts[bestIndex].content}" (score: ${bestScore.toFixed(2)})`);
        }

        return bestIndex;
    }

    /**
     * S'assure que le dossier profiles existe
     */
    private static ensureDirectoryExists(): void {
        if (!existsSync(PROFILES_DIR)) {
            mkdirSync(PROFILES_DIR, {recursive: true});
        }
    }

    /**
     * Calcule le score d'importance d'un fait (0-10)
     * Basé sur la longueur, les mots-clés importants, etc.
     */
    private static calculateImportance(fact: string, confidence: number): number {
        let score = 5; // Score de base

        // Bonus pour la longueur (plus de détails = plus important)
        if (fact.length > 50) score += 1;
        if (fact.length > 100) score += 1;

        // Bonus pour les mots-clés importants
        const importantKeywords = [
            "préfère",
            "aime",
            "déteste",
            "toujours",
            "jamais",
            "travaille",
            "joue",
            "étudie",
            "utilise",
            "développe",
            "crée",
            "niveau",
            "rank",
            "expert",
            "débutant",
        ];

        const lowerFact = fact.toLowerCase();
        importantKeywords.forEach((keyword) => {
            if (lowerFact.includes(keyword)) score += 0.5;
        });

        // Bonus pour la confiance
        score += confidence * 2;

        // Limiter entre 0 et 10
        return Math.min(10, Math.max(0, score));
    }
}

