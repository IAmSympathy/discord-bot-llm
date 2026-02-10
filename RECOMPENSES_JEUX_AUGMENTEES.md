# 🎮 Augmentation des Récompenses pour les Jeux

## 🎯 Problème Identifié

Les récompenses pour jouer aux jeux étaient **trop faibles** :

- Objets saisonniers : 5% de chance seulement
- Bûches : **Pas de récompense du tout** ❌

Résultat : Les joueurs n'étaient **pas motivés** à jouer aux jeux.

---

## ✅ Solutions Appliquées

### 1. Augmentation des Objets Saisonniers

**Avant :** 5% de chance (1/20)
**Après :** **15% de chance** (3/20)

→ **×3 plus de chances** d'obtenir un objet saisonnier !

### 2. Ajout des Bûches

**Avant :** Aucune récompense
**Après :** **30% de chance** (3/10)

→ **Nouvelle récompense** très généreuse pour encourager les jeux !

---

## 🎲 Nouvelles Chances par Victoire

| Récompense              | Chance  | Ratio | Notes                   |
|-------------------------|---------|-------|-------------------------|
| **🪵 Bûche**            | **30%** | 3/10  | Nouveau ! Très généreux |
| **❄️ Objet Saisonnier** | **15%** | 3/20  | Triplé (était 5%)       |

### Probabilités Combinées

Pour **1 victoire** :

- 30% de bûche
- 15% d'objet saisonnier
- **~41% d'obtenir au moins quelque chose** 🎁

Pour **10 victoires** :

- **~97% d'obtenir au moins 1 bûche**
- **~80% d'obtenir au moins 1 objet saisonnier**

---

## 📊 Impact sur le Gameplay

### Scénario : 10 Parties Jouées

**Avant :**

```
10 victoires
├─ 5% objets × 10 = ~0.5 objet saisonnier
└─ 0% bûches = 0 bûche
→ Total : ~0.5 récompense en moyenne
```

**Après :**

```
10 victoires
├─ 15% objets × 10 = ~1.5 objets saisonniers
└─ 30% bûches × 10 = ~3 bûches
→ Total : ~4.5 récompenses en moyenne
```

**→ ×9 plus de récompenses !**

---

## 🎮 Encouragement à Jouer

### Motivation Renforcée

**Avant :**

- Jouer 20 parties → Peut-être 1 objet si chanceux
- Pas de bûches
- **Décourageant** ❌

**Après :**

- Jouer 3-4 parties → Au moins 1 bûche très probable
- Jouer 7-8 parties → Au moins 1 objet saisonnier probable
- **Motivant** ✅

### Exemples Concrets

**Joueur Occasionnel (3 parties/jour) :**

```
3 victoires/jour
├─ 30% bûches → ~1 bûche/jour (haute probabilité)
└─ 15% objets → ~1 objet tous les 2 jours
```

**Joueur Régulier (10 parties/jour) :**

```
10 victoires/jour
├─ 30% bûches → ~3 bûches/jour
└─ 15% objets → ~1-2 objets/jour
```

**Joueur Hardcore (30 parties/jour) :**

```
30 victoires/jour
├─ 30% bûches → ~9 bûches/jour
└─ 15% objets → ~4-5 objets/jour
→ Peut alimenter le feu seul !
```

---

## 🔧 Fichiers Modifiés

### 1. `src/services/rewardService.ts`

**Ajout de la fonction complète :**

```typescript
export function tryRandomFirewoodReward(
    userId: string,
    username: string,
    activity: "message" | "voice" | "reaction" | "command" | "daily" | "game_win"
): boolean {
    const chances: Record<string, number> = {
        message: 0.02,     // 2% par message
        voice: 0.1,        // 10% par tranche vocal
        reaction: 0.05,    // 5% par réaction
        command: 0.15,     // 15% par commande
        daily: 1.0,        // 100% sur le daily
        game_win: 0.3      // 30% par victoire ✨ NOUVEAU
    };
    // ...
}
```

### 2. `src/games/common/globalStats.ts`

