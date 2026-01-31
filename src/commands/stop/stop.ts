import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
import {abortImageAnalysis, abortStream} from "../../queue/queue";
import {logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Arrête de force le raisonnement de Netricsa dans un cas où elle est coincé dans uen boucle"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const channelKey = process.env.WATCH_CHANNEL_ID || interaction.channelId;

            // Essayer d'arrêter le stream ET l'analyse d'image
            const streamAborted = abortStream(channelKey);
            const imageAnalysisAborted = await abortImageAnalysis(channelKey);

            const success = streamAborted || imageAnalysisAborted;

            if (success) {
                let message = "D'accord, j'arrête";
                if (streamAborted && imageAnalysisAborted) {
                    message += " de parler et l'analyse d'image.";
                } else if (streamAborted) {
                    message += " de parler.";
                } else if (imageAnalysisAborted) {
                    message += " l'analyse d'image.";
                }

                await interaction.reply({
                    content: message,
                });

                console.log(`[Stop Command] ${streamAborted ? 'Stream' : ''}${streamAborted && imageAnalysisAborted ? ' and ' : ''}${imageAnalysisAborted ? 'Image analysis' : ''} aborted by ${interaction.user.displayName}`);

                // Logger l'arrêt forcé
                const actions = [];
                if (streamAborted) actions.push("Arrêt du raisonnement");
                if (imageAnalysisAborted) actions.push("Arrêt de l'analyse d'image");

                await logCommand("🛑 Arrêt forcé", undefined, [
                    {name: "👤 Par", value: interaction.user.displayName, inline: true},
                    {name: "⚙️ Action", value: actions.join(" + "), inline: true},
                    {name: "✅ Statut", value: "Succès", inline: true}
                ]);
            } else {
                // Créer un embed éphémère quand le bot n'est pas en train de parler
                const embed = new EmbedBuilder()
                    .setColor(0xed4245) // Rouge
                    .setTitle("❌ Aucune réponse en cours")
                    .setDescription("Netricsa n'est pas actuellement en train de parler.")
                    .setTimestamp();

                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error: any) {
            console.error("[Stop Command] Error:", error);

            if (error?.code === 10062) {
                console.warn(`[stop] Interaction expired`);
                return;
            }

            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle("❌ Erreur")
                    .setDescription("Une erreur s'est produite lors de l'arrêt.");

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        embeds: [errorEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({
                        embeds: [errorEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (editError: any) {
                if (editError?.code === 10062) {
                    console.warn(`[stop] Could not send error message - interaction expired`);
                }
            }
        }
    },
};
