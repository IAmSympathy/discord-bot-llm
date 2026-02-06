import {Guild} from "discord.js";
import {LEVEL_ROLES, LEVEL_THRESHOLDS} from "../utils/constants";
import {createLogger} from "../utils/logger";

const logger = createLogger("LevelRoleService");

/**
 * Détermine quel rôle de niveau un utilisateur devrait avoir selon son niveau
 */
export function getLevelRoleForLevel(level: number): { roleKey: string; roleName: string } | null {
    // Parcourir les seuils du plus haut au plus bas
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        const threshold = LEVEL_THRESHOLDS[i];
        if (level >= threshold.level) {
            return {
                roleKey: threshold.role,
                roleName: threshold.name
            };
        }
    }
    return null;
}

/**
 * Détermine le prochain rôle de niveau et combien de niveaux manquent
 */
export function getNextLevelRole(level: number): { roleName: string; roleId: string; levelsNeeded: number } | null {
    for (const threshold of LEVEL_THRESHOLDS) {
        if (level < threshold.level) {
            const roleId = LEVEL_ROLES[threshold.role as keyof typeof LEVEL_ROLES];
            return {
                roleName: threshold.name,
                roleId: roleId,
                levelsNeeded: threshold.level - level
            };
        }
    }
    return null; // Déjà au niveau max
}

/**
 * Récupère tous les IDs de rôles de niveau
 */
function getAllLevelRoleIds(): string[] {
    return Object.values(LEVEL_ROLES);
}

/**
 * Met à jour les rôles de niveau d'un utilisateur
 * @returns true si un changement de rôle a eu lieu
 */
export async function updateUserLevelRoles(
    guild: Guild,
    userId: string,
    newLevel: number
): Promise<{ changed: boolean; newRole?: string; oldRole?: string; skipped?: 'bot' | 'left' }> {
    try {
        const member = await guild.members.fetch(userId).catch((error) => {
            // Ignorer l'erreur si le membre n'existe plus (a quitté le serveur)
            // 10007 = Unknown Member, 10013 = Unknown User
            if (error.code === 10007 || error.code === 10013) {
                logger.debug(`User ${userId} no longer in guild (left server or unknown user)`);
                return null;
            }
            throw error;
        });

        if (!member) {
            return {changed: false, skipped: 'left'};
        }

        // Ne pas attribuer de rôles aux bots
        if (member.user.bot) {
            logger.debug(`Skipping level role update for bot ${member.user.username}`);
            return {changed: false, skipped: 'bot'};
        }

        const targetLevelRole = getLevelRoleForLevel(newLevel);
        if (!targetLevelRole) {
            logger.warn(`No level role found for level ${newLevel}`);
            return {changed: false};
        }

        const targetRoleId = LEVEL_ROLES[targetLevelRole.roleKey as keyof typeof LEVEL_ROLES];

        // Vérifier si l'utilisateur a déjà le bon rôle
        const hasTargetRole = member.roles.cache.has(targetRoleId);

        // Trouver les rôles de niveau actuels de l'utilisateur
        const allLevelRoleIds = getAllLevelRoleIds();
        const currentLevelRoles = member.roles.cache.filter(role =>
            allLevelRoleIds.includes(role.id)
        );

        let oldRoleName: string | undefined = undefined;
        let changed = false;

        // Retirer tous les anciens rôles de niveau
        for (const role of currentLevelRoles.values()) {
            if (role.id !== targetRoleId) {
                await member.roles.remove(role);
                oldRoleName = role.name;
                changed = true;
                logger.info(`Removed level role ${role.name} from ${member.user.username}`);
            }
        }

        // Ajouter le nouveau rôle si pas déjà présent
        if (!hasTargetRole) {
            await member.roles.add(targetRoleId);
            changed = true;
            logger.info(`Added level role ${targetLevelRole.roleName} to ${member.user.username}`);
        }

        return {
            changed,
            newRole: changed ? targetLevelRole.roleName : undefined,
            oldRole: oldRoleName
        };

    } catch (error) {
        logger.error(`Error updating level roles for user ${userId}:`, error);
        return {changed: false};
    }
}

/**
 * Initialise les rôles de niveau pour tous les utilisateurs au démarrage
 */
export async function initializeLevelRolesForGuild(guild: Guild, allXP: { [userId: string]: { level: number } }): Promise<void> {
    logger.info(`Initializing level roles for guild ${guild.name}...`);

    let updated = 0;
    let skippedBots = 0;
    let skippedLeft = 0;

    for (const [userId, xpData] of Object.entries(allXP)) {
        const result = await updateUserLevelRoles(guild, userId, xpData.level);

        if (result.changed) {
            updated++;
        } else if (result.skipped === 'bot') {
            skippedBots++;
        } else if (result.skipped === 'left') {
            skippedLeft++;
        }
    }

    logger.info(`Level roles initialized: ${updated} users updated, ${skippedBots} bots skipped, ${skippedLeft} users left`);
}
