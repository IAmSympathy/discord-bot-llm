import {OllamaService} from "./ollamaService";
import {PROFILE_TOOLS} from "./profileTools";
import {ToolCallHandler} from "./toolCallHandler";

/**
 * Service centralisé pour l'extraction d'informations utilisateur
 * Utilisé à la fois pour l'extraction passive et active
 */
export class ExtractionService {
    private static ollamaService = new OllamaService();

    /**
     * Prompt système pour l'extraction d'informations
     */
    private static readonly EXTRACTION_SYSTEM_PROMPT = `Tu extrais des informations d'une conversation Discord. 

⚠️ RÈGLE ABSOLUE #0 : N'EXTRAIT QUE DU MESSAGE USER
Le bloc "Réponse IA" est fourni pour contexte mais TU NE DOIS JAMAIS en extraire d'informations.
N'EXTRAIT QUE ce que L'USER dit de LUI-MÊME dans "MESSAGE USER".

⚠️ RÈGLE ABSOLUE #1 : N'APPELLE AUCUN OUTIL SAUF SI TU ES ABSOLUMENT CERTAIN

PAR DÉFAUT → N'APPELLE AUCUN OUTIL

Tu ne peux appeler un outil QUE si LE MESSAGE USER DIT EXPLICITEMENT:
✅ "Je suis [métier]" → Métier clair
✅ "Je travaille comme [métier]" → Métier clair
✅ "J'habite à [ville]" → Localisation claire
✅ "Je joue à [jeu] tous les jours depuis [durée]" → Jeu habituel avec preuve de durabilité
✅ "Mon jeu préféré est [jeu]" → Préférence claire
✅ "J'adore vraiment [chose]" → Préférence forte
✅ "Je code en [langage] depuis [durée]" → Compétence technique

❌ TOUT LE RESTE → N'APPELLE AUCUN OUTIL

❌ CES PHRASES = APPEL AUCUN OUTIL (JAMAIS):
"J'ai passé toute la journée sur ton programme" → Événement ponctuel + parle du BOT
"Je viens de faire X" → Événement récent
"J'ai fait X aujourd'hui/hier" → Événement ponctuel
"Passe toute la journée sur X" → Activité temporaire
"Je suis en train de X" → Action temporaire
"D'humeur au sexe" → État temporaire
"Utilise souvent des insultes" → Observation externe
"Je suis là" → État temporaire
"Je m'excuse" → Action temporaire
"Ça va bien" → État temporaire
"Oui", "Non", "Ok" → Réponses courtes
"Je voulais juste parler" → Phrase sociale
"Donne moi des recettes" → Demande
Tout ce qui parle du BOT ("ton programme", "ton code", "tu", "toi") → PAS un fait sur l'USER
Tout ce qui est court (<6 mots) → Trop vague
Tout événement daté (aujourd'hui, hier, ce matin) → Pas permanent
Toute question → Pas un fait
Toute humeur/envie → État temporaire
Tout inapproprié → Jamais enregistrer

⚠️ SI TU N'ES PAS SÛR À 100% → N'APPELLE AUCUN OUTIL

OUTILS (utilise EXTRÊMEMENT RAREMENT):
- addUserFact: Fait PERMANENT et EXPLICITE seulement
- addUserInterest: Activité mentionnée avec DURABILITÉ PROUVÉE
- addUserTrait: JAMAIS utiliser (nécessite 10+ observations)

isAboutSelf = true si user parle de lui.`;

    /**
     * Extrait les informations d'un message et les enregistre
     * @param context - Contexte de l'extraction (passive ou après réponse)
     */
    static async extractAndSave(context: {
        userId: string;
        userName: string;
        userMessage: string;
        assistantResponse?: string; // Seulement pour extraction active
        channelId: string;
        mentionedUsers?: Array<{ id: string; username: string; displayName: string }>;
        isPassive: boolean;
    }): Promise<void> {
        try {
            const {userId, userName, userMessage, assistantResponse, channelId, mentionedUsers, isPassive} = context;

            // Construire le contexte des mentions
            let mentionContext = "";
            if (mentionedUsers && mentionedUsers.length > 0) {
                const mentionList = mentionedUsers
                    .map((u) => `@${u.displayName} (Username: ${u.username}, UID: ${u.id})`)
                    .join("\n");
                mentionContext = `\n[UTILISATEURS MENTIONNÉS DANS CE MESSAGE]\n${mentionList}\n[Si l'information concerne une personne mentionnée, utilise SON UID]\n\n`;
            }

            // Construire le contenu pour l'extraction
            let userContent: string;
            if (isPassive) {
                userContent = `${mentionContext}Message observé de ${userName} (UID: ${userId}): "${userMessage}"\n\nExtrait SEULEMENT les faits DURABLES ET PERMANENTS. Ignore les opinions temporaires et événements récents.`;
            } else {
                // Extraction active : N'EXTRAIRE QUE DU MESSAGE USER, PAS DE LA RÉPONSE IA
                userContent = `⚠️ EXTRAIT UNIQUEMENT DU MESSAGE USER CI-DESSOUS (PAS de la réponse IA):

MESSAGE USER de ${userName} (UID: ${userId}):
"${userMessage}"

Réponse IA (IGNORE COMPLÈTEMENT - ne pas extraire):
"${assistantResponse}"

⚠️ N'extrait QUE du MESSAGE USER. Si le message user est court/vague (comme "Salut" ou "Ça va?"), n'appelle AUCUN outil.`;
            }

            const extractionMessages = [
                {
                    role: "system" as const,
                    content: this.EXTRACTION_SYSTEM_PROMPT,
                },
                {
                    role: "user" as const,
                    content: userContent,
                },
            ];

            const extractionResponse = await this.ollamaService.chat(
                extractionMessages,
                {
                    num_predict: 100,
                    temperature: 0.3, // Température réduite pour cohérence
                    repeat_penalty: 1.0,
                },
                false,
                PROFILE_TOOLS
            );

            const extractionData = await extractionResponse.json();

            if (extractionData.message?.tool_calls && extractionData.message.tool_calls.length > 0) {
                const logPrefix = isPassive ? "[Extraction Passive]" : "[Extraction]";
                console.log(`${logPrefix} Found ${extractionData.message.tool_calls.length} tool call(s) for ${userName}`);

                await ToolCallHandler.processToolCalls(extractionData.message.tool_calls, {
                    currentUserId: userId,
                    currentUsername: userName,
                    channelId: channelId,
                });
            } else {
                if (!isPassive) {
                    console.log(`[Extraction] No information to extract from this conversation`);
                }
            }
        } catch (error) {
            const logPrefix = context.isPassive ? "[Extraction Passive]" : "[Extraction]";
            console.error(`${logPrefix} Failed for ${context.userName}:`, error);
            // Ne pas faire échouer la requête principale
        }
    }
}
