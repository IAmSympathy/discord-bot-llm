import path from "path";
import {REST, Routes} from "discord.js";
import {createLogger} from "../utils/logger";

const logger = createLogger("DeployCommands");

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
            logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const deployCommands = async () => {
    const rest = new REST().setToken(process.env.DISCORD_LLM_BOT_TOKEN!);

    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands.`);

        const data: any = await rest.put(Routes.applicationCommands(process.env.DISCORD_LLM_BOT_CLIENT_ID!), {
            body: commands,
        });

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        logger.error("Error deploying commands:", error);
    }
};
export default deployCommands;
