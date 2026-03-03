/**
 * Serveur HTTP qui génère et expose poToken + visitorData pour Lavalink youtube-plugin.
 * Basé sur l'API officielle bgutils-js v3.
 * Port 8080.
 */
const {createServer} = require('http');
const {JSDOM} = require('jsdom');

let BG;

async function loadBG() {
    if (!BG) {
        const mod = await import('./node_modules/bgutils-js/dist/index.js');
        BG = mod.BG;
    }
    return BG;
}

let cachedToken = null;
let lastGenerated = 0;
const TTL = 6 * 60 * 1000; // 6 minutes

async function generateToken() {
    const now = Date.now();
    if (cachedToken && now - lastGenerated < TTL) return cachedToken;

    try {
        const bg = await loadBG();

        // Crée un environnement DOM minimal pour bgutils
        const dom = new JSDOM('', {runScripts: 'dangerously'});
        const globalObj = dom.window;

        const requestKey = 'O43z0dpjhgX20SCx4KAo';

        const bgConfig = {
            fetch: (url, opts) => fetch(url, opts),
            globalObj,
        };

        const challenge = await bg.Challenge.create(bgConfig);
        if (!challenge) throw new Error('Challenge creation failed');

        const bgClient = await bg.BotGuardClient.create({
            program: challenge.program,
            globalObj,
            globalName: challenge.globalName,
        });

        const webPoMinter = new bg.WebPoMinter(bgClient, challenge.interpreterHash);

        // Generate poToken for a known YouTube video
        const poToken = await webPoMinter.mintAsWebsafeString(requestKey);

        const visitorData = challenge.interpreterHash || 'CgtKTkFQTURCUWcyOCj-';

        cachedToken = {poToken, visitorData};
        lastGenerated = now;
        console.log(`[potoken] Generated OK: ${poToken.substring(0, 20)}...`);
        return cachedToken;
    } catch (err) {
        console.error('[potoken] Error:', err.message);
        return null;
    }
}

const server = createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/token' || url === '/api/token') {
        const token = await generateToken();
        if (!token) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Failed to generate token'}));
            return;
        }
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(token));
    } else if (url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(8080, '127.0.0.1', () => {
    console.log('[potoken] Server listening on http://127.0.0.1:8080');
    generateToken().catch(console.error);
});

