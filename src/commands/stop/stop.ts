import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {abortImageAnalysis} from "../../queue/queue";
import {abortImageGeneration, abortImageGenerationByChannel} from "../../services/imageGenerationTracker";
import {abortChannelOperations, abortUserOperation} from "../../queue/globalQueue";
import {logCommand} from "../../utils/discordLogger";
import {EnvConfig} from "../../utils/envConfig";
import {createInfoEmbed, handleInteractionError, safeReply} from "../../utils/interactionUtils";
import {hasModeratorPermission, hasOwnerPermission} from "../../utils/permissions";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("🛑 Arrête de force le raisonnement, l'analyse d'image(s) et la génération d'image de Netricsa"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const channelKey = EnvConfig.WATCH_CHANNEL_ID || interaction.channelId;
            const requestingUserId = interaction.user.id;

            // Vérifier si l'utilisateur est modérateur ou owner
            const isAdminOrOwner = hasOwnerPermission(interaction.member as any) || hasModeratorPermission(interaction.member as any);

            // Essayer d'arrêter toutes les opérations via la queue globale
            let globalQueueAborted = false;
            if (isAdminOrOwner) {
                // Admin peut arrêter toutes les opérations dans le canal
                globalQueueAborted = abortChannelOperations(channelKey, requestingUserId, true);
            } else {
                // Utilisateur normal ne peut arrêter que ses propres opérations
                globalQueueAborted = abortUserOperation(requestingUserId);
            }

            // Essayer d'arrêter l'analyse d'image (pour les anciennes animations en cours)
            const imageAnalysisAborted = await abortImageAnalysis(channelKey, requestingUserId, isAdminOrOwner);

            // Essayer d'arrêter les générations d'images (pour les jobs Python en cours)
            let imageGenerationAborted = false;
            if (isAdminOrOwner) {
                imageGenerationAborted = abortImageGenerationByChannel(channelKey, requestingUserId, true);
            } else {
                imageGenerationAborted = abortImageGeneration(requestingUserId);
            }

            const success = globalQueueAborted || imageAnalysisAborted || imageGenerationAborted;

            if (success) {
                let message = "D'accord, j'arrête";
                const actions = [];

                if (globalQueueAborted) actions.push("ma réfléxion");
                if (imageAnalysisAborted) actions.push("l'analyse d'image");
                if (imageGenerationAborted) actions.push("la génération d'image");

                if (actions.length > 0) {
                    message += " " + actions.join(" et ") + ".";
                }

                await safeReply(interaction, message, true);

                console.log(`[Stop Command] Aborted by ${interaction.user.displayName}: ${[
                    globalQueueAborted && 'Global queue operation',
                    imageAnalysisAborted && 'Image analysis',
                    imageGenerationAborted && 'Image generation',
                ].filter(Boolean).join(', ')}`);

                // Logger l'arrêt forcé
                const channelName = getChannelNameFromInteraction(interaction);
                const logActions = [];
                if (globalQueueAborted) logActions.push("Arrêt de l'opération");
                if (imageAnalysisAborted) logActions.push("Arrêt de l'analyse d'image");
                if (imageGenerationAborted) logActions.push("Arrêt de la génération d'image");

                await logCommand("🛑 Arrêt forcé", undefined, [
                    {name: "👤 Par", value: interaction.user.displayName, inline: true},
                    {name: "⚙️ Action", value: logActions.join(" + "), inline: true},
                    {name: "✅ Statut", value: "Succès", inline: true}
                ], undefined, channelName, interaction.user.displayAvatarURL());
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
