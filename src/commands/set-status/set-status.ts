import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder} from "discord.js";
import * as fs from "fs";
import * as path from "path";
import {DATA_DIR} from "../../utils/constants";
import {logCommand} from "../../utils/discordLogger";
import {createErrorEmbed} from "../../utils/embedBuilder";
import {applyDefaultStatus} from "../../services/statusService";
import {hasOwnerPermission} from "../../utils/permissions";
import {replyWithError} from "../../utils/interactionUtils";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

const STATUS_FILE = path.join(DATA_DIR, "bot_default_status.json");

interface StatusData {
    text: string;
    type: "PLAYING" | "WATCHING" | "LISTENING" | "COMPETING";
}

function loadDefaultStatus(): StatusData {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading default status:", error);
    }
    return {text: "", type: "PLAYING"};
}

function saveDefaultStatus(status: StatusData): void {
    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
    } catch (error) {
        console.error("Error saving default status:", error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set-status")
        .setDescription("[TAH-UM] 🎭 Modifie le statut par défaut de Netricsa")
        .addStringOption((option) =>
            option
                .setName("text")
                .setDescription("Le texte du statut (laisser vide pour effacer le statut)")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Le type de statut")
                .setRequired(false)
                .addChoices(
                    {name: "🎮 Joue à", value: "PLAYING"},
                    {name: "👀 Regarde", value: "WATCHING"},
                    {name: "🎵 Écoute", value: "LISTENING"},
                    {name: "🏆 En compétition", value: "COMPETING"}
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            // Vérifier si l'utilisateur a la permission owner
            if (!hasOwnerPermission(member)) {
                await replyWithError(
                    interaction,
                    "Permission refusée",
                    "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                    true
                );
                return;
            }

            const text = interaction.options.getString("text") || "";
            const type = interaction.options.getString("type") as StatusData["type"] || "PLAYING";

            // Si le texte est vide, clear le statut
            if (!text || text.trim() === "") {
                // Sauvegarder un statut vide
                const statusData: StatusData = {text: "", type: "PLAYING"};
                saveDefaultStatus(statusData);

                // Appliquer le statut (ce qui va clear la présence)
                applyDefaultStatus(interaction.client);

                // Créer l'embed de confirmation
                const successEmbed = new EmbedBuilder()
                    .setColor(0x57F287) // Vert
                    .setTitle("✅ Statut Effacé")
                    .setDescription("Le statut par défaut de Netricsa a été effacé avec succès !")
                    .setFooter({text: `Effacé par ${interaction.user.displayName}`})
                    .setTimestamp();

                await interaction.reply({embeds: [successEmbed], ephemeral: true});

                // Logger la commande
                const channelName = getChannelNameFromInteraction(interaction);
                await logCommand(
                    "🔧 Set Status",
                    undefined,
                    [
                        {name: "👤 Owner", value: interaction.user.username, inline: true},
                        {name: "🧹 Action", value: "Statut effacé", inline: true}
                    ],
                    undefined,
                    channelName,
                    interaction.user.displayAvatarURL()
                );

                return;
            }

            // Sauvegarder le statut par défaut
            const statusData: StatusData = {text, type};
            saveDefaultStatus(statusData);

            // Appliquer le statut immédiatement
            applyDefaultStatus(interaction.client);

            const typeEmoji = {
                PLAYING: "🎮",
                WATCHING: "👀",
                LISTENING: "🎵",
                COMPETING: "🏆"
            }[type];

            const typeName = {
                PLAYING: "Joue à",
                WATCHING: "Regarde",
                LISTENING: "Écoute",
                COMPETING: "En compétition"
            }[type];

            // Créer l'embed de confirmation
            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287) // Vert
                .setTitle("✅ Statut Modifié")
                .setDescription("Le statut par défaut de Netricsa a été modifié avec succès !")
                .addFields(
                    {name: "📝 Type", value: `${typeEmoji} ${typeName}`, inline: true},
                    {name: "💬 Texte", value: text, inline: false}
                )
                .setFooter({text: `Modifié par ${interaction.user.displayName}`})
                .setTimestamp();

            await interaction.reply({embeds: [successEmbed], ephemeral: true});

            // Logger la commande
            const channelName = getChannelNameFromInteraction(interaction);
            await logCommand(
                "🔧 Set Status",
                undefined,
                [
                    {name: "👤 Owner", value: interaction.user.username, inline: true},
                    {name: "📝 Type", value: `${typeEmoji} ${typeName}`, inline: true},
                    {name: "💬 Texte", value: text, inline: false}
                ],
                undefined,
                channelName,
                interaction.user.displayAvatarURL()
            );

        } catch (error) {
            console.error("Error executing set-status command:", error);
            const errorEmbed = createErrorEmbed(
                "Erreur",
                "Une erreur s'est produite lors de la modification du statut."
            );

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({embeds: [errorEmbed]});
            } else {
                await interaction.reply({embeds: [errorEmbed], ephemeral: true});
            }
        }
    },
};
