import {createLogger} from "../utils/logger";
import {recordAIConversation, recordCommandUsed, recordImageGenerated, recordImageReimagined, recordImageUpscaled, recordMemeSearched, recordMentionReceived, recordMessageSent, recordPromptCreated, recordReactionAdded, recordReactionReceived, recordReplyReceived} from "./userStatsService";
import {recordYearlyAIConversation, recordYearlyCommandUsed, recordYearlyImageGenerated, recordYearlyImageReimagined, recordYearlyImageUpscaled, recordYearlyMemeSearched, recordYearlyMentionReceived, recordYearlyMessageSent, recordYearlyPromptCreated, recordYearlyReactionAdded, recordYearlyReactionReceived, recordYearlyReplyReceived, recordYearlyVoiceTime} from "./yearlyStatsService";
import {recordDailyAIConversation, recordDailyCommand, recordDailyCounterContribution, recordDailyGamePlayed, recordDailyHangmanPlayed, recordDailyImageGenerated, recordDailyMessage, recordDailyReaction, recordDailyVoiceTime} from "./dailyStatsService";
import {recordWeeklyImageGenerated, recordWeeklyMessage, recordWeeklyReaction, recordWeeklyVoiceTime} from "./weeklyStatsService";

const logger = createLogger("StatsRecorder");

/**
 * Enregistre un message envoyé dans toutes les stats (total, yearly, weekly, daily)
 */
export function recordMessageStats(userId: string, username: string): void {
    recordMessageSent(userId, username);
    recordYearlyMessageSent(userId, username);
    recordWeeklyMessage(userId, username);
    recordDailyMessage(userId, username);
}

/**
 * Enregistre une réaction ajoutée dans toutes les stats
 */
export function recordReactionAddedStats(userId: string, username: string): void {
    recordReactionAdded(userId, username);
    recordYearlyReactionAdded(userId, username);
    recordWeeklyReaction(userId, username);
    recordDailyReaction(userId, username);
}

/**
 * Enregistre une réaction reçue dans toutes les stats
 */
export function recordReactionReceivedStats(userId: string, username: string): void {
    recordReactionReceived(userId, username);
    recordYearlyReactionReceived(userId, username);
}

/**
 * Enregistre une commande utilisée dans toutes les stats
 */
export function recordCommandStats(userId: string, username: string): void {
    recordCommandUsed(userId, username);
    recordYearlyCommandUsed(userId, username);
    recordDailyCommand(userId, username);
}

/**
 * Enregistre une conversation IA dans toutes les stats
 */
export function recordAIConversationStats(userId: string, username: string): void {
    recordAIConversation(userId, username);
    recordYearlyAIConversation(userId, username);
    recordDailyAIConversation(userId, username);
}

/**
 * Enregistre une image générée dans toutes les stats
 */
export function recordImageGeneratedStats(userId: string, username: string): void {
    recordImageGenerated(userId, username);
    recordYearlyImageGenerated(userId, username);
    recordWeeklyImageGenerated(userId, username);
    recordDailyImageGenerated(userId, username);
}

/**
 * Enregistre une image réimaginée dans toutes les stats
 */
export function recordImageReimaginedStats(userId: string, username: string): void {
    recordImageReimagined(userId, username);
    recordYearlyImageReimagined(userId, username);
}

/**
 * Enregistre une image upscalée dans toutes les stats
 */
export function recordImageUpscaledStats(userId: string, username: string): void {
    recordImageUpscaled(userId, username);
    recordYearlyImageUpscaled(userId, username);
}

/**
 * Enregistre une recherche de meme dans toutes les stats
 */
export function recordMemeSearchedStats(userId: string, username: string): void {
    recordMemeSearched(userId, username);
    recordYearlyMemeSearched(userId, username);
}

/**
 * Enregistre un prompt créé dans toutes les stats
 */
export function recordPromptCreatedStats(userId: string, username: string): void {
    recordPromptCreated(userId, username);
    recordYearlyPromptCreated(userId, username);
}

/**
 * Enregistre une mention reçue dans toutes les stats
 */
export function recordMentionReceivedStats(userId: string, username: string): void {
    recordMentionReceived(userId, username);
    recordYearlyMentionReceived(userId, username);
}

/**
 * Enregistre une réponse reçue dans toutes les stats
 */
export function recordReplyReceivedStats(userId: string, username: string): void {
    recordReplyReceived(userId, username);
    recordYearlyReplyReceived(userId, username);
}

/**
 * Enregistre du temps vocal dans toutes les stats
 */
export function recordVoiceTimeStats(userId: string, username: string, minutes: number): void {
    const {recordVoiceTime} = require("./userStatsService");
    recordVoiceTime(userId, username, minutes);
    recordYearlyVoiceTime(userId, username, minutes);
    recordWeeklyVoiceTime(userId, username, minutes);
    recordDailyVoiceTime(userId, username, minutes);
}

/**
 * Enregistre une contribution au compteur (uniquement daily, car pas trackée ailleurs)
 */
export function recordCounterContributionStats(userId: string, username: string): void {
    recordDailyCounterContribution(userId, username);
}

/**
 * Enregistre une partie jouée (daily + weekly)
 */
export function recordGamePlayedStats(userId: string, username: string, won: boolean): void {
    const {recordWeeklyGamePlayed: weeklyGame} = require("./weeklyStatsService");
    weeklyGame(userId, username, won);
    recordDailyGamePlayed(userId, username, won);
}

/**
 * Enregistre une partie de pendu jouée (spécifiquement pour les défis quotidiens)
 */
export function recordHangmanPlayedStats(userId: string, username: string, won: boolean): void {
    recordDailyHangmanPlayed(userId, username, won);
}

