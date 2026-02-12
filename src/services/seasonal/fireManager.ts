import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {cleanExpiredCooldowns, getWeatherProtectionInfo, isWeatherProtectionActive, loadFireData, resetDailyStats, saveFireData} from "./fireDataManager";
import {FIRE_COLORS, FIRE_CONFIG, FIRE_EMOJIS, FIRE_NAMES, getFireMultiplier, getFireState} from "./fireData";

const logger = createLogger("FireManager");

let updateInterval: NodeJS.Timeout | null = null; // Intervalle unique qui gère tout (2s)
let dailyResetInterval: NodeJS.Timeout | null = null;

// Frame d'animation actuelle (pour alterner les visuels)
let animationFrame = 0;

// Cache de la météo pour éviter de fetch plusieurs fois par cycle
let weatherCache: { data: WeatherData | null; timestamp: number } | null = null;
const WEATHER_CACHE_DURATION = 15000; // 15 secondes (synchronisé avec l'intervalle de mise à jour)

/**
 * Interface pour les données météo
 */
interface WeatherData {
    temperature: number;
    condition: string;
    emoji: string;
}

/**
 * Récupère les données météo depuis le nom du salon Discord au lieu d'appeler l'API
 * Format attendu: "❄️ Chutes de neige, -4°"
 * Utilise un cache pour éviter de fetch plusieurs fois par cycle
 */
function getWeatherFromChannel(client: Client): WeatherData | null {
    // Vérifier si on a un cache valide
    const now = Date.now();
    if (weatherCache && (now - weatherCache.timestamp) < WEATHER_CACHE_DURATION) {
        return weatherCache.data;
    }
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return null;

        // Liste des emojis météo possibles
        const WEATHER_EMOJIS = ['☀️', '🌤️', '⛅', '☁️', '🌧️', '🌦️', '⛈️', '🌨️', '❄️', '🌫️', '💨', '🌪️', '🌡️', '🌩️', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

        // Chercher le salon météo
        const weatherChannel = guild.channels.cache.find(
            channel => {
                if (channel.type !== ChannelType.GuildVoice) return false;
                const startsWithWeatherEmoji = WEATHER_EMOJIS.some(emoji => channel.name.startsWith(emoji));
                const hasTemperature = channel.name.includes('°');
                return startsWithWeatherEmoji && hasTemperature;
            }
        );

        if (!weatherChannel) {
            logger.debug("Weather channel not found");
            return null;
        }

        // Parser le nom du salon: "❄️ Chutes de neige, -4°"
        const channelName = weatherChannel.name;

        // Extraire l'emoji (peut être 1 ou 2 caractères pour les emojis avec variante de couleur)
        // Les emojis comme ❄️ sont composés de 2 caractères (❄ + sélecteur de variation)
        let emoji = channelName[0];
        // Vérifier s'il y a un sélecteur de variation (U+FE0F) pour les emojis colorés
        if (channelName.length > 1 && channelName.charCodeAt(1) === 0xFE0F) {
            emoji = channelName.substring(0, 2); // Capturer l'emoji avec sa variante
        }

        // Extraire la température (chercher un nombre suivi de °)
        const tempMatch = channelName.match(/(-?\d+)°/);
        const temperature = tempMatch ? parseInt(tempMatch[1]) : 0;

        // Extraire la condition (entre l'emoji et la température)
        const conditionMatch = channelName.match(/^\S+\s+(.+),\s*-?\d+°/);
        const condition = conditionMatch ? conditionMatch[1].trim() : "Inconnu";

        const weatherData = {
            temperature,
            condition,
            emoji
        };

        // Mettre à jour le cache
        weatherCache = {
            data: weatherData,
            timestamp: Date.now()
        };

        logger.debug(`Weather from channel: ${temperature}°C, ${condition} (${emoji})`);

        return weatherData;
    } catch (error) {
        logger.debug("Error parsing weather from channel:", error);

        // En cas d'erreur, mettre en cache null
        weatherCache = {
            data: null,
            timestamp: Date.now()
        };

        return null;
    }
}

/**
 * Invalide le cache météo pour forcer un refresh
 */
export function invalidateWeatherCache(): void {
    weatherCache = null;
}

/**
 * Initialise le système de feu
 */
