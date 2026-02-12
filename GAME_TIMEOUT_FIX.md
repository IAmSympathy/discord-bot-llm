# Correction des Timeouts de Jeux

## Problème Résolu

Les boutons des jeux restaient visibles même après un timeout, sans indication claire que la partie était expirée.

## Corrections Apportées

### 1. **Hangman** (`src/games/hangman/hangman.ts`)

- ✅ Ajout d'un embed de timeout pour le collector de jeu principal
- ✅ Ajout d'un collector timeout pour le bouton "Nouvelle partie"
- Messages clairs : "Le temps de jeu est écoulé" et "Le temps pour rejouer est écoulé"

### 2. **Tic-Tac-Toe** (`src/games/tictactoe/tictactoe.ts`)

- ✅ Ajout d'un embed de timeout pour le collector de jeu principal
- ✅ Ajout d'un embed de timeout pour l'attente d'un joueur
- ✅ Ajout d'un collector timeout pour le bouton "Rematch"
- Messages adaptés à chaque situation

### 3. **Connect 4** (`src/games/connect4/connect4.ts`)

- ✅ Ajout d'un embed de timeout pour le collector de jeu principal
- ✅ Ajout d'un embed de timeout pour l'attente d'un joueur
- ✅ Ajout d'un collector timeout pour le bouton "Rematch"
- Tous les timeouts ont maintenant des messages clairs

### 4. **Roche-Papier-Ciseaux** (`src/games/rockpaperscissors/rockpaperscissors.ts`)

- ✅ Ajout d'un embed de timeout pour le collector de jeu principal
- ✅ Ajout d'un embed de timeout pour l'attente d'un joueur
- ✅ Ajout d'un collector timeout pour le bouton "Rematch"
- Messages explicites pour chaque phase

### 5. **Blackjack** (`src/games/blackjack/blackjack.ts`)

- ✅ Amélioration de l'embed de timeout pour le collector de jeu principal
- ✅ Amélioration de l'embed de timeout pour le bouton "Rematch"
- Déjà partiellement géré, mais amélioré pour la cohérence

### 6. **Menu Principal** (`src/commands/games/games.ts`)

- ✅ Déjà correctement géré (pas de modification nécessaire)

## Comportement Après Correction

Lorsqu'un timeout se produit maintenant :

1. **Les boutons sont supprimés** (plus d'interactions possibles)
2. **Un embed clair est affiché** avec :
    - Couleur rouge (0xED4245)
    - Titre du jeu concerné
    - Message explicite : "⏱️ Le temps [de jeu/pour rejouer/pour choisir] est écoulé"
    - Timestamp

## Types de Timeout Gérés

- ✅ **Timeout du menu principal** : 2 minutes pour choisir un jeu
- ✅ **Timeout d'attente d'un joueur** : 1 minute pour qu'un adversaire rejoigne
- ✅ **Timeout de partie active** : Variable selon le jeu (1-10 minutes)
- ✅ **Timeout de rematch** : 2 minutes pour accepter un rematch

## Test Recommandé

Pour tester les corrections :

1. Lancer un jeu via `/games`
2. Ne pas interagir pendant le temps imparti
3. Vérifier que :
    - Les boutons disparaissent
    - Un message de timeout clair s'affiche
    - Le jeu est bien supprimé de la liste des parties actives

