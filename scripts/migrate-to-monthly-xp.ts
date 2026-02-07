/**
 * Script pour migrer l'XP actuel vers le système mensuel (février 2026)
 * À exécuter une seule fois
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const USER_XP_FILE = path.join(DATA_DIR, "user_xp.json");
const MONTHLY_XP_FILE = path.join(DATA_DIR, "monthly_xp.json");

interface UserXP {
    userId: string;
    username: string;
    totalXP: number;
    level: number;
    lastUpdate: number;
}

interface MonthlyXPData {
    [yearMonth: string]: {
        [userId: string]: {
            username: string;
            xpGained: number;
        };
    };
}

function migrateToMonthlyXP() {
    console.log("🔄 Début de la migration XP vers monthly_xp.json...");

    // Charger l'XP actuel
    let currentXP: { [userId: string]: UserXP } = {};
    if (fs.existsSync(USER_XP_FILE)) {
        const data = fs.readFileSync(USER_XP_FILE, "utf-8");
        currentXP = JSON.parse(data);
        console.log(`✅ Chargé ${Object.keys(currentXP).length} utilisateurs depuis user_xp.json`);
    } else {
        console.error("❌ Fichier user_xp.json non trouvé!");
        return;
    }

    // Charger ou créer monthly_xp.json
    let monthlyXP: MonthlyXPData = {};
    if (fs.existsSync(MONTHLY_XP_FILE)) {
        const data = fs.readFileSync(MONTHLY_XP_FILE, "utf-8");
        monthlyXP = JSON.parse(data);
        console.log("✅ Fichier monthly_xp.json chargé");
    } else {
        console.log("📝 Création d'un nouveau fichier monthly_xp.json");
    }

    // Créer les données pour février 2026 si elles n'existent pas
    const february2026 = "2026-02";
    if (!monthlyXP[february2026]) {
        monthlyXP[february2026] = {};
        console.log(`📅 Création de la section ${february2026}`);
    }

    let migratedCount = 0;
    let updatedCount = 0;

    // Copier l'XP total de chaque utilisateur comme XP gagné en février
    for (const [userId, userData] of Object.entries(currentXP)) {
        if (monthlyXP[february2026][userId]) {
            // Déjà existant, additionner
            const oldXP = monthlyXP[february2026][userId].xpGained;
            monthlyXP[february2026][userId].xpGained = userData.totalXP;
            monthlyXP[february2026][userId].username = userData.username;
            console.log(`📊 Mise à jour ${userData.username}: ${oldXP} XP → ${userData.totalXP} XP`);
            updatedCount++;
        } else {
            // Nouveau
            monthlyXP[february2026][userId] = {
                username: userData.username,
                xpGained: userData.totalXP
            };
            console.log(`✨ Ajout ${userData.username}: ${userData.totalXP} XP`);
            migratedCount++;
        }
    }

    // Sauvegarder
    fs.writeFileSync(MONTHLY_XP_FILE, JSON.stringify(monthlyXP, null, 2));

    console.log("\n🎉 Migration terminée !");
    console.log(`📊 Résumé :`);
    console.log(`   - ${migratedCount} nouveaux utilisateurs ajoutés`);
    console.log(`   - ${updatedCount} utilisateurs mis à jour`);
    console.log(`   - Total: ${migratedCount + updatedCount} utilisateurs dans ${february2026}`);
    console.log(`📁 Fichier sauvegardé: ${MONTHLY_XP_FILE}`);
}

// Exécuter la migration
try {
    migrateToMonthlyXP();
} catch (error) {
    console.error("❌ Erreur lors de la migration:", error);
    process.exit(1);
}
