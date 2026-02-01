import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {abortImageAnalysis, abortStream} from "../../queue/queue";
import {logCommand} from "../../utils/discordLogger";
import {EnvConfig} from "../../utils/envConfig";
import {createInfoEmbed, handleInteractionError, safeReply} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Arrête de force le raisonnement et/ou l'analyse d'image(s) de Netricsa"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const channelKey = EnvConfig.WATCH_CHANNEL_ID || interaction.channelId;

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

                await safeReply(interaction, message);

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
                const embed = createInfoEmbed(
                    "❌ Aucune réponse en cours",
                    "Netricsa n'est pas actuellement en train de parler."
                );

                await safeReply(interaction, {embeds: [embed]}, true);
            }
        } catch (error: any) {
            await handleInteractionError(interaction, error, "Stop");
        }
    },
};
