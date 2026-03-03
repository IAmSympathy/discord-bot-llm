/**
 * Serveur HTTP qui génère et expose poToken + visitorData pour Lavalink.
 * Port 8080 — Lavalink le consulte via tokenEndpoint.
 */
import {BG} from "bgutils-js";
import {createServer} from "http";

let cachedToken = null;
let lastGenerated = 0;
const TTL = 5 * 60 * 1000; // 5 minutes

async function generateToken() {
    const now = Date.now();
    if (cachedToken && now - lastGenerated < TTL) return cachedToken;

    try {
        const requestKey = "O43z0dpjhgX20SCx4KAo";
        const bgConfig = {
            fetch: (url, opts) => fetch(url, opts),
            globalObj: globalThis,
        };

        const bg = await BG.challenge.create(bgConfig);
        const bgChallenge = await BG.challenge.solve(bg);

        if (!bgChallenge) throw new Error("BG challenge failed");

        const poToken = await BG.PoToken.generate({
            program: bgChallenge.program,
            globalName: bgChallenge.globalName,
            bgConfig,
        });

        // visitorData : générer un identifiant stable
        const visitorData = Buffer.from(JSON.stringify({t: Date.now()})).toString("base64");

        cachedToken = {poToken, visitorData};
        lastGenerated = now;
        console.log(`[potoken] Generated poToken: ${poToken.substring(0, 20)}...`);
        return cachedToken;
    } catch (err) {
        console.error("[potoken] Error generating token:", err.message);
        return null;
    }
}

const server = createServer(async (req, res) => {
    if (req.url === "/token" || req.url === "/api/token") {
        const token = await generateToken();
        if (!token) {
            res.writeHead(500);
            res.end(JSON.stringify({error: "Failed to generate token"}));
            return;
        }
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(token));
    } else if (req.url === "/health") {
        res.writeHead(200);
        res.end("OK");
    } else {
        res.writeHead(404);
        res.end("Not found");
    }
});

server.listen(8080, "127.0.0.1", () => {
    console.log("[potoken] Server running on http://127.0.0.1:8080");
    // Pré-génère au démarrage
    generateToken().catch(console.error);
});