**Changements :**

```typescript
// Avant
if (Math.random() < 0.05) {
    rewardSeasonalItem(userId, username, "game_win");
}

// Après
if (Math.random() < 0.15) {  // ✅ 5% → 15%
    rewardSeasonalItem(userId, username, "game_win");
}

// ✅ NOUVEAU - Récompenses de bûches
tryRandomFirewoodReward(userId, username, "game_win");
```

---

## 🎁 Toutes les Sources de Récompenses

### Objets Saisonniers

| Source          | Chance     | Notes                    |
|-----------------|------------|--------------------------|
| 🏆 Achievement  | 100%       | Garanti (Medium/Large)   |
| 🎮 **Jeux**     | **15%** ⬆️ | **Triplé !**             |
| 🎨 Cmd Netricsa | 3%         | /imagine, /upscale, etc. |
| ⚡ Cmd générale  | 1%         | /ship, /choose, etc.     |
| 🎤 Vocal        | 0.8%       | Par tranche              |

### Bûches

| Source       | Chance    | Notes             |
|--------------|-----------|-------------------|
| ⛏️ /harvest  | 100%      | Cooldown 6h       |
| 📅 /daily    | 100%      | Une fois par jour |
| 🎮 **Jeux**  | **30%** ✨ | **NOUVEAU !**     |
| ⚡ Commandes  | 15%       | Par commande      |
| 🎤 Vocal     | 10%       | Par tranche       |
| 👍 Réactions | 5%        | Par réaction      |
| 💬 Messages  | 2%        | Par message       |

---

## ✅ Avantages

### Pour les Joueurs

✅ **Gratifiant** : Récompenses fréquentes et tangibles
✅ **Motivant** : Raison claire de jouer aux jeux
✅ **Équilibré** : Pas trop facile, pas trop dur
✅ **Varié** : Bûches ET objets saisonniers

### Pour le Serveur

✅ **Engagement** : Plus de parties jouées
✅ **Activité** : Canal de jeux plus vivant
✅ **Coopération** : Bûches = contribution au feu communautaire
✅ **Rétention** : Les joueurs reviennent pour les récompenses

---

## 📈 Estimation d'Impact

### Avant (Système Ancien)

```
Joueur moyen : 5 parties/jour
→ 0.25 objet saisonnier/jour (1 tous les 4 jours)
→ 0 bûche
→ Motivation : ⭐⭐☆☆☆ (2/5)
```

### Après (Nouveau Système)

```
Joueur moyen : 5 parties/jour (×2 plus motivé)
→ 0.75 objet saisonnier/jour (1 tous les 1-2 jours)
→ 1.5 bûches/jour
→ Motivation : ⭐⭐⭐⭐⭐ (5/5)
```

**Résultat attendu :**

- **×2 plus de parties jouées**
- **×10 plus de récompenses distribuées**
- **Feu mieux alimenté** grâce aux bûches

---

## 🎯 Messages aux Joueurs

Quand ils gagnent avec récompense :

### Bûche Obtenue

```
🎮 Victoire !
🪵 +1 Bûche de Bois !

Tu as gagné une bûche pour le feu de foyer !
Va l'utiliser pour maintenir le feu allumé.
```

### Objet Saisonnier Obtenu

```
🎮 Victoire !
✨ +1 Chauffe-Mains Magique !

Tu as trouvé un objet saisonnier !
Vérifie ton inventaire (/profile → 🎒)
```

### Les Deux !

```
🎮 Victoire !
🪵 +1 Bûche de Bois !
✨ +1 Couverture Thermique !

Jackpot ! Double récompense !
```

---

## 🚀 Résultat Final

Le système de récompenses pour les jeux est maintenant :

- **×3 plus généreux** pour les objets saisonniers (15%)
- **Nouvelle source** de bûches très généreuse (30%)
- **Motivation claire** de jouer aux jeux
- **Contribution au serveur** via les bûches pour le feu

**Les jeux sont maintenant vraiment gratifiants ! 🎮🎁**

