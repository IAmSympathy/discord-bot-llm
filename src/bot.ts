require("dotenv").config();
import { Client, Events, GatewayIntentBits } from "discord.js";
import { registerWatchedChannelResponder } from "./watchChannel";

// Load environment variables
const BOT_TOKEN = process.env.DISCORD_LLM_BOT_TOKEN;

// Create an instance of Client and set the intents to listen for messages.
const client = new Client({
  intents: [GatewayIntentBits.GuildMessageTyping, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

// Register the watched channel responder
registerWatchedChannelResponder(client);

// Once the WebSocket is connected, log a message to the console.
client.once(Events.ClientReady, () => {
  console.log("Bot is online!");
});

// Log in with the bot's token.
client.login(BOT_TOKEN);
