import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {disableLowPowerModeAuto, isLowPowerMode, resetToAutoMode} from "../../services/botStateService";
import {createErrorEmbed, logCommand} from "../../utils/discordLogger";
import {setNormalStatus} from "../../services/statusService";
import {hasOwnerPermission} from "../../utils/permissions";
import {getCurrentGame} from "../../services/activityMonitor";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("auto-lowpower")
        .setDescription("Active/Désactive le Low Power Mode automatiquement (basé sur l'activité de jeu de Tah-Um)"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            if (!hasOwnerPermission(member)) {
                const errorEmbed = createErrorEmbed(
                    "Permission refusée",
                    "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*"
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Réinitialiser au mode automatique
            resetToAutoMode();

            // Si le bot était en Low Power, le désactiver pour recalculer l'état
            if (isLowPowerMode()) {
                disableLowPowerModeAuto();
            }

            // Mettre à jour le statut en fonction du jeu actuel
            const currentGame = getCurrentGame();
            if (currentGame) {
                // L'utilisateur joue, le statut sera géré par l'activityMonitor
                console.log(`[AutoLowPower] Owner is currently playing "${currentGame}", activityMonitor will handle status`);
            } else {
                // Pas de jeu en cours, mettre en mode normal
                await setNormalStatus(interaction.client);
            }

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

            await interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});

            // Logger la commande
            await logCommand("🔄 Mode automatique Low Power réactivé", undefined, [
                {name: "👤 Par", value: interaction.user.username, inline: true}
            ]);
        } catch (error) {
            console.error("[AutoLowPower] Error executing command:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                "Une erreur s'est produite lors de l'exécution de la commande."
            );
            await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral}).catch(console.error);
        }
    },
};
