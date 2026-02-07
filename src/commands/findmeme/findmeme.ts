import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {getRandomMeme} from "../../services/memeService";
import {logCommand} from "../../utils/discordLogger";
import {EnvConfig} from "../../utils/envConfig";
import {handleInteractionError, replyWithError} from "../../utils/interactionUtils";
import {NETRICSA_USER_ID, NETRICSA_USERNAME, recordMemeSearched} from "../../services/userStatsService";
import * as fs from "fs";
import * as path from "path";

const MEME_CHANNEL_ID = EnvConfig.MEME_CHANNEL_ID;
const MEME_HISTORY_FILE = path.join(process.cwd(), "data", "posted_memes.json");

interface PostedMeme {
    id: string;
    title: string;
    url: string;
    postedAt: number;
}

function saveMemeToHistory(meme: { id: string; title: string; url: string }): void {
    try {
        const dir = path.dirname(MEME_HISTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }

        let history: PostedMeme[] = [];
        if (fs.existsSync(MEME_HISTORY_FILE)) {
            const data = fs.readFileSync(MEME_HISTORY_FILE, "utf-8");
            history = JSON.parse(data);
        }

        history.push({
            id: meme.id,
            title: meme.title,
            url: meme.url,
            postedAt: Date.now()
        });

        fs.writeFileSync(MEME_HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
    } catch (error) {
        console.error("[FindMeme] Error saving meme history:", error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("findmeme")
        .setDescription("Demande à Netricsa de trouver un meme sur internet"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            if (!MEME_CHANNEL_ID) {
                await replyWithError(
                    interaction,
                    "Configuration manquante",
                    "Le salon pour les memes n'est pas configuré (MEME_CHANNEL_ID).",
                    true
                );
                return;
            }

            // Note: La vérification du canal est maintenant gérée par le système centralisé dans bot.ts

            // Réponse immédiate
            await interaction.reply("Recherche d'un meme...");

            // Récupérer un meme
            const meme = await getRandomMeme();

            if (!meme) {
                await interaction.editReply("Désolée, je n'ai plus de nouveaux memes à partager pour le moment !");
                return;
            }

            // Éditer le message pour afficher le titre en citation et l'URL du meme
            await interaction.editReply(`> ${meme.title}\n${meme.url}`);

            // Enregistrer dans l'historique
            saveMemeToHistory(meme);

            console.log(`[FindMeme] Posted meme: "${meme.title}" (${meme.id})`);

            // Enregistrer dans les statistiques utilisateur
            recordMemeSearched(interaction.user.id, interaction.user.username);
            // Enregistrer aussi pour Netricsa elle-même
            recordMemeSearched(NETRICSA_USER_ID, NETRICSA_USERNAME);

            // Vérifier les achievements Netricsa
            const {checkNetricsaAchievements} = require("../../services/netricsaAchievementChecker");
            await checkNetricsaAchievements(
                interaction.user.id,
                interaction.user.username,
                interaction.client,
                interaction.channelId
            );

            // Ajouter XP avec notification
            const {addXP, XP_REWARDS} = require("../../services/xpSystem");
            if (interaction.channel) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.memeRecherche,
                    interaction.channel,
                    false // Les utilisateurs de commandes ne sont jamais des bots
                );
            }

            // Logger la commande
            await logCommand("🎭 Meme posté", undefined, [
                {name: "👤 Demandé par", value: interaction.user.username, inline: true},
                {name: "📺 Salon", value: `<#${MEME_CHANNEL_ID}>`, inline: true}
            ]);
        } catch (error: any) {
            await handleInteractionError(interaction, error, "FindMeme");
        }
    },
};
