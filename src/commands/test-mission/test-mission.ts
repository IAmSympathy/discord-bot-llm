import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder} from "discord.js";
import {CommandPermissions, hasOwnerPermission} from "../../utils/permissions";
import {replyWithError} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("test-mission")
        .setDescription("[TAH-UM] 🕵️ Tester les missions imposteur")
        .setDefaultMemberPermissions(CommandPermissions.OWNER_ONLY)
        .addStringOption(option =>
            option
                .setName("mission")
                .setDescription("Le type de mission à tester")
                .setRequired(true)
                .addChoices(
                    // Faciles
                    {name: "🟢 Envoyer 5 messages", value: "send_messages"},
                    {name: "🟢 Ajouter 3 réactions (personnes connectées)", value: "add_reactions_online"},
                    {name: "🟢 3 messages avec emojis différents", value: "use_emojis"},
                    {name: "🟢 Mentionner 3 personnes différentes", value: "mention_users"},
                    {name: "🟢 Utiliser 3 commandes fun différentes", value: "use_fun_commands"},
                    // Moyennes
                    {name: "🟡 Conversation IA (3 messages consécutifs)", value: "conversation_ai"},
                    {name: "🟡 Générer 3 images", value: "generate_images"},
                    {name: "🟡 10 min en vocal (seul)", value: "join_vocal_solo"},
                    {name: "🟡 Message de 100+ caractères", value: "long_message"},
                    {name: "🟡 Conversation avec recherche web", value: "ai_web_search"},
                    // Difficiles
                    {name: "🔴 Créer 2 prompts et générer", value: "prompt_and_generate"},
                    {name: "🔴 Utiliser un symbole imposé", value: "use_symbol"},
                    {name: "🔴 Utiliser des mots imposés", value: "use_imposed_words"},
                    {name: "🔴 Jouer 5 jeux différents", value: "play_different_games"},
                    {name: "🔴 Utiliser formatage Discord", value: "use_discord_formatting"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member instanceof GuildMember ? interaction.member : null;
        if (!hasOwnerPermission(member)) {
            await replyWithError(
                interaction,
                "Permission refusée",
                "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                true
            );
            return;
        }

        const missionType = interaction.options.getString("mission", true);
        const {loadEventsData, saveEventsData} = require("../../services/events/eventsDataManager");

        await interaction.deferReply({flags: 64});

        // Charger les événements
        const eventsData = loadEventsData();

        // Supprimer les anciens événements de test de mission
        eventsData.activeEvents = eventsData.activeEvents.filter((e: any) => e.id !== "test_mission_event");

        // Créer une mission de test
        const testMission = {
            type: missionType,
            description: getMissionDescription(missionType),
            difficulty: getMissionDifficulty(missionType).includes("Facile") ? "easy" :
                getMissionDifficulty(missionType).includes("Moyenne") ? "medium" : "hard",
            goal: getMissionGoal(missionType),
            progress: 0,
            completed: false,
            imposedData: getMockImposedData(missionType)
        };

        // Créer un événement temporaire
        const testEvent = {
            id: "test_mission_event",
            type: "impostor",
            channelId: null,
            startTime: Date.now(),
            endTime: Date.now() + (24 * 60 * 60 * 1000), // 24 heures
            data: {
                impostorId: interaction.user.id,
                impostorUsername: interaction.user.username,
                missions: [testMission],
                completed: false,
                discovered: false,
                discoveredBy: null,
                isTest: true
            }
        };

        // Ajouter l'événement
        eventsData.activeEvents.push(testEvent);
        saveEventsData(eventsData);

        // Créer l'embed avec les instructions
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🧪 Mission de Test Activée !`)
            .setDescription(
                `**Mission :** ${testMission.description}\n\n` +
                `${getTestInstructions(missionType, testMission)}\n\n` +
                `✅ **Tu peux maintenant accomplir cette mission !**\n` +
                `📊 **Progression :** ${testMission.progress}/${testMission.goal}\n\n` +
                `*Tu recevras une notification DM quand la mission sera complétée.*\n` +
                `*Utilise \`/stop-event\` pour arrêter le test.*`
            )
            .addFields(
                {name: "🎯 Objectif", value: `${testMission.goal}`, inline: true},
                {name: "📋 Type", value: getMissionDifficulty(missionType), inline: true},
                {name: "⏱️ Durée", value: "24 heures", inline: true}
            )
            .setTimestamp();

        if (testMission.imposedData) {
            embed.addFields({
                name: "🎯 Données Imposées",
                value: missionType === "use_symbol"
                    ? `Symbole: **${testMission.imposedData}**`
                    : `Mots: **${testMission.imposedData.split(',').join('**, **')}**`,
                inline: false
            });
        }

        await interaction.editReply({embeds: [embed]});
    }
};

