import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, TextChannel, VoiceChannel} from "discord.js";
import {createLogger} from "../../utils/logger";
import {cleanExpiredCooldowns, getWeatherProtectionInfo, isWeatherProtectionActive, loadFireData, resetDailyStats, saveFireData} from "./fireDataManager";
import {FIRE_COLORS, FIRE_CONFIG, FIRE_EMOJIS, FIRE_NAMES, getFireMultiplier, getFireState} from "./fireData";

const logger = createLogger("FireManager");

let decayInterval: NodeJS.Timeout | null = null;
let updateInterval: NodeJS.Timeout | null = null;
let dailyResetInterval: NodeJS.Timeout | null = null;

// Frame d'animation actuelle (pour alterner les visuels)
let animationFrame = 0;

// Cache des noms de salons pour éviter les rate limits Discord
let lastVoiceChannelName = "";
let lastTextChannelName = "";
let lastVoiceChannelUpdate = 0;
let lastTextChannelUpdate = 0;

// Discord rate limit: 2 changements de nom par 10 minutes
const CHANNEL_NAME_UPDATE_COOLDOWN = 5 * 60 * 1000; // 5 minutes entre chaque changement

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
 * Obtient le multiplicateur de vitesse de brûlage selon la température et la protection active
 * Plus le multiplicateur est élevé, plus les bûches se consument vite
 * C'est un feu de FOYER (intérieur), donc seule la température extérieure compte
 */
