import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {AttachmentBuilder} from "discord.js";

const logger = createLogger("LevelUpImages");

const ASSETS_DIR = path.join(process.cwd(), "assets", "levelup");
const LEVELUP_DIR = path.join(ASSETS_DIR, "levelup");
const ROLEUP_DIR = path.join(ASSETS_DIR, "roleup");

// S'assurer que les dossiers existent
if (!fs.existsSync(LEVELUP_DIR)) {
    fs.mkdirSync(LEVELUP_DIR, {recursive: true});
}
if (!fs.existsSync(ROLEUP_DIR)) {
    fs.mkdirSync(ROLEUP_DIR, {recursive: true});
}

/**
 * Récupère l'image de level up pour un niveau donné
 * Utilise les images de roleup pour tous les level ups (même logique)
 *
 * @param level - Le niveau atteint
 * @param roleName - (Optionnel) Le nom du rôle actuel (HATCHLING, JUVENILE, ADULT, SOLDIER, ELITE, COMMANDO)
 * @returns AttachmentBuilder ou null si aucune image disponible
 */
export function getLevelUpImage(level: number, roleName?: string): AttachmentBuilder | null {
    // Utiliser la même image que pour les role ups
    if (roleName) {
        return getRoleUpImage(roleName);
    }

    logger.warn(`No role name provided for level ${level}, cannot get level up image`);
    return null;
}

/**
 * Récupère l'image de role up pour un rôle donné
 *
 * @param roleName - Le nom du rôle (HATCHLING, JUVENILE, ADULT, SOLDIER, ELITE, COMMANDO)
 * @returns AttachmentBuilder ou null si aucune image disponible
 */
export function getRoleUpImage(roleName: string): AttachmentBuilder | null {
    try {
        const roleNameLower = roleName.toLowerCase();
        const specificImagePath = path.join(ROLEUP_DIR, `role_${roleNameLower}.png`);

        if (fs.existsSync(specificImagePath)) {
            logger.info(`Using specific role up image for ${roleName}`);
            return new AttachmentBuilder(specificImagePath, {name: `role_${roleNameLower}.png`});
        }

        // Sinon, chercher l'image par défaut
        const defaultImagePath = path.join(ASSETS_DIR, "default_roleup.png");

        if (fs.existsSync(defaultImagePath)) {
            logger.info(`Using default role up image for ${roleName}`);
            return new AttachmentBuilder(defaultImagePath, {name: "default_roleup.png"});
        }

        logger.warn(`No role up image found for ${roleName}`);
        return null;

    } catch (error) {
        logger.error(`Error loading role up image for ${roleName}:`, error);
        return null;
    }
}

/**
 * Vérifie si une image de level up existe pour un niveau donné
 *
 * @param level - Le niveau à vérifier
 * @param roleName - (Optionnel) Le nom du rôle à vérifier
 * @returns true si une image existe (utilise hasRoleUpImage)
 */
export function hasLevelUpImage(level: number, roleName?: string): boolean {
    if (roleName) {
        return hasRoleUpImage(roleName);
    }
    return false;
}

/**
 * Vérifie si une image de role up existe pour un rôle donné
 *
 * @param roleName - Le nom du rôle à vérifier
 * @returns true si une image existe (spécifique ou par défaut)
 */
export function hasRoleUpImage(roleName: string): boolean {
    const roleNameLower = roleName.toLowerCase();
    const specificImagePath = path.join(ROLEUP_DIR, `role_${roleNameLower}.png`);
    const defaultImagePath = path.join(ASSETS_DIR, "default_roleup.png");

    return fs.existsSync(specificImagePath) || fs.existsSync(defaultImagePath);
}

/**
 * Liste toutes les images de level up disponibles
 * (Retourne les images de role up car elles sont utilisées pour les level ups)
 *
 * @returns Liste des rôles pour lesquels des images existent
 */
export function listAvailableLevelUpImages(): string[] {
    return listAvailableRoleUpImages();
}

/**
 * Liste toutes les images de role up disponibles
 *
 * @returns Liste des rôles pour lesquels des images existent
 */
export function listAvailableRoleUpImages(): string[] {
    const roles: string[] = [];

    if (!fs.existsSync(ROLEUP_DIR)) {
        return roles;
    }

    const files = fs.readdirSync(ROLEUP_DIR);

    for (const file of files) {
        const match = file.match(/^role_(\w+)\.png$/);
        if (match) {
            roles.push(match[1].toUpperCase());
        }
    }

    return roles;
}
