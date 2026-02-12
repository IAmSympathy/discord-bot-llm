import {MemoryTurn} from "../memory/fileMemory";
import {WebContext} from "../services/searchService";
import {normalizeAccents} from "../utils/textTransformers";
import {createLogger} from "../utils/logger";

const logger = createLogger("PromptBuilder");

/**
 * Formate un tour de mémoire pour l'historique
 * FORMAT AMÉLIORÉ : Plus clair pour que le LLM comprenne la continuité
 */
function formatMemoryTurn(turn: MemoryTurn, showChannelHeader: boolean = false): string {
    const imageContext = turn.imageDescriptions?.length ? ` [avec ${turn.imageDescriptions.length} image(s)]` : "";

    const channelHeader = showChannelHeader ? `[Dans le salon #${turn.channelName}]\n` : "";

    // Âge simplifié (seulement si > 1 jour)
    const ageInMs = Date.now() - turn.ts;
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
    const timeAgo = ageInDays > 0 ? ` (il y a ${ageInDays} jour${ageInDays > 1 ? 's' : ''})` : " (récemment)";

    // Si pas de réponse du bot (commande ou message sans interaction)
    if (!turn.assistantText) {
        return `${channelHeader}${turn.displayName} a dit${timeAgo} : "${turn.userText}"${imageContext}`;
    }

    // Message normal avec réponse du bot
    return `${channelHeader}${turn.displayName} a dit${timeAgo} : "${turn.userText}"${imageContext}
→ Tu as répondu : "${turn.assistantText}"`;
}

/**
 * Construit le bloc d'historique de conversation
 * FORMAT AMÉLIORÉ : Plus naturel et explicite pour la compréhension du LLM
 */
export function buildHistoryBlock(recentTurns: MemoryTurn[], currentChannelId: string): string {
    if (recentTurns.length === 0) return "";

    const formattedParts: string[] = [];
    let lastChannelId: string | null = null;

    for (let i = 0; i < recentTurns.length; i++) {
        const turn = recentTurns[i];
        const channelChanged = lastChannelId !== null && lastChannelId !== turn.channelId;

        if (channelChanged) {
            formattedParts.push(`\n━━━ CHANGEMENT DE SALON ━━━\n`);
        }

        formattedParts.push(formatMemoryTurn(turn, i === 0 || channelChanged));

        if (i < recentTurns.length - 1) {
            formattedParts.push(""); // Ligne vide entre les tours
        }

        lastChannelId = turn.channelId;
    }

    const currentChannelNote = lastChannelId && lastChannelId !== currentChannelId
        ? `\n\n⚠️ ATTENTION : Le message actuel ci-dessous provient d'un AUTRE SALON que le dernier message de l'historique.`
        : "";

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 HISTORIQUE DE LA CONVERSATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Note importante : Ceci est l'historique de tes échanges PASSÉS. Les messages ci-dessous ont DÉJÀ eu lieu.
Si tu vois des salutations, questions-réponses ou sujets déjà abordés avec certains utilisateurs, ne les répète PAS.
Continue naturellement la conversation à partir de là où elle en était.

${formattedParts.join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 FIN DE L'HISTORIQUE${currentChannelNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Construit le bloc de contexte du thread starter (message d'origine du thread)
 */
export function buildThreadStarterBlock(starterContext: { content: string; author: string; imageUrls: string[] }, imageDescriptions: string[]): string {
    const imageContext = imageDescriptions.length > 0 ? `\n[📎 Médias dans le message d'origine] :\n${imageDescriptions.map((desc, i) => `  ${i + 1}. ${desc}`).join("\n")}` : "";

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧵 MESSAGE D'ORIGINE DU THREAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CONTEXTE IMPORTANT : Ceci est le message qui a DÉMARRÉ ce thread.
   → C'est le SUJET PRINCIPAL de cette conversation

👤 Auteur : ${starterContext.author}

📝 Message :
${starterContext.content}${imageContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧵 FIN DU MESSAGE D'ORIGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
}

/**
 * Construit le bloc de message actuel de l'utilisateur
 * FORMAT AMÉLIORÉ : Clarifier que c'est le NOUVEAU message qui nécessite une réponse
 */
export function buildCurrentUserBlock(userId: string, userName: string, prompt: string, imageDescriptions: string[], recentTurns: MemoryTurn[] = []): string {
    const currentTs = Date.now();
    const currentDate = new Date(currentTs);
    const imageContext = imageDescriptions.length > 0 ? `\n[📎 ${imageDescriptions.length} image(s)/GIF(s) attaché(s)]:\n${imageDescriptions.map((desc, i) => `  ${i + 1}. ${desc}`).join("\n")}` : "";

    // Chercher des profils d'utilisateurs mentionnés dans le message ET l'historique
    // Exclut l'utilisateur actuel
    const mentionedProfilesContext = buildMentionedProfilesContext(prompt, recentTurns, userId);

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 NOUVEAU MESSAGE (À TRAITER MAINTENANT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 De : ${userName} (ID: ${userId})
📅 Date/Heure : ${currentDate.toLocaleDateString("fr-CA", {year: "numeric", month: "long", day: "numeric"})} à ${currentDate.toLocaleTimeString("fr-CA", {hour: "2-digit", minute: "2-digit"})}

📝 Message :
"${prompt}"${imageContext}

⚠️ IMPORTANT : C'est le message actuel qui nécessite ta réponse. 
   Prends en compte l'historique ci-dessus pour le contexte, mais réponds SPÉCIFIQUEMENT à CE message.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${mentionedProfilesContext}`;
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
                    profilesMap.set(profile.userId, `━━━ PROFIL DE ${profile.username.toUpperCase()} (UID Discord: ${profile.userId}) ━━━\n${summary}\n━━━ FIN PROFIL DE ${profile.username.toUpperCase()} ━━━`);
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
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PROFILS DES PERSONNES MENTIONNÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${profiles.join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FIN DES PROFILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * Construit le bloc de contexte web
 */
export function buildWebContextBlock(webContext: WebContext | null): string {
    if (!webContext) return "";

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 CONTEXTE WEB (Recherche effectuée)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ INFORMATIONS RÉCENTES : Ces faits proviennent d'une recherche web en temps réel
   → Utilise ces informations pour répondre avec des données actualisées
   → Ces faits sont vérifiés et pertinents pour le message actuel

🔍 REQUÊTE DE RECHERCHE : "${webContext.query}"

📊 FAITS VÉRIFIÉS (${webContext.facts.length}) :
${webContext.facts.map((fact, i) => `   ${i + 1}. ${fact}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 FIN DU CONTEXTE WEB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
}
