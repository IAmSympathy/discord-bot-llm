import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from "discord.js";
import {getRandomMeme} from "../../services/memeService";
import {createErrorEmbed, logCommand} from "../../utils/discordLogger";
import * as fs from "fs";
import * as path from "path";

const MEME_CHANNEL_ID = process.env.MEME_CHANNEL_ID;
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
        .setDescription("Demande à Netricsa de trouver un meme aléatoire"),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            if (!MEME_CHANNEL_ID) {
                const errorEmbed = createErrorEmbed(
                    "Configuration manquante",
                    "Le salon pour les memes n'est pas configuré (MEME_CHANNEL_ID)."
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Vérifier que la commande est utilisée dans le bon salon
            if (interaction.channelId !== MEME_CHANNEL_ID) {
                const errorEmbed = createErrorEmbed(
                    "Salon incorrect",
                    `Cette commande ne peut être utilisée que dans <#${MEME_CHANNEL_ID}>.`
                );
                await interaction.reply({embeds: [errorEmbed], flags: MessageFlags.Ephemeral});
                return;
            }

            // Réponse immédiate
            await interaction.reply("🎭 Recherche d'un meme...");

            // Récupérer un meme
            const meme = await getRandomMeme();

            if (!meme) {
                await interaction.editReply("🤷 Désolée, je n'ai plus de nouveaux memes à partager pour le moment !");
                return;
            }

            // Éditer le message pour afficher le titre en citation et l'URL du meme
            await interaction.editReply(`> ${meme.title}\n${meme.url}`);

            // Enregistrer dans l'historique
            saveMemeToHistory(meme);

            console.log(`[FindMeme] Posted meme: "${meme.title}" (${meme.id})`);

            // Logger la commande
            await logCommand("🎭 Meme posté", undefined, [
                {name: "👤 Demandé par", value: interaction.user.username, inline: true},
                {name: "📺 Salon", value: `<#${MEME_CHANNEL_ID}>`, inline: true}
            ]);
        } catch (error) {
            console.error("[FindMeme] Error executing command:", error);
            const errorMessage = "❌ Une erreur s'est produite lors de la recherche du meme.";

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(errorMessage).catch(console.error);
            } else {
                await interaction.reply({content: errorMessage, flags: MessageFlags.Ephemeral}).catch(console.error);
            }
        }
    },
};


