# ✅ Modifications Finales - Harvest & Seuils du Feu

## 🎯 Résumé des Changements

### 1. ✅ Commande /harvest pour obtenir des bûches

### 2. ✅ Ajustement des seuils d'intensité du feu

---

## 🪵 1. Nouvelle Commande /harvest

### Concept

Au lieu de donner des bûches automatiquement via le daily ou les activités, les utilisateurs doivent maintenant **récolter** leurs bûches avec `/harvest`.

### Fonctionnement

**Commande :** `/harvest`
**Cooldown :** 12 heures
**Résultat :** Donne 1 bûche (si l'inventaire est vide)

### Messages

#### Succès

```
✅ Bûche récoltée !

🪵 Tu as récolté une Bûche de Bois !

📦 Elle a été ajoutée à ton inventaire.
🔥 Va l'utiliser au feu de foyer pour augmenter son intensité !

⏱️ Prochaine récolte disponible dans 12 heures
```

#### Cooldown actif

```
⏰ Cooldown actif

Tu as déjà récolté une bûche récemment !

Prochaine récolte disponible dans 8h 23min
```

#### Inventaire plein (déjà une bûche)

```
🪵 Inventaire plein

Tu as déjà une bûche dans ton inventaire !

💡 Va l'utiliser au feu de foyer avant d'en récolter une autre.
📍 Trouve le feu dans le salon dédié et clique sur "🪵 Ajouter une bûche"

⚠️ Rappel : Tu ne peux avoir qu'une seule bûche à la fois.
```

### Message au Feu (sans bûche)

Quand on clique sur "🪵 Ajouter une bûche" sans en avoir :

```
🪵 Pas de bûche !

Tu n'as pas de bûche dans ton inventaire !

🎁 Comment obtenir une bûche ?
• Utilise la commande /harvest (cooldown: 12h)
• Utilise /daily pour ta récompense quotidienne
• Participe aux activités du serveur (chances aléatoires)

💡 Tu ne peux avoir qu'une seule bûche à la fois dans ton inventaire.
```

### Avantages

✅ **Intentionnel** : L'utilisateur décide quand récolter
✅ **Clair** : Une commande dédiée facile à retenir
✅ **Équilibré** : Cooldown de 12h empêche l'abus
✅ **Simple** : Une seule action = une bûche

---

## 🔥 2. Nouveaux Seuils d'Intensité du Feu

### Problème Avant

- "ÉTEINT - 13.4%" → Pas logique
- Éteint allait de 0-20%, trop large

### Solution Après

| État             | Intensité | Emoji | Nom       | Multiplicateur XP |
|------------------|-----------|-------|-----------|-------------------|
| **EXTINGUISHED** | 0-5%      | 💀    | Éteint    | ×0.5              |
| **LOW**          | 6-30%     | 💨    | Braises   | ×0.75             |
| **MEDIUM**       | 31-60%    | 🔥    | Stable    | ×1.0 (neutre)     |
| **HIGH**         | 61-85%    | ♨️    | Vigoureux | ×1.25             |
| **INTENSE**      | 86-100%   | 🌋    | Ardent    | ×1.5              |

### Changements Détaillés

#### Seuils d'Intensité

**Avant :**

- Éteint : 0-20%
- Faible : 21-40%
- Moyen : 41-60%
- Fort : 61-80%
- Intense : 81-100%

**Après :**

- Éteint : **0-5%** (vraiment éteint)
- Braises : **6-30%** (faible mais pas éteint)
- Stable : 31-60% (normal)
- Vigoureux : **61-85%** (fort)
- Ardent : **86-100%** (très intense)

#### Noms Plus Roleplay

**Avant → Après :**

- Éteint → **Éteint** (inchangé)
- Faible → **Braises** (plus évocateur)
- Moyen → **Stable** (plus positif)
- Fort → **Vigoureux** (plus dynamique)
- Intense → **Ardent** (plus poétique)

#### Emojis Améliorés

**Avant → Après :**

- 🪵 → **💀** (Éteint - plus dramatique)
- 💨 → **💨** (Braises - fumée)
- 💥 → **🔥** (Stable - feu classique)
- ♨️ → **♨️** (Vigoureux - vapeur/chaleur)
- 🔥 → **🌋** (Ardent - volcan/extrême)

#### Multiplicateurs XP

**Avant → Après :**

- Éteint : 0.33× → **0.5×** (moins punitif)
- Faible : 0.66× → **0.75×** (moins punitif)
- Moyen : 1.0× → **1.0×** (inchangé)
- Fort : 1.15× → **1.25×** (plus récompensant)
- Intense : 1.33× → **1.5×** (plus récompensant)

### Exemples de Seuils

**0-5% : 💀 Éteint**

- 0.0% → Éteint
- 2.5% → Éteint
- 5.0% → Éteint

**6-30% : 💨 Braises**

- 6.0% → Braises
- 15.0% → Braises (avant: "Éteint" ❌)
- 20.0% → Braises (avant: "Éteint" ❌)
- 30.0% → Braises

**31-60% : 🔥 Stable**

- 31.0% → Stable
- 45.0% → Stable
- 60.0% → Stable

**61-85% : ♨️ Vigoureux**

- 61.0% → Vigoureux
- 75.0% → Vigoureux
- 85.0% → Vigoureux

**86-100% : 🌋 Ardent**

- 86.0% → Ardent
- 95.0% → Ardent
- 100.0% → Ardent

### Impact sur le Gameplay

#### Alertes

- **Alerte critique** : Passe de 15% → **10%** (plus urgent)
- **Alerte basse** : Reste à 30% (zone "Braises")

#### Progression Plus Naturelle

- **Avant** : 13% = "Éteint" (confusion)
- **Après** : 13% = "Braises" (logique ✅)

#### Récompenses Plus Généreuses

- **Fort (75%)** : 1.15× → **1.25×** (+0.10)
- **Intense (95%)** : 1.33× → **1.5×** (+0.17)

---

## 📂 Fichiers Modifiés

### Nouveau Fichier

1. **`src/commands/harvest/harvest.ts`** (nouveau)
    - Commande `/harvest` complète
    - Cooldown de 12h
    - Messages adaptés selon la situation

### Fichiers Modifiés

2. **`src/services/seasonal/fireButtonHandler.ts`**
    - Message mis à jour pour mentionner `/harvest`

3. **`src/services/seasonal/fireData.ts`**
    - Nouveaux seuils (0-5%, 6-30%, 31-60%, 61-85%, 86-100%)
    - Nouveaux noms (Braises, Stable, Vigoureux, Ardent)
    - Nouveaux emojis (💀, 💨, 🔥, ♨️, 🌋)
    - Nouveaux multiplicateurs (0.5, 0.75, 1.0, 1.25, 1.5)
    - Seuil d'alerte critique à 10%

---

## 🎮 Flux Utilisateur Complet

### Cycle de la Bûche

```
1. Utilisateur utilise /harvest
   ↓
2. Reçoit 1 bûche 🪵
   ↓
3. Cooldown de 12h commence
   ↓
4. Va au feu de foyer
   ↓
5. Clique "🪵 Ajouter une bûche"
   ↓
6. Bûche consommée, intensité +8%
   ↓
7. Cooldown de 6h pour ajouter au feu
   ↓
8. Après 12h de /harvest : peut récolter à nouveau
```

### Timeline Exemple

**00:00** - `/harvest` → Obtient bûche
**00:05** - Ajoute au feu → Bûche consommée
**06:05** - Peut ajouter une autre bûche (si en a une)
**12:00** - `/harvest` disponible → Obtient nouvelle bûche
**12:05** - Ajoute au feu → etc.

---

## 📊 Comparaison Avant/Après

### Obtention de Bûches

| Aspect       | Avant             | Après                      |
|--------------|-------------------|----------------------------|
| **Commande** | Aucune            | `/harvest`                 |
| **Daily**    | Donne bûche       | Donne bûche                |
| **Cooldown** | 6h (ajout au feu) | 12h (récolte) + 6h (ajout) |
| **Clarté**   | Passive           | **Active** ✅               |

### États du Feu

| Intensité | Avant       | Après          |
|-----------|-------------|----------------|
| **5%**    | 🪵 Éteint   | 💀 Éteint ✅    |
| **15%**   | 🪵 Éteint ❌ | 💨 Braises ✅   |
| **25%**   | 💨 Faible   | 💨 Braises ✅   |
| **45%**   | 💥 Moyen    | 🔥 Stable ✅    |
| **70%**   | ♨️ Fort     | ♨️ Vigoureux ✅ |
| **95%**   | 🔥 Intense  | 🌋 Ardent ✅    |

### Multiplicateurs XP

| État      | Intensité | Avant | Après     | Différence |
|-----------|-----------|-------|-----------|------------|
| Éteint    | 0-5%      | ×0.33 | **×0.5**  | +51%       |
| Braises   | 6-30%     | ×0.66 | **×0.75** | +14%       |
| Stable    | 31-60%    | ×1.0  | **×1.0**  | =          |
| Vigoureux | 61-85%    | ×1.15 | **×1.25** | +9%        |
| Ardent    | 86-100%   | ×1.33 | **×1.5**  | +13%       |

---

## ✅ Avantages des Changements

### /harvest

✅ **Contrôle** : L'utilisateur choisit quand récolter
✅ **Engagement** : Action volontaire vs passive
✅ **Mémorable** : Commande simple à retenir
✅ **Message clair** : "Utilise /harvest" facile à comprendre

### Seuils du Feu

✅ **Logique** : "Éteint" seulement quand vraiment éteint (0-5%)
✅ **Roleplay** : Noms plus immersifs (Braises, Ardent)
✅ **Visuel** : Emojis mieux adaptés (💀 pour éteint, 🌋 pour intense)
✅ **Équilibré** : Multiplicateurs plus généreux aux hauts niveaux
✅ **Progression** : 5 états bien distincts

---

## 🚀 Résultat Final

### Système de Bûches

- 🪵 Commande `/harvest` toutes les 12h
- 🔥 Ajoute au feu avec bouton (cooldown 6h)
- 📦 Limite de 1 bûche en inventaire
- 💬 Messages clairs à chaque étape

### États du Feu

- 💀 **0-5%** : Éteint (critique)
- 💨 **6-30%** : Braises (faible)
- 🔥 **31-60%** : Stable (normal)
- ♨️ **61-85%** : Vigoureux (fort)
- 🌋 **86-100%** : Ardent (intense)

---

## 🎯 Commandes pour Tester

1. `/harvest` - Récolte une bûche
2. `/profile` → 🎒 Inventaire - Vérifie ta bûche
3. Va au feu de foyer
4. Clique "🪵 Ajouter une bûche"
5. Observe le nouvel état du feu !

**Bon feu ! 🪵🔥**

