import {GuildMember} from "discord.js";

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
    const ALLOWED_ROLES = ["1122751212299767929", "1129445913123880960", "829521404214640671", "828652861218226196"];
    return hasAnyRole(member, ALLOWED_ROLES);
}

/**
 * Vérifie si un membre a les permissions de propriétaire
 */
export function hasOwnerPermission(member: GuildMember | null): boolean {
    const OWNER_ROLES = ["1122751212299767929", "1129445913123880960"];
    return hasAnyRole(member, OWNER_ROLES);
}
