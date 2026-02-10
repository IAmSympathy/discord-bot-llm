/**
 * Script de migration pour ajouter initialContribution aux bûches existantes
 */

const fs = require('fs');
const path = require('path');

const FIRE_DATA_FILE = path.join(__dirname, '../data/seasonal_fire.json');
const LOG_BONUS = 8; // 8% par bûche

function migrateFireLogs() {
    try {
        if (!fs.existsSync(FIRE_DATA_FILE)) {
            console.log('❌ Fichier seasonal_fire.json introuvable');
            return;
        }

        const fireData = JSON.parse(fs.readFileSync(FIRE_DATA_FILE, 'utf-8'));

        console.log(`📊 Bûches actuelles : ${fireData.logs.length}`);

        let migrated = 0;
        for (const log of fireData.logs) {
            if (!log.initialContribution) {
                log.initialContribution = LOG_BONUS;
                migrated++;
            }
        }

        // Recalculer l'intensité basée sur les contributions actuelles
        const now = Date.now();
        const LOG_BURN_TIME = 3 * 60 * 60 * 1000; // 3 heures
        const WEATHER_MULTIPLIER = 1.0; // Multiplicateur normal (pas d'effet météo lors de la migration)

        let totalIntensity = 0;
        for (const log of fireData.logs) {
            const logAge = now - log.addedAt;
            const effectiveAge = logAge * WEATHER_MULTIPLIER;

            if (effectiveAge < LOG_BURN_TIME) {
                const timeRatio = 1 - (effectiveAge / LOG_BURN_TIME);
                totalIntensity += log.initialContribution * timeRatio;
            }
        }

        const oldIntensity = fireData.intensity;
        fireData.intensity = Math.min(100, Math.max(0, totalIntensity));

        console.log(`✅ ${migrated} bûche(s) migrée(s)`);
        console.log(`📈 Intensité recalculée : ${oldIntensity.toFixed(1)}% → ${fireData.intensity.toFixed(1)}%`);
        console.log(`🪵 Bûches actives : ${fireData.logs.length}`);

        // Sauvegarder
        fs.writeFileSync(FIRE_DATA_FILE, JSON.stringify(fireData, null, 4), 'utf-8');
        console.log('💾 Fichier sauvegardé !');

    } catch (error) {
        console.error('❌ Erreur lors de la migration :', error);
    }
}

migrateFireLogs();


