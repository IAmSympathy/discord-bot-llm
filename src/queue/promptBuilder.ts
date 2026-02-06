import {MemoryTurn} from "../memory/fileMemory";
import {WebContext} from "../services/searchService";
import {normalizeAccents} from "../utils/textTransformers";
import {createLogger} from "../utils/logger";

const logger = createLogger("PromptBuilder");

/**
 * Formate un tour de mémoire pour l'historique
 * SIMPLIFIÉ : Moins de métadonnées, focus sur le contenu
 */
function formatMemoryTurn(turn: MemoryTurn, showChannelHeader: boolean = false): string {
    const imageContext = turn.imageDescriptions?.length ? ` [Images: ${turn.imageDescriptions.join(", ")}]` : "";
    const reactionContext = turn.assistantReactions?.length ? ` [Réactions: ${turn.assistantReactions.join(" ")}]` : "";

    const channelHeader = showChannelHeader ? `📍 #${turn.channelName}\n` : "";

    // Âge simplifié (seulement si > 1 jour)
    const ageInMs = Date.now() - turn.ts;
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
    const ageNote = ageInDays > 1 ? ` [${ageInDays}j]` : "";

    // Si c'est un message passif (sans réponse du bot)
    if (turn.isPassive || !turn.assistantText) {
        const hasReaction = turn.assistantReactions && turn.assistantReactions.length > 0;
        const passiveNote = hasReaction ? " [Vu, réagi]" : " [Vu]";

        return `${channelHeader}👤 ${turn.displayName}: "${turn.userText}"${imageContext}${passiveNote}${ageNote}`;
    }

    // Message normal avec réponse du bot
    return `${channelHeader}👤 ${turn.displayName}: "${turn.userText}"${imageContext}${ageNote}
🤖 Toi: "${turn.assistantText}"${reactionContext}`;
}

/**
 * Construit le bloc d'historique de conversation
 * Groupe les messages par salon et indique les changements de contexte
 */
export function buildHistoryBlock(recentTurns: MemoryTurn[], currentChannelId: string): string {
    if (recentTurns.length === 0) return "";

    const formattedParts: string[] = [];
    let lastChannelId: string | null = null;

    for (let i = 0; i < recentTurns.length; i++) {
        const turn = recentTurns[i];
        const channelChanged = lastChannelId !== null && lastChannelId !== turn.channelId;

        if (channelChanged) {
            formattedParts.push(`\n⚠️ CHANGEMENT DE SALON ⚠️\n`);
        }

        formattedParts.push(formatMemoryTurn(turn, i === 0 || channelChanged));

        if (i < recentTurns.length - 1) {
            formattedParts.push("---");
        }

        lastChannelId = turn.channelId;
    }

    const currentChannelNote = lastChannelId && lastChannelId !== currentChannelId
        ? `\n⚠️ Le message actuel vient d'un AUTRE SALON ⚠️`
        : "";

    return `=== HISTORIQUE RÉCENT ===
[Note: "[Vu]" = tu as observé ce message passivement. "[Vu, réagi]" = tu as observé et ajouté une réaction emoji. Tu connais ces infos même si tu n'as pas répondu en texte.]

${formattedParts.join("\n")}
=== FIN HISTORIQUE ===${currentChannelNote}`;
}

/**
 * Construit le bloc de contexte du thread starter (message d'origine du thread)
 */
export function buildThreadStarterBlock(starterContext: { content: string; author: string; imageUrls: string[] }, imageDescriptions: string[]): string {
    const imageContext = imageDescriptions.length > 0 ? `\n[Médias dans le message d'origine, description générée automatiquement]:\n- ${imageDescriptions.join("\n- ")}` : "";

    return `=== MESSAGE D'ORIGINE DU THREAD ===
[IMPORTANT: Ceci est le MESSAGE QUI A DÉMARRÉ CE THREAD. C'est le sujet principal de cette conversation.]

Auteur: ${starterContext.author}
Message:
${starterContext.content}${imageContext}
=== FIN MESSAGE D'ORIGINE DU THREAD ===

`;
}

/**
 * Construit le bloc de message actuel de l'utilisateur
 */
