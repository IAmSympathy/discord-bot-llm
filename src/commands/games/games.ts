import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("games")
        .setDescription("Affiche le menu des jeux disponibles"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            await showGameMenu(interaction);
        } catch (error: any) {
            await handleInteractionError(interaction, error, "Games");
        }
    },

    // Exporter pour utilisation depuis les jeux
    showGameMenu
};

export async function showGameMenu(interaction: any, originalUserId?: string) {
    const userId = originalUserId || interaction.user.id;
    const embed = new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle("🎮 Menu des Jeux")
        .setDescription(
            "Choisis un jeu pour commencer !\n\n"
        )
        .setTimestamp();

    const rpsButton = new ButtonBuilder()
        .setCustomId("game_rps")
        .setLabel("Roche-Papier-Ciseaux (1-2 Joueurs)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🪨");

    const tttButton = new ButtonBuilder()
        .setCustomId("game_ttt")
        .setLabel("Tic-Tac-Toe (1-2 Joueurs)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("❌");

    const hangmanButton = new ButtonBuilder()
        .setCustomId("game_hangman")
        .setLabel("Bonhomme Pendu (1 Joueur)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔤");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rpsButton, tttButton, hangmanButton);

    // Si c'est une interaction de bouton (retour au menu), utiliser update() au lieu de reply()
    const isButtonInteraction = interaction.isButton && interaction.isButton();
    let message;

    if (isButtonInteraction) {
        message = await interaction.update({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });
    } else {
        message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });
    }

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 minutes
    });

    collector.on("collect", async (i: any) => {
        try {
            if (i.user.id !== userId) {
                await i.reply({content: "❌ Ce n'est pas ton menu !", ephemeral: true});
                return;
            }

            collector.stop("game_selected");

            if (i.customId === "game_rps") {
                await showRPSModeSelection(i, userId);
            } else if (i.customId === "game_ttt") {
                await showTTTModeSelection(i, userId);
            } else if (i.customId === "game_hangman") {
                await startHangman(i, userId);
            }
        } catch (error) {
            console.error("[Games] Error handling game selection:", error);
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
            const timeoutEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🎮 Menu des Jeux")
                .setDescription("⏱️ Le temps pour choisir un jeu est écoulé.")
                .setTimestamp();

            await interaction.editReply({embeds: [timeoutEmbed], components: []});
        }
    });
}

async function showRPSModeSelection(interaction: any, originalUserId: string) {
    const embed = new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle("🪨 Roche-Papier-Ciseaux 📄✂️")
        .setDescription("Choisis ton mode de jeu :")
        .setTimestamp();

    const playerButton = new ButtonBuilder()
        .setCustomId("rps_mode_player")
        .setLabel("Contre un joueur")
        .setStyle(ButtonStyle.Success)
        .setEmoji("👤");

    const aiButton = new ButtonBuilder()
        .setCustomId("rps_mode_ai")
        .setLabel("Contre Netricsa")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("<:zzzRole_NetricsaModule:1466997072564584631>");


    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playerButton, aiButton);

    await interaction.update({embeds: [embed], components: [row]});

    const collector = interaction.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on("collect", async (i: any) => {
        if (i.user.id !== originalUserId) {
            await i.reply({content: "Ce n'est pas ton menu !", ephemeral: true});
            return;
        }

        collector.stop();

        const rpsModule = require("../../games/rockpaperscissors/rockpaperscissors");
        const mode = i.customId === "rps_mode_ai" ? "ai" : "player";
        const playerId = i.user.id;
        const gameId = i.channelId + "_" + Date.now();

        if (mode === "ai") {
            await rpsModule.startGameAgainstAI(i, playerId, gameId, originalUserId);
        } else {
            await rpsModule.waitForPlayer(i, playerId, gameId, originalUserId);
        }
    });
}

async function showTTTModeSelection(interaction: any, originalUserId: string) {
    const embed = new EmbedBuilder()
        .setColor(0x2494DB)
        .setTitle("❌ Tic-Tac-Toe ⭕")
        .setDescription("Choisis ton mode de jeu :")
        .setTimestamp();

    const aiButton = new ButtonBuilder()
        .setCustomId("ttt_mode_ai")
        .setLabel("Contre Netricsa")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("<:zzzRole_NetricsaModule:1466997072564584631>");

    const playerButton = new ButtonBuilder()
        .setCustomId("ttt_mode_player")
        .setLabel("Contre un joueur")
        .setStyle(ButtonStyle.Success)
        .setEmoji("👤");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(playerButton, aiButton);

    await interaction.update({embeds: [embed], components: [row]});

    const collector = interaction.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on("collect", async (i: any) => {
        if (i.user.id !== originalUserId) {
            await i.reply({content: "Ce n'est pas ton menu !", ephemeral: true});
            return;
        }

        collector.stop();

        const tttModule = require("../../games/tictactoe/tictactoe");
        const mode = i.customId === "ttt_mode_ai" ? "ai" : "player";
        const playerId = i.user.id;
        const gameId = i.channelId + "_" + Date.now();

        if (mode === "ai") {
            await tttModule.startGameAgainstAI(i, playerId, gameId, originalUserId);
        } else {
            await tttModule.waitForPlayer(i, playerId, gameId, originalUserId);
        }
    });
}

async function startHangman(interaction: any, originalUserId: string) {
    const hangmanModule = require("../../games/hangman/hangman");
    const playerId = interaction.user.id;
    const gameId = interaction.channelId + "_" + playerId + "_" + Date.now();

    await hangmanModule.startGame(interaction, playerId, gameId, originalUserId);
}
