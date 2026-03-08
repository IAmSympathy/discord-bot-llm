import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";
import {Client, Message, TextChannel} from "discord.js";
import {EnvConfig} from "../utils/envConfig";
import {checkCounterChallengeProgress} from "./randomEventsService";
import {recordCounterContributionStats} from "./statsRecorder";

const logger = createLogger("CounterService");
const COUNTER_STATE_FILE = path.join(DATA_DIR, "counter_state.json");

// Rate limit Discord : max 2 renommages de salon par 10 minutes
const CHANNEL_RENAME_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let lastChannelRenameTime = 0;

/**
 * Met à jour le nom du salon compteur pour afficher le nombre actuel.
 * Respecte le rate limit Discord (~2 renommages / 10 min).
 */
async function updateCounterChannelName(channel: TextChannel, count: number): Promise<void> {
    const now = Date.now();
    if (now - lastChannelRenameTime < CHANNEL_RENAME_COOLDOWN_MS) return;
    try {
        const newName = `┃🧮┃compteur『${count}』`;
        await channel.setName(newName);
        lastChannelRenameTime = now;
        logger.info(`[Counter] Channel renamed to "${newName}"`);
    } catch (error) {
        logger.warn("[Counter] Failed to rename channel (rate limit or permissions):", error);
    }
}

/**
 * Démarre un interval qui vérifie toutes les 5 minutes si le nom du salon
 * doit être mis à jour (utile si personne n'a compté depuis longtemps).
 */
export function startCounterChannelNameUpdater(client: Client): void {
    const INTERVAL_MS = CHANNEL_RENAME_COOLDOWN_MS; // 5 minutes

    setInterval(async () => {
        const channelId = EnvConfig.COUNTER_CHANNEL_ID;
        if (!channelId) return;

        try {
            const channel = await client.channels.fetch(channelId) as TextChannel | null;
            if (!channel) return;

            const state = loadCounterState();
            const expectedName = `┃🧮┃compteur『${state.currentNumber}』`;

            // Ne renommer que si le nom est différent (évite un call inutile)
            if (channel.name !== expectedName) {
                await updateCounterChannelName(channel, state.currentNumber);
            }
        } catch (error) {
            logger.warn("[Counter] Periodic channel name check failed:", error);
        }
    }, INTERVAL_MS);

    logger.info(`[Counter] Periodic channel name updater started (every ${INTERVAL_MS / 60000} min)`);
}

interface CounterState {
    currentNumber: number;
    lastUserId: string | null;
    highestReached: number;
    contributions: { [userId: string]: { username: string; count: number } };
}

/**
 * Charge l'état du compteur
 */
