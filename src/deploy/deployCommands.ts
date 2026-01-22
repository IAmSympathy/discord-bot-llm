import path from "path";
import { REST, Routes } from "discord.js";

const commands: any[] = [];
const foldersPath = path.join(__dirname, "..", "commands");
const commandFolders = require("fs").readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = require("fs")
    .readdirSync(commandsPath)
    .filter((file: string) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

const deployCommands = async () => {
  const rest = new REST().setToken(process.env.DISCORD_LLM_BOT_TOKEN!);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data: any = await rest.put(Routes.applicationCommands(process.env.DISCORD_LLM_BOT_CLIENT_ID!), {
      body: commands,
    });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
};

export default deployCommands;
