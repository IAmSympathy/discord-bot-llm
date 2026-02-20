import {ActionRowBuilder, ApplicationCommandType, ChannelSelectMenuBuilder, ChannelType, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction, MessageFlags, NewsChannel, PermissionFlagsBits, TextChannel, ThreadChannel, VoiceChannel} from "discord.js";
import {createLogger} from "../../utils/logger";

const logger = createLogger("MoveMessage");

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Déplacer")
        .setType(ApplicationCommandType.Message),

    async execute(interaction: MessageContextMenuCommandInteraction) {
        try {
            // Vérifier que l'utilisateur a les permissions de gérer les messages
            if (interaction.guild && interaction.memberPermissions) {
                if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                    await interaction.reply({
                        content: "❌ Vous devez avoir la permission **Gérer les messages** pour utiliser cette fonction.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }

            const targetMessage = interaction.targetMessage;

            // Vérifier que le message n'est pas un message système
            if (targetMessage.system) {
                await interaction.reply({
                    content: "❌ Impossible de déplacer un message système.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Créer le sélecteur de salon
            const channelSelect = new ChannelSelectMenuBuilder()
                .setCustomId(`move_channel_${targetMessage.id}`)
                .setPlaceholder("🔀 Sélectionner le salon de destination")
                .setChannelTypes([
                    ChannelType.GuildText,
                    ChannelType.GuildVoice,
                    ChannelType.PublicThread,
                    ChannelType.PrivateThread,
                    ChannelType.GuildNews
                ]);

            const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
                .addComponents(channelSelect);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("📬 Déplacer le message")
                .setDescription(
                    `Sélectionnez le salon de destination pour déplacer ce message.\n\n` +
                    `**Message de:** ${targetMessage.author.tag}\n` +
                    `**Contenu:** ${targetMessage.content ? (targetMessage.content.length > 100 ? targetMessage.content.substring(0, 100) + "..." : targetMessage.content) : "*Pas de contenu texte*"}\n\n` +
                    `Le message sera envoyé avec le nom et la photo de l'auteur original.\n` +
                    `💡 *Les salons vocaux supportés incluent leur discussion textuelle.*`
                )
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

            // Créer un collector pour le sélecteur de salon
            const collector = interaction.channel?.createMessageComponentCollector({
                filter: (i) => i.customId === `move_channel_${targetMessage.id}` && i.user.id === interaction.user.id,
                time: 60000 // 1 minute
            });

            if (!collector) {
                logger.error("Failed to create collector");
                return;
            }

            collector.on("collect", async (selectInteraction) => {
                try {
                    if (!selectInteraction.isChannelSelectMenu()) return;

                    await selectInteraction.deferUpdate();

                    const selectedChannelId = selectInteraction.values[0];
                    const targetChannel = await interaction.guild?.channels.fetch(selectedChannelId);

                    if (!targetChannel) {
                        await selectInteraction.followUp({
                            content: "❌ Impossible de trouver le salon sélectionné.",
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    // Vérifier que le bot peut envoyer des messages dans ce salon
                    if (targetChannel.isTextBased()) {
                        const botMember = interaction.guild?.members.me;
                        if (!botMember) return;

                        const permissions = targetChannel.permissionsFor(botMember);
                        if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
                            await selectInteraction.followUp({
                                content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${targetChannel}.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        // Vérifier les permissions pour les webhooks (sauf pour les threads)
                        const isThread = targetChannel.type === ChannelType.PublicThread ||
                            targetChannel.type === ChannelType.PrivateThread;

                        if (!isThread && !permissions?.has(PermissionFlagsBits.ManageWebhooks)) {
                            await selectInteraction.followUp({
                                content: `❌ Je n'ai pas la permission de gérer les webhooks dans ${targetChannel}.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        // Déplacer le message
                        await moveMessage(targetMessage, targetChannel as TextChannel | ThreadChannel | NewsChannel | VoiceChannel, selectInteraction);
                    } else {
                        await selectInteraction.followUp({
                            content: "❌ Le salon sélectionné ne permet pas l'envoi de messages.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    collector.stop();
                } catch (error: any) {
                    logger.error("Error in channel select collector:", error);
                    try {
                        await selectInteraction.followUp({
                            content: "❌ Une erreur s'est produite lors du déplacement du message.",
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (e) {
                        logger.error("Error sending error message:", e);
                    }
                }
            });

            collector.on("end", (collected, reason) => {
                if (reason === "time" && collected.size === 0) {
                    interaction.editReply({
                        content: "⏱️ Temps écoulé. Le déplacement a été annulé.",
                        embeds: [],
                        components: []
                    }).catch(() => {
                    });
                }
            });

        } catch (error: any) {
            logger.error("Error executing moveMessage command:", error);
            const errorMessage = "❌ Une erreur s'est produite lors de l'exécution de la commande.";

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: errorMessage,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: errorMessage,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};

/**
 * Déplace un message vers un autre salon en utilisant un webhook
 */
async function moveMessage(
    sourceMessage: any,
    targetChannel: TextChannel | ThreadChannel | NewsChannel | VoiceChannel,
    interaction: any
) {
    try {
        const isThread = targetChannel.type === ChannelType.PublicThread ||
            targetChannel.type === ChannelType.PrivateThread;

        let webhookToUse: any;

        if (isThread) {
            // Pour les threads, on doit obtenir le webhook du canal parent
            const parentChannel = targetChannel.parent;
            if (!parentChannel || !parentChannel.isTextBased()) {
                throw new Error("Unable to get parent channel for thread");
            }

            // Récupérer ou créer un webhook dans le canal parent
            const webhooks = await parentChannel.fetchWebhooks();
            webhookToUse = webhooks.find(wh => wh.name === "Déplaceur de Messages") ||
                await parentChannel.createWebhook({
                    name: "Déplaceur de Messages",
                    reason: "Webhook pour déplacer des messages"
                });
        } else {
            // Pour les canaux normaux (TextChannel, NewsChannel, VoiceChannel)
            const webhooks = await (targetChannel as TextChannel | NewsChannel | VoiceChannel).fetchWebhooks();
            webhookToUse = webhooks.find(wh => wh.name === "Déplaceur de Messages") ||
                await (targetChannel as TextChannel | NewsChannel | VoiceChannel).createWebhook({
                    name: "Déplaceur de Messages",
                    reason: "Webhook pour déplacer des messages"
                });
        }

        // Préparer le contenu du message
        let content = sourceMessage.content || "";

        // Récupérer les embeds
        const embeds = sourceMessage.embeds || [];

        // Récupérer les pièces jointes
        const files = sourceMessage.attachments.map((attachment: any) => attachment.url);

        // Options pour le webhook
        const webhookOptions: any = {
            content: content,
            username: sourceMessage.author.username,
            avatarURL: sourceMessage.author.displayAvatarURL(),
            embeds: embeds,
            files: files,
        };

        // Si c'est un thread, on doit spécifier le threadId
        if (isThread) {
            webhookOptions.threadId = targetChannel.id;
        }

        // Envoyer le message via le webhook
        await webhookToUse.send(webhookOptions);

        // Supprimer le message original
        await sourceMessage.delete();

        // Log Discord de l'action
        const {logCommand} = require("../../utils/discordLogger");
        const sourceChannelName = sourceMessage.channel?.name || "Canal inconnu";
        const targetChannelName = targetChannel.name;

        await logCommand(
            "📬 Message déplacé",
            `Message de **${sourceMessage.author.username}** déplacé`,
            [
                {name: "👤 Auteur du message", value: sourceMessage.author.username, inline: true},
                {name: "👮 Déplacé par", value: interaction.user.username, inline: true},
                {name: "📤 Depuis", value: `#${sourceChannelName}`, inline: true},
                {name: "📥 Vers", value: `#${targetChannelName}`, inline: true},
                {name: "📝 Contenu", value: content ? `\`\`\`\n${content.length > 500 ? content.substring(0, 500) + "..." : content}\n\`\`\`` : "*Aucun contenu texte*", inline: false}
            ],
            undefined,
            sourceChannelName,
            interaction.user.displayAvatarURL()
        );

        // Confirmer le déplacement via l'édition du message éphémère
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ Message déplacé avec succès")
            .setDescription(
                `Le message de **${sourceMessage.author.username}** a été déplacé.\n\n` +
                `**Depuis:** #${sourceChannelName}\n` +
                `**Vers:** ${targetChannel}\n\n` +
                `Le message original a été supprimé.`
            )
            .setTimestamp();

        await interaction.editReply({
            embeds: [confirmEmbed],
            components: []
        });

    } catch (error: any) {
        logger.error("Error moving message:", error);
        throw error;
    }
}













