import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {abortStream} from "../../queue/queue";
import {logCommand} from "../../utils/discordLogger";

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Arrête de force le raisonnement de Netricsa dans un cas où elle est coincé dans uen boucle"),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply();
        } catch (error: any) {
            if (error?.code === 10062) {
                console.warn(`[stop] Interaction expired before deferReply`);
                return;
            }
            throw error;
        }

        try {
            const channelKey = process.env.WATCH_CHANNEL_ID || interaction.channelId;
            const success = abortStream(channelKey);

            if (success) {
                await interaction.editReply({
                    content: "D'accord, j'arrête de parler.",
                });
                console.log(`[Stop Command] Stream aborted by ${interaction.user.displayName}`);

                // Logger l'arrêt forcé
                await logCommand("🛑 Réponse arrêtée", undefined, [
                    {name: "👤 Par", value: interaction.user.displayName, inline: true},
                    {name: "⚙️ Action", value: "Arrêt forcé du raisonnement", inline: true},
                    {name: "✅ Statut", value: "Succès", inline: true}
                ]);
            } else {
                await interaction.editReply({
                    content: "Je ne suis pas en train de parler.",
                });
            }
        } catch (error: any) {
            console.error("[Stop Command] Error:", error);
            try {
                await interaction.editReply({
                    content: "FUCK YOU JE CONTINUE À PARLER HAHAHAHA",
                });
            } catch (editError: any) {
                if (editError?.code === 10062) {
                    console.warn(`[stop] Could not edit reply - interaction expired`);
                }
            }
        }
    },
};
