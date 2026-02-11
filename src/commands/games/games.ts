import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {handleInteractionError} from "../../utils/interactionUtils";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("games")
        .setDescription("🎮 Affiche le menu des jeux disponibles"),

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

    const connect4Button = new ButtonBuilder()
        .setCustomId("game_connect4")
        .setLabel("Connect 4 (1-2 Joueurs)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔴");

    const blackjackButton = new ButtonBuilder()
        .setCustomId("game_blackjack")
        .setLabel("Blackjack (1 Joueur)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🃏");

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(rpsButton, tttButton, connect4Button);
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(blackjackButton, hangmanButton);

    // Si c'est une interaction de bouton (retour au menu), utiliser update() au lieu de reply()
    const isButtonInteraction = interaction.isButton && interaction.isButton();
    let message;

    if (isButtonInteraction) {
        message = await interaction.update({
            embeds: [embed],
            components: [row1, row2],
            fetchReply: true
        });
    } else {
        message = await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
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
            } else if (i.customId === "game_connect4") {
                await showConnect4ModeSelection(i, userId);
            } else if (i.customId === "game_blackjack") {
                await startBlackjack(i, userId);
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
    const rpsModule = require("../../games/rockpaperscissors/rockpaperscissors");
    await rpsModule.showModeSelection(interaction, originalUserId);
}

async function showTTTModeSelection(interaction: any, originalUserId: string) {
    const tttModule = require("../../games/tictactoe/tictactoe");
    await tttModule.showModeSelection(interaction, originalUserId);
}

async function startHangman(interaction: any, originalUserId: string) {
    const hangmanModule = require("../../games/hangman/hangman");
    const playerId = interaction.user.id;
    const gameId = interaction.channelId + "_" + playerId + "_" + Date.now();

    await hangmanModule.startGame(interaction, playerId, gameId, originalUserId);
}

async function showConnect4ModeSelection(interaction: any, originalUserId: string) {
    const c4Module = require("../../games/connect4/connect4");
    await c4Module.showModeSelection(interaction, originalUserId);
}

async function startBlackjack(interaction: any, originalUserId: string) {
    const blackjackModule = require("../../games/blackjack/blackjack");
    await blackjackModule.startGame(interaction, originalUserId);
}

