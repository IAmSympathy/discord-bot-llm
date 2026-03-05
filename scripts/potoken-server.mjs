/**
 * Serveur HTTP qui génère et expose poToken + visitorData pour Lavalink.
 * Port 8080 — Utilise youtube-po-token-generator (headless Chrome).
 */
import {createServer} from "http";
import {generate} from "youtube-po-token-generator";

let cachedToken = null;
let lastGenerated = 0;
const TTL = 5 * 60 * 1000; // 5 minutes

async function generateToken() {
    const now = Date.now();
    if (cachedToken && now - lastGenerated < TTL) return cachedToken;

    try {
        console.log(`[potoken] Generating new token...`);
        const result = await generate();
        cachedToken = {poToken: result.poToken, visitorData: result.visitorData};
        lastGenerated = Date.now();
        console.log(`[potoken] Generated: ${result.poToken.substring(0, 20)}... vd: ${result.visitorData.substring(0, 20)}...`);
        return cachedToken;
    } catch (err) {
        console.error("[potoken] Error:", err.message);
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
    generateToken().catch(console.error);
});
