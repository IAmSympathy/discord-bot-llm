import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {abortImageAnalysis, abortStream} from "../../queue/queue";
import {abortImageGeneration, abortImageGenerationByChannel} from "../../services/imageGenerationTracker";
import {abortAskNetricsaByChannel, abortAskNetricsaRequest} from "../../services/askNetricsaTracker";
import {logCommand} from "../../utils/discordLogger";
import {EnvConfig} from "../../utils/envConfig";
import {createInfoEmbed, handleInteractionError, safeReply} from "../../utils/interactionUtils";
import {hasModeratorPermission, hasOwnerPermission} from "../../utils/permissions";

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("🛑 Arrête de force le raisonnement, l'analyse d'image(s) et la génération d'image de Netricsa"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const channelKey = EnvConfig.WATCH_CHANNEL_ID || interaction.channelId;
            const requestingUserId = interaction.user.id;

            // Vérifier si l'utilisateur est modérateur ou owner
            const isAdminOrOwner = hasOwnerPermission(interaction.member as any) || hasModeratorPermission(interaction.member as any);

            // Essayer d'arrêter le stream et l'analyse d'image (avec permissions)
            const streamAborted = abortStream(channelKey, requestingUserId, isAdminOrOwner);
            const imageAnalysisAborted = await abortImageAnalysis(channelKey, requestingUserId, isAdminOrOwner);

            // Pour les générations d'images :
            // Si admin/owner : chercher toutes les générations dans le canal
            // Sinon : chercher seulement les générations de l'utilisateur
            let imageGenerationAborted = false;

            if (isAdminOrOwner) {
                // Admin peut arrêter n'importe quelle génération dans le canal
                imageGenerationAborted = abortImageGenerationByChannel(channelKey, requestingUserId, true);
            } else {
                // Utilisateur normal ne peut arrêter que ses propres générations
                imageGenerationAborted = abortImageGeneration(requestingUserId);
            }

            // Pour les requêtes ask-netricsa :
            // Si admin/owner : chercher toutes les requêtes dans le canal
            // Sinon : chercher seulement les requêtes de l'utilisateur
            let askNetricsaAborted = false;

            if (isAdminOrOwner) {
                // Admin peut arrêter n'importe quelle requête dans le canal
                askNetricsaAborted = abortAskNetricsaByChannel(channelKey, requestingUserId, true);
            } else {
                // Utilisateur normal ne peut arrêter que ses propres requêtes
                askNetricsaAborted = abortAskNetricsaRequest(requestingUserId);
            }

            const success = streamAborted || imageAnalysisAborted || imageGenerationAborted || askNetricsaAborted;

            if (success) {
                let message = "D'accord, j'arrête";
                const actions = [];

                if (streamAborted) actions.push("de parler");
                if (imageAnalysisAborted) actions.push("l'analyse d'image");
                if (imageGenerationAborted) actions.push("la génération d'image");
                if (askNetricsaAborted) actions.push("de réfléchir");

                if (actions.length > 0) {
                    message += " " + actions.join(" et ") + ".";
                }

                await safeReply(interaction, message);

                console.log(`[Stop Command] Aborted by ${interaction.user.displayName}: ${[
                    streamAborted && 'Stream',
                    imageAnalysisAborted && 'Image analysis',
                    imageGenerationAborted && 'Image generation',
                    askNetricsaAborted && 'Ask-Netricsa'
                ].filter(Boolean).join(', ')}`);

                // Logger l'arrêt forcé
                const logActions = [];
                if (streamAborted) logActions.push("Arrêt du raisonnement");
                if (imageAnalysisAborted) logActions.push("Arrêt de l'analyse d'image");
                if (imageGenerationAborted) logActions.push("Arrêt de la génération d'image");
                if (askNetricsaAborted) logActions.push("Arrêt de ask-netricsa");

                await logCommand("🛑 Arrêt forcé", undefined, [
                    {name: "👤 Par", value: interaction.user.displayName, inline: true},
                    {name: "⚙️ Action", value: logActions.join(" + "), inline: true},
                    {name: "✅ Statut", value: "Succès", inline: true}
                ]);
            } else {
                // Créer un embed éphémère quand il n'y a rien à arrêter
                const embed = createInfoEmbed(
                    "Aucune action en cours",
                    "La requête actuelle n'a pas été faite par toi, ou il n'y a aucune requête en cours."
                );

                await interaction.reply({embeds: [embed], ephemeral: true});
            }
        } catch (error: any) {
            await handleInteractionError(interaction, error, "Stop");
        }
    },
};
