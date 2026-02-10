import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {forceResetCounter} from "../../services/counterService";
import {EnvConfig} from "../../utils/envConfig";
import {createErrorEmbed, createSuccessEmbed} from "../../utils/embedBuilder";
import {logCommand} from "../../utils/discordLogger";
import {handleInteractionError, safeReply} from "../../utils/interactionUtils";

const logger = createLogger("ResetCounterCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reset-counter")
        .setDescription("[TAH-UM] 🔄 Réinitialise le compteur à 0")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            await logCommand(interaction);

            // Vérifier qu'on est bien dans un serveur
            if (!interaction.guild) {
                const errorEmbed = createErrorEmbed(
                    "Erreur",
                    "Cette commande ne peut être utilisée que dans un serveur."
                );
                await safeReply(interaction, {embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Récupérer le salon compteur
            const COUNTER_CHANNEL_ID = EnvConfig.COUNTER_CHANNEL_ID;
            if (!COUNTER_CHANNEL_ID) {
                const errorEmbed = createErrorEmbed(
                    "Erreur de Configuration",
                    "Le salon compteur n'est pas configuré."
                );
                await safeReply(interaction, {embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            const counterChannel = await interaction.guild.channels.fetch(COUNTER_CHANNEL_ID);
            if (!counterChannel || !counterChannel.isTextBased()) {
                const errorEmbed = createErrorEmbed(
                    "Erreur",
                    "Le salon compteur est introuvable ou invalide."
                );
                await safeReply(interaction, {embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Réinitialiser le compteur
            await forceResetCounter(counterChannel as TextChannel);

            logger.info(`Counter reset by ${interaction.user.username}`);

            const successEmbed = createSuccessEmbed(
                "Compteur Réinitialisé",
                `Le compteur a été réinitialisé à **0**.\nLes utilisateurs peuvent recommencer à compter à partir de **1** dans <#${COUNTER_CHANNEL_ID}>.`
            );
            await safeReply(interaction, {embeds: [successEmbed], flags: MessageFlags.Ephemeral});

        } catch (error) {
            logger.error("Error executing reset-counter command:", error);
            await handleInteractionError(interaction, error, "reset-counter");
        }
    },
};



