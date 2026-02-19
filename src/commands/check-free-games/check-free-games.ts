import {ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {checkAndNotifyFreeGames} from "../../services/freeGamesService";
import {createErrorEmbed, createSuccessEmbed} from "../../utils/embedBuilder";
import {logCommand} from "../../utils/discordLogger";
import {handleInteractionError, safeReply} from "../../utils/interactionUtils";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";
import {OWNER_ROLES} from "../../utils/constants";

const logger = createLogger("CheckFreeGamesCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("check-free-games")
        .setDescription("[TAH-UM] 🎮 Vérifie manuellement les jeux gratuits disponibles")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        const channelName = getChannelNameFromInteraction(interaction);
        await logCommand(
            "Commande : check-free-games",
            `Utilisateur : ${interaction.user.tag}`,
            undefined,
            undefined,
            channelName
        );

        try {
            // Vérifier si l'utilisateur a la permission
            const member = interaction.member;
            if (!member) {
                const embed = createErrorEmbed("Erreur", "Impossible de vérifier vos permissions.");
                await safeReply(interaction, {embeds: [embed], flags: 1 << 6});
                return;
            }

            const hasPermission = OWNER_ROLES.some(roleId =>
                (member as any).roles?.cache?.has(roleId)
            );

            if (!hasPermission && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                const embed = createErrorEmbed(
                    "Permission refusée",
                    "Vous devez être administrateur pour utiliser cette commande."
                );
                await safeReply(interaction, {embeds: [embed], flags: 1 << 6});
                return;
            }

            // Répondre immédiatement pour éviter le timeout
            const processingEmbed = createSuccessEmbed(
                "Vérification en cours...",
                "🔍 Recherche de jeux gratuits en cours..."
            );
            await safeReply(interaction, {embeds: [processingEmbed]});

            // Vérifier les jeux gratuits
            await checkAndNotifyFreeGames(interaction.client);

            // Mettre à jour la réponse
            const successEmbed = createSuccessEmbed(
                "Vérification terminée",
                "✅ La vérification des jeux gratuits est terminée. Si des jeux sont disponibles, une notification a été envoyée dans le salon configuré."
            );

            await interaction.editReply({embeds: [successEmbed]});

            logger.info(`Manual free games check triggered by ${interaction.user.tag}`);

        } catch (error: any) {
            logger.error("Error in check-free-games command:", error);
            await handleInteractionError(interaction, error, channelName);
        }
    },
};