export function buildCurrentUserBlock(userId: string, userName: string, prompt: string, imageDescriptions: string[], recentTurns: MemoryTurn[] = []): string {
    const currentTs = Date.now();
    const currentDate = new Date(currentTs);
    const imageContext = imageDescriptions.length > 0 ? `\n[Images/GIFs attachés]:\n- ${imageDescriptions.join("\n- ")}` : "";

    // Chercher des profils d'utilisateurs mentionnés dans le message ET l'historique
    // Exclut l'utilisateur actuel
    const mentionedProfilesContext = buildMentionedProfilesContext(prompt, recentTurns, userId);

    return `
=== MESSAGE ACTUEL ===
👤 ${userName} (UID: ${userId})
📅 ${currentDate.toLocaleDateString("fr-CA", {year: "numeric", month: "long", day: "numeric"})} à ${currentDate.toLocaleTimeString("fr-CA", {hour: "2-digit", minute: "2-digit"})}

"${prompt}"${imageContext}
=== FIN MESSAGE ===${mentionedProfilesContext}`;
}

/**
 * Cherche et retourne les profils des utilisateurs mentionnés dans le message ET l'historique
 * Exclut l'utilisateur actuel pour éviter les confusions
 */
function buildMentionedProfilesContext(prompt: string, recentTurns: MemoryTurn[] = [], currentUserId?: string): string {
    const {UserProfileService} = require("../services/userProfileService");
    const profilesMap = new Map<string, any>(); // Pour éviter les doublons

    // Récupérer tous les profils existants
    const allProfiles = UserProfileService.getAllProfiles();

    if (allProfiles.length === 0) return "";

    // Chercher dans le message actuel
    const lowerPrompt = prompt.toLowerCase();
    const normalizedPrompt = normalizeAccents(prompt);

    // Chercher dans les displayNames de l'historique (pas dans tout le contenu)
    // pour éviter de charger des profils juste parce qu'un mot apparaît quelque part
    const displayNamesInHistory = new Set<string>();
    recentTurns.forEach(turn => {
        displayNamesInHistory.add(turn.displayName.toLowerCase());
    });

    logger.info(`[ProfileDetection] Searching in: "${prompt.substring(0, 60)}..."`);

    for (const profile of allProfiles) {
        // IMPORTANT : Exclure l'utilisateur actuel
        if (currentUserId && profile.userId === currentUserId) {
            continue;
        }

        const lowerUsername = profile.username.toLowerCase();
        const normalizedUsername = normalizeAccents(profile.username);
        const usernameBase = lowerUsername.split(/[0-9_-]/)[0]; // "eddie" de "eddie64"

        // Vérifier si le username ou un alias est mentionné dans le message actuel
        // Utiliser à la fois la comparaison normale ET la comparaison sans accents
        const isInPrompt = lowerPrompt.includes(lowerUsername) ||
            normalizedPrompt.includes(normalizedUsername) || // ← NOUVEAU : détecte "jeremy" pour "Jérémy"
            (usernameBase.length > 2 && lowerPrompt.includes(usernameBase)) || // Éviter les faux positifs avec les chaînes vides ou trop courtes
            (profile.aliases && profile.aliases.some((alias: string) => {
                const normalizedAlias = normalizeAccents(alias);
                return lowerPrompt.includes(alias.toLowerCase()) || normalizedPrompt.includes(normalizedAlias);
            }));

        // Vérifier si le displayName correspond dans l'historique
        const isInHistory = displayNamesInHistory.has(lowerUsername) ||
            (profile.aliases && profile.aliases.some((alias: string) =>
                displayNamesInHistory.has(alias.toLowerCase())
            ));

        if (isInPrompt || isInHistory) {
            // Éviter les doublons
            if (!profilesMap.has(profile.userId)) {
                const summary = UserProfileService.getProfileSummary(profile.userId);
                if (summary) {
                    logger.info(`[ProfileDetection] ✓ Found profile: ${profile.username}`);
                    profilesMap.set(profile.userId, `═══ PROFIL DE ${profile.username.toUpperCase()} (UID Discord: ${profile.userId}) ═══\n${summary}\n═══ FIN PROFIL DE ${profile.username.toUpperCase()} ═══`);
                }
            }
        }
    }

    if (profilesMap.size === 0) {
        logger.info(`[ProfileDetection] No profiles found`);
        return "";
    }

    logger.info(`[ProfileDetection] Total: ${profilesMap.size} profile(s) added to context`);
    const profiles = Array.from(profilesMap.values());
    return `\n\n=== PROFILS DES PERSONNES MENTIONNÉES ===
${profiles.join("\n\n")}
=== FIN PROFILS ===\n`;
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
