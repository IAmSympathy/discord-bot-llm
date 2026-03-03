// Génère un cold start poToken depuis le visitorData
// Usage: node gen-potoken.mjs <visitorData>
import {createRequire} from 'module';

const require = createRequire(import.meta.url);

const visitorData = process.argv[2] || 'Cgs3d3BLZVhjaktaVSi0sZTNBjIKCgJDQRIEGgAgKQ==';

async function main() {
    const mod = await import('./node_modules/bgutils-js/dist/index.js');
    const BG = mod.BG || mod.default;
    const PoToken = BG.PoToken || mod.PoToken;

    // Extraire l'identifier depuis le visitorData (base64 -> string courte)
    const identifier = visitorData.split('%')[0].substring(0, 22);

    // Cold start token - fonctionne sans BotGuard, valide pendant ~6h
    const coldToken = PoToken.generateColdStartToken(visitorData);

    console.log(JSON.stringify({
        poToken: coldToken,
        visitorData: visitorData
    }));
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});

