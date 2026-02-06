import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {generateImage} from "../../services/imageGenerationService";
import {logBotImageGeneration} from "../../utils/discordLogger";
import {createErrorEmbed} from "../../utils/embedBuilder";
import {createLogger} from "../../utils/logger";
import {hasActiveGeneration, registerImageGeneration, unregisterImageGeneration, updateJobId} from "../../services/imageGenerationTracker";
import {formatTime} from "../../utils/timeFormat";
import {BotStatus, clearStatus, setStatus} from "../../services/statusService";
import {FileMemory} from "../../memory/fileMemory";
import {MEMORY_FILE_PATH, MEMORY_MAX_TURNS, TYPING_ANIMATION_INTERVAL} from "../../utils/constants";
import {isLowPowerMode} from "../../services/botStateService";
import {NETRICSA_USER_ID, NETRICSA_USERNAME, recordImageGenerated} from "../../services/userStatsService";

const logger = createLogger("GenerateImageCmd");
const memory = new FileMemory(MEMORY_FILE_PATH);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("imagine")
        .setDescription("Demande à Netricsa de générer une image")
        .addStringOption((option) =>
            option
                .setName("prompt")
                .setDescription("Description de l'image à générer (EN ANGLAIS)")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("negative")
                .setDescription("Ce que tu NE veux PAS dans l'image (optionnel, EN ANGLAIS)")
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Nombre d'images à générer")
                .setRequired(false)
                .addChoices(
                    {name: "1", value: 1},
                    {name: "2", value: 2},
                    {name: "3", value: 3}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {

        // Vérifier si l'utilisateur a déjà une génération en cours
        if (hasActiveGeneration(interaction.user.id)) {
            const errorEmbed = createErrorEmbed(
                "⏳ Génération en Cours",
                "Tu as déjà une génération d'image en cours. Attends qu'elle soit terminée avant d'en lancer une nouvelle."
            );
            await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            return;
        }

        // Vérifier le mode low power (l'owner peut quand même utiliser)
        if (isLowPowerMode()) {
            const errorEmbed = createErrorEmbed(
                "⚡ Mode Économie d'Énergie",
                "Netricsa est en mode économie d'énergie et ne peut pas générer d'images pour le moment."
            );
            await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
            return;
        }

        let progressMessage: any = null;

        try {
            const prompt = interaction.options.getString("prompt", true);
            const negativePrompt = interaction.options.getString("negative");
            const amount = interaction.options.getInteger("amount") || 1;

            const width = 1024;
            const height = 1024;
            const steps = 22;
            const cfgScale = 7.5;

            logger.info(`Generating image for ${interaction.user.username}: "${prompt.substring(0, 50)}..."`);

            // Définir le statut Discord (10 minutes pour les générations longues)
            await setStatus(interaction.client, BotStatus.GENERATING_IMAGE, 600000); // 10 minutes

            // Message de progression avec animation de points
            progressMessage = await interaction.reply({
                content: "Génération de l'image."
            });

            // Animation des points
            let dotCount = 1;
            const animationInterval = setInterval(async () => {
                dotCount = (dotCount % 3) + 1;
                const dots = ".".repeat(dotCount);

                const label = amount === 1 ? "image" : "images";

                await progressMessage
                    .edit(`Génération de ${amount === 1 ? "l’" : `${amount} `}${label}${dots}\n`)
                    .catch(() => {
                    });
            }, TYPING_ANIMATION_INTERVAL);

            // Enregistrer la génération dans le tracker
            registerImageGeneration(
                interaction.user.id,
                interaction.channelId,
                "imagine",
                animationInterval
            );

            // Générer 3 images
            const startTime = Date.now();
            const results = [];

            for (let i = 0; i < amount; i++) {
                const result = await generateImage({
                    prompt,
                    negativePrompt: negativePrompt || undefined,
                    width,
                    height,
                    steps,
                    cfgScale,
                    seed: -1, // Seed aléatoire pour chaque image
                });

                // Mettre à jour le job_id dans le tracker pour permettre l'annulation
                if (result.jobId) {
                    updateJobId(interaction.user.id, result.jobId);
                }

                results.push(result);
            }

            const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Arrêter l'animation
            clearInterval(animationInterval);

            // Désenregistrer la génération du tracker
            unregisterImageGeneration(interaction.user.id);

            // Créer un embed pour afficher les informations de manière compacte
            const {EmbedBuilder} = require("discord.js");
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6) // Bleu pour génération
                .addFields(
                    {name: "📝 Prompt", value: prompt.length > 1024 ? prompt.substring(0, 1021) + "..." : prompt}
                )
                .setFooter({text: `Temps: ${generationTime}s`})
                .setTimestamp();

            if (negativePrompt) {
                embed.addFields({
                    name: "🚫 Negative Prompt",
                    value: negativePrompt.length > 1024 ? negativePrompt.substring(0, 1021) + "..." : negativePrompt
                });
            }

            let baseContent = amount === 1
                ? `Voici l'image que tu m'as demandé d'imaginer`
                : `Voici ${amount} versions de l'image que tu m'as demandé d'imaginer`;

            // Envoyer les images avec l'embed
            const finalMessage = await progressMessage.edit({
                content: baseContent,
                embeds: [embed],
                files: results.map(r => r.attachment)
            });

            const imageUrls = Array.from(finalMessage.attachments.values()).map((att: any) => att.url);

            // Logger les 3 images en une seule entrée
            await logBotImageGeneration(
                interaction.user.username,
                prompt,
                formatTime(parseFloat(generationTime)),
                imageUrls
            );

            // Enregistrer dans les statistiques utilisateur (une stat par image générée)
            for (let i = 0; i < amount; i++) {
                recordImageGenerated(interaction.user.id, interaction.user.username);
                // Enregistrer aussi pour Netricsa elle-même
                recordImageGenerated(NETRICSA_USER_ID, NETRICSA_USERNAME);
            }

            // Ajouter XP avec notification de level up (message non-éphémère)
            const {addXP, XP_REWARDS} = require("../../services/xpSystem");
            if (interaction.channel) {
                for (let i = 0; i < amount; i++) {
                    await addXP(
                        interaction.user.id,
                        interaction.user.username,
                        XP_REWARDS.imageGeneree,
                        interaction.channel,
                        false
                    );
                }
            }

            // Ajouter à la mémoire une version simplifiée (pas besoin du prompt complet)
            logger.info("Saving to memory: /imagine command");
            await memory.appendTurn({
                ts: Date.now(),
                discordUid: interaction.user.id,
                displayName: interaction.user.username,
                userText: `/imagine`,
                assistantText: `J'ai généré une image`,
                channelId: interaction.channelId,
                channelName: interaction.channel?.isDMBased() ? "DM" : (interaction.channel as any)?.name || "unknown"
            }, MEMORY_MAX_TURNS);
            logger.info("Memory saved successfully for /imagine command");

            // Réinitialiser le statut Discord tout à la fin
            await clearStatus(interaction.client);

        } catch (error) {
            logger.error("Error generating image:", error);

            // Désenregistrer la génération en cas d'erreur
            unregisterImageGeneration(interaction.user.id);

            // Réinitialiser le statut Discord
            await clearStatus(interaction.client);

            // Si c'est une annulation, éditer le message pour indiquer l'annulation
            if (error instanceof Error && error.message === "CANCELLED") {
                logger.info("Generation cancelled by user");
                if (progressMessage) {
                    await progressMessage.edit("🛑 Génération annulée.").catch(() => {
                    });
                }
                return;
            }

            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
            const errorEmbed = createErrorEmbed(
                "Erreur de Génération",
                `Impossible de générer l'image.\n\n**Erreur:** ${errorMessage}`
            );

            // Si l'interaction a déjà été répondue, utiliser editReply, sinon reply
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        }
    },
};
