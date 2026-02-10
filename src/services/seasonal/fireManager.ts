import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {cleanExpiredCooldowns, getWeatherProtectionInfo, isWeatherProtectionActive, loadFireData, resetDailyStats, saveFireData} from "./fireDataManager";
import {FIRE_COLORS, FIRE_CONFIG, FIRE_EMOJIS, FIRE_NAMES, getFireMultiplier, getFireState} from "./fireData";

const logger = createLogger("FireManager");

let decayInterval: NodeJS.Timeout | null = null;
let updateInterval: NodeJS.Timeout | null = null;
let dailyResetInterval: NodeJS.Timeout | null = null;

/**
 * Initialise le système de feu
 */
export async function initializeFireSystem(client: Client): Promise<void> {
    logger.info("Initializing Fire System...");

    // Charger les données
    const fireData = loadFireData();

    // Démarrer la décroissance automatique
    startDecay();

    // Démarrer la mise à jour de l'interface
    startInterfaceUpdates(client);

    // Démarrer le reset quotidien
    startDailyReset();

    // Créer/mettre à jour le salon vocal et l'embed
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
 */
async function getWeatherBurnMultiplier(): Promise<number> {
    // Vérifier si la protection météo est active
    if (isWeatherProtectionActive()) {
        return 1.0; // Pas d'effet météo si protégé
    }

    try {
        const {getSherbrookeWeather} = require("../weatherService");
        const weather = await getSherbrookeWeather();

        if (weather) {
            const temp = weather.temperature;

            // Ajuster la vitesse de brûlage selon la température extérieure
            if (temp < -25) {
                return 1.3; // Froid extrême : brûle plus vite (2h18 au lieu de 3h) - grand besoin de chaleur
            } else if (temp < -15) {
                return 1.15; // Froid intense : brûle un peu plus vite (2h36 au lieu de 3h)
            } else if (temp > 0) {
                return 0.8; // Temps doux : brûle plus lentement (3h45 au lieu de 3h) - moins de besoin
            }
        }
    } catch (error) {
        logger.debug("Could not fetch weather for burn calculation, using default rate");
    }

    return 1.0; // Vitesse normale (entre -15°C et 0°C)
}

/**
 * Calcule la contribution actuelle d'une bûche en fonction de son âge et de la météo
 */
async function calculateLogContribution(log: any, now: number): Promise<number> {
    const logAge = now - log.addedAt;

    // Si la bûche a plus de 3 heures (temps de base), elle ne contribue plus
    if (logAge >= FIRE_CONFIG.LOG_BURN_TIME) {
        return 0;
    }

    // Obtenir le multiplicateur météo
    const weatherMultiplier = await getWeatherBurnMultiplier();

    // Calculer l'âge effectif de la bûche (affecté par la météo)
    const effectiveAge = logAge * weatherMultiplier;

    // Si l'âge effectif dépasse le temps de brûlage, la bûche est consumée
    if (effectiveAge >= FIRE_CONFIG.LOG_BURN_TIME) {
        return 0;
    }

    // La contribution décroît linéairement de initialContribution à 0
    const timeRatio = 1 - (effectiveAge / FIRE_CONFIG.LOG_BURN_TIME);
    return (log.initialContribution || FIRE_CONFIG.LOG_BONUS) * timeRatio;
}

/**
 * Calcule l'intensité totale basée sur les contributions de toutes les bûches
 */
async function calculateTotalIntensity(fireData: any): Promise<number> {
    const now = Date.now();
    let totalIntensity = 0;

    for (const log of fireData.logs) {
        totalIntensity += await calculateLogContribution(log, now);
    }

    return Math.min(FIRE_CONFIG.MAX_INTENSITY, Math.max(FIRE_CONFIG.MIN_INTENSITY, totalIntensity));
}

/**
 * Démarre la décroissance automatique du feu
 */
function startDecay(): void {
    if (decayInterval) {
        clearInterval(decayInterval);
    }

    decayInterval = setInterval(async () => {
        const fireData = loadFireData();
        const now = Date.now();

        const oldIntensity = fireData.intensity;

        // Obtenir le multiplicateur météo pour déterminer quelles bûches sont consumées
        const weatherMultiplier = await getWeatherBurnMultiplier();

        // 1. Retirer les bûches qui ont complètement brûlé (en tenant compte de la météo)
        const initialLogCount = fireData.logs.length;
        fireData.logs = fireData.logs.filter(log => {
            const logAge = now - log.addedAt;
            const effectiveAge = logAge * weatherMultiplier;
            return effectiveAge < FIRE_CONFIG.LOG_BURN_TIME;
        });

        const burnedLogs = initialLogCount - fireData.logs.length;
        if (burnedLogs > 0) {
            logger.info(`${burnedLogs} log(s) burned completely (weather multiplier: ${weatherMultiplier.toFixed(2)}x). Remaining: ${fireData.logs.length}`);
        }

        // 2. Recalculer l'intensité totale basée sur les contributions actuelles de toutes les bûches
        fireData.intensity = await calculateTotalIntensity(fireData);
        fireData.lastUpdate = now;
        saveFireData(fireData);

        const oldState = getFireState(oldIntensity);
        const newState = getFireState(fireData.intensity);

        if (oldIntensity !== fireData.intensity) {
            logger.info(`Fire intensity updated: ${oldIntensity.toFixed(1)}% → ${fireData.intensity.toFixed(1)}% (${fireData.logs.length} active logs, weather: ${weatherMultiplier.toFixed(2)}x)`);
        }

        // Log si changement d'état
        if (oldState !== newState) {
            logger.info(`Fire state changed: ${oldState} → ${newState}`);
        }
    }, FIRE_CONFIG.DECAY_INTERVAL);

    logger.info("Fire decay started (individual log contribution system with weather effects)");
}

/**
 * Démarre la mise à jour automatique de l'interface
 */
function startInterfaceUpdates(client: Client): void {
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    updateInterval = setInterval(async () => {
        await updateFireChannel(client);
        await updateFireEmbed(client);
        cleanExpiredCooldowns(); // Nettoyer les cooldowns expirés
    }, FIRE_CONFIG.UPDATE_INTERVAL);

    logger.info("Fire interface updates started");
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

    // Ajouter la bûche au tableau avec sa contribution initiale
    fireData.logs.push({
        addedAt: Date.now(),
        userId,
        username,
        initialContribution: FIRE_CONFIG.LOG_BONUS // 8%
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

    const oldState = getFireState(oldIntensity);
    const newState = getFireState(fireData.intensity);

    logger.info(`${username} added a log (${fireData.logs.length} total): ${oldIntensity.toFixed(1)}% → ${fireData.intensity.toFixed(1)}%`);

    // Message selon le changement d'état
    let message = `🪵 Tu as ajouté une bûche au feu ! (${oldIntensity.toFixed(1)}% → ${fireData.intensity.toFixed(1)}%)\nBûches actives : ${fireData.logs.length}`;

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

        const channelName = `💫 Multiplicateur XP - ×${totalMultiplier.toFixed(2)}`;

        // Trouver ou créer le salon vocal
        let voiceChannel: VoiceChannel | null = null;

        if (fireData.voiceChannelId) {
            voiceChannel = guild.channels.cache.get(fireData.voiceChannelId) as VoiceChannel;
        }

        // Chercher un salon existant si l'ID n'est pas sauvegardé
        if (!voiceChannel) {
            voiceChannel = guild.channels.cache.find(
                c => c.type === ChannelType.GuildVoice && (c.name.includes("Multiplicateur XP") || c.name.includes("Feu de Foyer"))
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
                logger.debug(`XP Multiplier voice channel updated: ${channelName}`);
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
                topic: "Maintenez le feu allumé pour conserver le multiplicateur d'XP ! Ajoutez une bûche toutes les 4 heures.",
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
            // Mettre à jour l'emoji du nom si le salon existe déjà
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

        const embed = await createFireEmbed(fireData);
        const addLogButton = createAddLogButton();
        const useProtectionButton = createUseProtectionButton();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(addLogButton, useProtectionButton);

        // Mettre à jour ou créer le message
        if (fireData.messageId) {
            try {
                const message = await textChannel.messages.fetch(fireData.messageId);
                await message.edit({embeds: [embed], components: [row]});
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
 */
function getFireVisual(intensity: number): string {
    // Caractère invisible pour l'espacement (U+2800 - Braille Pattern Blank)
    const blank = '⠀';

    if (intensity >= 85) {
        // Feu intense (Rugissant/Ardent)
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (intensity >= 60) {
        // Feu fort (Vif)
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (intensity >= 30) {
        // Feu moyen (Stable)
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (intensity >= 5) {
        // Feu faible (Vacillant)
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (intensity > 0) {
        // Feu très faible (Agonisant)
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else {
        // Feu éteint
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀💨💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⚫⚫⚫⚫⚫⚫⠀
⠀⠀⠀⠀╚═════════════════╝`;
    }
}

/**
 * Récupère les données météo et calcule son impact
 */
async function getWeatherImpact(): Promise<{ text: string; icon: string }> {
    // Vérifier d'abord si la protection est active
    const protectionInfo = getWeatherProtectionInfo();
    if (protectionInfo.active && protectionInfo.remainingTime > 0) {
        const minutes = Math.ceil(protectionInfo.remainingTime / 60000);
        return {
            text: `**Protection Active** (${minutes} min restantes)\n*La température n'a plus aucun effet sur le feu*`,
            icon: "🛡️"
        };
    }

    try {
        const {getSherbrookeWeather} = require("../weatherService");
        const weather = await getSherbrookeWeather();

        if (!weather) {
            return {text: "Conditions inconnues", icon: "🌡️"};
        }

        const temp = weather.temperature;
        const condition = weather.condition.toLowerCase();

        // Impact selon la température (feu de foyer intérieur)
        if (temp < -20) {
            return {text: `${weather.emoji} Froid extrême (${temp}°C) ! \n**Consommation ×1.3**`, icon: "🥶"};
        } else if (temp < -13) {
            return {text: `${weather.emoji} Froid (${temp}°C) \n**Consommation ×1.15**`, icon: "🔥"};
        } else if (temp > 0) {
            return {text: `${weather.emoji} Temps doux (${temp}°C) \n**Consommation ×0.8**`, icon: "☀️"};
        } else {
            return {text: `${weather.emoji} Temps hivernal (${temp}°C)`, icon: "❄️"};
        }
    } catch (error) {
        return {text: "Conditions inconnues", icon: "🌡️"};
    }
}

/**
 * Crée l'embed du feu
 */
async function createFireEmbed(fireData: any): Promise<EmbedBuilder> {
    const state = getFireState(fireData.intensity);
    const multiplier = getFireMultiplier(fireData.intensity);
    const emoji = FIRE_EMOJIS[state];
    const stateName = FIRE_NAMES[state];
    const color = FIRE_COLORS[state];

    // Barre de progression stylée
    const barLength = 20;
    const filledBars = Math.round((fireData.intensity / 100) * barLength);
    const emptyBars = barLength - filledBars;
    const progressBar = "▰".repeat(filledBars) + "▱".repeat(emptyBars);

    // Impact météo
    const weatherImpact = await getWeatherImpact();

    // Description role-play
    let description = `╔═══════════════════════════════╗\n`;
    description += `⠀  **${stateName.toUpperCase()}** - ${fireData.intensity.toFixed(1)}%  \n`;
    description += `⠀  ${progressBar}  \n`;
    description += `╚═══════════════════════════════╝\n\n`;

    // Multiplicateur XP
    description += `💫 **Multiplicateur XP : ×${multiplier.toFixed(2)}**\n\n`;

    // Impact météo (seulement si connu)
    if (weatherImpact.text !== "Conditions inconnues") {
        description += `${weatherImpact.icon} ${weatherImpact.text}\n\n`;
    }

    // Statistiques compactes - afficher le nombre réel de bûches
    description += `🪵 **Bûches : ${fireData.logs.length}**\n`;

    // Afficher le temps restant avant que la prochaine bûche brûle (avec effet météo)
    if (fireData.logs.length > 0) {
        // Trouver la bûche la plus ancienne (celle qui va brûler en premier)
        const oldestLog = fireData.logs.reduce((oldest: typeof fireData.logs[0], log: typeof fireData.logs[0]) =>
            log.addedAt < oldest.addedAt ? log : oldest
        );

        const now = Date.now();
        const logAge = now - oldestLog.addedAt;
        const weatherMultiplier = await getWeatherBurnMultiplier();
        const effectiveAge = logAge * weatherMultiplier;

        // Calculer le temps réel restant avant que la bûche brûle complètement
        // Le temps de brûlage restant dépend de la météo actuelle
        const timeRemainingEffective = FIRE_CONFIG.LOG_BURN_TIME - effectiveAge;
        const actualTimeRemaining = timeRemainingEffective / weatherMultiplier;

        if (actualTimeRemaining > 0) {
            description += `⏱️ Prochaine bûche brûlée dans : **${formatTimeRemaining(actualTimeRemaining)}**\n`;
        } else {
            description += `⏱️ Prochaine bûche brûlée : **Bientôt**\n`;
        }
    }

    if (fireData.stats.lastLog) {
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
        .setLabel("❄️ Protection Climatique")
        .setStyle(ButtonStyle.Success);
}

/**
 * Arrête le système de feu
 */
export function stopFireSystem(): void {
    if (decayInterval) {
        clearInterval(decayInterval);
        decayInterval = null;
    }

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
