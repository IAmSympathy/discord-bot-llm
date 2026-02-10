# 🎨 Ajustement des Emojis du Dessin ASCII du Feu

## 🎯 Changement Effectué

Les emojis dans le **dessin ASCII du feu** ont été ajustés pour correspondre aux nouveaux statuts.

---

## 🔥 Dessins Avant vs Après

### 5 Bûches - Ardent

**Avant :** 🔥 (flammes)
**Après :** ⚡ (éclairs)

```
⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⚡⚡⚡⚡⚡⚡
⠀⠀⠀⠀⠀⠀⠀⚡⚡⚡⚡⚡⚡⚡
⠀⠀⠀⠀⠀⠀⠀⠀⚡🪵🪵🪵🪵🪵⚡
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝
```

### 4 Bûches - Vigoureux

**Avant :** 🔥 (flammes)
**Après :** 🌟 (étoiles brillantes)

```
⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀🌟🌟🌟🌟🌟
⠀⠀⠀⠀⠀⠀⠀⠀🌟🪵🪵🪵🪵🌟
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝
```

### 3 Bûches - Stable

**Avant :** 🔥 (flammes)
**Après :** 🔥 (flammes - inchangé, correspond parfaitement)

```
⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀🔥🔥🔥🔥
⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝
```

### 2 Bûches - Braises

**Avant :** 🔥 (flammes)
**Après :** 🔴 (braises rouges)

```
⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔴🔴
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝
```

### 1 Bûche - Braises

**Avant :** 🔥 (flamme)
**Après :** 🔴 (braise rouge)

```
⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🔴
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀🪵⠀
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝
```

### 0 Bûche - Éteint

**Avant :** 💨💨 (fumée)
**Après :** 💨💨 (fumée - inchangé, déjà correct)

```
⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀💨💨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⚫⚫⚫⚫⚫⚫⠀
⠀⠀⠀⠀╚═════════════════╝
```

---

## 📊 Correspondance Complète

| Bûches | État    | Statut    | Emoji Titre | Emoji Dessin | Cohérence |
|--------|---------|-----------|-------------|--------------|-----------|
| **0**  | 0-5%    | Éteint    | 💨          | 💨💨         | ✅ Parfait |
| **1**  | 6-30%   | Braises   | 🔴          | 🔴           | ✅ Parfait |
| **2**  | 6-30%   | Braises   | 🔴          | 🔴🔴         | ✅ Parfait |
| **3**  | 31-60%  | Stable    | 🔥          | 🔥🔥🔥🔥     | ✅ Parfait |
| **4**  | 61-85%  | Vigoureux | 🌟          | 🌟🌟🌟🌟🌟   | ✅ Parfait |
| **5**  | 86-100% | Ardent    | ⚡           | ⚡⚡⚡⚡⚡⚡⚡      | ✅ Parfait |

---

## 💡 Logique Visuelle

### Progression Naturelle

```
💨💨 (Fumée)
   ↓
🔴 (Braise unique)
   ↓
🔴🔴 (Braises multiples)
   ↓
🔥🔥🔥🔥 (Flammes stables)
   ↓
🌟🌟🌟🌟🌟 (Brillance vigoureuse)
   ↓
⚡⚡⚡⚡⚡⚡⚡ (Puissance ardente)
```

### Intensité Visuelle Croissante

- **0 bûches** : Rien → Fumée (mort)
- **1 bûche** : Chaleur minimale → 1 braise
- **2 bûches** : Chaleur faible → 2 braises
- **3 bûches** : Feu normal → 4 flammes
- **4 bûches** : Feu fort → 5 étoiles brillantes
- **5 bûches** : Feu extrême → 7+ éclairs

---

## 🎨 Impact Visuel

### Avant (Uniforme)

Tous les états avec flammes utilisaient 🔥, ce qui rendait la progression moins claire visuellement.

```
5 bûches: 🔥🔥🔥🔥🔥🔥🔥 (intense mais pas distinctif)
4 bûches: 🔥🔥🔥🔥🔥 (pareil, juste moins)
3 bûches: 🔥🔥🔥🔥 (encore pareil)
2 bûches: 🔥🔥 (toujours pareil)
1 bûche: 🔥 (même emoji)
```

### Après (Distinct)

Chaque niveau a son propre emoji, rendant la progression immédiatement visible.

```
5 bûches: ⚡⚡⚡⚡⚡⚡⚡ (PUISSANCE MAXIMALE)
4 bûches: 🌟🌟🌟🌟🌟 (Brillant et fort)
3 bûches: 🔥🔥🔥🔥 (Feu normal)
2 bûches: 🔴🔴 (Braises chaudes)
1 bûche: 🔴 (Braise unique)
0 bûche: 💨💨 (Fumée/éteint)
```

---

## ✅ Avantages

### Pour les Joueurs

✅ **Reconnaissance instantanée** : Un coup d'œil suffit pour savoir l'état
✅ **Motivation visuelle** : ⚡ donne envie d'atteindre 5 bûches
✅ **Cohérence** : Dessin = Titre = État
✅ **Plus immersif** : Progression naturelle du feu

### Pour le Gameplay

✅ **Feedback clair** : État du feu évident sans lire le texte
✅ **Urgence visuelle** : 💨 ou 🔴 signale danger
✅ **Célébration** : ⚡ récompense l'effort collectif
✅ **Esthétique** : Plus beau et varié

---

## 🔧 Fichier Modifié

**`src/services/seasonal/fireManager.ts`**

Fonction `getFireVisual()` - Lignes ~470-520

### Changements

- ✅ 5 bûches : 🔥 → ⚡
- ✅ 4 bûches : 🔥 → 🌟
- ✅ 3 bûches : 🔥 → 🔥 (inchangé)
- ✅ 2 bûches : 🔥 → 🔴
- ✅ 1 bûche : 🔥 → 🔴
- ✅ 0 bûche : 💨 → 💨 (inchangé)

---

## 🎯 Exemple Complet dans l'Embed

```
⚡ FEU DE FOYER

╔═══════════════════════════════╗
⠀  ARDENT - 94.7%  
⠀  ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱  
╚═══════════════════════════════╝

💫 Multiplicateur XP : ×1.50

🥶 Froid extrême (-22°C) ! 
**Consommation ×1.3**

🪵 Bûches : 5
⏱️ Prochaine bûche brûlée dans : 1h 23min
👤 Dernière bûche : @User il y a 12 min

⠀⠀⠀⠀╔═════════════════╗
⠀⠀⠀⠀⠀⠀⠀⠀⚡⚡⚡⚡⚡⚡
⠀⠀⠀⠀⠀⠀⠀⚡⚡⚡⚡⚡⚡⚡
⠀⠀⠀⠀⠀⠀⠀⠀⚡🪵🪵🪵🪵🪵⚡
⠀⠀⠀⠀⠀⠀⠀⠀🟠🟠🟠🟠🟠🟠⠀
⠀⠀⠀⠀╚═════════════════╝
```

**Tout est cohérent : ⚡ partout !**

---

## 🚀 Résultat Final

Le feu de foyer a maintenant une **identité visuelle forte** à chaque niveau :

- 💨 = Éteint (triste)
- 🔴 = Braises (faible mais vivant)
- 🔥 = Stable (normal)
- 🌟 = Vigoureux (impressionnant)
- ⚡ = Ardent (ÉPIQUE)

**La progression est maintenant claire, cohérente et motivante ! 🎨🔥**

