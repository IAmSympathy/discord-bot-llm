import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {cleanExpiredCooldowns, loadFireData, resetDailyStats, saveFireData} from "./fireDataManager";
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
 * Démarre la décroissance automatique du feu
 */
function startDecay(): void {
    if (decayInterval) {
        clearInterval(decayInterval);
    }

    decayInterval = setInterval(async () => {
        const fireData = loadFireData();
        const now = Date.now();

        // 1. Retirer les bûches qui ont brûlé (plus de 3 heures)
        const initialLogCount = fireData.logs.length;
        fireData.logs = fireData.logs.filter(log => {
            const logAge = now - log.addedAt;
            return logAge < FIRE_CONFIG.LOG_BURN_TIME;
        });

        const burnedLogs = initialLogCount - fireData.logs.length;
        if (burnedLogs > 0) {
            logger.info(`${burnedLogs} log(s) burned completely. Remaining: ${fireData.logs.length}/${FIRE_CONFIG.MAX_LOGS}`);
        }

        // 2. Appliquer la décroissance normale d'intensité
        const timeSinceUpdate = now - fireData.lastUpdate;
        const periodsElapsed = Math.floor(timeSinceUpdate / FIRE_CONFIG.DECAY_INTERVAL);

        if (periodsElapsed > 0) {
            const oldIntensity = fireData.intensity;

            // Calculer le taux de décroissance basé sur la météo
            let decayRate = FIRE_CONFIG.DECAY_RATE;

            try {
                const {getSherbrookeWeather} = require("../weatherService");
                const weather = await getSherbrookeWeather();

                if (weather) {
                    const condition = weather.condition.toLowerCase();

                    // Ajuster le taux de décroissance selon la météo
                    if (condition.includes("pluie") || condition.includes("orage")) {
                        decayRate *= 2.0; // Pluie : décroissance 2x plus rapide (-3%/30min)
                        logger.info(`Weather effect: Rain/Storm - decay rate doubled`);
                    } else if (condition.includes("neige")) {
                        decayRate *= 1.5; // Neige : décroissance 1.5x plus rapide (-2.25%/30min)
                        logger.info(`Weather effect: Snow - decay rate increased by 50%`);
                    } else if (weather.temperature < -25) {
                        decayRate *= 0.8; // Froid extrême : les gens ajoutent plus de bûches, décroissance réduite
                        logger.info(`Weather effect: Extreme cold - decay rate reduced`);
                    }
                }
            } catch (error) {
                logger.debug("Could not fetch weather for decay calculation, using default rate");
            }

            fireData.intensity = Math.max(
                FIRE_CONFIG.MIN_INTENSITY,
                fireData.intensity - (decayRate * periodsElapsed)
            );
            fireData.lastUpdate = now;
            saveFireData(fireData);

            const oldState = getFireState(oldIntensity);
            const newState = getFireState(fireData.intensity);

            logger.info(`Fire decayed: ${oldIntensity}% → ${fireData.intensity}% (rate: ${decayRate.toFixed(2)}%, logs: ${fireData.logs.length})`);

            // Log si changement d'état
            if (oldState !== newState) {
                logger.info(`Fire state changed: ${oldState} → ${newState}`);
            }
        } else if (burnedLogs > 0) {
            // Sauvegarder même si pas de décroissance d'intensité (bûches brûlées)
            fireData.lastUpdate = now;
            saveFireData(fireData);
        }
    }, FIRE_CONFIG.DECAY_INTERVAL);

    logger.info("Fire decay started");
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
export function addLog(userId: string, username: string): { success: boolean; newIntensity?: number; message: string } {
    const fireData = loadFireData();

    // Plus de limite sur le nombre de bûches - on peut en ajouter infiniment!
    // Le visuel sera plafonné à 5 bûches mais le compteur continuera

    const oldIntensity = fireData.intensity;
    fireData.intensity = Math.min(
        FIRE_CONFIG.MAX_INTENSITY,
        fireData.intensity + FIRE_CONFIG.LOG_BONUS
    );

    // Ajouter la bûche au tableau
    fireData.logs.push({
        addedAt: Date.now(),
        userId,
        username
    });

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

    logger.info(`${username} added a log (${fireData.logs.length} total): ${oldIntensity}% → ${fireData.intensity}%`);

    // Message selon le changement d'état
    let message = `🪵 Tu as ajouté une bûche au feu ! (${oldIntensity}% → ${fireData.intensity}%)\nBûches actives : ${fireData.logs.length}`;

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
        const button = createAddLogButton();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

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
 * Crée la représentation visuelle du feu de foyer avec des emojis selon le nombre de bûches
 */
function getFireVisual(logCount: number): string {
    // Caractère invisible pour l'espacement (U+2800 - Braille Pattern Blank)
    const blank = '⠀';

    if (logCount >= 5) {
        // 5 bûches - Feu intense
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (logCount === 4) {
        // 4 bûches - Feu fort
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (logCount === 3) {
        // 3 bûches - Feu moyen
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (logCount === 2) {
        // 2 bûches - Feu faible
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else if (logCount === 1) {
        // 1 bûche - Feu très faible
        return `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`;
    } else {
        // Aucune bûche - Feu éteint
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
    try {
        const {getSherbrookeWeather} = require("../weatherService");
        const weather = await getSherbrookeWeather();

        if (!weather) {
            return {text: "Conditions inconnues", icon: "🌡️"};
        }

        const temp = weather.temperature;
        const condition = weather.condition.toLowerCase();

        // Impact selon la météo (adapté au climat québécois)
        if (condition.includes("pluie") || condition.includes("orage")) {
            return {text: `${weather.emoji} La pluie menace le feu ! **(-3%/30min)**`, icon: "⚠️"};
        } else if (condition.includes("neige")) {
            return {text: `${weather.emoji} La neige tombe **(-2.25%/30min)**`, icon: "❄️"};
        } else if (temp < -25) {
            return {text: `${weather.emoji} Froid intense (${temp}°C) ! **(-1.2%/30min)**`, icon: "🥶"};
        } else if (temp < -15) {
            return {text: `${weather.emoji} Grand froid (${temp}°C)`, icon: "🔥"};
        } else if (temp < 0) {
            return {text: `${weather.emoji} Temps hivernal (${temp}°C)`, icon: "❄️"};
        } else if (temp > 20) {
            return {text: `${weather.emoji} Belle température (${temp}°C)`, icon: "☀️"};
        } else {
            return {text: `${weather.emoji} Temps doux (${temp}°C)`, icon: "✅"};
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
    description += `⠀  **${stateName.toUpperCase()}** - ${fireData.intensity}%  \n`;
    description += `⠀  ${progressBar}  \n`;
    description += `╚═══════════════════════════════╝\n\n`;

    // Multiplicateur XP
    description += `💫 **Multiplicateur XP : ×${multiplier.toFixed(2)}**\n\n`;

    // Impact météo (seulement si connu)
    if (weatherImpact.text !== "Conditions inconnues") {
        description += `${weatherImpact.icon} ${weatherImpact.text}\n\n`;
    }

    // Statistiques compactes - afficher le nombre réel de bûches
    description += `🪵 **Bûches actives : ${fireData.logs.length}**\n`;

    if (fireData.stats.lastLog) {
        const timestampSeconds = Math.floor(fireData.stats.lastLog.timestamp / 1000);
        description += `Dernière bûche ajoutée : <@${fireData.stats.lastLog.userId}> <t:${timestampSeconds}:R>\n`;
    }

    // Afficher le temps restant avant que la prochaine bûche brûle
    if (fireData.logs.length > 0) {
        // Trouver la bûche la plus ancienne (celle qui va brûler en premier)
        const oldestLog = fireData.logs.reduce((oldest: typeof fireData.logs[0], log: typeof fireData.logs[0]) =>
            log.addedAt < oldest.addedAt ? log : oldest
        );

        const burnTime = oldestLog.addedAt + FIRE_CONFIG.LOG_BURN_TIME;
        const burnTimestampSeconds = Math.floor(burnTime / 1000);
        description += `⏱️ Prochaine bûche brûlée : <t:${burnTimestampSeconds}:R>\n`;
    }

    description += `\n`;

    // Visuel emoji du feu EN BAS (plafonné à 5 pour l'affichage)
    const visualLogCount = Math.min(fireData.logs.length, 5);
    const fireVisual = getFireVisual(visualLogCount);
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



