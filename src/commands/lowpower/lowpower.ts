import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from "discord.js";
import {toggleLowPowerMode} from "../../services/botStateService";
import {logCommand} from "../../utils/discordLogger";
import {setLowPowerStatus, setNormalStatus} from "../../services/statusService";
import {handleInteractionError, safeReply} from "../../utils/interactionUtils";
import {CommandPermissions} from "../../utils/permissions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lowpower")
        .setDescription("[TAH-UM] 🔋 Active/Désactive le Low Power Mode manuellement (désactive l'automatique)")
        .setDefaultMemberPermissions(CommandPermissions.OWNER_ONLY),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            // Note: La vérification des permissions est gérée par le système centralisé dans bot.ts

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

            await safeReply(interaction, {embeds: [embed], flags: MessageFlags.Ephemeral}, true);

            // Logger la commande
            await logCommand(newState ? "🔋 Low Power Mode activé" : "⚡ Low Power Mode désactivé", undefined, [
                {name: "👤 Par", value: interaction.user.username, inline: true},
                {name: "📺 Salon", value: `#${(interaction.channel as any)?.name || "DM"}`, inline: true}
            ]);

        } catch (error: any) {
            await handleInteractionError(interaction, error, "LowPower");
        }
    },
};
