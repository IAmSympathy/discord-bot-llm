import {MemoryTurn} from "../memory/fileMemory";
import {WebContext} from "../services/searchService";

/**
 * Formate un tour de mémoire pour l'historique
 */
function formatMemoryTurn(turn: MemoryTurn): string {
    const imageContext = turn.imageDescriptions?.length ? `\n[Images décrites]:\n- ${turn.imageDescriptions.join("\n- ")}` : "";
    const webContextBlock = turn.webContext ? `\n[Contexte factuel précédemment vérifié : ${turn.webContext.facts.join(" | ")}]` : "";
    const reactionContext = turn.assistantReactions?.length ? `\n[NOTE SYSTÈME - Tu as appliqué ces réactions emoji: ${turn.assistantReactions.join(" ")}]` : "";
    const date = new Date(turn.ts);

    return `UTILISATEUR "${turn.displayName}" (UID: ${turn.discordUid}):
[Date locale fr-CA: ${date.toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })}]
[Heure locale fr-CA: ${date.toLocaleTimeString("fr-CA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}]
Message:
${turn.userText}${imageContext}

TOI (Netricsa):
${turn.assistantText}${reactionContext}`;
}

/**
 * Construit le bloc d'historique de conversation
 */
export function buildHistoryBlock(recentTurns: MemoryTurn[]): string {
    if (recentTurns.length === 0) return "";

    const formattedTurns = recentTurns.map(formatMemoryTurn).join("\n\n--- Échange suivant ---\n\n");
    return `=== HISTORIQUE ===

${formattedTurns}

=== FIN HISTORIQUE ===`;
}

/**
 * Construit le bloc de message actuel de l'utilisateur
 */
export function buildCurrentUserBlock(userId: string, userName: string, prompt: string, imageDescriptions: string[]): string {
    const currentTs = Date.now();
    const currentDate = new Date(currentTs);
    const imageContext = imageDescriptions.length > 0 ? `\n[Images fournies par l'utilisateur, description générée automatiquement par Netricsa]:\n- ${imageDescriptions.join("\n- ")}` : "";

    return `
=== MESSAGE ACTUEL ===
UTILISATEUR "${userName}" (UID Discord: ${userId}):
[Date locale fr-CA: ${currentDate.toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })}]
[Heure locale fr-CA: ${currentDate.toLocaleTimeString("fr-CA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}]

Message:
${prompt}
=== FIN MESSAGE ACTUEL ===
[RAPPEL: Fais attention aux pronoms comme "il", "elle", "iel" dans le MESSAGE ACTUEL - ils peuvent faire référence à un autre utilisateur mentionné dans l'HISTORIQUE ci-dessus. Vérifie les noms d'utilisateurs et UIDs pour comprendre de qui il s'agit.]
[RAPPEL: Si tu veux mentionner un utilisateur utilise exactement: <@UID>. Ne mentionne pas l'utilisateur du MESSAGE ACTUEL si ce n'est pas pertinent.]
${imageContext}`;
}

/**
 * Construit le bloc de contexte web
 */
export function buildWebContextBlock(webContext: WebContext | null): string {
    if (!webContext) return "";

    return `=== CONTEXTE FACTUEL ===
Requête utilisée: ${webContext.query}
Faits vérifiés:
- ${webContext.facts.join("\n- ")}
=== FIN CONTEXTE FACTUEL ===

`;
}