function getTestInstructions(missionType: string, mission: any): string {
    const instructions: { [key: string]: string } = {
        // Faciles
        "send_messages": "📝 **Comment tester:**\n" +
            "• Envoie 5 messages dans n'importe quel salon (sauf compteur)\n" +
            "• Ne compte pas les conversations avec Netricsa\n" +
            "• Les messages normaux comptent",

        "add_reactions_online": "👍 **Comment tester:**\n" +
            "• Ajoute des réactions à des messages **récents** (moins de 2 semaines)\n" +
            "• ❌ Ne compte PAS : réactions à toi-même\n" +
            "• ❌ Ne compte PAS : réactions aux bots (Netricsa incluse)\n" +
            "• ❌ Ne compte PAS : messages de plus de 2 semaines\n" +
            "• Chaque réaction doit être sur un message d'une **personne différente**\n" +
            "• 3 personnes différentes = mission complétée",

        "use_emojis": "😀 **Comment tester:**\n" +
            "• Envoie **3 messages séparés** contenant des emojis\n" +
            "• Chaque message doit avoir au moins un emoji **différent** des autres\n" +
            "• ❌ Mettre 3 emojis dans le même message ne compte que pour 1 message\n" +
            "• ✅ Message 1 avec 😀, Message 2 avec 🎮, Message 3 avec 🔥 = mission complétée",

        "mention_users": "👤 **Comment tester:**\n" +
            "• Mentionne 3 personnes différentes (@user)\n" +
            "• Peut être dans le même message ou messages différents\n" +
            "• Chaque personne ne compte qu'une fois",

        "use_fun_commands": "🎲 **Comment tester:**\n" +
            "• Utilise 3 commandes fun **différentes**\n" +
            "• Exemples: `/8ball`, `/ascii`, `/rollthedice`, `/coinflip`, `/choose`, `/ship`, `/cucumber`, `/slots`\n" +
            "• Chaque commande ne compte qu'une fois",

        // Moyennes
        "conversation_ai": "💬 **Comment tester:**\n" +
            "• Envoie 3 messages **consécutifs** à Netricsa\n" +
            "• Maximum 10 minutes entre chaque message\n" +
            "• Peut être dans n'importe quel salon ou en DM\n" +
            "• Le streak se réinitialise après 10 min d'inactivité",

        "generate_images": "🎨 **Comment tester:**\n" +
            "• Génère 3 images avec `/imagine` ou `/reimagine`\n" +
            "• Chaque génération compte (même si tu fais plusieurs variantes)\n" +
            "• Les images doivent être uniques",

        "join_vocal_solo": "🎤 **Comment tester:**\n" +
            "• Rejoins un salon vocal **seul**\n" +
            "• Reste 10 minutes **au total** (cumulatif)\n" +
            "• Le temps compte par minute (1 min = +1 progression)\n" +
            "• ✅ Peut être fait en plusieurs sessions (ex: 3 min + 2 min + 5 min)\n" +
            "• ❌ Si quelqu'un rejoint, le temps ne compte plus jusqu'à ce que tu sois seul à nouveau",

        "long_message": "📝 **Comment tester:**\n" +
            "• Envoie un message de **plus de 100 caractères**\n" +
            "• Compte les espaces et la ponctuation\n" +
            "• Un seul message suffit",

        "ai_web_search": "🌐 **Comment tester:**\n" +
            "• Envoie un message à Netricsa qui déclenche une recherche web\n" +
            "• Utilise des mots-clés comme \"recherche\", \"internet\", ou pose une question actuelle\n" +
            "• Netricsa doit faire une recherche pour compléter la mission",

        // Difficiles
        "prompt_and_generate": "🖼️ **Comment tester:**\n" +
            "• Utilise `/prompt-maker` pour créer 2 prompts\n" +
            "• Puis génère les images avec `/imagine`\n" +
            "• Les 2 prompts créés comptent pour la progression",

        "use_symbol": `🔣 **Comment tester:**\n` +
            `• Envoie un message contenant le symbole imposé: **${mission.imposedData || '?'}**\n` +
            `• Le symbole doit être présent dans le texte\n` +
            (mission.imposedData === '@' || mission.imposedData === '#'
                ? `• ⚠️ ${mission.imposedData} ne doit PAS être dans une mention/tag de salon`
                : ""),

        "use_imposed_words": mission.imposedData ? `📝 **Comment tester:**\n` +
            `• Utilise **TOUS** les mots imposés dans tes messages\n` +
            `• Mots: **${mission.imposedData.split(',').join('**, **')}**\n` +
            `• ✅ Les mots **peuvent être dans des messages différents**\n` +
            `• ✅ Chaque mot compte pour +1 progression (3 mots = 3/3)\n` +
            `• ✨ Les **accents sont optionnels** (café = cafe)\n` +
            `• ✨ La **casse n'importe pas** (Café = café = CAFE)\n` +
            `• Exemples:\n` +
            `  - Message 1: "J'aime le ${mission.imposedData.split(',')[0]}" → 1/3\n` +
            `  - Message 2: "La ${mission.imposedData.split(',')[1]} est belle" → 2/3\n` +
            `  - Message 3: "Il y a de la ${mission.imposedData.split(',')[2]}" → 3/3 ✅`
            : "📝 **Comment tester:**\n• Envoie un message contenant tous les mots imposés\n• Les mots imposés n'ont pas été générés correctement",

        "play_different_games": "🎮 **Comment tester:**\n" +
            "• Joue à 5 jeux **différents** via `/games`\n" +
            "• Le résultat n'importe pas (victoire, défaite ou égalité)\n" +
            "• Chaque jeu ne compte qu'une fois\n" +
            "• Exemples: TicTacToe, RPS, Connect4, Hangman, etc.",

        "use_discord_formatting": "✨ **Comment tester:**\n" +
            "• Envoie un message avec du **formatage Discord**\n" +
            "• Exemples acceptés:\n" +
            "  - **Gras** : `**texte**`\n" +
            "  - *Italique* : `*texte*`\n" +
            "  - __Souligné__ : `__texte__`\n" +
            "  - ~~Barré~~ : `~~texte~~`\n" +
            "  - `Code` : `` `texte` ``\n" +
            "  - ||Spoiler|| : `||texte||`\n" +
            "  - > Citation : `> texte`"
    };

    return instructions[missionType] || "Instructions de test non disponibles.";
}

