# Guide de déploiement - Fix UserApp Jeux

## Problème résolu

Les jeux (TicTacToe, Rock-Paper-Scissors, Hangman) crashaient en UserApp avec l'erreur `50001: Missing Access` car le bot essayait d'éditer des messages dans des DM inaccessibles.

## Solution appliquée

- Ajout d'un champ `lastInteraction` dans les GameState
- Utilisation de `interaction.editReply()` au lieu de `message.edit()` en contexte UserApp
- Gestion appropriée des erreurs sans tenter d'envoyer de nouveaux messages

## Déploiement sur le serveur

### 1. Se connecter au serveur

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189
```

### 2. Résoudre le conflit git

Le serveur a un conflit avec `data/system_prompt.txt`. Voici comment le résoudre :

```bash
cd ~/discord-bot-llm

# Accepter la version du serveur (suppression du fichier)
git rm data/system_prompt.txt

# Terminer le merge
git commit -m "Merge: résoudre le conflit system_prompt.txt"

# Maintenant pull les nouveaux changements
git pull origin main
```

### 3. Recompiler

```bash
npx tsc
```

### 4. Redémarrer le bot

```bash
pm2 restart discord-bot-netricsa
```

### 5. Vérifier les logs

```bash
pm2 logs discord-bot-netricsa --lines 50
```

## Test

Essayez de jouer au Tic-Tac-Toe contre Netricsa en UserApp dans un DM. Le jeu devrait maintenant fonctionner sans erreur 50001.

## Changements techniques

### TicTacToe (`src/games/tictactoe/tictactoe.ts`)

- Ajout de `lastInteraction?: any` dans `GameState`
- Stockage de l'interaction après chaque `update()`
- Utilisation de `lastInteraction.editReply()` pour le tour de l'IA et le résultat final

### RockPaperScissors (`src/games/rockpaperscissors/rockpaperscissors.ts`)

- Ajout de `lastInteraction?: any` dans `GameState`
- Stockage de l'interaction après les choix
- Utilisation de `editReply()` au lieu de `update()` pour le résultat

### Hangman (`src/games/hangman/hangman.ts`)

- Ajout de `lastInteraction?: any` dans `GameState`
- Stockage de l'interaction après chaque action
- Utilisation de `lastInteraction.editReply()` pour le résultat final

