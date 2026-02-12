/**
 * Gestionnaire des générations d'images en cours
 * Permet de tracker et d'annuler les générations d'images et upscaling
 */

import * as fs from "fs";
import * as path from "path";

interface ImageGeneration {
    userId: string;
    channelId: string;
    type: "imagine" | "upscale";
    animationInterval?: NodeJS.Timeout;
    startTime: number;
    jobId?: string; // Job ID Python pour annulation
}

// URL du microservice Python
const IMAGE_API_URL = process.env.IMAGE_API_URL || "http://mabite:8000";

// Map pour stocker les générations en cours : clé = userId
const activeGenerations = new Map<string, ImageGeneration>();

/**
 * Enregistre une génération en cours
 */
export function registerImageGeneration(
    userId: string,
    channelId: string,
    type: "imagine" | "upscale",
    animationInterval?: NodeJS.Timeout
): void {
    activeGenerations.set(userId, {
        userId,
        channelId,
        type,
        animationInterval,
        startTime: Date.now()
    });
}

/**
 * Met à jour le job ID d'une génération en cours
 */
export function updateJobId(userId: string, jobId: string): void {
    const generation = activeGenerations.get(userId);
    if (generation) {
        generation.jobId = jobId;
    }
}

/**
 * Annule une génération en cours pour un utilisateur
 * @returns true si une génération a été annulée
 */
export function abortImageGeneration(userId: string): boolean {
    const generation = activeGenerations.get(userId);

    if (!generation) {
        return false;
    }

    console.log(`[ImageGeneration] Aborting generation for user ${userId}, jobId: ${generation.jobId}`);

    // Annuler le job Python
    if (generation.jobId) {
        // Si on a un job_id spécifique, l'annuler
        console.log(`[ImageGeneration] Cancelling specific job: ${generation.jobId}`);
        fetch(`${IMAGE_API_URL}/cancel/${generation.jobId}`, {
            method: "POST"
        })
            .then(res => res.json())
            .then(data => console.log(`[ImageGeneration] Cancel response:`, data))
            .catch(err => {
                console.error(`[ImageGeneration] Failed to cancel Python job ${generation.jobId}:`, err);
            });
    } else {
        // Si on n'a pas encore de job_id, créer directement le fichier de flag
        // car l'API Python est bloquée et ne peut pas traiter les requêtes HTTP
        console.log(`[ImageGeneration] No job_id yet, creating cancel flag file directly`);

        try {
            const cancelFlagsDir = path.join(process.cwd(), "python_services", "cancel_flags");

            // Créer le dossier s'il n'existe pas
            if (!fs.existsSync(cancelFlagsDir)) {
                fs.mkdirSync(cancelFlagsDir, {recursive: true});
            }

            // Créer le fichier de flag
            const flagFilePath = path.join(cancelFlagsDir, "cancel_all_generate.flag");
            fs.writeFileSync(flagFilePath, "cancelled", "utf8");

            console.log(`[ImageGeneration] Created cancel flag file: ${flagFilePath}`);
        } catch (err) {
            console.error(`[ImageGeneration] Failed to create cancel flag file:`, err);
        }
    }

    // Arrêter l'animation si elle existe
    if (generation.animationInterval) {
        clearInterval(generation.animationInterval);
    }

    // Retirer de la map
    activeGenerations.delete(userId);

    console.log(`[ImageGeneration] Aborted ${generation.type} for user ${userId}`);
    return true;
}

/**
 * Annule une génération en cours pour un canal
 * @returns true si une génération a été annulée
 */
export function abortImageGenerationByChannel(channelId: string, requestingUserId?: string, isAdminOrOwner: boolean = false): boolean {
    let aborted = false;

    console.log(`[ImageGeneration] Attempting to abort in channel ${channelId}, requesting user: ${requestingUserId}, isAdmin: ${isAdminOrOwner}`);
    console.log(`[ImageGeneration] Active generations:`, Array.from(activeGenerations.entries()).map(([uid, gen]) => ({
        userId: uid,
        channelId: gen.channelId,
        type: gen.type,
        hasJobId: !!gen.jobId
    })));

    for (const [userId, generation] of activeGenerations.entries()) {
        if (generation.channelId === channelId) {
            console.log(`[ImageGeneration] Found generation for user ${userId} in channel ${channelId}`);

            // Vérifier si l'utilisateur a le droit d'arrêter cette génération
            if (!isAdminOrOwner && requestingUserId && generation.userId !== requestingUserId) {
                console.log(`[ImageGeneration] User ${requestingUserId} cannot abort generation from ${userId} (not admin/owner)`);
                continue; // Passer à la suivante
            }

            console.log(`[ImageGeneration] Aborting generation for user ${userId}, jobId: ${generation.jobId}`);

            // Annuler le job Python
            if (generation.jobId) {
                // Si on a un job_id spécifique, l'annuler
                console.log(`[ImageGeneration] Cancelling specific job: ${generation.jobId}`);
                fetch(`${IMAGE_API_URL}/cancel/${generation.jobId}`, {
                    method: "POST"
                })
                    .then(res => res.json())
                    .then(data => console.log(`[ImageGeneration] Cancel response:`, data))
                    .catch(err => {
                        console.error(`[ImageGeneration] Failed to cancel Python job ${generation.jobId}:`, err);
                    });
            } else {
                // Si on n'a pas encore de job_id, créer directement le fichier de flag
                console.log(`[ImageGeneration] No job_id yet, creating cancel flag file directly`);

                try {
                    const cancelFlagsDir = path.join(process.cwd(), "python_services", "cancel_flags");

                    // Créer le dossier s'il n'existe pas
                    if (!fs.existsSync(cancelFlagsDir)) {
                        fs.mkdirSync(cancelFlagsDir, {recursive: true});
                    }

                    // Créer le fichier de flag
                    const flagFilePath = path.join(cancelFlagsDir, "cancel_all_generate.flag");
                    fs.writeFileSync(flagFilePath, "cancelled", "utf8");

                    console.log(`[ImageGeneration] Created cancel flag file: ${flagFilePath}`);
                } catch (err) {
                    console.error(`[ImageGeneration] Failed to create cancel flag file:`, err);
                }
            }

            // Arrêter l'animation
            if (generation.animationInterval) {
                clearInterval(generation.animationInterval);
            }

            // Retirer de la map
            activeGenerations.delete(userId);
            aborted = true;

            console.log(`[ImageGeneration] Aborted ${generation.type} for user ${userId} in channel ${channelId}`);
        }
    }

    if (!aborted) {
        console.log(`[ImageGeneration] No generation found to abort in channel ${channelId}`);
    }

    return aborted;
}

/**
 * Désenregistre une génération terminée
 */
export function unregisterImageGeneration(userId: string): void {
    const generation = activeGenerations.get(userId);

    if (generation) {
        // Arrêter l'animation si elle existe encore
        if (generation.animationInterval) {
            clearInterval(generation.animationInterval);
        }

        activeGenerations.delete(userId);
    }
}

/**
 * Vérifie si un utilisateur a une génération en cours
 */
export function hasActiveGeneration(userId: string): boolean {
    return activeGenerations.has(userId);
}

/**
 * Obtient les informations d'une génération en cours
 */
export function getActiveGeneration(userId: string): ImageGeneration | undefined {
    return activeGenerations.get(userId);
}

/**
 * Obtient le nombre de générations en cours
 */
export function getActiveGenerationsCount(): number {
    return activeGenerations.size;
}
