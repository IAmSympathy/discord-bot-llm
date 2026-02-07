import * as fs from "fs";
import * as path from "path";
import {createLogger} from "../utils/logger";
import {DATA_DIR} from "../utils/constants";
import {Message, TextChannel} from "discord.js";

const logger = createLogger("CounterService");
const COUNTER_STATE_FILE = path.join(DATA_DIR, "counter_state.json");

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
        logger.info(`Invalid counter input from ${message.author.username}: "${content}"`);
        await message.delete().catch(() => {
        });
        return false;
    }

    // Vérifier que ce n'est pas le même utilisateur que le précédent
    if (state.lastUserId === message.author.id) {
        logger.info(`User ${message.author.username} tried to count twice in a row`);
        await message.delete().catch(() => {
        });
        return false;
    }

    // Vérifier que c'est le bon nombre
    const expectedNumber = state.currentNumber + 1;
    if (number !== expectedNumber) {
        logger.info(`Wrong number from ${message.author.username}: expected ${expectedNumber}, got ${number}`);
        await message.delete().catch(() => {
        });

        // Si c'était un reset intentionnel à 1 et que le compteur était > 0, on reset
        if (number === 1 && state.currentNumber > 0) {
            await resetCounter(message.channel as TextChannel, message.author.username);
        }

        return false;
    }

    // Nombre valide ! Mettre à jour l'état
    state.currentNumber = number;
    state.lastUserId = message.author.id;

    // Mettre à jour le record
    if (number > state.highestReached) {
        state.highestReached = number;
        logger.info(`🎉 New record reached: ${number}`);

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

    saveCounterState(state);


    // Vérifier les achievements du compteur
    const {checkCounterAchievements} = require("./counterAchievementChecker");
    await checkCounterAchievements(
        message.author.id,
        message.author.username,
        message.client,
        message.channelId
    );

    logger.info(`Counter: ${message.author.username} counted ${number}`);

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
 */
export async function forceResetCounter(channel: TextChannel): Promise<void> {
    const state = loadCounterState();
    const oldNumber = state.currentNumber;

    state.currentNumber = 0;
    state.lastUserId = null;
    saveCounterState(state);

    logger.info(`Counter force reset from ${oldNumber} to 0`);

    await channel.send({
        content: `🔄 **Compteur réinitialisé par un administrateur !**\n` +
            `Le compteur était à **${oldNumber}**.\n` +
            `Record : **${state.highestReached}**\n` +
            `Recommencez à **1** !`
    });
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
                "├ ✨ Réactions spéciales aux paliers (10, 50, 100)\n" +
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