function loadCounterState(): CounterState {
    try {
        if (fs.existsSync(COUNTER_STATE_FILE)) {
            const data = fs.readFileSync(COUNTER_STATE_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error("Error loading counter state:", error);
    }

    return {
        currentNumber: 0,
        lastUserId: null,
        highestReached: 0,
        contributions: {}
    };
}

/**
 * Sauvegarde l'état du compteur
 */
function saveCounterState(state: CounterState): void {
    try {
        const dir = path.dirname(COUNTER_STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(COUNTER_STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        logger.error("Error saving counter state:", error);
    }
}

/**
 * Vérifie et traite un message dans le salon compteur
 * @returns true si le message est valide, false sinon
 */
export async function handleCounterMessage(message: Message): Promise<boolean> {
    const state = loadCounterState();
    const content = message.content.trim();

    // Vérifier que le message est un nombre
    const number = parseInt(content);
    if (isNaN(number) || content !== number.toString()) {
        logger.info(`[Counter] ❌ Invalid input from ${message.author.username}: "${content}" - Deleting in 3s`);
        await message.react("❌").catch(() => {
        });
        setTimeout(async () => {
            await message.delete().catch(() => {
            });
        }, 3000);
        return false;
    }

    // Vérifier que ce n'est pas le même utilisateur que le précédent
    if (state.lastUserId === message.author.id) {
        logger.info(`[Counter] ❌ User ${message.author.username} tried to count twice in a row (number: ${number}) - Deleting in 3s`);
        await message.react("🚫").catch(() => {
        });
        setTimeout(async () => {
            await message.delete().catch(() => {
            });
        }, 3000);
        return false;
    }

    // Vérifier que c'est le bon nombre
    const expectedNumber = state.currentNumber + 1;
    if (number !== expectedNumber) {
        logger.warn(`[Counter] ❌ Wrong number from ${message.author.username}: expected ${expectedNumber}, got ${number} - Deleting in 3s`);
        await message.react("⚠️").catch(() => {
        });
        setTimeout(async () => {
            await message.delete().catch(() => {
            });
        }, 3000);

        // Si c'était un reset intentionnel à 1 et que le compteur était > 0, on reset
        if (number === 1 && state.currentNumber > 0) {
            await resetCounter(message.channel as TextChannel, message.author.username);
        }

        return false;
    }

    // Nombre valide ! Mettre à jour l'état
    state.currentNumber = number;
    state.lastUserId = message.author.id;

    logger.info(`[Counter] ✅ Valid count from ${message.author.username}: ${number}`);

    // Mettre à jour le record
    if (number > state.highestReached) {
        state.highestReached = number;
        logger.info(`[Counter] 🎉 New record reached: ${number}`);

        // Réagir au message pour célébrer le nouveau record
        if (number % 1000 === 0) {
            // Palier 1000 - ÉNORME célébration
            await message.react("🏆").catch(() => {
            });
            await message.react("👑").catch(() => {
            });
            await message.react("💎").catch(() => {
            });
            await message.react("🌟").catch(() => {
            });
            await message.react("🎆").catch(() => {
            });
        } else if (number % 500 === 0) {
            // Palier 500 - Grande célébration
            await message.react("🎊").catch(() => {
            });
            await message.react("🎉").catch(() => {
            });
            await message.react("💫").catch(() => {
            });
            await message.react("🔥").catch(() => {
            });
        } else if (number % 250 === 0) {
            // Palier 250 - Célébration importante
            await message.react("⭐").catch(() => {
            });
            await message.react("💥").catch(() => {
            });
            await message.react("🌈").catch(() => {
            });
        } else if (number % 100 === 0) {
            // Palier 100 - Grosse célébration
            await message.react("🎉").catch(() => {
            });
            await message.react("💯").catch(() => {
            });
            await message.react("✨").catch(() => {
            });
        } else if (number === 666) {
            // Palier 666 - Le nombre de la bête
            await message.react("😈").catch(() => {
            });
            await message.react("🔥").catch(() => {
            });
            await message.react("👹").catch(() => {
            });
        } else if (number === 420) {
            // Palier 420 - Référence cannabis
            await message.react("🌿").catch(() => {
            });
            await message.react("🍃").catch(() => {
            });
            await message.react("😎").catch(() => {
            });
        } else if (number === 404) {
            // Palier 404 - Not Found
            await message.react("❓").catch(() => {
            });
            await message.react("🔍").catch(() => {
            });
            await message.react("🤷").catch(() => {
            });
        } else if (number === 360) {
            // Palier 360 - No scope
            await message.react("🎯").catch(() => {
            });
            await message.react("🔫").catch(() => {
            });
        } else if (number === 322) {
            // Palier 322 - Référence Dota 2 (throw)
            await message.react("💰").catch(() => {
            });
            await message.react("🤡").catch(() => {
            });
        } else if (number === 300) {
            // Palier 300 - Référence Spartan
            await message.react("⚔️").catch(() => {
            });
            await message.react("🛡️").catch(() => {
            });
        } else if (number === 256) {
            // Palier 256 - 2^8
            await message.react("💾").catch(() => {
            });
            await message.react("🖥️").catch(() => {
            });
        } else if (number === 200) {
            // Palier 200 - HTTP OK
            await message.react("✅").catch(() => {
            });
            await message.react("🌐").catch(() => {
            });
        } else if (number === 177013) {
            // Palier 177013 - Si vous savez, vous savez
            await message.react("💀").catch(() => {
            });
            await message.react("😱").catch(() => {
            });
            await message.react("⚠️").catch(() => {
            });
        } else if (number === 1337) {
            // Palier 1337 - LEET
            await message.react("🤓").catch(() => {
            });
            await message.react("💻").catch(() => {
            });
            await message.react("🔧").catch(() => {
            });
        } else if (number === 911) {
            // Palier 911 - Emergency
            await message.react("🚨").catch(() => {
            });
            await message.react("🚑").catch(() => {
            });
        } else if (number === 777) {
            // Palier 777 - Jackpot
            await message.react("🎰").catch(() => {
            });
            await message.react("💰").catch(() => {
            });
            await message.react("🍀").catch(() => {
            });
        } else if (number === 69) {
            // Palier 69 - Nice
            await message.react("😏").catch(() => {
            });
            await message.react("👀").catch(() => {
            });
        } else if (number === 67) {
            // Palier 67 - Nice
            await message.react("6️⃣").catch(() => {
            });
            await message.react("7️⃣").catch(() => {
            });
        } else if (number === 42) {
            // Palier 42 - La réponse à la grande question
            await message.react("🌌").catch(() => {
            });
            await message.react("📖").catch(() => {
            });
            await message.react("🤔").catch(() => {
            });
        } else if (number === 21) {
            // Palier 21 - Blackjack
            await message.react("🃏").catch(() => {
            });
            await message.react("🎲").catch(() => {
            });
        } else if (number === 13) {
            // Palier 13 - Malchance
            await message.react("🖤").catch(() => {
            });
            await message.react("🐈‍⬛").catch(() => {
            });
        } else if (number === 7) {
            // Palier 7 - Chance
            await message.react("🍀").catch(() => {
            });
            await message.react("✨").catch(() => {
            });
        } else if (number % 69 === 0 && number !== 69) {
            // Multiples de 69
            await message.react("😏").catch(() => {
            });
        } else if (number % 50 === 0) {
            // Palier 50 - Célébration moyenne
            await message.react("🎊").catch(() => {
            });
            await message.react("🎯").catch(() => {
            });
        } else if (number % 25 === 0) {
            // Palier 25
            await message.react("⚡").catch(() => {
            });
            await message.react("💪").catch(() => {
            });
        } else if (number % 10 === 0) {
            // Palier 10 - Petite célébration
            await message.react("✨").catch(() => {
            });
        } else if (number % 5 === 0) {
            // Palier 5 - Encouragement
            await message.react("👍").catch(() => {
            });
        }
    }

    // Enregistrer la contribution
    if (!state.contributions[message.author.id]) {
        state.contributions[message.author.id] = {
            username: message.author.username,
            count: 0
        };
    }
    state.contributions[message.author.id].count++;
    state.contributions[message.author.id].username = message.author.username;

    // Enregistrer dans les stats quotidiennes
    recordCounterContributionStats(message.author.id, message.author.username);


    saveCounterState(state);

    // Vérifier si l'objectif du défi du compteur est atteint
    await checkCounterChallengeProgress(
        message.client,
        message.author.id,
        message.author.username,
        number
    );

    // Vérifier les achievements du compteur
    const {checkCounterAchievements} = require("./counterAchievementChecker");
    await checkCounterAchievements(
        message.author.id,
        message.author.username,
        message.client,
        message.channelId
    );

    logger.info(`Counter: ${message.author.username} counted ${number}`);

    // Mettre à jour le nom du salon pour afficher le nombre actuel (cooldown 5 min)
    await updateCounterChannelName(message.channel as TextChannel, number);

    return true;
}

/**
 * Reset le compteur
 */
async function resetCounter(channel: TextChannel, username: string): Promise<void> {
    const state = loadCounterState();
    const oldNumber = state.currentNumber;

    state.currentNumber = 0;
    state.lastUserId = null;
    saveCounterState(state);

    logger.info(`Counter reset by ${username} from ${oldNumber} to 0`);

    await channel.send({
        content: `❌ **Compteur réinitialisé !**\n` +
            `Le compteur était à **${oldNumber}**.\n` +
            `Record : **${state.highestReached}**\n` +
            `Recommencez à **1** !`
    });
}

/**
 * Récupère l'état actuel du compteur
 */
export function getCounterState(): CounterState {
    return loadCounterState();
}

/**
 * Récupère le nombre de contributions d'un utilisateur au compteur
 */
export function getUserCounterContributions(userId: string): number {
    const state = loadCounterState();
    return state.contributions[userId]?.count || 0;
}

/**
 * Récupère le nombre actuel du compteur
 */
export function getCurrentCount(): number {
    const state = loadCounterState();
    return state.currentNumber;
}

/**
 * Récupère le top contributeurs du compteur
 */
export function getTopCounterContributors(limit: number = 10): Array<{ userId: string; username: string; count: number }> {
    const state = loadCounterState();

    return Object.entries(state.contributions)
        .map(([userId, data]) => ({
            userId,
            username: data.username,
            count: data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Force reset du compteur (commande admin)
 * Supprime tous les messages et réinitialise complètement le compteur avec le message d'intro
 */
export async function forceResetCounter(channel: TextChannel): Promise<void> {
    const state = loadCounterState();
    const oldNumber = state.currentNumber;

    logger.info(`Counter force reset from ${oldNumber} to 0`);

    // Réinitialiser l'état AVANT de supprimer les messages
    state.currentNumber = 0;
    state.lastUserId = null;
    saveCounterState(state);

    // Supprimer tous les messages du salon (par batch de 100 max)
    try {
        let deletedCount = 0;
        let hasMore = true;

        while (hasMore) {
            const messages = await channel.messages.fetch({limit: 100});

            if (messages.size === 0) {
                hasMore = false;
                break;
            }

            // Supprimer les messages par batch
            const deleted = await channel.bulkDelete(messages, true); // true = skip les messages > 14 jours
            deletedCount += deleted.size;

            // Si on a supprimé moins que le fetch, c'est qu'il n'y en a plus
            if (deleted.size < messages.size) {
                hasMore = false;
            }
        }

        logger.info(`Deleted ${deletedCount} messages from counter channel`);
    } catch (error) {
        logger.error("Error deleting messages:", error);
    }

    // Réinitialiser complètement le compteur avec le message d'intro
    await initializeCounter(channel);

    logger.info("Counter fully reset with intro message");
}

/**
 * Initialise le compteur avec un message explicatif de Netricsa
 */
export async function initializeCounter(channel: TextChannel): Promise<void> {
    const state = loadCounterState();


    // Si le compteur est déjà initialisé, ne pas renvoyer le message d'intro
    if (state.currentNumber !== 0 || state.lastUserId !== null) {
        logger.info("Counter already initialized, skipping intro message");
        return;
    }

    // Message d'explication des règles
    await channel.send({
        embeds: [{
            color: 0x5865F2,
            title: "🔢 Bienvenue au Compteur !",
            description:
                "**Règles du jeu :**\n" +
                "╭ 📝 Comptez en séquence (1, 2, 3, 4...)\n" +
                "├ 👥 Pas deux fois de suite le même utilisateur\n" +
                "├ ❌ Messages invalides supprimés automatiquement\n" +
                "├ ✨ Réactions spéciales aux paliers et à certains nombres\n" +
                "╰ 🏆 Vos contributions sont trackées dans vos stats !\n\n" +
                "**Bonne chance et amusez-vous ! 🎉**",
            footer: {
                text: "Le compteur commence maintenant !"
            }
        }]
    });

    // Envoyer le message "0" pour initialiser
    const zeroMessage = await channel.send("0");

    // Marquer comme initialisé (Netricsa a envoyé 0)
    state.currentNumber = 0;
    state.lastUserId = zeroMessage.author.id;
    saveCounterState(state);

    logger.info("Counter initialized with Netricsa's message");
}

/**
 * Valide et nettoie le salon compteur en vérifiant tous les messages récents
 */
async function validateAndCleanChannel(channel: TextChannel): Promise<void> {
    try {
        logger.info("Validating and cleaning counter channel...");

        const state = loadCounterState();
        let expectedNumber = state.currentNumber + 1;
        let lastValidUserId = state.lastUserId;

        // Récupérer les 100 derniers messages
        const messages = await channel.messages.fetch({limit: 100});

        // Trier par date (du plus ancien au plus récent)
        const sortedMessages = Array.from(messages.values()).reverse();

        let messagesToDelete: string[] = [];
        let validMessagesFound = 0;

        // Trouver le dernier message valide pour déterminer où on en est
        for (const msg of sortedMessages) {
            // Ignorer complètement tous les messages des bots (incluant Netricsa)
            // Cela inclut le message "0" initial et l'embed d'explication
            if (msg.author.bot) {
                continue;
            }

            const content = msg.content.trim();
            const number = parseInt(content);

            // Si c'est un nombre valide
            if (!isNaN(number) && content === number.toString()) {
                // Vérifier si c'est dans la séquence
                if (number === expectedNumber) {
                    // Vérifier que ce n'est pas le même utilisateur
                    if (lastValidUserId === msg.author.id) {
                        messagesToDelete.push(msg.id);
                    } else {
                        // Message valide !
                        expectedNumber = number + 1;
                        lastValidUserId = msg.author.id;
                        validMessagesFound++;
                    }
                } else {
                    // Mauvais nombre dans la séquence
                    messagesToDelete.push(msg.id);
                }
            } else {
                // Pas un nombre valide
                messagesToDelete.push(msg.id);
            }
        }

        // Supprimer les messages invalides (max 10 à la fois pour éviter le rate limit)
        if (messagesToDelete.length > 0) {
            logger.info(`Found ${messagesToDelete.length} invalid messages to delete`);

            for (let i = 0; i < messagesToDelete.length && i < 10; i++) {
                const messageId = messagesToDelete[i];
                try {
                    const msgToDelete = await channel.messages.fetch(messageId);
                    await msgToDelete.delete();
                    await new Promise(resolve => setTimeout(resolve, 500)); // Éviter le rate limit
                } catch (error) {
                    logger.error(`Error deleting message ${messageId}:`, error);
                }
            }

            if (messagesToDelete.length > 10) {
                logger.warn(`Only deleted 10 messages out of ${messagesToDelete.length} to avoid rate limit`);
            }
        }

        // Mettre à jour l'état si nécessaire
        if (validMessagesFound > 0 && expectedNumber - 1 !== state.currentNumber) {
            state.currentNumber = expectedNumber - 1;
            state.lastUserId = lastValidUserId;
            saveCounterState(state);
            logger.info(`Counter state updated to ${state.currentNumber} after validation`);
        }

        logger.info(`Counter channel validated. Current number: ${state.currentNumber}`);

    } catch (error) {
        logger.error("Error validating counter channel:", error);
    }
}


