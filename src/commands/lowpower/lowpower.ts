import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {toggleLowPowerMode} from "../../services/botStateService";
import {createErrorEmbed, logCommand} from "../../utils/discordLogger";
import {setLowPowerStatus, setNormalStatus} from "../../services/statusService";
import {hasOwnerPermission} from "../../utils/permissions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lowpower")
        .setDescription("Active/Désactive le Low Power Mode manuellement (désactive l'automatique)"),

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

            // Toggle le mode (marque automatiquement comme manuel)
            const newState = toggleLowPowerMode();

            // Changer le statut Discord en fonction du mode
            if (newState) {
                await setLowPowerStatus(interaction.client);
            } else {
                await setNormalStatus(interaction.client);
            }

            const embed = new EmbedBuilder()
                .setColor(newState ? 0xffa500 : 0x00ff00) // Orange si activé, vert si désactivé
                .setTitle(newState ? "🔋 Mode Low Power activé (MANUEL)" : "⚡ Mode Low Power désactivé (MANUEL)")
                .setDescription(
                    newState
                        ? `Netricsa est maintenant en mode économie d'énergie **MANUEL**.\n\nElle continuera à écouter et à enregistrer les conversations, mais ne fera pas d'appels LLM coûteux.\n\n⚠️ **Le mode automatique est désactivé** : elle ne se mettra plus automatiquement en Low Power si tu joues.`
                        : `Netricsa est de retour en mode normal **MANUEL**.\n\nElle va maintenant répondre normalement à tous les messages.\n\n⚠️ **Le mode automatique est désactivé** : elle ne se mettra plus automatiquement en Low Power si tu joues.`
                )
                .setFooter({text: "Utilise /auto-lowpower pour réactiver le mode automatique"})
                .setTimestamp();

            await interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});

            // Logger la commande
            await logCommand(newState ? "🔋 Low Power Mode activé" : "⚡ Low Power Mode désactivé", undefined, [
                {name: "👤 Par", value: interaction.user.username, inline: true},
                {name: "📺 Salon", value: `#${(interaction.channel as any)?.name || "DM"}`, inline: true}
            ]);

        } catch (error: any) {
            console.error("[LowPower Command] Error:", error);

            if (error?.code === 10062) {
                console.warn("[LowPower Command] Interaction expired");
                return;
            }

            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle("❌ Erreur")
                    .setDescription("Une erreur s'est produite lors du changement de mode.");

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({embeds: [errorEmbed], ephemeral: true});
                } else {
                    await interaction.reply({embeds: [errorEmbed], ephemeral: true});
                }
            } catch (replyError: any) {
                if (replyError?.code === 10062) {
                    console.warn("[LowPower Command] Could not send error message - interaction expired");
                }
            }
        }
    },
};
