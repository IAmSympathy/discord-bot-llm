// Script pour ajouter automatiquement les raretés manquantes

const fs = require('fs');

const getRarity = (xp) => {
    if (xp <= 150) return "AchievementRarity.COMMON";
    if (xp <= 500) return "AchievementRarity.RARE";
    if (xp <= 1000) return "AchievementRarity.EPIC";
    return "AchievementRarity.LEGENDARY";
};

const filePath = 'src/services/achievementService.ts';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let result = [];
let modified = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    // Chercher les lignes xpReward
    if (line.includes('xpReward:') && !line.trim().startsWith('//')) {
        const match = line.match(/xpReward:\s*(\d+)/);
        if (match) {
            const xp = parseInt(match[1]);

            // Vérifier si la ligne suivante a déjà rarity
            const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
            if (!nextLine.includes('rarity:')) {
                // Extraire l'indentation
                const indentMatch = line.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : '        ';
                const rarity = getRarity(xp);
                result.push(`${indent}rarity: ${rarity}`);
                modified++;
            }
        }
    }
}

fs.writeFileSync(filePath, result.join('\n'), 'utf8');
console.log(`✅ ${modified} raretés ajoutées!`);


