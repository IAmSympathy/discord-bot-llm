/**
 * Script de vérification pour la commande "Déplacer"
 *
 * Ce script vérifie que :
 * 1. Le fichier moveMessage.ts existe et est compilé
 * 2. La commande est correctement formatée
 * 3. Le gestionnaire dans bot.ts existe
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification de la fonctionnalité "Déplacer un message"...\n');

// Vérifier que le fichier source existe
const sourceFile = path.join(__dirname, 'src', 'commands', 'context', 'moveMessage.ts');
if (fs.existsSync(sourceFile)) {
    console.log('✅ Fichier source TypeScript trouvé : moveMessage.ts');
} else {
    console.log('❌ Fichier source TypeScript NON trouvé : moveMessage.ts');
    process.exit(1);
}

// Vérifier que le fichier compilé existe
const compiledFile = path.join(__dirname, 'dist', 'commands', 'context', 'moveMessage.js');
if (fs.existsSync(compiledFile)) {
    console.log('✅ Fichier JavaScript compilé trouvé : moveMessage.js');
} else {
    console.log('❌ Fichier JavaScript compilé NON trouvé : moveMessage.js');
    console.log('   Exécutez "npx tsc" pour compiler le TypeScript');
    process.exit(1);
}

// Vérifier le contenu du fichier compilé
const compiledContent = fs.readFileSync(compiledFile, 'utf-8');
if (compiledContent.includes('Déplacer') && compiledContent.includes('ApplicationCommandType.Message')) {
    console.log('✅ Le fichier compilé contient la commande de menu contextuel');
} else {
    console.log('❌ Le fichier compilé ne semble pas contenir la bonne commande');
    process.exit(1);
}

// Vérifier que bot.ts contient le gestionnaire
const botFile = path.join(__dirname, 'dist', 'bot.js');
if (fs.existsSync(botFile)) {
    const botContent = fs.readFileSync(botFile, 'utf-8');
    if (botContent.includes('isMessageContextMenuCommand')) {
        console.log('✅ Le gestionnaire de commandes contextuelles de message existe dans bot.js');
    } else {
        console.log('❌ Le gestionnaire de commandes contextuelles de message est manquant dans bot.js');
        process.exit(1);
    }
} else {
    console.log('❌ Le fichier bot.js compilé n\'existe pas');
    process.exit(1);
}

// Vérifier que le dossier context existe
const contextDir = path.join(__dirname, 'dist', 'commands', 'context');
if (fs.existsSync(contextDir)) {
    const files = fs.readdirSync(contextDir);
    console.log(`✅ Dossier commands/context trouvé avec ${files.length} fichier(s) :`);
    files.forEach(file => {
        console.log(`   - ${file}`);
    });
} else {
    console.log('❌ Le dossier commands/context n\'existe pas');
    process.exit(1);
}

console.log('\n🎉 Toutes les vérifications ont réussi !');
console.log('📌 La commande "Déplacer" est prête à être utilisée.');
console.log('\n💡 Pour tester la commande :');
console.log('   1. Démarrez le bot avec "node dist/bot.js" ou "npm start"');
console.log('   2. Dans Discord, faites clic droit sur un message');
console.log('   3. Sélectionnez Applications → Déplacer');
console.log('   4. Choisissez un salon de destination');

