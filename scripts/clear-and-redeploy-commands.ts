import {REST, Routes} from "discord.js";
import * as dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.DISCORD_LLM_BOT_TOKEN!;
const CLIENT_ID = process.env.DISCORD_LLM_BOT_CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID!;

const rest = new REST().setToken(TOKEN);

async function clearAndRedeploy() {
    try {
        console.log("🧹 Suppression de TOUTES les commandes globales...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), {body: []});
        console.log("✅ Commandes globales supprimées.");

        console.log("🧹 Suppression de TOUTES les commandes guild-only...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {body: []});
        console.log("✅ Commandes guild supprimées.");

        console.log("\n✅ Toutes les commandes ont été supprimées.");
        console.log("👉 Lance maintenant le déploiement normal pour remettre les bonnes commandes.");
    } catch (err) {
        console.error("❌ Erreur :", err);
    }
}

clearAndRedeploy();

