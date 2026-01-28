import {UserProfileService} from "./userProfileService";

/**
 * Gestionnaire pour exécuter les tool calls de l'IA
 */
export class ToolCallHandler {
    /**
     * Exécute un tool call et retourne le résultat
     */
    static async executeToolCall(
        toolName: string,
        args: any,
        context: {
            currentUserId: string;
            currentUsername: string;
            channelId: string;
        }
    ): Promise<string> {
        console.log(`[ToolCall] Executing ${toolName} with args:`, args);

        try {
            switch (toolName) {
                case "addUserFact": {
                    const {userId, fact, isAboutSelf} = args;

                    // VALIDATION : Rejeter les faits invalides
                    if (!fact || fact === "null" || fact === "undefined" || fact.trim().length === 0) {
                        console.log(`[ToolCall] ⚠️ Rejected invalid fact: "${fact}"`);
                        return `❌ Fait invalide ignoré`;
                    }

                    // Rejeter les faits triviaux (salutations, etc.)
                    const trivialPatterns = /^(salut|bonjour|bonsoir|merci|ok|lol|mdr|rien|null|oui|non|bien|mal)$/i;
                    if (trivialPatterns.test(fact.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected trivial fact: "${fact}"`);
                        return `❌ Fait trivial ignoré`;
                    }

                    // Rejeter les réponses conversationnelles courtes (questions, réponses vagues)
                    // Ex: "Bien et toi?", "Pas grand chose", "Rien de spécial"
                    const conversationalResponses = /^(bien et toi|pas grand[- ]chose|rien de (spécial|nouveau|plus)|et toi|comme ci comme ça|ça va|pas mal)[\?\!\.]*$/i;
                    if (conversationalResponses.test(fact.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected conversational response: "${fact}"`);
                        return `❌ Réponse conversationnelle ignorée`;
                    }

                    // Rejeter les faits contenant des questions
                    if (fact.includes("?")) {
                        console.log(`[ToolCall] ⚠️ Rejected fact with question mark: "${fact}"`);
                        return `❌ Questions ne sont pas des faits`;
                    }

                    // Rejeter les phrases incomplètes ou fragments sans sens
                    // Rejeter les phrases incomplètes ou fragments sans sens
                    const incompletePatterns = /^(auparavant|précédemment|avant|après|ensuite|puis)\s/i;
                    if (incompletePatterns.test(fact.trim()) && fact.length < 50) {
                        console.log(`[ToolCall] ⚠️ Rejected incomplete phrase: "${fact}"`);
                        return `❌ Phrase incomplète ignorée`;
                    }

                    // Rejeter les états émotionnels ou situations temporaires
                    // Ex: "est de bonne humeur", "a eu une mauvaise journée", "est fatigué"
                    const temporaryStates = /^(est|semble?|a eu|a une?|était|semblait).*(bonne? humeur|mauvaise? (humeur|journée)|fatigué|triste|content|heureux|stressé|énervé)/i;
                    if (temporaryStates.test(fact.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected temporary emotional state: "${fact}"`);
                        return `❌ État temporaire ignoré (pas durable)`;
                    }

                    // Rejeter les faits qui parlent d'actions/qualités vagues sans contexte
                    const vagueActions = /^(fait|fais|fait du|est|a un|a une)\s+(bon|bien|mal|mauvais)/i;
                    if (vagueActions.test(fact.trim()) && fact.length < 30) {
                        console.log(`[ToolCall] ⚠️ Rejected vague action/quality: "${fact}"`);
                        return `❌ Action vague ignorée`;
                    }

                    // Rejeter les faits techniques/méta qui parlent du bot/système
                    const technicalMetaPatterns = /(travaillé sur|donné|modifié|ajouté|créé|programmé|codé|implémenté).*(moi|bot|système|ia|netricsa|nettie)/i;
                    if (technicalMetaPatterns.test(fact.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected technical meta-fact about bot: "${fact}"`);
                        return `❌ Fait technique sur le bot ignoré`;
                    }

                    // Rejeter les faits avec des pronoms vagues sans contexte clair
                    const vaguePronouns = /^(a |fait |donné |modifié ).*(moi|lui|elle|eux)\s*$/i;
                    if (vaguePronouns.test(fact.trim()) && fact.length < 40) {
                        console.log(`[ToolCall] ⚠️ Rejected fact with vague pronouns: "${fact}"`);
                        return `❌ Fait avec pronoms vagues ignoré`;
                    }

                    // Rejeter les jugements de personnalité vagues (utiliser addUserTrait à la place)
                    const personalityJudgments = /^(a une personnalité|est une personne|a un caractère|utilise des).*(négatif|positif|mauvais|bon|insulte|méchanceté)/i;
                    if (personalityJudgments.test(fact.trim()) && fact.length < 50) {
                        console.log(`[ToolCall] ⚠️ Rejected vague personality judgment: "${fact}"`);
                        return `❌ Jugement de personnalité vague ignoré (utiliser addUserTrait pour traits spécifiques)`;
                    }

                    // Rejeter les faits génériques si un fait plus spécifique existe déjà
                    // Ex: "Joue aux jeux vidéo" rejeté si "Joue à [Jeu spécifique]" existe
                    const existingProfile = await UserProfileService.getProfile(userId);
                    if (existingProfile?.facts) {
                        const genericPatterns = [
                            {generic: /^joue aux? jeux vidéo$/i, specific: /^joue à .+/i},
                            {generic: /^fait de la programmation$/i, specific: /^(code en|développe en) .+/i},
                            {generic: /^aime (la |les )?musique$/i, specific: /^(écoute|aime) .+/i},
                        ];

                        for (const {generic, specific} of genericPatterns) {
                            if (generic.test(fact.trim())) {
                                const hasSpecific = existingProfile.facts.some(f => specific.test(f.content));
                                if (hasSpecific) {
                                    console.log(`[ToolCall] ⚠️ Rejected generic fact (specific already exists): "${fact}"`);
                                    return `❌ Fait générique ignoré (version spécifique existe déjà)`;
                                }
                            }
                        }
                    }

                    // Rejeter les méta-faits négatifs vagues SAUF s'ils décrivent un trait de personnalité
                    // ✅ Accepté : "Est impoli", "Est sarcastique", "A un caractère difficile"
                    // ❌ Rejeté : "Ne parle pas de", "N'a rien dit", "Pas de centre d'intérêt"
                    const isPersonalityTrait = /(est |a un|a une|caractère|personnalité|comportement|attitude)/i.test(fact);
                    if (!isPersonalityTrait) {
                        const negativeMetaPatterns = /^(ne |n'|pas de |rien |aucun |sans )/i;
                        if (negativeMetaPatterns.test(fact.trim())) {
                            console.log(`[ToolCall] ⚠️ Rejected negative meta-fact: "${fact}"`);
                            return `❌ Méta-fait négatif ignoré`;
                        }
                    }

                    // Rejeter les faits qui parlent de comportement conversationnel vague
                    // ✅ Accepté : "Dit souvent des insultes" (trait récurrent)
                    // ❌ Rejeté : "Dit que le bot est gentil" (observation ponctuelle)
                    const conversationalPatterns = /(parle de|dit que|voulait|trouve que|pense que|discute de|demande sur)/i;
                    if (conversationalPatterns.test(fact.trim()) && fact.length < 30) {
                        console.log(`[ToolCall] ⚠️ Rejected conversational meta-fact: "${fact}"`);
                        return `❌ Méta-fait conversationnel ignoré`;
                    }

                    // Rejeter les intentions temporaires ("je pense", "je vais", etc.)
                    const temporaryIntentions = /^(pense|va|vais|veux|veut|souhaite|aimerait|pourrait)/i;
                    if (temporaryIntentions.test(fact.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected temporary intention: "${fact}"`);
                        return `❌ Intention temporaire ignorée`;
                    }

                    // Rejeter les faits trop courts (< 10 caractères)
                    if (fact.trim().length < 10) {
                        console.log(`[ToolCall] ⚠️ Rejected too short fact: "${fact}"`);
                        return `❌ Fait trop court ignoré`;
                    }

                    // Déterminer la source et la confiance
                    let source: "self" | "other" | "inferred";
                    let confidence: number;

                    if (isAboutSelf && userId === context.currentUserId) {
                        // L'utilisateur parle de lui-même
                        source = "self";
                        confidence = 1.0;
                    } else {
                        // Quelqu'un d'autre parle de cet utilisateur
                        source = "other";
                        confidence = 0.6; // Moins fiable
                    }

                    // Récupérer le nom d'utilisateur (on utilise l'ID pour le moment)
                    const username = userId === context.currentUserId ? context.currentUsername : `User-${userId}`;

                    await UserProfileService.addFact(
                        userId,
                        username,
                        fact,
                        `Appris automatiquement dans le salon ${context.channelId}`,
                        confidence,
                        source
                    );

                    return `Fait enregistré pour l'utilisateur ${username}`;
                }

                case "addUserInterest": {
                    const {userId, interest, isAboutSelf} = args;

                    // VALIDATION : Rejeter les intérêts invalides
                    if (!interest || interest === "null" || interest === "undefined" || interest.trim().length === 0) {
                        console.log(`[ToolCall] ⚠️ Rejected invalid interest: "${interest}"`);
                        return `❌ Intérêt invalide ignoré`;
                    }

                    // Rejeter les intérêts triviaux
                    const trivialPatterns = /^(salut|bonjour|bonsoir|merci|ok|lol|mdr|rien|null)$/i;
                    if (trivialPatterns.test(interest.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected trivial interest: "${interest}"`);
                        return `❌ Intérêt trivial ignoré`;
                    }

                    // Rejeter les intérêts trop courts (< 3 caractères)
                    if (interest.trim().length < 3) {
                        console.log(`[ToolCall] ⚠️ Rejected too short interest: "${interest}"`);
                        return `❌ Intérêt trop court ignoré`;
                    }

                    // Déterminer la source
                    let source: "self" | "other" | "inferred";
                    let confidence: number;

                    if (isAboutSelf && userId === context.currentUserId) {
                        source = "self";
                        confidence = 1.0;
                    } else {
                        source = "other";
                        confidence = 0.6;
                    }

                    const username = userId === context.currentUserId ? context.currentUsername : `User-${userId}`;

                    await UserProfileService.addInterest(userId, username, interest);

                    // Également enregistrer comme fait avec le niveau de confiance approprié
                    await UserProfileService.addFact(
                        userId,
                        username,
                        `S'intéresse à ${interest}`,
                        `Appris automatiquement dans le salon ${context.channelId}`,
                        confidence,
                        source
                    );

                    return `Centre d'intérêt enregistré pour l'utilisateur ${username}`;
                }

                case "addUserTrait": {
                    const {userId, trait} = args;

                    // VALIDATION : Rejeter null/undefined/vide
                    if (!trait || trait.trim().length === 0) {
                        console.log(`[ToolCall] ⚠️ Rejected empty trait`);
                        return `❌ Trait vide ignoré`;
                    }

                    // VALIDATION : Le trait doit être UN MOT ou très court (< 20 chars)
                    // Exemples valides : "impoli", "sarcastique", "technique"
                    // Exemples invalides : "utilise des insultes", "a une personnalité négative"
                    if (trait.trim().length > 20) {
                        console.log(`[ToolCall] ⚠️ Rejected too long trait: "${trait}" (traits should be 1-2 words)`);
                        return `❌ Trait trop long ignoré (utiliser 1-2 mots max)`;
                    }

                    // VALIDATION : Rejeter les descriptions au lieu de traits
                    const traitDescriptions = /(utilise|fait|dit|a une|a un|parle)/i;
                    if (traitDescriptions.test(trait.trim())) {
                        console.log(`[ToolCall] ⚠️ Rejected trait description: "${trait}" (use adjective, not description)`);
                        return `❌ Description ignorée (utiliser un adjectif, ex: "impoli" pas "utilise des insultes")`;
                    }

                    // VALIDATION : Normaliser et valider le trait
                    const normalizedTrait = trait.trim().toLowerCase();

                    // Vérifier si le trait existe déjà
                    const existingProfile = await UserProfileService.getProfile(userId);
                    if (existingProfile?.personality?.traits?.includes(normalizedTrait)) {
                        console.log(`[ToolCall] ℹ️ Trait "${normalizedTrait}" already exists for user`);
                        return `Trait déjà enregistré`;
                    }

                    // ⚠️ IMPORTANT : Les traits doivent être basés sur des comportements RÉCURRENTS
                    // Cette fonction devrait idéalement vérifier l'historique, mais pour l'instant
                    // on fait confiance au prompt qui spécifie "3+ observations"

                    // Les traits sont toujours inférés par l'IA
                    const source: "self" | "other" | "inferred" = "inferred";
                    const confidence = 0.7;

                    const username = userId === context.currentUserId ? context.currentUsername : `User-${userId}`;

                    await UserProfileService.addPersonalityTrait(userId, username, normalizedTrait);

                    // Également enregistrer comme fait
                    await UserProfileService.addFact(
                        userId,
                        username,
                        `Est ${normalizedTrait}`,
                        `Observé par l'IA dans le salon ${context.channelId}`,
                        confidence,
                        source
                    );

                    return `Trait de personnalité enregistré pour l'utilisateur ${username}`;
                }

                case "updateUserFact": {
                    const {userId, oldFact, newFact, isAboutSelf} = args;

                    // Déterminer la source et la confiance
                    let source: "self" | "other" | "inferred";
                    let confidence: number;

                    if (isAboutSelf && userId === context.currentUserId) {
                        source = "self";
                        confidence = 1.0;
                    } else {
                        source = "other";
                        confidence = 0.6;
                    }

                    const username = userId === context.currentUserId ? context.currentUsername : `User-${userId}`;

                    const success = await UserProfileService.updateFact(userId, username, oldFact, newFact, confidence, source);

                    if (success) {
                        return `Fait mis à jour pour l'utilisateur ${username}`;
                    } else {
                        return `Fait non trouvé pour mise à jour`;
                    }
                }

                case "removeUserFact": {
                    const {userId, factToRemove} = args;

                    const username = userId === context.currentUserId ? context.currentUsername : `User-${userId}`;

                    const success = await UserProfileService.removeFact(userId, username, factToRemove);

                    if (success) {
                        return `Fait supprimé pour l'utilisateur ${username}`;
                    } else {
                        return `Fait non trouvé pour suppression`;
                    }
                }

                default:
                    console.warn(`[ToolCall] Unknown tool: ${toolName}`);
                    return `❌ Outil inconnu: ${toolName}`;
            }
        } catch (error) {
            console.error(`[ToolCall] Error executing ${toolName}:`, error);
            return `❌ Erreur lors de l'exécution de ${toolName}`;
        }
    }

    /**
     * Traite les tool calls d'une réponse Ollama
     */
    static async processToolCalls(
        toolCalls: any[],
        context: {
            currentUserId: string;
            currentUsername: string;
            channelId: string;
        }
    ): Promise<{ name: string; result: string }[]> {
        const results: { name: string; result: string }[] = [];

        for (const toolCall of toolCalls) {
            if (toolCall.function) {
                const toolName = toolCall.function.name;
                let args: any;

                try {
                    args = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
                } catch (error) {
                    console.error(`[ToolCall] Failed to parse arguments for ${toolName}:`, error);
                    continue;
                }

                const result = await this.executeToolCall(toolName, args, context);
                results.push({name: toolName, result});
            }
        }

        return results;
    }
}
