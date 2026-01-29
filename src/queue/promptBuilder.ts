import {MemoryTurn} from "../memory/fileMemory";
import {WebContext} from "../services/searchService";
import {normalizeAccents} from "../utils/textTransformers";

/**
 * Formate un tour de mémoire pour l'historique
 */
function formatMemoryTurn(turn: MemoryTurn, showChannelHeader: boolean = false): string {
    const imageContext = turn.imageDescriptions?.length ? `\n[Images décrites]:\n- ${turn.imageDescriptions.join("\n- ")}` : "";
    const reactionContext = turn.assistantReactions?.length ? `\n[NOTE SYSTÈME - Tu as appliqué ces réactions emoji: ${turn.assistantReactions.join(" ")}]` : "";
    const date = new Date(turn.ts);

    const channelHeader = showChannelHeader ? `\n📍 SALON: #${turn.channelName}\n` : "";

    // NOUVEAU : Calculer l'âge du message pour aider l'IA à juger de la pertinence
    const ageInMs = Date.now() - turn.ts;
    const ageInMinutes = Math.floor(ageInMs / (1000 * 60));
    const ageInHours = Math.floor(ageInMs / (1000 * 60 * 60));
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

    let ageNote = "";
    if (ageInDays > 14) {
        ageNote = `\n⏰ [ÂGE: ${ageInDays} jours - TRÈS ANCIEN, probablement hors contexte]`;
    } else if (ageInDays > 7) {
        ageNote = `\n⏰ [ÂGE: ${ageInDays} jours - ANCIEN, vérifier si toujours pertinent]`;
    } else if (ageInDays > 3) {
        ageNote = `\n⏰ [ÂGE: ${ageInDays} jours - QUELQUES JOURS, peut être dépassé]`;
    } else if (ageInDays > 1) {
        ageNote = `\n⏰ [ÂGE: ${ageInDays} jours]`;
    } else if (ageInHours > 12) {
        ageNote = `\n⏰ [ÂGE: ${ageInHours} heures]`;
    } else if (ageInHours > 3) {
        ageNote = `\n⏰ [ÂGE: ${ageInHours} heures]`;
    } else if (ageInMinutes > 10) {
        ageNote = `\n⏰ [ÂGE: ${ageInMinutes} minutes]`;
    }
    // Moins de 10 minutes = pas de add-note (très récent)

    // NOUVEAU : Indiquer si c'est un reply (conversation en cours)
    const replyNote = turn.isReply ? "\n💬 [Ce message est une RÉPONSE à un autre message - conversation en cours]" : "";

    // Si c'est un message passif (sans réponse du bot)
    if (turn.isPassive || !turn.assistantText) {
        // Cas spécial : si c'est une réaction emoji seulement
        const hasReaction = turn.assistantReactions && turn.assistantReactions.length > 0;
        const reactionNoteText = hasReaction
            ? `\n[NOTE SYSTÈME: Tu as VU ce message et réagi avec ${turn.assistantReactions!.join(" ")}, mais tu n'as pas répondu en texte car tu n'étais pas mentionné directement. Tu peux utiliser ces informations.]`
            : `\n[NOTE SYSTÈME: Tu as VU ce message (tu écoutes passivement les conversations), mais tu n'as pas répondu car tu n'étais pas mentionné directement. Tu peux utiliser ces informations.]`;

        return `${channelHeader}👤 ${turn.displayName} (UID: ${turn.discordUid}) dit:
[Date locale fr-CA: ${date.toLocaleDateString("fr-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })}]
[Heure locale fr-CA: ${date.toLocaleTimeString("fr-CA", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })}]${ageNote}${replyNote}
"${turn.userText}"${imageContext}${reactionNoteText}`;
    }

    // Message normal avec réponse du bot
    return `${channelHeader}👤 ${turn.displayName} (UID: ${turn.discordUid}) dit:
[Date locale fr-CA: ${date.toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })}]
[Heure locale fr-CA: ${date.toLocaleTimeString("fr-CA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}]${ageNote}${replyNote}
"${turn.userText}"${imageContext}

🤖 TOI (Netricsa) réponds:
"${turn.assistantText}"${reactionContext}`;
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
            formattedParts.push(`\n⚠️ CHANGEMENT DE SALON - NOUVELLE CONVERSATION ⚠️\n`);
        }

        formattedParts.push(formatMemoryTurn(turn, i === 0 || channelChanged));

        if (i < recentTurns.length - 1) {
            formattedParts.push("\n--- Échange suivant ---\n");
        }

        lastChannelId = turn.channelId;
    }

    const currentChannelNote = lastChannelId && lastChannelId !== currentChannelId
        ? `\n\n⚠️ IMPORTANT: Le message actuel provient d'un AUTRE SALON (#${currentChannelId}). C'est potentiellement une NOUVELLE CONVERSATION différente de l'historique ci-dessus. ⚠️`
        : "";

    return `=== HISTORIQUE GLOBAL (Multi-salons) ===
[NOTE SYSTÈME IMPORTANTE: Cet historique contient des messages de différents salons Discord que tu as VUS et ENTENDUS passivement. Tu CONNAIS ces informations même si tu n'as pas répondu. Quand on te pose des questions sur les conversations passées, tu DOIS utiliser ces informations pour répondre avec précision. Ne dis PAS "je ne me souviens pas" si l'information est dans cet historique.]

[ATTENTION AUX NOMS: Fais TRÈS ATTENTION au nom de l'utilisateur qui a dit chaque message. Ne confonds PAS les utilisateurs entre eux. Le format est "👤 NomUtilisateur dit: message". Lis bien QUI a dit QUOI.]

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
    const imageContext = imageDescriptions.length > 0 ? `\n[Médias fournis par l'utilisateur (GIF ou images), description générée automatiquement]:\n- ${imageDescriptions.join("\n- ")}` : "";

    // NOUVEAU : Chercher des profils d'utilisateurs mentionnés dans le message ET l'historique
    // Exclure l'utilisateur actuel
    const mentionedProfilesContext = buildMentionedProfilesContext(prompt, recentTurns, userId);

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
${mentionedProfilesContext}
[RAPPEL CRITIQUE - NE PAS CONFONDRE LES PROFILS]
Si le message mentionne QUELQU'UN D'AUTRE (ex: "Que fait Nathan?", "Il joue à quoi?"), tu dois:
1. Chercher le profil de CETTE personne mentionnée (pas celui de ${userName})
2. Utiliser les informations du PROFIL DE CETTE PERSONNE (avec son UID)
3. NE JAMAIS utiliser les infos du profil de ${userName} (UID: ${userId}) pour répondre sur quelqu'un d'autre

[RAPPEL MENTIONS: Si le message contient "@NomUtilisateur" ou "<@ID>", cela désigne UNE AUTRE PERSONNE. Toute information dans ce message concernant cette personne mentionnée s'applique à ELLE, pas à ${userName}. Cherche l'identité de la personne mentionnée dans l'HISTORIQUE ci-dessus pour trouver son UID.]
[RAPPEL PRONOMS: Les pronoms "il", "elle", "iel" peuvent référer à quelqu'un mentionné dans l'HISTORIQUE. Vérifie les UIDs pour identifier correctement les personnes.]
[RAPPEL TENOR: Les URLs Tenor contiennent le nom du GIF. Utilise-le comme contexte mais ne répète JAMAIS l'URL dans ta réponse.]
${imageContext}`;
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

    console.log(`[ProfileDetection] Searching in: "${prompt.substring(0, 60)}..."`);

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
                    console.log(`[ProfileDetection] ✓ Found profile: ${profile.username}`);
                    profilesMap.set(profile.userId, `═══ PROFIL DE ${profile.username.toUpperCase()} (UID Discord: ${profile.userId}) ═══\n${summary}\n═══ FIN PROFIL DE ${profile.username.toUpperCase()} ═══`);
                }
            }
        }
    }

    if (profilesMap.size === 0) {
        console.log(`[ProfileDetection] No profiles found`);
        return "";
    }

    console.log(`[ProfileDetection] Total: ${profilesMap.size} profile(s) added to context`);
    const profiles = Array.from(profilesMap.values());
    return `\n\n[INFORMATIONS SUR LES PERSONNES MENTIONNÉES DANS LA CONVERSATION]\n⚠️ ATTENTION: Chaque profil ci-dessous correspond à UNE personne différente. Vérifie l'UID pour ne pas confondre.\n\n${profiles.join("\n\n")}\n`;
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
