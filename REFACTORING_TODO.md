# Refactoring des Jeux - État des Lieux

## ✅ Tâches Accomplies

### 1. Suppression des commandes standalone

- ✅ Supprimé `/rockpaperscissors`
- ✅ Supprimé `/tictactoe`
- ✅ Supprimé `/hangman`
- ✅ Seule la commande `/games` existe maintenant

### 2. Infrastructure de stats globales

- ✅ Créé `src/games/common/globalStats.ts`
- ✅ Système de stats par joueur et par jeu
- ✅ Stats globales (tous jeux confondus)
- ✅ Enregistrement dans `data/game_stats.json`

### 3. Bouton "Retour au menu"

- ✅ Fonction `createBackToMenuButton()` créée dans `gameUtils.ts`
- ✅ Fonction `showGameMenu()` exportée pour réutilisation
- ⚠️ **À intégrer** : Ajouter le bouton dans les écrans de fin de partie

### 4. Système de navigation amélioré

- ✅ Le paramètre `originalUserId` est passé à travers toute la chaîne
- ✅ Permet de garder une trace de qui a lancé `/games`

## ⚠️ Tâches Restantes

### 1. Intégrer le bouton "Retour au menu" dans les jeux

Fichiers à modifier :

- `src/games/rockpaperscissors/rockpaperscissors.ts`
- `src/games/tictactoe/tictactoe.ts`
- `src/games/hangman/hangman.ts`

Pour chaque jeu, dans la fonction `displayResult()` ou équivalent :

```typescript
import {createBackToMenuButton} from "../common/gameUtils";

// Dans displayResult():
const rematchButton = createRematchButton(message.channelId, GAME_PREFIX);
const backButton = createBackToMenuButton();
const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rematchButton, backButton);

// Dans le collector:
if (i.customId.startsWith("game_back_to_menu_")) {
    if (i.user.id !== originalUserId) {
        await i.reply({content: "❌ Seul celui qui a lancé le menu peut y retourner !", ephemeral: true});
        return;
    }

    collector.stop("back_to_menu");
    const gamesModule = require("../../commands/games/games");
    await gamesModule.showGameMenu(i, originalUserId);
}
```

### 2. Ajouter bouton "Abandonner" au Pendu

Dans `src/games/hangman/hangman.ts` :

- Ajouter un bouton "Abandonner" dans `createLetterSelectMenu()`
- Gérer le clic dans le collector
- Marquer comme défaite et mettre à jour les stats globales

```typescript
const giveUpButton = new ButtonBuilder()
    .setCustomId(`hangman_giveup_${gameId}`)
    .setLabel("Abandonner")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🏳️");

// Dans le collector:
if (i.customId === `hangman_giveup_${gameId}`) {
    gameState.isCompleted = true;
    collector.stop("gave_up");

    // Enregistrer la défaite
    recordLoss(gameState.player, 'hangman');

    await displayResult(message, gameState, false, true); // true = abandoned
}
```

### 3. Intégrer les stats globales dans les jeux

Pour chaque jeu, remplacer les stats locales par le système global:

```typescript
import {recordWin, recordLoss, recordDraw} from "../common/globalStats";

// Quand un joueur gagne:
recordWin(winnerId, 'tictactoe'); // ou 'rockpaperscissors' ou 'hangman'

// Quand un joueur perd:
recordLoss(loserId, 'tictactoe');

// En cas d'égalité:
recordDraw(player1Id, 'tictactoe');
recordDraw(player2Id, 'tictactoe');
```

### 4. Afficher les stats dans les écrans de résultat

Utiliser `formatPlayerStats()` pour afficher les stats :

```typescript
import {formatPlayerStats} from "../common/globalStats";

// Dans displayResult():
const statsText = formatPlayerStats(winnerId, 'tictactoe');
embed.addFields({
    name: "📊 Statistiques",
    value: statsText,
    inline: false
});
```

### 5. Créer une commande `/stats`

Créer `src/commands/stats/stats.ts` :

```typescript
.
setDescription("Affiche tes statistiques de jeux")
    .addStringOption(option =>
        option
            .setName("jeu")
            .setDescription("Jeu spécifique ou global")
            .addChoices(
                {name: "🌐 Global", value: "global"},
                {name: "🪨 Roche-Papier-Ciseaux", value: "rockpaperscissors"},
                {name: "❌ Tic-Tac-Toe", value: "tictactoe"},
                {name: "🔤 Pendu", value: "hangman"}
            )
    );
```

## 📋 Ordre d'implémentation recommandé

1. ✅ Infrastructure de base (fait)
2. **Intégrer stats globales** dans un jeu (ex: Pendu)
3. **Ajouter bouton "Abandonner"** au Pendu
4. **Ajouter bouton "Retour au menu"** au Pendu
5. Tester le Pendu complètement
6. Répliquer pour Tic-Tac-Toe
7. Répliquer pour Roche-Papier-Ciseaux
8. Créer la commande `/stats`
9. Tests finaux

## 🎯 Résultat Final Attendu

- Une seule commande `/games` pour accéder à tous les jeux
- Stats persistantes par joueur (fichier JSON)
- Stats globales + stats par jeu
- Bouton "Retour au menu" après chaque partie
- Bouton "Abandonner" dans le Pendu
- Commande `/stats` pour consulter ses performances
