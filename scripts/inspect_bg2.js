const b = require('../potoken-gen/node_modules/bgutils-js');
const BG = b.BG;
console.log('BG keys:', JSON.stringify(Object.keys(BG)));
console.log('PoToken keys:', JSON.stringify(Object.keys(BG.PoToken)));
if (BG.Challenge) console.log('Challenge keys:', JSON.stringify(Object.keys(BG.Challenge)));
else console.log('BG.Challenge: undefined');
// Chercher Challenge partout
for (const key of Object.keys(b)) {
    if (typeof b[key] === 'object' && b[key] !== null && b[key].create && b[key].solve) {
        console.log('Found challenge-like at b.' + key);
    }
}
for (const key of Object.keys(BG)) {
    if (typeof BG[key] === 'object' && BG[key] !== null && (BG[key].create || BG[key].solve)) {
        console.log('Found challenge-like at BG.' + key, JSON.stringify(Object.keys(BG[key])));
    }
}

