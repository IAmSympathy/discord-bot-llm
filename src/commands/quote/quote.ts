import {AttachmentBuilder, ChatInputCommandInteraction, GuildMember, Message, SlashCommandBuilder, TextChannel, User,} from "discord.js";
import {createLogger} from "../../utils/logger";
import {createQuoteImage} from "../../services/quoteImageService";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";
import {tryRewardAndNotify} from "../../services/rewardNotifier";

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
        .setDescription("💬 Génère une image citation inspirationnelle à partir d'un message")
        // ── Mode 1 : ID de message ──────────────────────────────────────────
        .addStringOption((opt) =>
            opt
                .setName("message_id")
                .setDescription("ID du message à citer (clic droit → Copier l'identifiant)")
                .setRequired(false)
        )
        // ── Mode 2 : Manuel ─────────────────────────────────────────────────
        .addUserOption((opt) =>
            opt
                .setName("user")
                .setDescription("L'auteur de la citation (mode manuel)")
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName("message")
                .setDescription("Le texte de la citation (mode manuel)")
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName("context")
                .setDescription("Watermark / contexte affiché en bas à droite (max 32 caractères)")
                .setRequired(false)
        )
        // ── Option commune ──────────────────────────────────────────────────
        .addBooleanOption((opt) =>
            opt
                .setName("grayscale")
                .setDescription("Appliquer un filtre niveaux de gris (défaut : activé)")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const messageId = interaction.options.getString("message_id");
        const targetUser = interaction.options.getUser("user");
        const manualMessage = interaction.options.getString("message");
        const contextWatermark = interaction.options.getString("context");
        const grayScale = interaction.options.getBoolean("grayscale") ?? true;

        // ── Validation : au moins un des deux modes doit être utilisé ──────
        if (!messageId && !targetUser && !manualMessage) {
            await interaction.reply({
                content:
                    "❌ Tu dois soit fournir un **ID de message**, soit un **utilisateur + message** en mode manuel.",
                ephemeral: true,
            });
            return;
        }

        if (!messageId && (targetUser || manualMessage)) {
            if (!targetUser || !manualMessage) {
                await interaction.reply({
                    content: "❌ En mode manuel, tu dois fournir **à la fois** l'utilisateur et le message.",
                    ephemeral: true,
                });
                return;
            }
        }

        await interaction.deferReply();

        try {
            let authorUser: User;
            let authorMember: GuildMember | null = null;
            let quoteText: string;
            let showWatermark = false;
            let watermarkText = "Netricsa Bot";

            // ── Mode 1 : résoudre depuis l'ID du message ───────────────────
            if (messageId) {
                let fetchedMessage: Message | null = null;

                // Chercher dans le canal courant d'abord
                if (interaction.channel) {
                    try {
                        fetchedMessage = await (interaction.channel as TextChannel).messages.fetch(messageId);
                    } catch {
                        // pas dans ce canal
                    }
                }

                if (!fetchedMessage) {
                    await interaction.editReply({
                        content: `❌ Message introuvable avec l'ID \`${messageId}\`.\nAssure-toi que le message se trouve **dans ce canal**.`,
                    });
                    return;
                }

                if (!fetchedMessage.content?.trim()) {
                    await interaction.editReply({
                        content: "❌ Ce message ne contient pas de texte à citer.",
                    });
                    return;
                }

                authorUser = fetchedMessage.author;
                quoteText = fetchedMessage.content;

                // Récupérer le member pour le displayName
                if (interaction.guild) {
                    try {
                        authorMember = await interaction.guild.members.fetch(authorUser.id);
                    } catch {
                        // pas grave
                    }
                }
            } else {
                // ── Mode 2 : manuel ────────────────────────────────────────
                authorUser = targetUser!;
                quoteText = manualMessage!;

                if (interaction.guild) {
                    try {
                        authorMember = await interaction.guild.members.fetch(authorUser.id);
                    } catch {
                        // pas grave
                    }
                }
            }

            // ── Watermark ──────────────────────────────────────────────────
            if (contextWatermark) {
                showWatermark = true;
                watermarkText = contextWatermark.slice(0, 32);
            }

            const {displayName, username} = getAuthorInfo(authorUser, authorMember);
            const avatarUrl = getAvatarUrl(authorUser);

            // ── Génération de l'image ──────────────────────────────────────
            logger.info(`Generating quote for @${username} – "${quoteText.substring(0, 60)}..."`);

            const imageBuffer = await createQuoteImage({
                avatarUrl,
                quote: quoteText,
                displayName,
                username,
                grayScale,
                watermark: watermarkText,
                showWatermark,
            });

            const attachment = new AttachmentBuilder(imageBuffer, {
                name: `quote_${username}_${Date.now()}.png`,
            });

            await interaction.editReply({
                content: `💬 *« ${quoteText.length > 100 ? quoteText.substring(0, 97) + "…" : quoteText} »*`,
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
                        value: quoteText.length > 200 ? quoteText.substring(0, 197) + "…" : quoteText,
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