async function getWeatherBurnMultiplier(): Promise<number> {
    let weatherMultiplier = 1.0; // Par défaut, vitesse normale

    try {
        const {getSherbrookeWeather} = require("../weatherService");
        const weather = await getSherbrookeWeather();

        if (weather) {
            const temp = weather.temperature;

            // Ajuster la vitesse de brûlage selon la température extérieure
            if (temp < -25) {
                weatherMultiplier = 1.3; // Froid extrême : brûle plus vite (2h18 au lieu de 3h) - grand besoin de chaleur
            } else if (temp < -15) {
                weatherMultiplier = 1.15; // Froid intense : brûle un peu plus vite (2h36 au lieu de 3h)
            } else if (temp > 0) {
                weatherMultiplier = 0.8; // Temps doux : brûle plus lentement (3h45 au lieu de 3h) - moins de besoin
            }
        }
    } catch (error) {
        logger.debug("Could not fetch weather for burn calculation, using default rate");
    }

    // Si la protection météo est active, multiplier par le facteur de protection
    // Exemple: météo ×1.3 (froid) × protection ×0.5 = ×0.65 (brûle moins vite qu'en temps normal malgré le froid)
    if (isWeatherProtectionActive()) {
        weatherMultiplier *= FIRE_CONFIG.PROTECTION_BURN_MULTIPLIER;
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
 * Met à jour l'âge effectif accumulé de toutes les bûches selon les conditions actuelles
 * Cette fonction doit être appelée régulièrement pour accumuler l'âge correctement
 */
async function updateLogsEffectiveAge(fireData: any, now: number): Promise<void> {
    const weatherMultiplier = await getWeatherBurnMultiplier();

    for (const log of fireData.logs) {
        // Migration : initialiser effectiveAge et lastUpdate si nécessaire
        if (log.effectiveAge === undefined) {
            log.effectiveAge = 0;
            log.lastUpdate = log.addedAt;
        }

        // Calculer le temps écoulé depuis la dernière mise à jour
        const timeSinceLastUpdate = now - log.lastUpdate;

        // Accumuler l'âge effectif selon le multiplicateur actuel
        // Plus le multiplicateur est élevé, plus l'âge augmente vite (brûle plus vite)
        log.effectiveAge += timeSinceLastUpdate * weatherMultiplier;

        // Mettre à jour le timestamp
        log.lastUpdate = now;
    }
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

        // Obtenir le multiplicateur météo pour le logging
        const weatherMultiplier = await getWeatherBurnMultiplier();

        // 1. Mettre à jour l'âge effectif accumulé de toutes les bûches selon les conditions actuelles
        await updateLogsEffectiveAge(fireData, now);

        // 2. Retirer les bûches dont l'âge effectif a dépassé le temps de brûlage
        const initialLogCount = fireData.logs.length;
        fireData.logs = fireData.logs.filter(log => {
            return log.effectiveAge < FIRE_CONFIG.LOG_BURN_TIME;
        });

        const burnedLogs = initialLogCount - fireData.logs.length;
        if (burnedLogs > 0) {
            logger.info(`${burnedLogs} log(s) burned completely (weather multiplier: ${weatherMultiplier.toFixed(2)}x). Remaining: ${fireData.logs.length}`);
        }

        // 3. Recalculer l'intensité totale basée sur les contributions actuelles de toutes les bûches
        fireData.intensity = await calculateTotalIntensity(fireData);

        // Vérification de sécurité : si aucune bûche, forcer l'intensité à 0
        if (fireData.logs.length === 0 && fireData.intensity > 0) {
            logger.warn(`Intensity reset to 0 (was ${fireData.intensity.toFixed(1)}%) - no logs remaining`);
            fireData.intensity = 0;
        }

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
        // Incrémenter la frame d'animation
        animationFrame++;

        await updateFireChannel(client);
        await updateFireEmbed(client);
        cleanExpiredCooldowns(); // Nettoyer les cooldowns expirés
    }, FIRE_CONFIG.UPDATE_INTERVAL);

    logger.info(`Fire interface updates started (animation enabled, ${FIRE_CONFIG.UPDATE_INTERVAL / 1000}s interval)`);
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

        // Animation du nom du salon - 4 frames différentes
        const frame = animationFrame % 4;
        let channelName = "";

        // Choisir le style d'animation selon le multiplicateur
        if (totalMultiplier >= 1.2) {
            // Multiplicateur élevé - Animation avec étoiles qui bougent
            const starFrames = [
                `✨💫 XP ×${totalMultiplier.toFixed(2)} 💫✨`,
                `💫✨ XP ×${totalMultiplier.toFixed(2)} ✨💫`,
                `⭐💫 XP ×${totalMultiplier.toFixed(2)} 💫⭐`,
                `💫⭐ XP ×${totalMultiplier.toFixed(2)} ⭐💫`
            ];
            channelName = starFrames[frame];
        } else if (totalMultiplier >= 0.8) {
            // Multiplicateur moyen - Animation avec flèches
            const arrowFrames = [
                `📊 XP ×${totalMultiplier.toFixed(2)} 📊`,
                `➡️ XP ×${totalMultiplier.toFixed(2)} ⬅️`,
                `📈 XP ×${totalMultiplier.toFixed(2)} 📈`,
                `⬆️ XP ×${totalMultiplier.toFixed(2)} ⬆️`
            ];
            channelName = arrowFrames[frame];
        } else if (totalMultiplier >= 0.5) {
            // Multiplicateur faible - Animation d'alerte
            const alertFrames = [
                `⚠️ XP ×${totalMultiplier.toFixed(2)} ⚠️`,
                `🔻 XP ×${totalMultiplier.toFixed(2)} 🔻`,
                `⚠️ XP ×${totalMultiplier.toFixed(2)} ⚠️`,
                `📉 XP ×${totalMultiplier.toFixed(2)} 📉`
            ];
            channelName = alertFrames[frame];
        } else {
            // Multiplicateur très faible - Animation critique
            const criticalFrames = [
                `🚨 XP ×${totalMultiplier.toFixed(2)} 🚨`,
                `❗ XP ×${totalMultiplier.toFixed(2)} ❗`,
                `🚨 XP ×${totalMultiplier.toFixed(2)} 🚨`,
                `⛔ XP ×${totalMultiplier.toFixed(2)} ⛔`
            ];
            channelName = criticalFrames[frame];
        }

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
            // Mettre à jour le nom si différent ET si le cooldown est respecté
            const now = Date.now();
            const canUpdate = (now - lastVoiceChannelUpdate) >= CHANNEL_NAME_UPDATE_COOLDOWN;

            if (voiceChannel.name !== channelName && canUpdate) {
                await voiceChannel.setName(channelName);
                lastVoiceChannelName = channelName;
                lastVoiceChannelUpdate = now;
                logger.info(`XP Multiplier voice channel updated: ${channelName}`);
            } else if (voiceChannel.name !== channelName) {
                const timeRemaining = Math.ceil((CHANNEL_NAME_UPDATE_COOLDOWN - (now - lastVoiceChannelUpdate)) / 1000);
                logger.debug(`Voice channel update skipped (cooldown: ${timeRemaining}s remaining)`);
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
                topic: "Maintenez le feu allumé pour conserver le multiplicateur d'XP ! Utilisez /harvest toutes les 4h pour obtenir des bûches.",
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
            // Animation du nom du salon textuel - 4 frames différentes
            const frame = animationFrame % 4;
            const state = getFireState(fireData.intensity);
            let channelName = "";

            // Choisir le style d'animation selon l'état du feu
            if (state === "INTENSE") {
                // Feu intense - Animation avec multiples emojis feu qui dansent
                const intenseFrames = [
                    `🔥🔥🔥feu-de-foyer🔥🔥🔥`,
                    `🔥🔥🌟feu-de-foyer🌟🔥🔥`,
                    `🔥✨🔥feu-de-foyer🔥✨🔥`,
                    `🌟🔥🔥feu-de-foyer🔥🔥🌟`
                ];
                channelName = intenseFrames[frame];
            } else if (state === "HIGH") {
                // Feu fort - Animation avec feu et étincelles
                const highFrames = [
                    `🔥🔥feu-de-foyer🔥🔥`,
                    `🔥✨feu-de-foyer✨🔥`,
                    `✨🔥feu-de-foyer🔥✨`,
                    `🔥🔥feu-de-foyer🔥🔥`
                ];
                channelName = highFrames[frame];
            } else if (state === "MEDIUM") {
                // Feu moyen - Animation simple avec feu
                const mediumFrames = [
                    `🔥feu-de-foyer🔥`,
                    `🔥feu-de-foyer✨`,
                    `✨feu-de-foyer🔥`,
                    `🔥feu-de-foyer🔥`
                ];
                channelName = mediumFrames[frame];
            } else if (state === "LOW") {
                // Feu faible - Animation d'alerte qui clignote
                const lowFrames = [
                    `🟠feu-de-foyer🟠`,
                    `⚠️feu-de-foyer⚠️`,
                    `🟠feu-de-foyer🟠`,
                    `🔥feu-de-foyer🔥`
                ];
                channelName = lowFrames[frame];
            } else {
                // Feu éteint - Animation de fumée
                const extinguishedFrames = [
                    `💨feu-de-foyer💨`,
                    `⚫feu-de-foyer⚫`,
                    `💨feu-de-foyer💨`,
                    `🌫️feu-de-foyer🌫️`
                ];
                channelName = extinguishedFrames[frame];
            }

            // Mettre à jour le nom si différent ET si le cooldown est respecté
            const now = Date.now();
            const canUpdate = (now - lastTextChannelUpdate) >= CHANNEL_NAME_UPDATE_COOLDOWN;

            if (textChannel.name !== channelName && canUpdate) {
                await textChannel.setName(channelName);
                lastTextChannelName = channelName;
                lastTextChannelUpdate = now;
                logger.info(`Fire text channel name updated: ${channelName}`);
            } else if (textChannel.name !== channelName) {
                const timeRemaining = Math.ceil((CHANNEL_NAME_UPDATE_COOLDOWN - (now - lastTextChannelUpdate)) / 1000);
                logger.debug(`Text channel update skipped (cooldown: ${timeRemaining}s remaining)`);
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
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Flammes hautes au centre
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Flammes à droite
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀🔥🪵🪵🪵🪵🔥
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Flammes larges
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥🔥
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
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 1 - Flammes penchent à gauche
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 2 - Flammes penchent à droite
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝`,
            // Frame 3 - Flammes écartées
            `⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥⠀🔥⠀🔥
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
 */
async function getWeatherImpact(): Promise<{ text: string; icon: string }> {
    // Vérifier d'abord si la protection est active
    const protectionInfo = getWeatherProtectionInfo();

    try {
        const {getSherbrookeWeather} = require("../weatherService");
        const weather = await getSherbrookeWeather();

        if (!weather) {
            return {text: "Conditions inconnues", icon: "🌡️"};
        }

        const temp = weather.temperature;

        // Calculer le multiplicateur météo de base
        let weatherMultiplier = 1.0;
        let weatherText = `${weather.emoji} Temps hivernal (${temp}°C)`;

        if (temp < -20) {
            weatherMultiplier = 1.3;
            weatherText = `${weather.emoji} Froid extrême (${temp}°C)`;
        } else if (temp < -13) {
            weatherMultiplier = 1.15;
            weatherText = `${weather.emoji} Froid (${temp}°C)`;
        } else if (temp > 0) {
            weatherMultiplier = 0.8;
            weatherText = `${weather.emoji} Temps doux (${temp}°C)`;
        }

        // Si protection active, afficher les détails
        if (protectionInfo.active && protectionInfo.remainingTime > 0) {
            const minutes = Math.ceil(protectionInfo.remainingTime / 60000);

            let text = `${weatherText}\n`;
            text += `🛡️ **Protection Active** (${minutes} min)`;

            // Ajouter les contributeurs si disponibles
            if (protectionInfo.contributors && protectionInfo.contributors.length > 0) {
                if (protectionInfo.contributors.length === 1) {
                    text += `\n⠀⠀⠀👤 Par : <@${protectionInfo.contributors[0].userId}>`;
                } else {
                    const mentions = protectionInfo.contributors
                        .map(c => `<@${c.userId}>`)
                        .join(', ');
                    text += `\n⠀⠀⠀👥 Par : ${mentions}`;
                }
            }

            return {
                text,
                icon: "🛡️"
            };
        }

        // Pas de protection, afficher juste la météo
        return {
            text: `${weatherText}`,
            icon: weatherMultiplier > 1.0 ? "🥶" : (weatherMultiplier < 1.0 ? "☀️" : "❄️")
        };

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

    // Debug: log le nombre de bûches
    logger.debug(`Creating fire embed with ${fireData.logs.length} logs (intensity: ${fireData.intensity.toFixed(1)}%)`);

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


    // Impact météo détaillé (seulement si connu)
    if (weatherImpact.text !== "Conditions inconnues") {
        description += `${weatherImpact.icon} ${weatherImpact.text}\n\n`;
    }
    // Taux de brûlage actuel (ligne dédiée claire)
    const currentBurnRate = await getWeatherBurnMultiplier();
    description += `🔥 `;

    // Explication du taux
    if (currentBurnRate < 1.0) {
        description += `Les bûches durent **${(1 / currentBurnRate).toFixed(1)}× plus longtemps**\n`;
    } else if (currentBurnRate > 1.0) {
        description += `Les bûches brûlent **${currentBurnRate.toFixed(1)}× plus vite**\n`;
    } else {
        description += `Vitesse normale (4h par bûche)\n`;
    }
    description += `\n`;

    // Statistiques compactes - afficher le nombre réel de bûches
    description += `🪵 **Bûches : ${fireData.logs.length}**\n`;

    // Afficher le temps restant avant que la prochaine bûche brûle
    if (fireData.logs.length > 0) {
        // Trouver la bûche avec l'effectiveAge le plus élevé (celle qui va brûler en premier)
        const oldestLog = fireData.logs.reduce((oldest: typeof fireData.logs[0], log: typeof fireData.logs[0]) =>
            (log.effectiveAge || 0) > (oldest.effectiveAge || 0) ? log : oldest
        );

        const now = Date.now();
        const weatherMultiplier = await getWeatherBurnMultiplier();

        // Calculer combien de temps effectif il reste avant que la bûche brûle complètement
        const effectiveTimeRemaining = FIRE_CONFIG.LOG_BURN_TIME - (oldestLog.effectiveAge || 0);

        // Convertir en temps réel selon le multiplicateur actuel
        // Si multiplier = 0.5 (protection), le temps réel sera 2x plus long
        // Si multiplier = 1.3 (froid), le temps réel sera plus court
        const actualTimeRemaining = effectiveTimeRemaining / weatherMultiplier;

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
        .setLabel("❄️ Ajouter une protection")
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
