# 🎮 Système d'XP par Jeu

Chaque jeu a maintenant ses propres valeurs d'XP, avec des montants différents selon si vous jouez **contre un joueur (PvP)** ou **contre Netricsa (PvE)**.

---

## 📊 Tableau des Récompenses XP

### 🪨 Roche-Papier-Ciseaux

| Résultat    | PvP (vs Joueur) | PvE (vs Netricsa) |
|-------------|-----------------|-------------------|
| 🏆 Victoire | **15 XP**       | **8 XP**          |
| 💀 Défaite  | **6 XP**        | **3 XP**          |
| 🤝 Égalité  | **8 XP**        | **4 XP**          |

**Pourquoi ces valeurs ?**

- Jeu rapide et simple
- Valeurs modérées pour encourager à jouer sans spam
- PvE réduit car plus facile à farmer

---

### ❌ Tic-Tac-Toe

| Résultat    | PvP (vs Joueur) | PvE (vs Netricsa) |
|-------------|-----------------|-------------------|
| 🏆 Victoire | **20 XP**       | **10 XP**         |
| 💀 Défaite  | **8 XP**        | **4 XP**          |
| 🤝 Égalité  | **10 XP**       | **5 XP**          |

**Pourquoi ces valeurs ?**

- Jeu stratégique nécessitant réflexion
- Valeurs légèrement plus élevées que RPS
- Netricsa est relativement forte au Tic-Tac-Toe

---

### 🔴 Connect 4

| Résultat    | PvP (vs Joueur) | PvE (vs Netricsa) |
|-------------|-----------------|-------------------|
| 🏆 Victoire | **25 XP**       | **12 XP**         |
| 💀 Défaite  | **10 XP**       | **5 XP**          |
| 🤝 Égalité  | **12 XP**       | **6 XP**          |

**Pourquoi ces valeurs ?**

- Jeu le plus complexe et long
- Valeurs les plus élevées pour récompenser l'investissement
- Netricsa utilise un algorithme intelligent (battable mais difficile)

---

### 🔤 Pendu (Hangman)

| Résultat    | XP        |
|-------------|-----------|
| 🏆 Victoire | **15 XP** |
| 💀 Défaite  | **5 XP**  |

**Pourquoi ces valeurs ?**

- Jeu solo contre l'IA uniquement
- Pas de distinction PvP/PvE
- Valeurs moyennes car la difficulté dépend du mot

---

## 🎯 Comparaison Globale

### Par Type d'Adversaire

**PvP (Contre Joueurs) - XP moyens par victoire :**

- Roche-Papier-Ciseaux : 15 XP
- Tic-Tac-Toe : 20 XP
- Connect 4 : 25 XP

**PvE (Contre Netricsa) - XP moyens par victoire :**

- Roche-Papier-Ciseaux : 8 XP
- Tic-Tac-Toe : 10 XP
- Connect 4 : 12 XP
- Pendu : 15 XP

---

## 💡 Recommandations

### Pour Farmer de l'XP Rapidement

1. **RPS en PvP** - Parties rapides, 15 XP par victoire
2. **Tic-Tac-Toe en PvP** - Bon équilibre vitesse/récompense

### Pour Progresser Seul

1. **Pendu** - 15 XP par victoire, jeu solo
2. **Connect 4 vs Netricsa** - 12 XP mais Netricsa est forte
3. **Tic-Tac-Toe vs Netricsa** - 10 XP, bon entraînement

### Pour l'XP Maximum

1. **Connect 4 en PvP** - 25 XP par victoire (le plus élevé)
2. Mais nécessite un adversaire et des parties plus longues

---

## 📈 Équilibrage

**Ratio PvP/PvE :** Environ **2:1**

- Les parties contre joueurs donnent ~2x plus d'XP
- Encourage les interactions sociales
- Empêche le spam contre Netricsa

**Défaites et Égalités :**

- Les défaites donnent ~40% de l'XP d'une victoire
- Les égalités donnent ~50-60% de l'XP d'une victoire
- Encourage à continuer même en cas de défaite

---

## 🔄 Modifications

Pour modifier les valeurs d'XP, éditez le fichier :
`src/services/xpSystem.ts`

```typescript
export const XP_REWARDS = {
    // ...autres récompenses...

    // === JEUX - ROCHE PAPIER CISEAUX ===
    rpsVictoireVsJoueur: 15,  // ← Modifier ici
    rpsDefaiteVsJoueur: 6,
    rpsEgaliteVsJoueur: 8,
    rpsVictoireVsIA: 8,
    rpsDefaiteVsIA: 3,
    rpsEgaliteVsIA: 4,

    // ...etc pour les autres jeux...
};
```

Après modification, recompilez avec `tsc` et redémarrez le bot.

---

## 🎊 Autres Actions XP

Pour référence, voici les XP des autres actions :

**Discord :**

- Message envoyé : 5 XP
- Réaction ajoutée : 1 XP
- Réaction reçue : 2 XP
- Mention reçue : 3 XP
- Reply reçue : 4 XP
- Minute en vocal : 1 XP
- Contribution compteur : 1 XP

**Netricsa (IA) :**

- Image générée : 50 XP
- Image réimaginée : 40 XP
- Image upscalée : 30 XP
- Conversation IA : 10 XP
- Meme recherché : 15 XP
- Prompt créé : 30 XP

**Création :**

- Post création validé : **1000 XP** (nécessite validation manuelle)

---

## ✅ Résumé

✅ **Chaque jeu a ses propres valeurs d'XP**  
✅ **PvP donne ~2x plus d'XP que PvE**  
✅ **Connect 4 est le jeu le plus récompensé (25 XP PvP)**  
✅ **RPS est le plus rapide à farmer (15 XP PvP)**  
✅ **Pas de cooldown, jouez autant que vous voulez !**

🎮 **Amusez-vous et montez en niveau !**
