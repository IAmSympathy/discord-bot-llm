import {ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {CommandPermissions, hasOwnerPermission} from "../../utils/permissions";
import {startBoss, startCounterChallenge, startImpostorEvent, startMiniBoss, startMysteryBox, startRiddle, startSequence} from "../../services/randomEventsService";
import {replyWithError} from "../../utils/interactionUtils";

const logger = createLogger("TestEventCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("test-event")
        .setDescription("[TAH-UM] 🎲 Teste un événement aléatoire")
        .setDefaultMemberPermissions(CommandPermissions.OWNER_ONLY)
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type d'événement à tester")
                .setRequired(true)
                .addChoices(
                    {name: "🎯 Défi du Compteur", value: "counter_challenge"},
                    {name: "⚔️ Combat de Mini Boss", value: "mini_boss"},
                    {name: "👑 Combat de Boss", value: "boss"},
                    {name: "📦 Colis Mystère", value: "mystery_box_test"},
                    {name: "🕵️ Imposteur", value: "impostor_test"},
                    {name: "🧩 Énigme", value: "riddle"},
                    {name: "🔢 Suite Logique", value: "sequence"},
                    {name: "🔥 Stats Fin de Saison Feu", value: "fire_season_end"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            // Defer immédiatement pour éviter l'expiration de l'interaction
            await interaction.deferReply({ephemeral: true});

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

            if (!interaction.guild) {
                await interaction.editReply({content: "Cette commande doit être utilisée dans un serveur."});
                return;
            }

            const eventType = interaction.options.getString("type", true);

            switch (eventType) {
                case "counter_challenge":
                    await startCounterChallenge(interaction.client, interaction.guild, true);
                    await interaction.editReply({content: "✅ Défi du compteur démarré en mode TEST (aucun XP ne sera distribué) !"});
                    break;

                case "mini_boss":
                    await startMiniBoss(interaction.client, interaction.guild, true);
                    await interaction.editReply({content: "✅ Combat de mini boss démarré en mode TEST (aucun XP ne sera distribué) !"});
                    break;

                case "boss":
                    await startBoss(interaction.client, interaction.guild, true);
                    await interaction.editReply({content: "✅ Combat de boss démarré en mode TEST (aucun XP ne sera distribué) !"});
                    break;

                case "mystery_box_test":
                    try {
                        await startMysteryBox(interaction.client, interaction.guild, interaction.user.id, true);
                        await interaction.editReply({content: "✅ Colis mystère envoyé en DM en mode TEST (aucun XP distribué) !"});
                    } catch (error: any) {
                        await interaction.editReply({content: `❌ Erreur : ${error.message}`});
                    }
                    break;

                case "impostor_test":
                    try {
                        await startImpostorEvent(interaction.client, interaction.guild, interaction.user.id, true);
                        await interaction.editReply({content: "✅ Mission imposteur envoyée en DM en mode TEST (aucun XP distribué) !"});
                    } catch (error: any) {
                        await interaction.editReply({content: `❌ Erreur : ${error.message}`});
                    }
                    break;

                case "riddle":
                    await startRiddle(interaction.client, interaction.guild, true);
                    await interaction.editReply({content: "✅ Énigme démarrée en mode TEST (aucun XP ne sera distribué) !"});
                    break;

                case "sequence":
                    await startSequence(interaction.client, interaction.guild, true);
                    await interaction.editReply({content: "✅ Suite logique démarrée en mode TEST (aucun XP ne sera distribué) !"});
                    break;

                case "fire_season_end":
                    try {
                        const {sendSeasonStatistics} = require("../../services/seasonal/fireSeasonManager");
                        await sendSeasonStatistics(interaction.client);
                        await interaction.editReply({content: "✅ Statistiques de fin de saison du feu de foyer envoyées dans les annonces !"});
                    } catch (error: any) {
                        await interaction.editReply({content: `❌ Erreur : ${error.message}`});
                    }
                    break;

                default:
                    await interaction.editReply({content: "❌ Type d'événement invalide."});
                    break;
            }

        } catch (error) {
            logger.error("Error in test-event command:", error);
            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";

            try {
                if (interaction.deferred) {
                    await interaction.editReply({content: `❌ Erreur : ${errorMessage}`});
                } else if (!interaction.replied) {
                    await interaction.reply({content: `❌ Erreur : ${errorMessage}`, ephemeral: true});
                }
            } catch (replyError) {
                // Si on ne peut pas répondre, log seulement (interaction probablement expirée)
                logger.error("Could not send error message to user:", replyError);
            }
        }
    },
};
