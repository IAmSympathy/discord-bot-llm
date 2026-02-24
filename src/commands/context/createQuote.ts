import {ApplicationCommandType, AttachmentBuilder, ChannelType, ContextMenuCommandBuilder, GuildMember, MessageContextMenuCommandInteraction, MessageFlags, TextChannel, User,} from "discord.js";
import {createLogger} from "../../utils/logger";
import {createQuoteImage} from "../../services/quoteImageService";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {tryRewardAndNotify} from "../../services/rewardNotifier";
import {registerPendingQuote} from "../../services/quotePendingCache";

const logger = createLogger("CreateQuoteCtx");

// ─── Résoudre l'URL d'avatar d'un User Discord ───────────────────────────────
function getAvatarUrl(user: User): string {
    return user.displayAvatarURL({extension: "png", size: 512});
}

// ─── Extraire les infos de l'auteur depuis un GuildMember ou User ────────────
function getAuthorInfo(user: User, member?: GuildMember | null): { displayName: string; username: string } {
    const displayName = member?.displayName ?? user.displayName ?? user.username;
    return {displayName, username: user.username};
}

// ─── Construire le contexte selon l'endroit d'où vient le message ────────────
function buildContext(interaction: MessageContextMenuCommandInteraction): string {
    const channel = interaction.channel;

    // DM privé — afficher l'autre participant (pas l'auteur du message cité)
    if (!channel || channel.type === ChannelType.DM) {
        const author = interaction.targetMessage.author;
        const invoker = interaction.user;
        // Si l'auteur du message et celui qui cite sont la même personne (auto-citation),
        // on utilise le recipient du DMChannel comme autre participant
        if (author.id === invoker.id) {
            const recipient = (channel as any)?.recipient as User | null;
            const other = recipient ?? invoker;
            return `En DM avec ${other.displayName ?? other.username}`;
        }
        // Sinon, celui qui cite est l'autre participant
        return `En DM avec ${invoker.displayName ?? invoker.username}`;
    }

    // Groupe DM
    if (channel.type === ChannelType.GroupDM) {
        const name = (channel as any).name as string | null;
        return name ? `Dans ${name}` : "Dans un groupe DM";
    }

    // Serveur
    if (interaction.guild) {
        return `Dans ${interaction.guild.name}`;
    }

    return "";
}

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Créer une citation")
        .setType(ApplicationCommandType.Message),

    async execute(interaction: MessageContextMenuCommandInteraction) {
        const targetMessage = interaction.targetMessage;

        // Vérifier que le message a du contenu texte
        if (!targetMessage.content?.trim()) {
            await interaction.reply({
                content: "❌ Ce message ne contient pas de texte à citer.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply();

        try {
            const authorUser = targetMessage.author;
            let authorMember: GuildMember | null = null;

            // Récupérer le member pour le displayName (serveur uniquement)
            if (interaction.guild) {
                try {
                    authorMember = await interaction.guild.members.fetch(authorUser.id);
                } catch {
                    // pas grave
                }
            }

            const {displayName, username} = getAuthorInfo(authorUser, authorMember);
            const avatarUrl = getAvatarUrl(authorUser);
            const quoteText = targetMessage.content;

            // ── Contexte ─────────────────────────────────────────────────────
            const context = buildContext(interaction);

            // ── Année depuis le snowflake du message ──────────────────────────
            const messageTimestamp = new Date(
                parseInt(targetMessage.id) / 4194304 + 1420070400000
            );
            const quoteDate = messageTimestamp.getFullYear().toString();

            logger.info(`Generating context-menu quote for @${username} – "${quoteText.substring(0, 60)}..."`);

            const imageBuffer = await createQuoteImage({
                avatarUrl,
                quote: quoteText,
                displayName,
                username,
                grayScale: true,
                watermark: context,
                showWatermark: context.length > 0,
                quoteDate,
            });

            const attachment = new AttachmentBuilder(imageBuffer, {
                name: `quote_${username}_${Date.now()}.png`,
            });

            if (interaction.channelId) {
                registerPendingQuote(interaction.channelId, quoteText);
            }

            await interaction.editReply({
                content: `<@${authorUser.id}>`,
                files: [attachment],
            });

            // ── Logging ───────────────────────────────────────────────────────
            const {getChannelNameFromInteraction} = require("../../utils/channelHelper");
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                "💬 Quote (menu contextuel)",
                undefined,
                [
                    {name: "👤 Demandeur", value: interaction.user.username, inline: true},
                    {name: "✍️ Auteur cité", value: `@${username}`, inline: true},
                    {name: "📍 Contexte", value: context || "—", inline: true},
                    {
                        name: "📝 Citation",
                        value: quoteText.length > 200 ? quoteText.substring(0, 197) + "…" : quoteText,
                        inline: false,
                    },
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
            );

            // ── XP ────────────────────────────────────────────────────────────
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.commandeUtilisee,
                    interaction.channel as TextChannel,
                    false
                );
            }

            // ── Récompense saisonnière ────────────────────────────────────────
            await tryRewardAndNotify(
                null,
                interaction.channel as TextChannel | null,
                interaction.user.id,
                interaction.user.username,
                "command"
            );

            // ── Comptabiliser comme commande fun ──────────────────────────
            const {recordFunCommandStats} = require("../../services/statsRecorder");
            recordFunCommandStats(interaction.user.id, interaction.user.username);

            // ── Tracker les achievements quote ────────────────────────────
            const {trackQuoteAchievements} = require("../../services/achievementService");
            await trackQuoteAchievements(interaction.user.id, interaction.user.username, interaction.client, interaction.channelId, authorUser.id, authorUser.username);

        } catch (error) {
            logger.error("Error in 'Créer une citation' context menu:", error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "❌ Une erreur s'est produite lors de la génération de l'image.",
                });
            } else {
                await interaction.reply({
                    content: "❌ Une erreur s'est produite lors de la génération de l'image.",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};


