import {ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {hasOwnerPermission} from "../../utils/permissions";
import {replyWithError} from "../../utils/interactionUtils";
import {startCounterChallenge} from "../../services/randomEventsService";

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
                    {name: "🎯 Défi du Compteur", value: "counter_challenge"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            // Vérifier si l'utilisateur a la permission owner
            if (!hasOwnerPermission(member)) {
                await replyWithError(
                    interaction,
                    "Permission refusée",
                    "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                    true
                );
                return;
            }

            const eventType = interaction.options.getString("type", true);

            await interaction.deferReply({ephemeral: true});

            if (!interaction.guild) {
                await interaction.editReply({content: "❌ Cette commande doit être utilisée dans un serveur."});
                return;
            }

            switch (eventType) {
                case "counter_challenge":
                    await startCounterChallenge(interaction.client, interaction.guild);
                    await interaction.editReply({content: "✅ Défi du compteur démarré !"});
                    break;

                default:
                    await interaction.editReply({content: "❌ Type d'événement invalide."});
                    break;
            }

        } catch (error) {
            logger.error("Error in test-event command:", error);
            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";

            if (interaction.deferred) {
                await interaction.editReply({content: `❌ Erreur : ${errorMessage}`});
            } else {
                await interaction.reply({content: `❌ Erreur : ${errorMessage}`, ephemeral: true});
            }
        }
    },
};
