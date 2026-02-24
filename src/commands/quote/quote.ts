import {AttachmentBuilder, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, TextChannel, User,} from "discord.js";
import {createLogger} from "../../utils/logger";
import {createQuoteImage} from "../../services/quoteImageService";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {registerPendingQuote} from "../../services/quotePendingCache";

const logger = createLogger("QuoteCmd");

// ─── Résoudre l'URL d'avatar d'un User Discord ───────────────────────────────
function getAvatarUrl(user: User): string {
    return user.displayAvatarURL({extension: "png", size: 512});
}

// ─── Extraire les infos de l'auteur depuis un GuildMember ou User ────────────
function getAuthorInfo(user: User, member?: GuildMember | null): { displayName: string; username: string } {
    const displayName = member?.displayName ?? user.displayName ?? user.username;
    return {displayName, username: user.username};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("quote")
        .setDescription("💬 Génère une image citation inspirationnelle")
        .addUserOption((opt) =>
            opt
                .setName("user")
                .setDescription("L'auteur de la citation")
                .setRequired(true)
        )
        .addStringOption((opt) =>
            opt
                .setName("message")
                .setDescription("Le texte de la citation")
                .setRequired(true)
        )
        .addStringOption((opt) =>
            opt
                .setName("context")
                .setDescription("Watermark / contexte affiché en bas à droite (max 32 caractères)")
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName("date")
                .setDescription("Date à afficher après le nom. (défaut : année actuelle)")
                .setRequired(false)
        )
        .addBooleanOption((opt) =>
            opt
                .setName("grayscale")
                .setDescription("Appliquer un filtre niveaux de gris (défaut : activé)")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser("user", true);
        const manualMessage = interaction.options.getString("message", true);
        const contextWatermark = interaction.options.getString("context");
        const manualDate = interaction.options.getString("date");
        const grayScale = interaction.options.getBoolean("grayscale") ?? true;

        await interaction.deferReply();

        try {
            let authorMember: GuildMember | null = null;

            if (interaction.guild) {
                try {
                    authorMember = await interaction.guild.members.fetch(targetUser.id);
                } catch {
                    // pas grave
                }
            }

            // ── Watermark ──────────────────────────────────────────────────
            let showWatermark = false;
            let watermarkText = "Netricsa Bot";
            if (contextWatermark) {
                showWatermark = true;
                watermarkText = contextWatermark.slice(0, 32);
            }

            const {displayName, username} = getAuthorInfo(targetUser, authorMember);
            const avatarUrl = getAvatarUrl(targetUser);

            // ── Date ───────────────────────────────────────────────────────
            const quoteDate = manualDate ?? new Date().getFullYear().toString();

            // ── Génération de l'image ──────────────────────────────────────
            logger.info(`Generating quote for @${username} – "${manualMessage.substring(0, 60)}..."`);

            const imageBuffer = await createQuoteImage({
                avatarUrl,
                quote: manualMessage,
                displayName,
                username,
                grayScale,
                watermark: watermarkText,
                showWatermark,
                quoteDate,
            });

            const attachment = new AttachmentBuilder(imageBuffer, {
                name: `quote_${username}_${Date.now()}.png`,
            });

            if (interaction.channelId) {
                registerPendingQuote(interaction.channelId, manualMessage);
            }

            await interaction.editReply({
                content: `<@${targetUser.id}>`,
                files: [attachment],
            });

            // ── Logging ────────────────────────────────────────────────────
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                "💬 Quote",
                undefined,
                [
                    {name: "👤 Demandeur", value: interaction.user.username, inline: true},
                    {name: "✍️ Auteur cité", value: `@${username}`, inline: true},
                    {
                        name: "📝 Citation",
                        value: manualMessage.length > 200 ? manualMessage.substring(0, 197) + "…" : manualMessage,
                        inline: false,
                    },
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
            );

            // ── XP ─────────────────────────────────────────────────────────
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.commandeUtilisee,
                    interaction.channel as TextChannel,
                    false
                );
            }

            // ── Récompense saisonnière ─────────────────────────────────────
            await tryRewardAndNotify(
                interaction,
                interaction.channel as TextChannel | null,
                interaction.user.id,
                interaction.user.username,
                "command"
            );

            // ── Comptabiliser comme commande fun (défis quotidiens) ────────
            const {recordFunCommandStats} = require("../../services/statsRecorder");
            recordFunCommandStats(interaction.user.id, interaction.user.username);

            // ── Tracker les achievements quote ────────────────────────────
            const {trackQuoteAchievements} = require("../../services/achievementService");
            await trackQuoteAchievements(interaction.user.id, interaction.user.username, interaction.client, interaction.channelId, targetUser.id, targetUser.username);

        } catch (error) {
            logger.error("Error in /quote command:", error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "❌ Une erreur s'est produite lors de la génération de l'image.",
                });
            } else {
                await interaction.reply({
                    content: "❌ Une erreur s'est produite lors de la génération de l'image.",
                    ephemeral: true,
                });
            }
        }
    },
};
