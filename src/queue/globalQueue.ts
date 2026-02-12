import {createLogger} from "../utils/logger";

const logger = createLogger("GlobalQueue");

// ===== QUEUE GLOBALE UNIQUE POUR TOUTES LES OPÉRATIONS =====
// Toutes les opérations gourmandes en ressources (LLM, génération d'images, upscale)
// passent par cette queue unique pour éviter la surcharge

type AsyncJob<T> = () => Promise<T>;
let globalQueue: Promise<unknown> = Promise.resolve();

// Map pour tracker les utilisateurs actuellement dans la queue
const usersInQueue = new Map<string, {
    type: 'llm' | 'imagine' | 'reimagine' | 'upscale' | 'ask-netricsa';
    startTime: number;
}>();

// Map pour tracker les opérations actives et permettre l'annulation
const activeOperations = new Map<string, {
    type: 'llm' | 'imagine' | 'reimagine' | 'upscale' | 'ask-netricsa';
    userId: string;
    channelId: string;
    abortFlag: boolean;
    startTime: number;
}>();

/**
 * Ajoute une tâche à la queue globale unique
 * Garantit que toutes les requêtes sont traitées séquentiellement
 */
export function enqueueGlobally<T>(job: AsyncJob<T>): Promise<T> {
    const prev = globalQueue;

    const next = prev
        .catch(() => {
            // Avaler les erreurs du job précédent pour ne pas bloquer la file
        })
        .then(job);

    globalQueue = next.catch(() => {
        // Capturer les erreurs pour ne pas casser la chaîne
    });

    return next;
}

/**
 * Vérifie si un utilisateur est déjà dans la queue
 */
export function isUserInQueue(userId: string): boolean {
    return usersInQueue.has(userId);
}

/**
 * Récupère le type d'opération d'un utilisateur dans la queue
 */
export function getUserQueueOperation(userId: string): string | null {
    const operation = usersInQueue.get(userId);
    return operation ? operation.type : null;
}

/**
 * Ajoute un utilisateur à la queue
 */
export function addUserToQueue(userId: string, type: 'llm' | 'imagine' | 'reimagine' | 'upscale' | 'ask-netricsa'): void {
    usersInQueue.set(userId, {type, startTime: Date.now()});
    logger.info(`User ${userId} added to queue (${type}). Queue size: ${usersInQueue.size}`);
}

/**
 * Retire un utilisateur de la queue
 */
export function removeUserFromQueue(userId: string): void {
    const operation = usersInQueue.get(userId);
    if (operation) {
        const duration = Date.now() - operation.startTime;
        logger.info(`User ${userId} removed from queue (${operation.type}, duration: ${duration}ms). Queue size: ${usersInQueue.size - 1}`);
    }
    usersInQueue.delete(userId);
}

/**
 * Enregistre une opération active
 */
export function registerActiveOperation(
    operationId: string,
    type: 'llm' | 'imagine' | 'reimagine' | 'upscale' | 'ask-netricsa',
    userId: string,
    channelId: string
): void {
    activeOperations.set(operationId, {
        type,
        userId,
        channelId,
        abortFlag: false,
        startTime: Date.now()
    });
    logger.info(`Operation ${operationId} registered (${type}) for user ${userId}`);
}

/**
 * Désenregistre une opération active
 */
export function unregisterActiveOperation(operationId: string): void {
    const operation = activeOperations.get(operationId);
    if (operation) {
        const duration = Date.now() - operation.startTime;
        logger.info(`Operation ${operationId} unregistered (${operation.type}, duration: ${duration}ms)`);
    }
    activeOperations.delete(operationId);
}

/**
 * Vérifie si une opération a été annulée
 */
export function isOperationAborted(operationId: string): boolean {
    const operation = activeOperations.get(operationId);
    return operation ? operation.abortFlag : false;
}

/**
 * Annule une opération pour un utilisateur spécifique
 */
export function abortUserOperation(userId: string): boolean {
    for (const [operationId, operation] of activeOperations.entries()) {
        if (operation.userId === userId) {
            operation.abortFlag = true;
            logger.info(`Operation ${operationId} aborted for user ${userId}`);
            return true;
        }
    }
    return false;
}

/**
 * Annule toutes les opérations dans un canal (pour admins)
 */
export function abortChannelOperations(channelId: string, requestingUserId?: string, isAdminOrOwner: boolean = false): boolean {
    let aborted = false;

    for (const [operationId, operation] of activeOperations.entries()) {
        if (operation.channelId === channelId) {
            // Vérifier les permissions
            if (!isAdminOrOwner && requestingUserId && operation.userId !== requestingUserId) {
                continue;
            }

            operation.abortFlag = true;
            logger.info(`Operation ${operationId} (${operation.type}) aborted in channel ${channelId}`);
            aborted = true;
        }
    }

    return aborted;
}

/**
 * Récupère les statistiques de la queue
 */
export function getQueueStats(): {
    queueSize: number;
    activeOperations: number;
    operations: Array<{ type: string; userId: string; duration: number }>;
} {
    const operations = Array.from(usersInQueue.entries()).map(([userId, op]) => ({
        type: op.type,
        userId,
        duration: Date.now() - op.startTime
    }));

    return {
        queueSize: usersInQueue.size,
        activeOperations: activeOperations.size,
        operations
    };
}

