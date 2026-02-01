import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {clearDMMemory} from "../../services/dmMemoryService";
import {logCommand} from "../../utils/discordLogger";
import {createSuccessEmbed, handleInteractionError, safeReply} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reset-dm")
        .setDescription("Réinitialise la mémoire de conversation de Netricsa en DM"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;

            // Effacer la mémoire DM de l'utilisateur
            await clearDMMemory(userId);

            const embed = createSuccessEmbed(
                "Mémoire DM réinitialisée",
                `Ta mémoire de conversation en DM avec Netricsa a été effacée.\n\n` +
                `✅ Netricsa ne se souviendra plus de vos conversations précédentes en DM.\n` +
                `💡 Tu peux maintenant commencer une nouvelle conversation avec elle en lui envoyant un message privé.`
            );

            await safeReply(interaction, {embeds: [embed]}, true);

            // Logger la commande
            await logCommand("🔄 Mémoire DM réinitialisée", undefined, [
                {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                {name: "🆔 User ID", value: userId, inline: true}
            ]);

        } catch (error: any) {
            await handleInteractionError(interaction, error, "ResetDM");
        }
    },
};
