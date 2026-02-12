import {ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {createLogger} from "../../utils/logger";
import {createErrorEmbed, createSuccessEmbed, replyWithError} from "../../utils/interactionUtils";
import {logCommand} from "../../utils/discordLogger";
import {publishYearlyRewind} from "../../services/yearlyRewindService";
import * as fs from "fs";
import * as path from "path";
import {EnvConfig} from "../../utils/envConfig";
import {hasOwnerPermission} from "../../utils/permissions";

const logger = createLogger("TestRewindCmd");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("test-rewind")
        .setDescription("[TAH-UM] ⏪ Déclenche manuellement le rewind annuel pour tester")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;
            if (!hasOwnerPermission(member)) {
                await replyWithError(
                    interaction,
                    "Permission refusée",
                    "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                    true
                );
                return;
            }

            await interaction.deferReply({ephemeral: true});

            logger.info(`Manual rewind triggered by ${interaction.user.username}`);

            // Log la commande
            await logCommand(
                interaction.user.username,
                "/test-rewind"
            );

            // Sauvegarder l'état actuel
            const REWIND_STATE_FILE = path.join(process.cwd(), "data", "rewind_state.json");
            let originalState = "";
            if (fs.existsSync(REWIND_STATE_FILE)) {
                originalState = fs.readFileSync(REWIND_STATE_FILE, "utf-8");
            }

            try {
                // Réinitialiser l'état pour forcer la publication
                fs.writeFileSync(REWIND_STATE_FILE, JSON.stringify({lastRewind: ""}, null, 2));

                // Déclencher le rewind
                await publishYearlyRewind(interaction.client);

                const ANNOUNCEMENTS_CHANNEL_ID = EnvConfig.ANNOUNCEMENTS_CHANNEL_ID;
                const successEmbed = createSuccessEmbed(
                    "✅ Rewind publié !",
                    `Le rewind annuel a été publié avec succès dans <#${ANNOUNCEMENTS_CHANNEL_ID}> !`
                );
                await interaction.editReply({embeds: [successEmbed]});

            } finally {
                // Restaurer l'état original
                if (originalState) {
                    fs.writeFileSync(REWIND_STATE_FILE, originalState);
                }
            }

        } catch (error) {
            logger.error("Error in test-rewind command:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                `Impossible de publier le rewind : ${error instanceof Error ? error.message : "Erreur inconnue"}`
            );

            if (interaction.deferred) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        }
    },
};
