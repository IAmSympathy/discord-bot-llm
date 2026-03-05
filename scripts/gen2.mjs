// Renouvellement automatique du poToken pour Lavalink youtube-plugin
// Génère un nouveau cold start token toutes les 5h et met à jour application.yml

import {copyFileSync, existsSync, readFileSync, writeFileSync} from 'fs';

const YML_PATH = '/home/ubuntu/lavalink/application.yml';
const YML_BACKUP_PATH = '/home/ubuntu/lavalink/application.yml.bak';
const INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 heures
const IDENTIFIER = 'CgtKTkFQTURCUWcyOC';
const VISITOR_DATA = 'Cgs3d3BLZVhjaktaVSi0sZTNBjIKCgJDQRIEGgAgKQ==';

async function generateAndApply() {
    try {
        const mod = await import('./node_modules/bgutils-js/dist/index.js');
        const BG = mod.BG;

        const poToken = BG.PoToken.generateColdStartToken(IDENTIFIER);
        console.log(`[${new Date().toISOString()}] New poToken: ${poToken.substring(0, 20)}...`);

        // Sauvegarde avant modification
        if (existsSync(YML_PATH)) {
            copyFileSync(YML_PATH, YML_BACKUP_PATH);
        }

        // Met à jour application.yml (regex global avec guillemets simples ou doubles)
        let yml = readFileSync(YML_PATH, 'utf8');

        // Cible uniquement la ligne `token:` dans le bloc `pot:` du YAML
        // Regex multi-ligne : cherche "pot:" suivi (lignes après) de "token: "..."
        yml = yml.replace(
            /(pot:[\s\S]*?token:\s*)"[^"]*"/,
            `$1"${poToken}"`
        );

        writeFileSync(YML_PATH, yml, 'utf8');
        console.log(`[${new Date().toISOString()}] poToken updated in application.yml (no restart needed).`);
    } catch (e) {
        console.error(`[${new Date().toISOString()}] Error: ${e.message}`);
        // Restaure la sauvegarde si elle existe
        if (existsSync(YML_BACKUP_PATH)) {
            try {
                copyFileSync(YML_BACKUP_PATH, YML_PATH);
                console.log(`[${new Date().toISOString()}] Restored backup after error.`);
            } catch (restoreErr) {
                console.error(`[${new Date().toISOString()}] Failed to restore backup: ${restoreErr.message}`);
            }
        }
    }
}

// Premier appel immédiat au démarrage
generateAndApply();

// Renouvellement toutes les 5h
setInterval(generateAndApply, INTERVAL_MS);
console.log(`[${new Date().toISOString()}] poToken auto-renewer started. Interval: 5h`);