function getMissionDescription(missionType: string): string {
    const descriptions: { [key: string]: string } = {
        "send_messages": "Envoyer 5 messages",
        "add_reactions_online": "Ajouter 3 réactions à 3 messages récents de personnes différentes",
        "use_emojis": "Envoyer 3 messages avec emojis différents",
        "mention_users": "Mentionner 3 personnes différentes",
        "use_fun_commands": "Utiliser 3 commandes fun différentes",
        "conversation_ai": "Conversation IA de 3 messages consécutifs",
        "generate_images": "Générer 3 images",
        "join_vocal_solo": "10 minutes en vocal seul",
        "long_message": "Message de 100+ caractères",
        "ai_web_search": "Conversation avec recherche web",
        "prompt_and_generate": "Créer 2 prompts et générer",
        "use_symbol": "Utiliser un symbole imposé",
        "use_imposed_words": "Utiliser des mots imposés",
        "play_different_games": "Jouer 5 jeux différents",
        "use_discord_formatting": "Utiliser formatage Discord"
    };
    return descriptions[missionType] || "Mission inconnue";
}

function getMissionGoal(missionType: string): number {
    const goals: { [key: string]: number } = {
        "send_messages": 5,
        "add_reactions_online": 3,
        "use_emojis": 3,
        "mention_users": 3,
        "use_fun_commands": 3,
        "conversation_ai": 3,
        "generate_images": 3,
        "join_vocal_solo": 10,
        "long_message": 1,
        "ai_web_search": 1,
        "prompt_and_generate": 2,
        "use_symbol": 1,
        "use_imposed_words": 3,
        "play_different_games": 4,
        "use_discord_formatting": 1
    };
    return goals[missionType] || 1;
}

function getMissionDifficulty(missionType: string): string {
    const easy = ["send_messages", "add_reactions_online", "use_emojis", "mention_users", "use_fun_commands"];
    const medium = ["conversation_ai", "generate_images", "join_vocal_solo", "long_message", "ai_web_search"];
    const hard = ["prompt_and_generate", "use_symbol", "use_imposed_words", "play_different_games", "use_discord_formatting"];

    if (easy.includes(missionType)) return "🟢 Facile";
    if (medium.includes(missionType)) return "🟡 Moyenne";
    if (hard.includes(missionType)) return "🔴 Difficile";
    return "❓ Inconnue";
}

function getMockImposedData(missionType: string): string | undefined {
    if (missionType === "use_symbol") {
        return "&"; // Exemple de symbole
    }
    if (missionType === "use_imposed_words") {
        return "café,forêt,lumière"; // Exemple de mots
    }
    return undefined;
}
