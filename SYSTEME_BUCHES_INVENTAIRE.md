# 🪵 Système de Bûches avec Inventaire

## 🎯 Objectif

Les bûches utilisent maintenant le système d'inventaire, mais avec une **limite de 1 bûche par utilisateur** pour équilibrer le système.

---

## 🔄 Comment ça fonctionne

### Avant

- On pouvait ajouter une bûche au feu toutes les 6h sans limite
- Pas de système d'inventaire
- Pas de gestion des ressources

### Après

- ✅ **Limite d'inventaire** : 1 bûche maximum par personne
- ✅ **Consommation** : La bûche est consommée quand on l'ajoute au feu
- ✅ **Obtention** : Plusieurs façons d'obtenir une nouvelle bûche
- ✅ **Cooldown conservé** : Toujours 6h entre chaque ajout au feu

---

## 🎁 Comment Obtenir une Bûche

### Méthode Garantie

| Méthode       | Chance | Notes                              |
|---------------|--------|------------------------------------|
| **📅 /daily** | 100%   | Garanti si tu n'en as pas déjà une |

### Méthodes Aléatoires

| Activité         | Chance | Notes                            |
|------------------|--------|----------------------------------|
| **⚡ Commandes**  | 8%     | Ex: /ship, /choose, /rollthedice |
| **🎤 Vocal**     | 5%     | Par tranche de temps (1/20)      |
| **👍 Réactions** | 2%     | Par réaction ajoutée (1/50)      |
| **💬 Messages**  | 1%     | Par message envoyé (1/100)       |

---

## 📊 Flux d'Utilisation

```
1. Tu obtiens une bûche 🪵
   ↓
2. Elle apparaît dans ton inventaire (limite: 1)
   ↓
3. Tu vas au feu de foyer
   ↓
4. Tu cliques "🪵 Ajouter une bûche"
   ↓
5. La bûche est consommée et ajoutée au feu
   ↓
6. Cooldown de 6h activé
   ↓
7. Tu peux obtenir une nouvelle bûche !
```

---

## 💬 Messages aux Utilisateurs

### Quand tu n'as pas de bûche

```
🪵 Pas de bûche !

Tu n'as pas de bûche dans ton inventaire !

🎁 Comment obtenir une bûche ?
• Complète des défis quotidiens
• Participe aux activités du serveur
• Gagne des objets saisonniers

💡 Tu ne peux avoir qu'une seule bûche à la fois dans ton inventaire.
```

### Quand tu as le cooldown (mais toujours ta bûche)

```
⏰ Cooldown actif

Tu as déjà ajouté une bûche récemment !

Prochaine bûche disponible dans 3h 24min

💡 Tu as toujours ta bûche 🪵 dans ton inventaire !
```

### Quand le feu est plein (mais tu gardes ta bûche)

```
🔥 Feu au maximum

Le feu a déjà 5 bûches actives !
Attends qu'une bûche se consume avant d'en ajouter une autre.

💡 Tu as toujours ta bûche 🪵 dans ton inventaire !
```

### Succès

```
✅ Bûche ajoutée !

🔥 Nouvelle intensité : 68% (+8%)
🪵 4/5 bûches actives

🪵 Ta bûche a été consommée et ajoutée au feu !
💡 Tu peux obtenir une nouvelle bûche en participant aux activités.
```

### Daily avec bûche

```
🗓️ Récompense quotidienne réclamée !

Tu as récupéré ta récompense quotidienne !

💫 +50 XP gagné !
🪵 +1 Bûche pour le feu de foyer !
🔥 Série : 3 jours
```

### Daily quand tu as déjà une bûche

```
🗓️ Récompense quotidienne réclamée !

Tu as récupéré ta récompense quotidienne !

💫 +50 XP gagné !
💡 Tu as déjà une bûche dans ton inventaire
🔥 Série : 3 jours
```

---

## 🎒 Affichage dans l'Inventaire

```
🎒 Inventaire de Username

📊 Niveau 15 • 2,450 / 2,550 XP

🎒 Inventaire

🪵 Bûches pour le Feu
🪵 Bûche de Bois × 1
   ↳ Une bûche pour alimenter le feu de foyer (limite: 1 par personne)
   ↳ Utilise-la au feu de foyer pour augmenter l'intensité !

❄️ Hiver ✨ (Saison actuelle)
🔹 🧤 Chauffe-Mains Magique × 2
   ↳ Des petites poches chauffantes...
💎 🧣 Couverture Thermique × 1
   ↳ Une grande couverture...

📦 Total d'objets : 4
```

---

## ⚖️ Équilibrage

### Pourquoi limiter à 1 bûche ?

1. **Éviter le stockage excessif**
    - Pas d'accumulation de 10+ bûches
    - Force à utiliser régulièrement

2. **Valoriser chaque bûche**
    - Chaque bûche devient précieuse
    - Décision réfléchie de quand l'utiliser

3. **Encourager l'activité constante**
    - Incite à revenir tous les jours
    - Récompense l'engagement régulier

4. **Simplifier la gestion**
    - Pas de confusion sur combien on peut en avoir
    - Message clair : 1 maximum

### Chances Généreuses

Les chances d'obtenir des bûches sont **plus élevées** que pour les objets saisonniers :

- **8%** par commande (vs 1% pour les objets)
- **5%** par vocal (vs 0.8% pour les objets)
- **100%** sur le daily (garanti)

**Pourquoi ?** Parce que limité à 1, donc pas de risque d'abus.

