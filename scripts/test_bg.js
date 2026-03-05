// Inspecter l'API complète de bgutils-js pour générer un vrai poToken
const {BG} = require('../potoken-gen/node_modules/bgutils-js');

async function main() {
    try {
        // Polyfill window dans globalThis avant tout
        if (!globalThis.window) {
            globalThis.window = globalThis;
            globalThis.document = {
                createElement: () => ({}), getElementById: () => null, readyState: 'complete', addEventListener: () => {
                }, removeEventListener: () => {
                }
            };
            globalThis.navigator = {userAgent: 'Mozilla/5.0'};
            globalThis.location = {href: 'https://www.youtube.com'};
        }

        const bgConfig = {
            fetch: (url, opts) => fetch(url, opts),
            globalObj: globalThis,
            requestKey: 'O43z0dpjhgX20SCx4KAo',
            identifier: 'Cgs3d3BLZVhjaktaVSiTtKLNBjIKCgJDQRIEGgAgKQ==',
        };

        const challenge = await BG.Challenge.create(bgConfig);
        console.log('challenge.globalName:', challenge.globalName);

        // Exécuter le script BotGuard dans globalThis
        if (challenge.interpreterJavascript) {
            const jsCode = challenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue
                || challenge.interpreterJavascript;
            const vmMod = await import('vm');
            new vmMod.Script(jsCode).runInThisContext();
            console.log('VM installed:', !!globalThis[challenge.globalName]);
        }

        const result = await BG.PoToken.generate({
            program: challenge.program,
            globalName: challenge.globalName,
            bgConfig,
        });
        console.log('poToken:', result.poToken ? result.poToken.substring(0, 30) + '...' : 'null');
        console.log('integrityToken:', result.integrityTokenData ? 'ok' : 'null');
    } catch (e) {
        console.error('Error:', e.message);
        console.error(e.stack);
    }
}

main();
