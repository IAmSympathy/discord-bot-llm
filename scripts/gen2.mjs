// Renouvellement automatique du poToken pour Lavalink youtube-plugin
// Génère un nouveau cold start token toutes les 5h et met à jour application.yml

import {readFileSync, writeFileSync} from 'fs';

const YML_PATH = '/home/ubuntu/lavalink/application.yml';
const INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 heures
const IDENTIFIER = 'CgtKTkFQTURCUWcyOC';
const VISITOR_DATA = 'Cgs3d3BLZVhjaktaVSi0sZTNBjIKCgJDQRIEGgAgKQ==';

async function generateAndApply() {
    try {
        const mod = await import('./node_modules/bgutils-js/dist/index.js');
        const BG = mod.BG;

        const poToken = BG.PoToken.generateColdStartToken(IDENTIFIER);
        console.log(`[${new Date().toISOString()}] New poToken: ${poToken.substring(0, 20)}...`);

        // Met à jour application.yml
        let yml = readFileSync(YML_PATH, 'utf8');
        yml = yml.replace(/poToken: ".*?"/, `poToken: "${poToken}"`);
        writeFileSync(YML_PATH, yml, 'utf8');

        console.log(`[${new Date().toISOString()}] poToken updated in application.yml (no restart needed).`);
    } catch (e) {
        console.error(`[${new Date().toISOString()}] Error: ${e.message}`);
    }
}

// Premier appel immédiat au démarrage
generateAndApply();

// Renouvellement toutes les 5h
setInterval(generateAndApply, INTERVAL_MS);
console.log(`[${new Date().toISOString()}] poToken auto-renewer started. Interval: 5h`);
