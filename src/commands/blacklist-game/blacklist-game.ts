import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, SlashCommandBuilder} from "discord.js";
import {addGameToBlacklist, disableLowPowerModeAuto, enableLowPowerModeAuto, getGameBlacklist, isManualMode, removeGameFromBlacklist} from "../../services/botStateService";
import {getCurrentGame} from "../../services/activityMonitor";
import {createSuccessEmbed, logCommand} from "../../utils/discordLogger";
import {hasOwnerPermission} from "../../utils/permissions";
import {setLowPowerStatus, setNormalStatus} from "../../services/statusService";
import {createErrorEmbed, handleInteractionError, replyWithError} from "../../utils/interactionUtils";
import {getChannelNameFromInteraction} from "../../utils/channelHelper";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blacklist-game")
        .setDescription("[TAH-UM] 🚫 Gère la blacklist des jeux qui ne déclenchent pas le Low Power Mode")
        .addStringOption(option =>
            option
                .setName("action")
                .setDescription("Action à effectuer")
                .setRequired(true)
                .addChoices(
                    {name: "➕ Ajouter le jeu actuel", value: "add-current"},
                    {name: "➕ Ajouter un jeu", value: "add"},
                    {name: "➖ Retirer un jeu", value: "remove"},
                    {name: "📋 Voir la liste", value: "list"}
                )
        )
        .addStringOption(option =>
            option
                .setName("game")
                .setDescription("Nom du jeu (requis pour ajouter/retirer)")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const member = interaction.member instanceof GuildMember ? interaction.member : null;

            if (!hasOwnerPermission(member)) {
                await replyWithError(
                    interaction,
                    "Permission refusée",
                    "Vous n'avez pas la permission d'utiliser cette commande.\n\n*Cette commande est réservée à Tah-Um uniquement.*",
                    true
                );
                return;
            }

            const action = interaction.options.getString("action", true);
            const gameName = interaction.options.getString("game");
            const channelName = getChannelNameFromInteraction(interaction);

            switch (action) {
                case "add-current": {
                    const currentGame = getCurrentGame();

                    if (!currentGame) {
                        await replyWithError(
                            interaction,
                            "Aucun jeu détecté",
                            "Tu ne sembles pas jouer à un jeu actuellement.\n\nUtilise l'action **Ajouter un jeu** pour ajouter un jeu manuellement.",
                            true
                        );
                        return;
                    }

                    addGameToBlacklist(currentGame);

                    // Réévaluer le statut : si on joue à ce jeu et qu'on est en mode auto, désactiver le Low Power
                    if (!isManualMode() && currentGame === getCurrentGame()) {
                        console.log(`[BlacklistGame] Game "${currentGame}" now blacklisted, re-evaluating status...`);
                        const disabled = disableLowPowerModeAuto();
                        if (disabled) {
                            await setNormalStatus(interaction.client);
                            console.log(`[BlacklistGame] ⚡ Disabled Low Power Mode (game now blacklisted)`);
                        }
                    }

                    const successEmbed = createSuccessEmbed(
                        "🎮 Jeu ajouté à la blacklist",
                        `**${currentGame}** a été ajouté à la blacklist.\n\nNetricsa ne se mettra plus automatiquement en Low Power Mode quand tu joueras à ce jeu.`
                    );

                    await interaction.reply({embeds: [successEmbed], flags: MessageFlags.Ephemeral});

                    await logCommand("🎮 Jeu blacklisté", undefined, [
                        {name: "👤 Par", value: interaction.user.username, inline: true},
                        {name: "🎮 Jeu", value: currentGame, inline: true}
                    ], undefined, channelName);
                    break;
                }

                case "add": {
                    if (!gameName) {
                        await replyWithError(
                            interaction,
                            "Nom de jeu requis",
                            "Tu dois spécifier le nom du jeu dans le champ **game**.",
                            true
                        );
                        return;
                    }

                    addGameToBlacklist(gameName);

                    // Réévaluer le statut : si on joue à ce jeu et qu'on est en mode auto, désactiver le Low Power
                    const currentGame = getCurrentGame();
                    if (!isManualMode() && currentGame === gameName) {
                        console.log(`[BlacklistGame] Game "${gameName}" now blacklisted, re-evaluating status...`);
                        const disabled = disableLowPowerModeAuto();
                        if (disabled) {
                            await setNormalStatus(interaction.client);
                            console.log(`[BlacklistGame] ⚡ Disabled Low Power Mode (game now blacklisted)`);
                        }
                    }

                    const successEmbed = createSuccessEmbed(
                        "🎮 Jeu ajouté à la blacklist",
                        `**${gameName}** a été ajouté à la blacklist.\n\nNetricsa ne se mettra plus automatiquement en Low Power Mode quand tu joueras à ce jeu.`
                    );

                    await interaction.reply({embeds: [successEmbed], flags: MessageFlags.Ephemeral});

                    await logCommand("🎮 Jeu blacklisté", undefined, [
                        {name: "👤 Par", value: interaction.user.username, inline: true},
                        {name: "🎮 Jeu", value: gameName, inline: true}
                    ], undefined, channelName);
                    break;
                }

                case "remove": {
                    if (!gameName) {
                        await replyWithError(
                            interaction,
                            "Nom de jeu requis",
                            "Tu dois spécifier le nom du jeu dans le champ **game**.",
                            true
                        );
                        return;
                    }

                    const removed = removeGameFromBlacklist(gameName);

                    if (removed) {
                        // Réévaluer le statut : si on joue à ce jeu et qu'on est en mode auto, activer le Low Power
                        const currentGame = getCurrentGame();
                        if (!isManualMode() && currentGame === gameName) {
                            console.log(`[BlacklistGame] Game "${gameName}" removed from blacklist, re-evaluating status...`);
                            const enabled = enableLowPowerModeAuto();
                            if (enabled) {
                                await setLowPowerStatus(interaction.client);
                                console.log(`[BlacklistGame] 🔋 Enabled Low Power Mode (game removed from blacklist)`);
                            }
                        }

                        const successEmbed = createSuccessEmbed(
                            "🎮 Jeu retiré de la blacklist",
                            `**${gameName}** a été retiré de la blacklist.\n\nNetricsa se mettra automatiquement en Low Power Mode si tu joues à ce jeu.`
                        );
                        await interaction.reply({embeds: [successEmbed], flags: MessageFlags.Ephemeral});

                        await logCommand("🎮 Jeu retiré de la blacklist", undefined, [
                            {name: "👤 Par", value: interaction.user.username, inline: true},
                            {name: "🎮 Jeu", value: gameName, inline: true}
                        ], undefined, channelName);
                    } else {
                        const errorEmbed = createErrorEmbed(
                            "Jeu introuvable",
                            `**${gameName}** n'est pas dans la blacklist.`
                        );
                        await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                    }
                    break;
                }

                case "list": {
                    const blacklist = getGameBlacklist();

                    const embed = new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle("🎮 Blacklist des jeux")
                        .setTimestamp();

                    if (blacklist.length === 0) {
                        embed.setDescription("Aucun jeu dans la blacklist.\n\nNetricsa se mettra automatiquement en Low Power Mode pour tous les jeux.");
                    } else {
                        const gameList = blacklist.map((game, index) => `${index + 1}. ${game}`).join("\n");
                        embed.setDescription(
                            `**${blacklist.length} jeu(x) blacklisté(s)** :\n\n${gameList}\n\n` +
                            `*Ces jeux ne déclenchent PAS le Low Power Mode automatique.*`
                        );
                    }

                    await interaction.reply({embeds: [embed], flags: MessageFlags.Ephemeral});
                    break;
                }
            }
        } catch (error: any) {
            await handleInteractionError(interaction, error, "BlacklistGame");
        }
    },
};
