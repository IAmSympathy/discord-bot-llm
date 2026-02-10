# 🎨 Ajustement des Emojis du Feu de Foyer

## 🎯 Changements Effectués

Les emojis ont été ajustés pour mieux correspondre aux **noms des statuts** du feu.

---

## 🔥 Nouveaux Emojis

| État             | Intensité | Nom       | Emoji Avant | Emoji Après | Raison                                  |
|------------------|-----------|-----------|-------------|-------------|-----------------------------------------|
| **EXTINGUISHED** | 0-5%      | Éteint    | 💀          | **💨**      | Fumée résiduelle (plus doux que "mort") |
| **LOW**          | 6-30%     | Braises   | 💨          | **🔴**      | Braises rouges chaudes                  |
| **MEDIUM**       | 31-60%    | Stable    | 🔥          | **🔥**      | Inchangé - parfait                      |
| **HIGH**         | 61-85%    | Vigoureux | ♨️          | **🌟**      | Brillant et énergique                   |
| **INTENSE**      | 86-100%   | Ardent    | 🌋          | **⚡**       | Intense comme l'éclair                  |

---

## 💡 Logique des Emojis

### 💨 Éteint (0-5%)

- **Avant :** 💀 (mort - trop dramatique)
- **Après :** 💨 (fumée - représente les dernières braises qui fument)
- **Correspond à :** État d'extinction, fumée résiduelle

### 🔴 Braises (6-30%)

- **Avant :** 💨 (fumée - pas assez visuel pour des braises)
- **Après :** 🔴 (rouge - représente les braises rougeoyantes)
- **Correspond à :** Braises chaudes mais faibles, rougeoiement

### 🔥 Stable (31-60%)

- **Avant :** 🔥 (flamme)
- **Après :** 🔥 (flamme - inchangé)
- **Correspond à :** Feu normal et stable, flamme classique

### 🌟 Vigoureux (61-85%)

- **Avant :** ♨️ (vapeur - pas assez dynamique)
- **Après :** 🌟 (étoile brillante - représente la vigueur)
- **Correspond à :** Feu fort et brillant, plein d'énergie

### ⚡ Ardent (86-100%)

- **Avant :** 🌋 (volcan - pas mal mais pas assez "ardent")
- **Après :** ⚡ (éclair - représente l'intensité extrême)
- **Correspond à :** Feu ardent, intense, puissant

---

## 📊 Progression Visuelle

```
💨 → 🔴 → 🔥 → 🌟 → ⚡
```

**Progression cohérente :**

1. 💨 Fumée (presque rien)
2. 🔴 Braises (chaleur sans flamme)
3. 🔥 Feu (flammes stables)
4. 🌟 Éclat (brillance intense)
5. ⚡ Foudre (puissance maximale)

---

## 🎮 Affichage dans le Jeu

### Exemple d'Affichage

```
🔥 État du Feu de Foyer

💨 Éteint - 3.2%
🔴 Braises - 18.5%
🔥 Stable - 45.0%
🌟 Vigoureux - 72.3%
⚡ Ardent - 94.7%
```

### Dans l'Embed du Feu

```
⚡ Ardent - 94.7%

Le feu brûle avec une intensité ardente !
Multiplicateur XP : ×1.5
```

---

## 🎨 Cohérence Thématique

### Thème : Progression de la Chaleur

- **Froid/Éteint** : 💨 (absence de flamme)
- **Chaleur faible** : 🔴 (braises)
- **Chaleur normale** : 🔥 (flamme)
- **Chaleur forte** : 🌟 (brillance)
- **Chaleur extrême** : ⚡ (puissance)

### Cohérence Visuelle

✅ **Progression intuitive** : Du plus faible au plus fort
✅ **Emojis clairs** : Faciles à comprendre
✅ **Correspondance** : Chaque emoji correspond à son nom
✅ **Visuellement distinct** : Pas de confusion possible

---

## 🔧 Fichier Modifié

**`src/services/seasonal/fireData.ts`**

```typescript
// Avant
export const FIRE_EMOJIS = {
    [FireState.EXTINGUISHED]: "💀",  // Mort/éteint
    [FireState.LOW]: "💨",            // Faible fumée
    [FireState.MEDIUM]: "🔥",         // Feu normal
    [FireState.HIGH]: "♨️",           // Chaud/vapeur
    [FireState.INTENSE]: "🌋"         // Très intense
};

// Après
export const FIRE_EMOJIS = {
    [FireState.EXTINGUISHED]: "💨",  // Éteint - fumée résiduelle
    [FireState.LOW]: "🔴",            // Braises - braises rouges
    [FireState.MEDIUM]: "🔥",         // Stable - feu normal
    [FireState.HIGH]: "🌟",           // Vigoureux - brillant et fort
    [FireState.INTENSE]: "⚡"         // Ardent - intense comme l'éclair
};
```

---

## ✅ Avantages

### Pour les Joueurs

✅ **Plus clair** : Emojis correspondent mieux aux noms
✅ **Plus logique** : Progression visuelle cohérente
✅ **Plus positif** : 💨 au lieu de 💀 pour "éteint"
✅ **Plus excitant** : ⚡ pour l'intensité maximale

### Pour le Gameplay

✅ **Meilleure lisibilité** : État du feu plus facile à identifier
✅ **Motivation visuelle** : ⚡ donne envie d'atteindre l'intensité max
✅ **Cohérence thématique** : Progression naturelle du feu
✅ **Feedback immédiat** : Un coup d'œil suffit pour comprendre l'état

---

## 🎯 Résultat Final

### Affichage Complet

```
⚡ Ardent - 94.7%
━━━━━━━━━━━━━━━━━━━━
🔥 4/5 bûches actives
🌡️ -15°C (Froid)
❄️ Protection active (45 min)
💫 Multiplicateur XP : ×1.5
━━━━━━━━━━━━━━━━━━━━
```

Les emojis racontent maintenant une histoire visuelle cohérente :

- 💨 = Fumée (éteint)
- 🔴 = Braises (faible)
- 🔥 = Flamme (normal)
- 🌟 = Brillance (fort)
- ⚡ = Éclair (extrême)

**Progression naturelle et intuitive ! 🎨🔥**

