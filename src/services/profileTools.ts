/**
 * Définition des outils (tools) pour l'extraction automatique d'informations
 * Utilisé avec Ollama pour permettre à l'IA d'enregistrer des infos sur les utilisateurs
 */

export interface Tool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required: string[];
        };
    };
}

export interface ToolCall {
    function: {
        name: string;
        arguments: string;
    };
}

/**
 * Outils disponibles pour l'IA
 */
export const PROFILE_TOOLS: Tool[] = [
    {
        type: "function",
        function: {
            name: "addUserFact",
            description:
                "Enregistre un fait SPÉCIFIQUE et IMPORTANT sur un utilisateur. Sois PRÉCIS avec les noms exacts. ATTENTION : Si le message contient '@AutrePersonne', l'information concerne AutrePersonne (utilise son UID), PAS celui qui parle.",
            parameters: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "L'UID Discord de la personne CONCERNÉE par le fait (si '@AutrePersonne' est mentionné, utilise l'UID de AutrePersonne, pas de celui qui parle)",
                    },
                    fact: {
                        type: "string",
                        description: "Le fait à enregistrer - DOIT être spécifique avec les noms exacts (pas de catégories génériques)",
                    },
                    isAboutSelf: {
                        type: "boolean",
                        description: "true si l'utilisateur parle de lui-même, false si quelqu'un d'autre parle de lui ou si '@AutrePersonne' est mentionné",
                    },
                },
                required: ["userId", "fact", "isAboutSelf"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "updateUserFact",
            description:
                "Met à jour un fait existant qui est devenu obsolète ou incorrect. Utilise ceci quand l'utilisateur corrige ou met à jour une information précédente (ex: 'Je suis maintenant rank 350' alors qu'avant c'était 'rank 313'). Fournis l'ancien fait et le nouveau fait.",
            parameters: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "L'ID Discord de l'utilisateur concerné",
                    },
                    oldFact: {
                        type: "string",
                        description: "L'ancien fait à remplacer (doit correspondre exactement ou partiellement)",
                    },
                    newFact: {
                        type: "string",
                        description: "Le nouveau fait à jour",
                    },
                    isAboutSelf: {
                        type: "boolean",
                        description: "true si l'utilisateur parle de lui-même, false si quelqu'un d'autre parle de lui",
                    },
                },
                required: ["userId", "oldFact", "newFact", "isAboutSelf"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "removeUserFact",
            description:
                "Supprime un fait qui n'est plus vrai ou pertinent. Utilise ceci quand l'utilisateur indique explicitement qu'une information n'est plus valide (ex: 'Je ne joue plus à ce jeu', 'J'ai arrêté', 'Ce n'est plus le cas').",
            parameters: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "L'ID Discord de l'utilisateur concerné",
                    },
                    factToRemove: {
                        type: "string",
                        description: "Le fait à supprimer (description partielle suffit)",
                    },
                },
                required: ["userId", "factToRemove"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "addUserInterest",
            description:
                "Enregistre un centre d'intérêt SPÉCIFIQUE d'un utilisateur. Sois PRÉCIS avec le nom exact. ATTENTION : Si '@AutrePersonne' est mentionné, enregistre pour AutrePersonne (utilise son UID), pas pour celui qui parle.",
            parameters: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "L'UID Discord de la personne CONCERNÉE (si '@AutrePersonne' est mentionné, utilise l'UID de AutrePersonne)",
                    },
                    interest: {
                        type: "string",
                        description: "Le centre d'intérêt SPÉCIFIQUE - nom exact uniquement (pas de catégories génériques)",
                    },
                    isAboutSelf: {
                        type: "boolean",
                        description: "true si l'utilisateur parle de lui-même, false si quelqu'un d'autre parle de lui ou si '@AutrePersonne' est mentionné",
                    },
                },
                required: ["userId", "interest", "isAboutSelf"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "addUserTrait",
            description:
                "Enregistre un trait de personnalité de l'utilisateur. Utilise ceci quand tu observes un aspect récurrent de sa personnalité (humour, style, caractère, etc.).",
            parameters: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "L'ID Discord de l'utilisateur concerné",
                    },
                    trait: {
                        type: "string",
                        description: "Le trait de personnalité (ex: 'sarcastique', 'technique', 'amical')",
                    },
                },
                required: ["userId", "trait"],
            },
        },
    },
];
