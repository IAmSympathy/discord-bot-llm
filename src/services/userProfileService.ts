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
    timestamp: Date;
}

export interface UserProfile {
    userId: string;
    username: string;
    aliases: string[]; // Surnoms : ["Jérémy", "Jay", "MR.Fou"]
    interests: string[]; // Centres d'intérêt : ["jeux vidéo", "programmation"]
    roles: string[]; // Rôles Discord : ["Admin", "Modérateur"]
    facts: UserFact[];
    currentActivity?: {
        gameName: string;
        details?: string;
        timestamp: number;
    };
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
            if (profile.facts) {
                profile.facts = profile.facts.map((f: any) => ({
                    ...f,
                    timestamp: new Date(f.timestamp),
                }));
            }

            // Rétrocompatibilité : Initialiser les champs manquants pour les anciens profils
            if (!profile.aliases) profile.aliases = [];
            if (!profile.interests) profile.interests = [];
            if (!profile.roles) profile.roles = [];
            if (!profile.facts) profile.facts = [];

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
            aliases: [],
            interests: [],
            roles: [],
            facts: [],
        };
    }

    /**
     * Ajoute un fait sur un utilisateur
     */
    static async addFact(
        userId: string,
        username: string,
        fact: string
    ): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            // Mettre à jour le nom d'utilisateur si nécessaire
            profile.username = username;

            // Vérifier si un fait similaire existe déjà (éviter les doublons)
            const existingFact = profile.facts.find((f) => f.content.toLowerCase() === fact.toLowerCase());

            if (existingFact) {
                console.log(`[UserProfile] ⚠️ Fact already exists for ${username}: "${fact}"`);
            } else {
                // Ajouter un nouveau fait
                profile.facts.push({
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    content: fact,
                    timestamp: new Date(),
                });
                console.log(`[UserProfile] ➕ Added fact for ${username}: "${fact}"`);
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
        newFact: string
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

            // Mettre à jour le fait
            profile.facts[factIndex] = {
                ...oldFact,
                content: newFact,
            };

            this.saveProfile(userId, profile);

            console.log(`[UserProfile] 🔄 Updated fact for ${username}: "${oldFact.content}" → "${newFact}"`);
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

            this.saveProfile(userId, profile);

            console.log(`[UserProfile] 🗑️ Removed fact for ${username}: "${removedFact.content}"`);
            return true;
        });
    }

    /**
     * Ajoute un alias (surnom) à un utilisateur
     */
    static async addAlias(userId: string, username: string, alias: string): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            profile.username = username;

            if (!profile.aliases.includes(alias)) {
                profile.aliases.push(alias);
                console.log(`[UserProfile] 🏷️ Added alias for ${username}: "${alias}"`);
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

            if (!profile.interests.includes(interest)) {
                profile.interests.push(interest);
                console.log(`[UserProfile] 💡 Added interest for ${username}: "${interest}"`);
                this.saveProfile(userId, profile);
            }
        });
    }

    /**
     * Supprime un alias (surnom)
     */
    static async removeAlias(userId: string, username: string, alias: string): Promise<boolean> {
        return withLock(userId, () => {
            const profile = this.getProfile(userId);

            if (!profile) {
                console.log(`[UserProfile] ⚠️ No profile found for ${username} to remove alias`);
                return false;
            }

            // Recherche case insensitive
            const aliasLower = alias.toLowerCase();
            const index = profile.aliases.findIndex(a => a.toLowerCase() === aliasLower);
            if (index === -1) {
                console.log(`[UserProfile] ⚠️ Alias not found: "${alias}"`);
                return false;
            }

            const removedAlias = profile.aliases[index];
            profile.aliases.splice(index, 1);
            this.saveProfile(userId, profile);

            console.log(`[UserProfile] 🗑️ Removed alias for ${username}: "${removedAlias}"`);
            return true;
        });
    }

    /**
     * Supprime un centre d'intérêt
     */
    static async removeInterest(userId: string, username: string, interest: string): Promise<boolean> {
        return withLock(userId, () => {
            const profile = this.getProfile(userId);

            if (!profile) {
                console.log(`[UserProfile] ⚠️ No profile found for ${username} to remove interest`);
                return false;
            }

            // Recherche case insensitive
            const interestLower = interest.toLowerCase();
            const index = profile.interests.findIndex(i => i.toLowerCase() === interestLower);
            if (index === -1) {
                console.log(`[UserProfile] ⚠️ Interest not found: "${interest}"`);
                return false;
            }

            const removedInterest = profile.interests[index];
            profile.interests.splice(index, 1);
            this.saveProfile(userId, profile);

            console.log(`[UserProfile] 🗑️ Removed interest for ${username}: "${removedInterest}"`);
            return true;
        });
    }

    /**
     * Met à jour les rôles Discord d'un utilisateur
     * Cette fonction est appelée automatiquement quand l'IA voit un message
     */
    static async updateRoles(userId: string, username: string, roles: string[]): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            profile.username = username;
            profile.roles = roles;

            this.saveProfile(userId, profile);
        });
    }

    /**
     * Met à jour l'activité en cours d'un utilisateur (jeu joué)
     */
    static async updateActivity(userId: string, username: string, gameName: string | null, details?: string): Promise<void> {
        return withLock(userId, () => {
            let profile = this.getProfile(userId);

            if (!profile) {
                profile = this.createProfile(userId, username);
            }

            profile.username = username;

            if (gameName) {
                profile.currentActivity = {
                    gameName,
                    details,
                    timestamp: Date.now()
                };
                console.log(`[UserProfile] 🎮 ${username} is now playing ${gameName}`);
            } else {
                // Supprimer l'activité si null
                delete profile.currentActivity;
                console.log(`[UserProfile] 🎮 ${username} stopped playing`);
            }

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

        // Rôles Discord (avec vérification pour compatibilité ancien format)
        if (profile.roles && profile.roles.length > 0) {
            lines.push(`Rôles: ${profile.roles.join(", ")}`);
        }

        // Aliases (surnoms) (avec vérification pour compatibilité ancien format)
        if (profile.aliases && profile.aliases.length > 0) {
            lines.push(`Surnoms: ${profile.aliases.join(", ")}`);
        }

        // Activité en cours (jeu joué) - Vérifier que l'activité n'est pas trop ancienne (max 15 minutes)
        if (profile.currentActivity) {
            const activityAge = Date.now() - profile.currentActivity.timestamp;
            const maxAge = 15 * 60 * 1000; // 15 minutes

            if (activityAge < maxAge) {
                let activityText = `Joue actuellement à: ${profile.currentActivity.gameName}`;
                if (profile.currentActivity.details) {
                    activityText += ` (${profile.currentActivity.details})`;
                }
                lines.push(activityText);
            }
        }

        // Intérêts (avec vérification pour compatibilité ancien format)
        if (profile.interests && profile.interests.length > 0) {
            lines.push(`Intérêts: ${profile.interests.join(", ")}`);
        }

        // Faits récents (max 8) triés par date
        if (profile.facts && profile.facts.length > 0) {
            const recentFacts = profile.facts
                // Trier par date (les plus récents en premier)
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 8); // Garder les 8 plus récents

            lines.push(`Faits connus:`);
            recentFacts.forEach((f) => {
                lines.push(`- ${f.content}`);
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
            if (profile) {
                profiles.push(profile);
            }
        }

        return profiles;
    }

    /**
     * Supprime le profil d'un utilisateur
     */
    static deleteProfile(userId: string): boolean {
        this.ensureDirectoryExists();
        const filePath = join(PROFILES_DIR, `${userId}.json`);

        if (!existsSync(filePath)) return false;

        try {
            const fs = require("fs");
            fs.unlinkSync(filePath);
            console.log(`[UserProfile] 🗑️ Profile deleted for user ${userId}`);
            return true;
        } catch (error) {
            console.error(`[UserProfile] Error deleting profile for ${userId}:`, error);
            return false;
        }
    }

    /**
     * Trouve le meilleur match pour un pattern dans une liste de faits
     * Utilisé pour la recherche/suppression de faits
     */
    private static findBestMatch(pattern: string, facts: UserFact[]): number {
        const patternLower = pattern.toLowerCase();

        // D'abord chercher une correspondance exacte
        const exactMatch = facts.findIndex((f) => f.content.toLowerCase() === patternLower);
        if (exactMatch !== -1) return exactMatch;

        // Ensuite chercher si le pattern est contenu dans un fait
        const containsMatch = facts.findIndex((f) => f.content.toLowerCase().includes(patternLower));
        if (containsMatch !== -1) return containsMatch;

        // Enfin chercher si un fait est contenu dans le pattern
        const reverseMatch = facts.findIndex((f) => patternLower.includes(f.content.toLowerCase()));
        if (reverseMatch !== -1) return reverseMatch;

        return -1;
    }

    /**
     * S'assure que le répertoire des profils existe
     */
    private static ensureDirectoryExists(): void {
        if (!existsSync(PROFILES_DIR)) {
            mkdirSync(PROFILES_DIR, {recursive: true});
        }
    }
}

