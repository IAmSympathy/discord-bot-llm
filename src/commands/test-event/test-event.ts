import {ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {hasOwnerPermission} from "../../utils/permissions";
import {startCounterChallenge, startImpostorEvent, startMysteryBox} from "../../services/randomEventsService";

const logger = createLogger("TestEventCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("test-event")
        .setDescription("🎲 Teste un événement aléatoire (Owner uniquement)")
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Type d'événement à tester")
                .setRequired(true)
                .addChoices(
                    {name: "🎯 Défi du Compteur", value: "counter_challenge"},
                    {name: "📦 Colis Mystère (test embed)", value: "mystery_box_test"},
                    {name: "🕵️ Imposteur (test embed)", value: "impostor_test"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            // Defer immédiatement pour éviter l'expiration de l'interaction
            await interaction.deferReply({ephemeral: true});

            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            // Vérifier si l'utilisateur a la permission owner
            if (!hasOwnerPermission(member)) {
                await interaction.editReply({
                    content: "❌ **Permission refusée**\n\nVous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*"
                });
                return;
            }

            if (!interaction.guild) {
                await interaction.editReply({content: "❌ Cette commande doit être utilisée dans un serveur."});
                return;
            }

            const eventType = interaction.options.getString("type", true);

            switch (eventType) {
                case "counter_challenge":
                    await startCounterChallenge(interaction.client, interaction.guild, true);
                    await interaction.editReply({content: "✅ Défi du compteur démarré en mode TEST (aucun XP ne sera distribué) !"});
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
