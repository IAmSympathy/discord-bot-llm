require("dotenv").config();
import path from "path";
import fs from "fs";
import {ActivityType, Client, Collection, Events, GatewayIntentBits, MessageFlags, PresenceStatusData} from "discord.js";
import {registerWatchedChannelResponder} from "./watchChannel";
import {registerForumThreadHandler} from "./forumThreadHandler";
import {registerCitationsThreadHandler} from "./citationsThreadHandler";
import deployCommands from "./deploy/deployCommands";

export async function setBotPresence(client: Client, status: PresenceStatusData, activityName?: string) {
    if (!client.user) return;

    if (!activityName) activityName = "";

    await client.user.setPresence({
        status: status,
        activities: [{name: activityName, type: ActivityType.Playing}],
    });
}

// Load environment variables
const BOT_TOKEN = process.env.DISCORD_LLM_BOT_TOKEN;

// Create an instance of Client and set the intents to listen for messages.
const client = new Client({
    intents: [GatewayIntentBits.GuildMessageTyping, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Deploy commands
deployCommands();

// Register the watched channel responder
registerWatchedChannelResponder(client);

// Register the forum thread handler
registerForumThreadHandler(client);

// Register the citations thread handler
registerCitationsThreadHandler(client);

// Once the WebSocket is connected, log a message to the console.
client.once(Events.ClientReady, () => {
    console.log("Bot is online!");
});

if (client.user) {
    client.user.setPresence({
        status: "online",
        activities: [
            {
                name: " ",
                type: 3, // WATCHING
            },
        ],
    });
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error: any) {
        console.error("[Command Error]", error);

        // Si l'interaction a expiré (Unknown interaction), on ne peut plus répondre
        if (error?.code === 10062 || error?.rawError?.code === 10062) {
            console.warn(`[Command] Interaction expired for ${interaction.commandName} - user took too long or network delay`);
            return;
        }

        // Essayer de répondre seulement si l'interaction est encore valide
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral});
            } else {
                await interaction.reply({content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral});
            }
        } catch (replyError: any) {
            // Si on ne peut pas répondre (interaction expirée), log seulement
            if (replyError?.code === 10062) {
                console.warn(`[Command] Could not send error message - interaction already expired`);
            } else {
                console.error("[Command] Error sending error message:", replyError);
            }
        }
    }
});

// Log in with the bot's token.
client.login(BOT_TOKEN);
