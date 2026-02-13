import {createLogger} from "../utils/logger";
import {recordAIConversation, recordCommandUsed, recordImageGenerated, recordImageReimagined, recordImageUpscaled, recordMemeSearched, recordMentionReceived, recordMessageSent, recordPromptCreated, recordReactionAdded, recordReactionReceived, recordReplyReceived} from "./userStatsService";
import {recordYearlyAIConversation, recordYearlyCommandUsed, recordYearlyImageGenerated, recordYearlyImageReimagined, recordYearlyImageUpscaled, recordYearlyMemeSearched, recordYearlyMentionReceived, recordYearlyMessageSent, recordYearlyPromptCreated, recordYearlyReactionAdded, recordYearlyReactionReceived, recordYearlyReplyReceived, recordYearlyVoiceTime} from "./yearlyStatsService";
import {recordMonthlyAIConversation, recordMonthlyCommand, recordMonthlyCounterContribution, recordMonthlyGamePlayed, recordMonthlyHangmanPlayed, recordMonthlyImageGenerated, recordMonthlyImageReimagined, recordMonthlyImageUpscaled, recordMonthlyMemeSearched, recordMonthlyMessage, recordMonthlyPromptCreated, recordMonthlyReaction, recordMonthlyVoiceTime} from "./monthlyStatsService";
import {recordWeeklyAIConversation, recordWeeklyCommand, recordWeeklyImageGenerated, recordWeeklyImageReimagined, recordWeeklyImageUpscaled, recordWeeklyMemeSearched, recordWeeklyMessage, recordWeeklyPromptCreated, recordWeeklyReaction, recordWeeklyVoiceTime} from "./weeklyStatsService";
import {recordDailyAIConversation, recordDailyCommand, recordDailyCounterContribution, recordDailyGamePlayed, recordDailyHangmanPlayed, recordDailyImageGenerated, recordDailyMessage, recordDailyReaction, recordDailyVoiceTime} from "./dailyStatsService";

const logger = createLogger("StatsRecorder");

/**
 * Enregistre un message envoyé dans toutes les stats (total, yearly, monthly, weekly, daily)
 */
export function recordMessageStats(userId: string, username: string): void {
    recordMessageSent(userId, username);
    recordYearlyMessageSent(userId, username);
    recordMonthlyMessage(userId, username);
    recordWeeklyMessage(userId, username);
    recordDailyMessage(userId, username);
}

/**
 * Enregistre une réaction ajoutée dans toutes les stats
 */
export function recordReactionAddedStats(userId: string, username: string): void {
    recordReactionAdded(userId, username);
    recordYearlyReactionAdded(userId, username);
    recordMonthlyReaction(userId, username);
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
    recordMonthlyCommand(userId, username);
    recordWeeklyCommand(userId, username);
    recordDailyCommand(userId, username);
}

/**
 * Enregistre une conversation IA dans toutes les stats
 */
export function recordAIConversationStats(userId: string, username: string): void {
    recordAIConversation(userId, username);
    recordYearlyAIConversation(userId, username);
    recordMonthlyAIConversation(userId, username);
    recordWeeklyAIConversation(userId, username);
    recordDailyAIConversation(userId, username);
}

/**
 * Enregistre une image générée dans toutes les stats
 */
export function recordImageGeneratedStats(userId: string, username: string): void {
    recordImageGenerated(userId, username);
    recordYearlyImageGenerated(userId, username);
    recordMonthlyImageGenerated(userId, username);
    recordWeeklyImageGenerated(userId, username);
    recordDailyImageGenerated(userId, username);
}

/**
 * Enregistre une image réimaginée dans toutes les stats
 */
export function recordImageReimaginedStats(userId: string, username: string): void {
    recordImageReimagined(userId, username);
    recordYearlyImageReimagined(userId, username);
    recordMonthlyImageReimagined(userId, username);
    recordWeeklyImageReimagined(userId, username);
    const {recordDailyImageReimagined} = require("./dailyStatsService");
    recordDailyImageReimagined(userId, username);
}

/**
 * Enregistre une image upscalée dans toutes les stats
 */
export function recordImageUpscaledStats(userId: string, username: string): void {
    recordImageUpscaled(userId, username);
    recordYearlyImageUpscaled(userId, username);
    recordMonthlyImageUpscaled(userId, username);
    recordWeeklyImageUpscaled(userId, username);
}

/**
 * Enregistre une recherche de meme dans toutes les stats
 */
export function recordMemeSearchedStats(userId: string, username: string): void {
    recordMemeSearched(userId, username);
    recordYearlyMemeSearched(userId, username);
    recordMonthlyMemeSearched(userId, username);
    recordWeeklyMemeSearched(userId, username);
}

/**
 * Enregistre un prompt créé dans toutes les stats
 */
export function recordPromptCreatedStats(userId: string, username: string): void {
    recordPromptCreated(userId, username);
    recordYearlyPromptCreated(userId, username);
    recordMonthlyPromptCreated(userId, username);
    recordWeeklyPromptCreated(userId, username);
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
    recordMonthlyVoiceTime(userId, username, minutes);
    recordWeeklyVoiceTime(userId, username, minutes);
    recordDailyVoiceTime(userId, username, minutes);
}

/**
 * Enregistre une contribution au compteur (daily + monthly)
 */
export function recordCounterContributionStats(userId: string, username: string): void {
    recordMonthlyCounterContribution(userId, username);
    recordDailyCounterContribution(userId, username);
}

/**
 * Enregistre une partie jouée (daily + monthly + weekly)
 */
export function recordGamePlayedStats(userId: string, username: string, won: boolean): void {
    const {recordWeeklyGamePlayed: weeklyGame} = require("./weeklyStatsService");
    weeklyGame(userId, username, won);
    recordMonthlyGamePlayed(userId, username, won);
    recordDailyGamePlayed(userId, username, won);
}

/**
 * Enregistre une partie de pendu jouée (daily + monthly)
 */
export function recordHangmanPlayedStats(userId: string, username: string, won: boolean): void {
    recordMonthlyHangmanPlayed(userId, username, won);
    recordDailyHangmanPlayed(userId, username, won);
}

/**
 * Enregistre l'utilisation d'une commande fun (pour les défis quotidiens)
 */
export function recordFunCommandStats(userId: string, username: string): void {
    const {recordDailyFunCommand} = require("./dailyStatsService");
    recordDailyFunCommand(userId, username);
}
