import {GuildMember} from "discord.js";
import {ALLOWED_COMMAND_ROLES, OWNER_ROLES} from "./constants";

/**
 * Permissions pour les commandes slash Discord
 * Pour les commandes owner : utilisez null pour qu'elles soient invisibles par défaut
 * La vérification se fera manuellement par rôle dans execute()
 */
export const CommandPermissions = {
    OWNER_ONLY: null, // Invisible à tous - vérification manuelle par rôle owner requise
    MODERATOR_ONLY: null, // Invisible à tous - vérification manuelle par rôle modérateur requise
    PUBLIC: undefined // Visible par tous
} as const;

/**
 * Vérifie si un membre possède au moins un des rôles spécifiés
 */
export function hasAnyRole(member: GuildMember | null, roleIds: readonly string[]): boolean {
    if (!member) return false;
    return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Vérifie si un membre a les permissions de modérateur ou supérieur
 */
export function hasModeratorPermission(member: GuildMember | null): boolean {
    return hasAnyRole(member, ALLOWED_COMMAND_ROLES);
}

/**
 * Vérifie si un membre a les permissions de propriétaire
 */
export function hasOwnerPermission(member: GuildMember | null): boolean {
    return hasAnyRole(member, OWNER_ROLES);
}
