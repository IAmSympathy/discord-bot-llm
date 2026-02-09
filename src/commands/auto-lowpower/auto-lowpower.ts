import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {disableLowPowerModeAuto, isLowPowerMode, resetToAutoMode} from "../../services/botStateService";
import {logCommand} from "../../utils/discordLogger";
import {hasOwnerPermission} from "../../utils/permissions";
import {checkOwnerActivity, getCurrentGame} from "../../services/activityMonitor";
import {handleInteractionError, replyWithError, safeReply} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("auto-lowpower")
        .setDescription("(TAH-UM) Active/Désactive le Low Power Mode automatiquement"),

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

            // Réinitialiser au mode automatique
            resetToAutoMode();

            // Si le bot était en Low Power, le désactiver pour recalculer l'état
            if (isLowPowerMode()) {
                disableLowPowerModeAuto();
            }

            // Forcer une vérification immédiate de l'activité pour appliquer le bon statut
            await checkOwnerActivity(interaction.client);

            // Récupérer le jeu actuel après vérification
            const currentGame = getCurrentGame();

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("🔄 Mode automatique réactivé")
                .setDescription(
                    `Le mode **automatique** Low Power est maintenant activé.\n\n` +
                    `✅ **Netricsa se mettra automatiquement en Low Power quand tu joues**\n` +
                    `✅ **Elle se remettra en mode normal quand tu arrêtes**\n` +
                    `✅ **Les jeux blacklistés ne déclenchent pas le Low Power**\n\n` +
                    (currentGame ? `🎮 **Tu joues actuellement à "${currentGame}"** - Le mode automatique va gérer le statut.\n\n` : '') +
                    `💡 **Astuce** : Utilise \`/blacklist-game add-current\` pour blacklister le jeu que tu joues actuellement.`
                )
                .setTimestamp();

            await safeReply(interaction, {embeds: [embed], flags: MessageFlags.Ephemeral}, true);

            // Logger la commande
            await logCommand("🔄 Mode automatique Low Power réactivé", undefined, [
                {name: "👤 Par", value: interaction.user.username, inline: true}
            ]);
        } catch (error: any) {
            await handleInteractionError(interaction, error, "AutoLowPower");
        }
    },
};
