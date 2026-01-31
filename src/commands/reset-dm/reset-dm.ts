import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {clearDMMemory} from "../../services/dmMemoryService";
import {logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reset-dm")
        .setDescription("Réinitialise la mémoire de conversation de Netricsa en DM"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const userId = interaction.user.id;

            // Effacer la mémoire DM de l'utilisateur
            await clearDMMemory(userId);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle("🔄 Mémoire DM réinitialisée")
                .setDescription(
                    `Ta mémoire de conversation en DM avec Netricsa a été effacée.\n\n` +
                    `✅ Netricsa ne se souviendra plus de vos conversations précédentes en DM.\n` +
                    `💡 Tu peux maintenant commencer une nouvelle conversation avec elle en lui envoyant un message privé.`
                )
                .setTimestamp();

            await interaction.reply({embeds: [embed], ephemeral: true});

            // Logger la commande
            await logCommand("🔄 Mémoire DM réinitialisée", undefined, [
                {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                {name: "🆔 User ID", value: userId, inline: true}
            ]);

        } catch (error: any) {
            console.error("[ResetDM Command] Error:", error);

            if (error?.code === 10062) {
                console.warn("[ResetDM Command] Interaction expired");
                return;
            }

            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle("❌ Erreur")
                    .setDescription("Une erreur s'est produite lors de la réinitialisation de ta mémoire DM.");

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({embeds: [errorEmbed], ephemeral: true});
                } else {
                    await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                }
            } catch (replyError: any) {
                if (replyError?.code === 10062) {
                    console.warn("[ResetDM Command] Could not send error message - interaction expired");
                }
            }
        }
    },
};