---

## 🔧 Implémentation Technique

### Fichiers Modifiés

1. **`src/services/userInventoryService.ts`**
    - Ajout de `InventoryItemType.FIREWOOD_LOG`
    - Modification de `addItemToInventory()` pour limiter à 1 bûche
    - Retourne `false` si l'utilisateur a déjà une bûche

2. **`src/services/rewardService.ts`**
    - Ajout de `giveFirewoodLog()` - Donne une bûche avec vérification
    - Ajout de `tryRandomFirewoodReward()` - Système aléatoire
    - Chances configurables par activité

3. **`src/services/seasonal/fireButtonHandler.ts`**
    - Vérification de la bûche dans l'inventaire avant ajout
    - Consommation de la bûche après succès
    - Messages mis à jour pour informer l'utilisateur

4. **`src/commands/daily/daily.ts`**
    - Ajout automatique d'une bûche (si pas déjà)
    - Message adapté selon si bûche donnée ou non

5. **`src/utils/statsEmbedBuilder.ts`**
    - Section spéciale pour les bûches dans l'inventaire
    - Affichage séparé des objets saisonniers

6. **`src/commands/ship/ship.ts`**
    - Ajout de la chance de recevoir une bûche (8%)

### Nouvelle Interface

```typescript
// Dans ITEM_CATALOG
[InventoryItemType.FIREWOOD_LOG]
:
{
    name: "Bûche de Bois",
        description
:
    "Une bûche pour alimenter le feu de foyer (limite: 1 par personne)",
        emoji
:
    "🪵",
        season
:
    Season.WINTER,
        rarity
:
    "common"
}
```

### Fonctions Principales

```typescript
// Donner une bûche (retourne false si déjà une)
giveFirewoodLog(userId, username)
:
boolean

// Essayer de donner aléatoirement
tryRandomFirewoodReward(userId, username, activity)
:
boolean

// Vérifier si l'utilisateur a une bûche
hasItem(userId, InventoryItemType.FIREWOOD_LOG, 1)
:
boolean

// Consommer la bûche
removeItemFromInventory(userId, InventoryItemType.FIREWOOD_LOG, 1)
```

---

## 🎮 Expérience Utilisateur

### Scénario 1 : Premier Daily

```
Utilisateur: /daily
Bot: +50 XP + 🪵 +1 Bûche !
Inventaire: [🪵 Bûche × 1]
```

### Scénario 2 : Utiliser la Bûche

```
Utilisateur: Clique "🪵 Ajouter une bûche"
Bot: ✅ Bûche ajoutée ! (consommée)
Inventaire: []
Cooldown: 6h
```

### Scénario 3 : Essayer d'utiliser sans bûche

```
Utilisateur: Clique "🪵 Ajouter une bûche"
Bot: ❌ Pas de bûche ! Obtiens-en une avec /daily
```

### Scénario 4 : Daily quand on a déjà une bûche

```
Utilisateur: /daily (a déjà 🪵)
Bot: +50 XP + 💡 Tu as déjà une bûche
Inventaire: [🪵 Bûche × 1] (inchangé)
```

### Scénario 5 : Recevoir une bûche aléatoire

```
Utilisateur: /ship @user1 @user2
Bot: [Résultat du ship]
     🪵 Tu as trouvé une bûche ! (8% chance)
Inventaire: [🪵 Bûche × 1]
```

---

## 📈 Statistiques Attendues

### Pour un utilisateur actif quotidien :

**Sources de bûches :**

- 1× /daily = **1 bûche garantie/jour**
- 5× commandes à 8% = **~0.4 bûche/jour**
- 2h vocal à 5%/tranche = **~0.6 bûche/jour**
- 50 messages à 1% = **~0.5 bûche/jour**

**Total théorique :** ~2.5 chances/jour

**Réalité avec limite :** 1 bûche max, donc :

- Daily donne la bûche si pas déjà
- Autres sources donnent bûche si consommée

**Résultat :** Encourage à utiliser régulièrement !

---

## ✅ Avantages du Système

### Pour les Joueurs

✅ **Simple** : Limite claire (1 max)
✅ **Motivant** : Daily donne toujours une bûche
✅ **Stratégique** : Décider quand utiliser sa bûche
✅ **Gratifiant** : Chances multiples d'en obtenir

### Pour le Serveur

✅ **Équilibré** : Pas d'accumulation infinie
✅ **Engagement** : Encourage l'activité quotidienne
✅ **Clair** : Messages explicites
✅ **Flexible** : Plusieurs sources de bûches

### Technique

✅ **Réutilisable** : Système d'inventaire existant
✅ **Maintenable** : Code centralisé
✅ **Extensible** : Facile d'ajouter d'autres items à limite

---

## 🚀 Résultat Final

Un système complet où :

- 🪵 Les bûches sont des **objets d'inventaire**
- 📦 **Limite de 1** par utilisateur
- 🎁 **100% garanti** avec /daily
- 🎲 **Chances multiples** via activités
- 🔥 **Cooldown conservé** (6h entre ajouts)
- 💬 **Messages clairs** à chaque étape
- 🎒 **Visible** dans l'inventaire

---

## 🎯 Commandes pour Tester

1. `/daily` - Obtiens ta bûche garantie
2. Vérifie `/profile` → 🎒 Inventaire
3. Va au feu de foyer
4. Clique "🪵 Ajouter une bûche"
5. Recommence demain !

**Bon feu ! 🪵🔥**

