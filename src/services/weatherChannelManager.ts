import {ChannelType, Client, Events, Guild, PermissionFlagsBits, VoiceChannel} from "discord.js";
import {createLogger} from "../utils/logger";
import {formatWeatherChannelName, getSherbrookeWeather} from "./weatherService";
import {EnvConfig} from "../utils/envConfig";

const logger = createLogger("WeatherChannelManager");

const WEATHER_CHANNEL_NAME_PREFIX = "🌡️";
const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes

let weatherChannelId: string | null = null;
let updateInterval: NodeJS.Timeout | null = null;

/**
 * Trouve le canal vocal météo existant
 */
async function findWeatherChannel(guild: Guild): Promise<VoiceChannel | null> {
    try {
        // Rafraîchir les canaux
        await guild.channels.fetch();

        // Chercher un canal vocal qui commence par l'emoji météo
        const channels = guild.channels.cache.filter(
            channel => channel.type === ChannelType.GuildVoice &&
                channel.name.startsWith(WEATHER_CHANNEL_NAME_PREFIX)
        );

        if (channels.size > 0) {
            return channels.first() as VoiceChannel;
        }

        return null;
    } catch (error) {
        logger.error("Error finding weather channel:", error);
        return null;
    }
}

/**
 * Crée le canal vocal météo en haut du serveur
 */
async function createWeatherChannel(guild: Guild): Promise<VoiceChannel | null> {
    try {
        logger.info("Creating weather voice channel...");

        // Récupérer la météo actuelle
        const weather = await getSherbrookeWeather();

        if (!weather) {
            logger.error("Could not fetch weather data to create channel (this should not happen with fallback)");
            return null;
        }

        const channelName = formatWeatherChannelName(weather);

        logger.info(`Creating channel with name: ${channelName}`);

        // Créer le canal vocal avec permissions pour empêcher les connexions
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            position: 0, // En haut
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [
                        PermissionFlagsBits.Connect, // Empêcher de se connecter
                        PermissionFlagsBits.Speak,   // Empêcher de parler
                    ],
                    allow: [
                        PermissionFlagsBits.ViewChannel, // Permettre de voir
                    ]
                },
                {
                    id: guild.members.me!.id, // Le bot
                    allow: [
                        PermissionFlagsBits.ManageChannels, // Pour pouvoir modifier
                        PermissionFlagsBits.ViewChannel,
                    ]
                }
            ]
        });

        logger.info(`✅ Weather channel created successfully: ${channel.name} (ID: ${channel.id})`);

        // Déplacer le canal tout en haut
        await channel.setPosition(0);

        return channel as VoiceChannel;

    } catch (error) {
        logger.error("Error creating weather channel:", error);
        return null;
    }
}

/**
 * Met à jour le nom du canal vocal météo
 */
async function updateWeatherChannel(guild: Guild): Promise<void> {
    try {
        // Trouver ou créer le canal
        let channel = await findWeatherChannel(guild);

        if (!channel) {
            logger.info("Weather channel not found, creating it...");
            channel = await createWeatherChannel(guild);

            if (!channel) {
                logger.error("Failed to create weather channel");
                return;
            }

            weatherChannelId = channel.id;
        }

        // Récupérer la météo actuelle
        const weather = await getSherbrookeWeather();

        if (!weather) {
            logger.error("Could not fetch weather data");
            return;
        }

        const newName = formatWeatherChannelName(weather);

        // Mettre à jour le nom si nécessaire
        if (channel.name !== newName) {
            await channel.setName(newName);
            logger.info(`Weather channel updated: ${newName}`);
        } else {
            logger.info(`Weather channel name unchanged: ${newName}`);
        }

        // S'assurer que le canal est toujours en haut
        if (channel.position !== 0) {
            await channel.setPosition(0);
            logger.info("Weather channel moved to top position");
        }

    } catch (error) {
        logger.error("Error updating weather channel:", error);
    }
}

/**
 * Initialise le canal vocal météo et démarre les mises à jour automatiques
 */
export function registerWeatherChannel(client: Client): void {
    logger.info("Weather channel manager initialized");

    client.once(Events.ClientReady, async () => {
        logger.info("Initializing weather channel...");

        try {
            // Obtenir le serveur principal
            const guildId = EnvConfig.GUILD_ID;

            if (!guildId) {
                logger.error("❌ GUILD_ID not configured in .env - Weather channel disabled");
                return;
            }

            logger.info(`Fetching guild ${guildId}...`);
            const guild = await client.guilds.fetch(guildId);

            if (!guild) {
                logger.error(`❌ Guild ${guildId} not found - Weather channel disabled`);
                return;
            }

            logger.info(`✅ Guild found: ${guild.name}`);

            // Créer ou mettre à jour le canal immédiatement
            logger.info("Creating/updating weather channel...");
            await updateWeatherChannel(guild);

            // Configurer les mises à jour automatiques toutes les 30 minutes
            updateInterval = setInterval(async () => {
                logger.info("Running scheduled weather update...");
                await updateWeatherChannel(guild);
            }, UPDATE_INTERVAL);

            logger.info(`✅ Weather channel updates scheduled every ${UPDATE_INTERVAL / 60000} minutes`);

        } catch (error) {
            logger.error("❌ Error initializing weather channel:", error);
        }
    });
}

/**
 * Arrête les mises à jour automatiques (pour cleanup)
 */
export function stopWeatherUpdates(): void {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        logger.info("Weather updates stopped");
    }
}