export async function initializeFireSystem(client: Client): Promise<void> {
    logger.info("Initializing Fire System...");

    // Charger les données
    const fireData = loadFireData();

    // Démarrer l'intervalle unique qui gère TOUT (decay + embed + channel)
    startUnifiedUpdates(client);

    // Démarrer le reset quotidien
    startDailyReset();

    // Créer/mettre à jour le salon vocal et l'embed initialement
    await updateFireChannel(client);
    await updateFireEmbed(client);

    logger.info(`Fire System initialized. Current intensity: ${fireData.intensity}%`);
}

/**
 * Formate une durée en millisecondes en texte lisible
 */
function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return "Bientôt";

    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h ${minutes}min`;
        }
        return `${hours}h`;
    }

    return `${minutes}min`;
}

/**
 * Obtient le multiplicateur de vitesse de brûlage selon la température
 * Plus le multiplicateur est élevé, plus les bûches se consument vite
 * C'est un feu de FOYER (intérieur), donc seule la température extérieure compte
 * LIT LES DONNÉES DEPUIS LE SALON MÉTÉO DISCORD
 * Note : Les protections ne modifient plus ce multiplicateur, elles réduisent directement l'âge effectif
 */
async function getWeatherBurnMultiplier(client: Client): Promise<number> {
    let weatherMultiplier = 1.0; // Par défaut, vitesse normale

    try {
        const weather = getWeatherFromChannel(client);

        if (weather) {
            const temp = weather.temperature;

            // Ajuster la vitesse de brûlage selon la température extérieure
            // Multiplicateurs adoucis pour s'adapter aux bûches de 12h
            if (temp < -20) {
                weatherMultiplier = 1.2; // Froid extrême : brûle 20% plus vite (10h au lieu de 12h)
            } else if (temp < -13) {
                weatherMultiplier = 1.1; // Froid : brûle 10% plus vite (≈11h au lieu de 12h)
            } else if (temp > 0) {
                weatherMultiplier = 0.9; // Temps doux : brûle 10% plus lentement (≈13h au lieu de 12h)
            }
        }
    } catch (error) {
        logger.debug("Could not get weather from channel, using default rate");
    }

    return weatherMultiplier;
}

/**
 * Calcule la contribution actuelle d'une bûche en fonction de son âge effectif accumulé
 * L'âge effectif est mis à jour progressivement selon les conditions (météo, protection)
 */
async function calculateLogContribution(log: any, now: number): Promise<number> {
    // Utiliser l'âge effectif accumulé (ou 0 si pas encore défini - migration)
    const effectiveAge = log.effectiveAge || 0;

    // Si l'âge effectif dépasse le temps de brûlage standard, la bûche est consumée
    if (effectiveAge >= FIRE_CONFIG.LOG_BURN_TIME) {
        return 0;
    }

    // Contribution fixe jusqu'à ce que la bûche brûle complètement (pas de décroissance)
    return log.initialContribution || FIRE_CONFIG.LOG_BONUS;
}

/**
 * Calcule l'intensité totale basée sur les contributions de toutes les bûches
 */
async function calculateTotalIntensity(fireData: any): Promise<number> {
    // Si aucune bûche, l'intensité est forcément 0
    if (fireData.logs.length === 0) {
        return 0;
    }

    const now = Date.now();
    let totalIntensity = 0;

    for (const log of fireData.logs) {
        totalIntensity += await calculateLogContribution(log, now);
    }

    return Math.min(FIRE_CONFIG.MAX_INTENSITY, Math.max(FIRE_CONFIG.MIN_INTENSITY, totalIntensity));
}

/**
 * Met à jour l'âge effectif de la bûche qui brûle actuellement (système de queue FIFO)
 * Seule la PREMIÈRE bûche (index 0) brûle - les autres attendent en queue
 */
async function updateLogsEffectiveAge(fireData: any, now: number, client: Client): Promise<void> {
    const weatherMultiplier = await getWeatherBurnMultiplier(client);

    // Système de queue : seule la première bûche brûle
    if (fireData.logs.length > 0) {
        const burningLog = fireData.logs[0]; // La première bûche est celle qui brûle

        // Migration : initialiser effectiveAge et lastUpdate si nécessaire
        if (burningLog.effectiveAge === undefined) {
            burningLog.effectiveAge = 0;
            burningLog.lastUpdate = burningLog.addedAt;
        }

        // Calculer le temps écoulé depuis la dernière mise à jour
        const timeSinceLastUpdate = now - burningLog.lastUpdate;

        // Accumuler l'âge effectif selon le multiplicateur actuel
        // Plus le multiplicateur est élevé, plus l'âge augmente vite (brûle plus vite)
        burningLog.effectiveAge += timeSinceLastUpdate * weatherMultiplier;

        // Mettre à jour le timestamp
        burningLog.lastUpdate = now;

        // Les autres bûches (index > 0) attendent en queue - elles ne brûlent pas
        // Leur effectiveAge reste à 0 jusqu'à ce qu'elles deviennent la première bûche
    }
}

/**
 * Démarre l'intervalle unifié qui gère TOUT toutes les 2 secondes :
 * - Mise à jour de l'âge effectif des bûches (decay)
 * - Retrait des bûches consumées
 * - Recalcul de l'intensité
 * - Mise à jour de l'embed avec animation
 * - Mise à jour du salon vocal
 */
function startUnifiedUpdates(client: Client): void {
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    updateInterval = setInterval(async () => {
        try {
            // === 1. BACKEND : Gestion des bûches et intensité ===
            const fireData = loadFireData();
            const now = Date.now();
            const oldIntensity = fireData.intensity;

            // Obtenir le multiplicateur météo
            const weatherMultiplier = await getWeatherBurnMultiplier(client);

            // Mettre à jour l'âge effectif de la bûche qui brûle (première de la queue)
            await updateLogsEffectiveAge(fireData, now, client);

            // Retirer la première bûche si elle est complètement consumée (système FIFO)
            if (fireData.logs.length > 0 && fireData.logs[0].effectiveAge >= FIRE_CONFIG.LOG_BURN_TIME) {
                const burnedLog = fireData.logs.shift(); // Retirer la première bûche

                if (burnedLog) {
                    logger.info(`Log burned: ${burnedLog.username} (weather: ${weatherMultiplier.toFixed(2)}x). Remaining: ${fireData.logs.length}`);
                }

                // Si une nouvelle bûche devient la première, initialiser son temps de brûlage
                if (fireData.logs.length > 0 && fireData.logs[0].lastUpdate === fireData.logs[0].addedAt) {
                    fireData.logs[0].lastUpdate = now;
                    logger.info(`Next log starts burning: ${fireData.logs[0].username}`);
                }
            }

            // Recalculer l'intensité totale
            fireData.intensity = await calculateTotalIntensity(fireData);

            // Vérification : si aucune bûche, forcer l'intensité à 0
            if (fireData.logs.length === 0 && fireData.intensity > 0) {
                logger.warn(`Intensity reset to 0 (was ${fireData.intensity.toFixed(1)}%) - no logs remaining`);
                fireData.intensity = 0;
            }

            fireData.lastUpdate = now;
            saveFireData(fireData);

            // Log les changements significatifs
            const oldState = getFireState(oldIntensity);
            const newState = getFireState(fireData.intensity);

            if (oldState !== newState) {
                logger.info(`Fire state changed: ${oldState} → ${newState}`);
            }

            // === 2. FRONTEND : Mise à jour visuelle ===
            // Incrémenter la frame d'animation
            animationFrame++;

            // Mettre à jour l'embed (avec animation et toutes les données actuelles)
            await updateFireEmbed(client);

            // Mettre à jour le salon vocal avec le multiplicateur actuel
            await updateFireChannel(client);

            // Nettoyer les cooldowns expirés
            cleanExpiredCooldowns();

        } catch (error) {
            logger.error("Error in unified update interval:", error);
        }
    }, FIRE_CONFIG.UPDATE_INTERVAL);

    logger.info(`Fire system unified updates started (2s interval - decay + embed + channel)`);
}

/**
 * Démarre le reset quotidien des statistiques
 */
function startDailyReset(): void {
    if (dailyResetInterval) {
        clearInterval(dailyResetInterval);
    }

    // Calculer le temps jusqu'à minuit
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Premier reset à minuit
    setTimeout(() => {
        resetDailyStats();

        // Puis tous les jours à minuit
        dailyResetInterval = setInterval(() => {
            resetDailyStats();
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    logger.info("Daily reset scheduled");
}

/**
 * Ajoute une bûche au feu
 */
export async function addLog(userId: string, username: string): Promise<{ success: boolean; newIntensity?: number; message: string }> {
    const fireData = loadFireData();

    const oldIntensity = fireData.intensity;

    const now = Date.now();

    // Ajouter la bûche au tableau avec sa contribution initiale
    fireData.logs.push({
        addedAt: now,
        userId,
        username,
        initialContribution: FIRE_CONFIG.LOG_BONUS, // 8%
        effectiveAge: 0, // Commence à 0
        lastUpdate: now // Timestamp de création
    });

    // Recalculer l'intensité totale basée sur toutes les bûches actives
    fireData.intensity = await calculateTotalIntensity(fireData);

    fireData.stats.logsToday++;
    fireData.stats.totalLogs++;
    fireData.stats.lastLog = {
        userId,
        username,
        timestamp: Date.now()
    };

    saveFireData(fireData);

    // Incrémenter le compteur historique de bûches pour cet utilisateur
    const {incrementUserLogCount} = require("./seasonalUserStatsService");
    incrementUserLogCount(userId);

    const oldState = getFireState(oldIntensity);
    const newState = getFireState(fireData.intensity);

    logger.info(`${username} added a log (${fireData.logs.length} total): ${oldIntensity.toFixed(1)}% → ${fireData.intensity.toFixed(1)}%`);

    // Message selon le changement d'état
    let message = `🪵 Tu as ajouté une bûche au feu ! (${oldIntensity.toFixed(1)}% → ${fireData.intensity.toFixed(1)}%)`;

    if (oldState !== newState) {
        message += `\n\n🔥 Le feu est maintenant **${FIRE_NAMES[newState]}** !`;
        logger.info(`Fire state improved: ${oldState} → ${newState}`);
    }

    return {
        success: true,
        newIntensity: fireData.intensity,
        message
    };
}

/**
 * Met à jour le salon vocal avec le multiplicateur XP global
 */
export async function updateFireChannel(client: Client): Promise<void> {
    try {
        const fireData = loadFireData();
        const guild = client.guilds.cache.first();

        if (!guild) return;

        // Calculer le multiplicateur total (feu de foyer pour l'instant, peut inclure d'autres sources plus tard)
        const fireMultiplier = getFireMultiplier(fireData.intensity);
        const totalMultiplier = fireMultiplier; // Plus tard: fireMultiplier * weatherMultiplier * etc.

        // Nom simple basé sur le multiplicateur (sans animation)
        const channelName = `💫 Multiplicateur XP - ×${totalMultiplier.toFixed(2)}`;

        // Trouver ou créer le salon vocal
        let voiceChannel: VoiceChannel | null = null;

        if (fireData.voiceChannelId) {
            voiceChannel = guild.channels.cache.get(fireData.voiceChannelId) as VoiceChannel;
        }

        // Chercher un salon existant si l'ID n'est pas sauvegardé
        if (!voiceChannel) {
            voiceChannel = guild.channels.cache.find(
                c => c.type === ChannelType.GuildVoice && (c.name.includes("XP ×") || c.name.includes("Multiplicateur XP") || c.name.includes("Feu de Foyer"))
            ) as VoiceChannel;
        }

        // Créer le salon s'il n'existe pas
        if (!voiceChannel) {
            voiceChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                userLimit: 0,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: ["Connect"] // Personne ne peut se connecter
                    }
                ]
            });

            fireData.voiceChannelId = voiceChannel.id;
            saveFireData(fireData);

            logger.info(`XP Multiplier voice channel created: ${voiceChannel.id}`);
        } else {
            // Mettre à jour le nom si différent
            if (voiceChannel.name !== channelName) {
                await voiceChannel.setName(channelName);
                logger.info(`XP Multiplier voice channel updated: ${channelName}`);
            }

            // Vérifier et mettre à jour les permissions pour empêcher les connexions
            const everyonePermissions = voiceChannel.permissionOverwrites.cache.get(guild.id);
            if (!everyonePermissions || !everyonePermissions.deny.has("Connect")) {
                await voiceChannel.permissionOverwrites.edit(guild.id, {
                    Connect: false
                });
                logger.info(`XP Multiplier voice channel permissions updated - connections disabled`);
            }
        }

        // Placer le salon en position 1 (juste sous la météo qui est en position 0)
        if (voiceChannel.position !== 1) {
            await voiceChannel.setPosition(1);
            logger.debug(`XP Multiplier voice channel positioned at 1 (below weather)`);
        }

    } catch (error) {
        logger.error("Error updating fire channel:", error);
    }
}

/**
 * Met à jour l'embed permanent du feu
 */
export async function updateFireEmbed(client: Client): Promise<void> {
    try {
        const fireData = loadFireData();
        const guild = client.guilds.cache.first();

        if (!guild) return;

        // Trouver le salon textuel dédié ou en créer un
        let textChannel: TextChannel | null = null;

        if (fireData.channelId) {
            textChannel = guild.channels.cache.get(fireData.channelId) as TextChannel;
        }

        // Chercher un salon existant si l'ID n'est pas sauvegardé
        if (!textChannel) {
            textChannel = guild.channels.cache.find(
                c => c.type === ChannelType.GuildText && c.name.includes("feu-de-foyer")
            ) as TextChannel;
        }

        // Créer le salon s'il n'existe pas
        if (!textChannel) {
            const state = getFireState(fireData.intensity);
            const emoji = FIRE_EMOJIS[state];
            const CATEGORY_ID = "1470500820297711657";

            textChannel = await guild.channels.create({
                name: `${emoji}feu-de-foyer`,
                type: ChannelType.GuildText,
                topic: "Maintenez le feu allumé pour conserver le multiplicateur d'XP ! Utilisez /harvest toutes les 6h pour obtenir des bûches.",
                parent: CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ["ViewChannel", "ReadMessageHistory"],
                        deny: ["SendMessages"] // Les messages normaux sont interdits, seul le bouton fonctionne
                    },
                    {
                        id: client.user!.id,
                        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks"] // Le bot peut écrire
                    }
                ]
            });

            fireData.channelId = textChannel.id;
            saveFireData(fireData);

            // Placer le salon tout en bas de la catégorie
            const category = guild.channels.cache.get(CATEGORY_ID);
            if (category && category.type === ChannelType.GuildCategory) {
                const channelsInCategory = guild.channels.cache.filter(
                    c => c.parentId === CATEGORY_ID &&
                        c.type === ChannelType.GuildText &&
                        'position' in c
                );
                const maxPosition = Math.max(...channelsInCategory.map(c => (c as TextChannel).position), 0);
                await textChannel.setPosition(maxPosition + 1);
            }


            logger.info(`Fire text channel created: ${textChannel.id}`);
        } else {
            // Mettre à jour l'emoji du nom si le salon existe déjà (sans animation)
            const state = getFireState(fireData.intensity);
            const emoji = FIRE_EMOJIS[state];
            const expectedName = `${emoji}feu-de-foyer`;

            if (textChannel.name !== expectedName) {
                await textChannel.setName(expectedName);
                logger.debug(`Fire text channel name updated: ${expectedName}`);
            }
        }

        if (!textChannel) {
            logger.warn("No text channel found for fire embed");
            return;
        }

        // Créer l'embed complet avec TOUTES les données actuelles (intensité, bûches, météo, etc.)
        const embed = await createFireEmbed(fireData, client);
        const addLogButton = createAddLogButton();
        const useProtectionButton = createUseProtectionButton();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(addLogButton, useProtectionButton);

        // Mettre à jour ou créer le message
        if (fireData.messageId) {
            try {
                const message = await textChannel.messages.fetch(fireData.messageId);
                await message.edit({embeds: [embed], components: [row]});
                logger.debug(`Fire embed fully updated: intensity=${fireData.intensity.toFixed(1)}%, logs=${fireData.logs.length}, frame=${animationFrame}`);
            } catch (error) {
                // Message n'existe plus, en créer un nouveau
                const newMessage = await textChannel.send({embeds: [embed], components: [row]});
                fireData.messageId = newMessage.id;
                fireData.channelId = textChannel.id;
                saveFireData(fireData);
                logger.info(`New fire embed message created: ${newMessage.id}`);
            }
        } else {
            const newMessage = await textChannel.send({embeds: [embed], components: [row]});
            fireData.messageId = newMessage.id;
            fireData.channelId = textChannel.id;
            saveFireData(fireData);
            logger.info(`Fire embed message created: ${newMessage.id}`);
        }

    } catch (error) {
        logger.error("Error updating fire embed:", error);
    }
}

/**
 * Crée la représentation visuelle du feu de foyer avec des emojis selon l'intensité
 * Utilise l'animation frame pour alterner entre différents visuels
 */
function getFireVisual(intensity: number): string {
    // Déterminer quelle frame utiliser (on alterne entre 0, 1, 2, 3)
    const frame = animationFrame % 4;

    if (intensity >= 85) {
        // Feu intense (Rugissant/Ardent) - 4 frames d'animation
        const frames = [
            // Frame 0 - Flammes hautes
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Flammes moyennes
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Flammes très hautes
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Flammes moyennes-hautes
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`
        ];
        return frames[frame];
    } else if (intensity >= 60) {
        // Feu fort (Vif) - 4 frames d'animation avec variations beaucoup plus visibles
        const frames = [
            // Frame 0 - Flammes à gauche
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Flammes hautes au centre
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Flammes à droite
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Flammes larges
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`
        ];
        return frames[frame];
    } else if (intensity >= 30) {
        // Feu moyen (Stable) - 4 frames d'animation avec mouvements variés
        const frames = [
            // Frame 0 - Flammes centrées
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Flammes penchent à gauche
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Flammes penchent à droite
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Flammes écartées
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`
        ];
        return frames[frame];
    } else if (intensity >= 5) {
        // Feu faible (Vacillant) - 4 frames pour effet de vacillement très prononcé
        const frames = [
            // Frame 0 - Deux flammes côte à côte
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Flammes séparées
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Une flamme haute
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Flammes décalées
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`
        ];
        return frames[frame];
    } else if (intensity > 0) {
        // Feu très faible (Agonisant) - 4 frames pour effet de tremblement et extinction
        const frames = [
            // Frame 0
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`
        ];
        return frames[frame];
    } else {
        // Feu éteint - 4 frames d'animation pour effet de fumée qui se dissipe progressivement
        const frames = [
            // Frame 0 - Fumée dense
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀💨💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⚫⚫⚫⚫⚫⚫⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Fumée qui monte
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⚫⚫⚫⚫⚫⚫⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Fumée qui se dissipe
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⚫⚫⚫⚫⚫⚫⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Presque plus de fumée
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⚫⚫⚫⚫⚫⚫⠀
⠀⠀⠀⠀╚═════════════════╝`
        ];
        return frames[frame];
    }
}

/**
 * Récupère les données météo et calcule son impact
 * LIT LES DONNÉES DEPUIS LE SALON MÉTÉO DISCORD
 */
async function getWeatherImpact(client: Client): Promise<{ text: string; icon: string }> {
    try {
        const weather = getWeatherFromChannel(client);

        if (!weather) {
            return {text: "Conditions inconnues", icon: "🌡️"};
        }

        const temp = weather.temperature;

        // Déterminer le texte SANS l'emoji (on l'ajoutera séparément)
        let weatherText = `Temps hivernal (${temp}°C)`;

        if (temp < -20) {
            weatherText = `Froid extrême (${temp}°C)`;
        } else if (temp < -13) {
            weatherText = `Froid (${temp}°C)`;
        } else if (temp > 0) {
            weatherText = `Temps doux (${temp}°C)`;
        }

        return {
            text: weatherText, // Texte SANS emoji
            icon: weather.emoji // Emoji coloré du salon météo (❄️ et non ❄)
        };

    } catch (error) {
        return {text: "Conditions inconnues", icon: "🌡️"};
    }
}

/**
 * Crée l'embed du feu
 */
async function createFireEmbed(fireData: any, client: Client): Promise<EmbedBuilder> {
    const state = getFireState(fireData.intensity);
    const multiplier = getFireMultiplier(fireData.intensity);
    const emoji = FIRE_EMOJIS[state];
    const stateName = FIRE_NAMES[state];
    const color = FIRE_COLORS[state];

    // Debug: log le nombre de bûches
    logger.debug(`Creating fire embed with ${fireData.logs.length} logs (intensity: ${fireData.intensity.toFixed(1)}%)`);

    // Barre de progression stylée
    const barLength = 20;
    const filledBars = Math.round((fireData.intensity / 100) * barLength);
    const emptyBars = barLength - filledBars;
    const progressBar = "▰".repeat(filledBars) + "▱".repeat(emptyBars);

    // Impact météo
    const weatherImpact = await getWeatherImpact(client);

    // Description role-play
    let description = `╔═══════════════════════════════╗\n`;
    description += `⠀  **${stateName.toUpperCase()}** - ${fireData.intensity.toFixed(1)}%  \n`;
    description += `⠀  ${progressBar}  \n`;
    description += `╚═══════════════════════════════╝\n\n`;

    // Multiplicateur XP
    description += `💫 **Multiplicateur XP : ×${multiplier.toFixed(2)}**\n\n`;


    // Impact météo détaillé (seulement si connu)
    if (weatherImpact.text !== "Conditions inconnues") {
        description += `${weatherImpact.icon} ${weatherImpact.text}\n`;
    }
    // Taux de brûlage actuel (ligne dédiée claire)
    const currentBurnRate = await getWeatherBurnMultiplier(client);
    description += `🔥 `;

    // Explication du taux
    if (currentBurnRate < 1.0) {
        description += `Les bûches durent **${(1 / currentBurnRate).toFixed(1)}× plus longtemps**\n`;
    } else if (currentBurnRate > 1.0) {
        description += `Les bûches brûlent **${currentBurnRate.toFixed(1)}× plus vite**\n`;
    } else {
        description += `Vitesse normale (8h par bûche)\n`;
    }
    description += `\n`;

    // Statistiques compactes - afficher le nombre réel de bûches
    description += `🪵 **Bûches : ${fireData.logs.length}**\n`;

    // Afficher le temps restant avant que la première bûche brûle (système de queue FIFO)
    if (fireData.logs.length > 0) {
        const now = Date.now();
        const weatherMultiplier = await getWeatherBurnMultiplier(client);

        // Dans un système de queue, seule la PREMIÈRE bûche brûle
        const burningLog = fireData.logs[0];

        // Calculer l'âge effectif actuel en temps réel
        const baseAge = burningLog.effectiveAge || 0;
        const timeSinceLastUpdate = now - (burningLog.lastUpdate || burningLog.addedAt);
        const currentEffectiveAge = baseAge + (timeSinceLastUpdate * weatherMultiplier);

        // Calculer combien de temps effectif il reste avant que cette bûche brûle complètement
        const effectiveTimeRemaining = FIRE_CONFIG.LOG_BURN_TIME - currentEffectiveAge;

        // Convertir en temps réel selon le multiplicateur actuel
        const actualTimeRemaining = effectiveTimeRemaining / weatherMultiplier;

        if (actualTimeRemaining > 0) {
            description += `⏱️ Prochaine bûche brûlée dans : **${formatTimeRemaining(actualTimeRemaining)}**\n`;
        } else {
            description += `⏱️ Prochaine bûche brûlée : **Bientôt**\n`;
        }
    }

    if (fireData.stats.lastLog && fireData.stats.lastLog.userId && fireData.stats.lastLog.timestamp) {
        const timestampSeconds = Math.floor(fireData.stats.lastLog.timestamp / 1000);
        description += `👤 Dernière bûche : <@${fireData.stats.lastLog.userId}> <t:${timestampSeconds}:R>\n`;
    }

    description += `\n`;

    // Visuel emoji du feu EN BAS (basé sur l'intensité)
    const fireVisual = getFireVisual(fireData.intensity);
    description += fireVisual;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} FEU DE FOYER`)
        .setDescription(description)
        .setFooter({text: "Gardez les flammes vivantes pour maximiser vos gains d'XP !"})
        .setTimestamp();

    return embed;
}

/**
 * Crée le bouton pour ajouter une bûche
 */
function createAddLogButton(): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId("fire_add_log")
        .setLabel("🪵 Ajouter une bûche")
        .setStyle(ButtonStyle.Primary);
}

/**
 * Crée le bouton pour utiliser un stuff à feu
 */
function createUseProtectionButton(): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId("fire_use_protection")
        .setLabel("❄️ Ajouter une protection")
        .setStyle(ButtonStyle.Success);
}

/**
 * Arrête le système de feu
 */
export function stopFireSystem(): void {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }

    if (dailyResetInterval) {
        clearInterval(dailyResetInterval);
        dailyResetInterval = null;
    }

    logger.info("Fire System stopped");
}

/**
 * Obtient le multiplicateur XP actuel du feu
 */
export function getCurrentFireMultiplier(): number {
    const fireData = loadFireData();
    return getFireMultiplier(fireData.intensity);
}

// Exporter les fonctions de protection météo
export {isWeatherProtectionActive, getWeatherProtectionInfo} from "./fireDataManager";
