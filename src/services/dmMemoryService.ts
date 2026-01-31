import {FileMemory, MemoryTurn} from "../memory/fileMemory";
import {MEMORY_MAX_TURNS} from "../utils/constants";
import * as path from "path";

/**
 * Service pour gérer la mémoire des conversations en DM
 * Chaque utilisateur a sa propre mémoire isolée
 */

const DM_MEMORY_DIR = "./data/dm_memories";
const dmMemories = new Map<string, FileMemory>();

/**
 * Récupère l'instance de mémoire pour un utilisateur spécifique
 */
export function getDMMemory(userId: string): FileMemory {
    if (!dmMemories.has(userId)) {
        const memoryPath = path.join(DM_MEMORY_DIR, `${userId}.json`);
        dmMemories.set(userId, new FileMemory(memoryPath));
    }
    return dmMemories.get(userId)!;
}

/**
 * Récupère les tours récents d'une conversation DM
 */
export async function getDMRecentTurns(userId: string, limit: number): Promise<MemoryTurn[]> {
    const memory = getDMMemory(userId);
    return await memory.getRecentTurns(limit);
}

/**
 * Ajoute un tour à la mémoire DM d'un utilisateur
 */
export async function appendDMTurn(userId: string, turn: MemoryTurn): Promise<void> {
    const memory = getDMMemory(userId);
    await memory.appendTurn(turn, MEMORY_MAX_TURNS);
}

/**
 * Efface toute la mémoire DM d'un utilisateur
 */
export async function clearDMMemory(userId: string): Promise<void> {
    const memory = getDMMemory(userId);
    await memory.clearAll();
    console.log(`[DMMemory] Cleared DM memory for user ${userId}`);
}

/**
 * Vérifie si un utilisateur a une mémoire DM existante
 */
export function hasDMMemory(userId: string): boolean {
    return dmMemories.has(userId);
}
