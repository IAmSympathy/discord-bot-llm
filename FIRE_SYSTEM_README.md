# 🔥 Système de Feu de Foyer - Documentation Complète

## 📋 Vue d'ensemble

Le système de **Feu de Foyer** est un événement saisonnier d'hiver qui permet aux joueurs de maintenir collectivement un feu allumé pour bénéficier d'un multiplicateur d'XP global.

---

## 🎮 Fonctionnement

### Concept

- Un feu de foyer avec une **intensité de 0% à 100%**
- L'intensité décroît naturellement avec le temps
- Les joueurs ajoutent des bûches pour maintenir le feu
- Plus le feu est intense, plus le **multiplicateur d'XP** est élevé

### Valeurs

```
Intensité → Multiplicateur XP
├─ 81-100% (Intense) → ×1.33
├─ 61-80% (Fort) → ×1.15
├─ 41-60% (Moyen) → ×1.00 (normal)
├─ 21-40% (Faible) → ×0.66
└─ 0-20% (Éteint) → ×0.33 (pénalité)
```

---

## 🔧 Paramètres

### Décroissance

- **-1% toutes les 30 minutes** (-2% par heure)
- Durée sans intervention : ~50 heures (100% → 0%)

### Ajout de bûches

- **+10% par bûche**
- **Cooldown : 4 heures** par joueur
- Maximum : 100%

### Mise à jour

- Interface mise à jour toutes les **5 minutes**
- Salon vocal mis à jour en temps réel
- Reset quotidien des statistiques à minuit

---

## 🎨 Interface

### 1. Salon Vocal (en haut du serveur)

```
🔥 Feu de Foyer - ×1.15 XP
```

Le nom change selon l'état :

- `🔥 Feu de Foyer - ×1.33 XP` (Intense)
- `🔥 Feu de Foyer - ×1.15 XP` (Fort)
- `🔥 Feu de Foyer - ×1.0 XP` (Moyen)
- `🪵 Feu de Foyer - ×0.66 XP` (Faible)
- `💨 Feu de Foyer - ×0.33 XP` (Éteint)

**Caractéristiques :**

- ✅ Personne ne peut se connecter (afichage seulement)
- ✅ Toujours en première position
- ✅ Mis à jour toutes les 5 minutes

### 2. Embed Permanent (salon général)

```
┌────────────────────────────────────┐
│ 🔥 FEU DE FOYER                    │
├────────────────────────────────────┤
│ État actuel : FORT                 │
│                                    │
│ [████████░░] 75%                   │
│                                    │
│ 🎁 Multiplicateur XP : ×1.15       │
│                                    │
│ 📊 Statistiques                    │
│ • Dernière bûche : il y a 25 min   │
│ • Bûches aujourd'hui : 18          │
│ • S'éteindra dans : ~37h           │
│                                    │
│ 💡 +10% par bûche                  │
│ ⏰ Cooldown : 4h par personne      │
│                                    │
│ [🪵 Ajouter une bûche]             │
└────────────────────────────────────┘
```

**Caractéristiques :**

- ✅ Bouton interactif pour ajouter des bûches
- ✅ Statistiques en temps réel
- ✅ Barre de progression visuelle
- ✅ Couleur selon l'état du feu

---

## 🎯 Interaction Utilisateur

### Ajouter une bûche

**Bouton** : `🪵 Ajouter une bûche`

#### Succès

```
┌────────────────────────────────────┐
│ ✅ BÛCHE AJOUTÉE !                 │
├────────────────────────────────────┤
│ 🪵 Tu as ajouté une bûche au feu ! │
│ (65% → 75%)                        │
│                                    │
│ 🔥 Le feu est maintenant Fort !    │
│                                    │
│ Merci de contribuer au feu !       │
└────────────────────────────────────┘
Couleur: Vert
```

#### Cooldown actif

```
┌────────────────────────────────────┐
│ ⏰ COOLDOWN ACTIF                  │
├────────────────────────────────────┤
│ Tu as déjà ajouté une bûche        │
│ récemment !                        │
│                                    │
│ Temps restant : 2h 35min           │
│                                    │
│ Tu peux ajouter une bûche toutes   │
│ les 4 heures                       │
└────────────────────────────────────┘
Couleur: Rouge
```

#### Feu au maximum

```
┌────────────────────────────────────┐
│ 🔥 FEU AU MAXIMUM                  │
├────────────────────────────────────┤
│ Le feu est déjà à son intensité    │
│ maximale ! 🔥                      │
└────────────────────────────────────┘
Couleur: Orange
```

---

## 💻 Commande /fire-stats

Affiche des statistiques détaillées du feu.

```
/fire-stats
```

**Affichage :**

```
┌────────────────────────────────────┐
│ 🔥 Statistiques du Feu de Foyer    │
├────────────────────────────────────┤
│ État actuel : 🔥 Fort              │
│                                    │
│ ███████████████░░░░░ 75%           │
│                                    │
│ ### 🎁 Multiplicateur XP           │
│ ×1.15 - Tous les gains d'XP sont   │
│ multipliés par ce facteur !        │
│                                    │
│ ### 📊 Statistiques                │
│ • Bûches aujourd'hui : 18          │
│ • Total saison : 127               │
│ • Dernière bûche : il y a 25min    │
│   par JoueurA                      │
│ • S'éteindra dans : ~37h           │
│                                    │
│ ### ℹ️ Informations                │
│ • Ajouter une bûche : +10%         │
│ • Cooldown : 4 heures par personne │
│ • Décroissance : -1% toutes les    │
│   30 minutes                       │
│                                    │
│ ### 🔥 Paliers de multiplicateur   │
│ • 81-100% : ×1.33 (Intense)        │
│ • 61-80% : ×1.15 (Fort)            │
│ • 41-60% : ×1.00 (Moyen)           │
│ • 21-40% : ×0.66 (Faible)          │
│ • 0-20% : ×0.33 (Éteint)           │
└────────────────────────────────────┘
```

---

## 🔄 Intégration XP

Le multiplicateur du feu est **automatiquement appliqué** à tous les gains d'XP :

### Exemple de calcul

```typescript
// XP de base
const baseXP = 5; // Message envoyé

// Multiplicateur du feu
const fireMultiplier = 1.15; // Feu Fort (75%)

// XP final
const finalXP = Math.round(baseXP * fireMultiplier);
// = 5 * 1.15 = 5.75 → 6 XP
```

### Activités affectées

- ✅ Messages Discord
- ✅ Commandes utilisées
- ✅ Temps vocal
- ✅ Réactions
- ✅ Conversations IA
- ✅ Génération d'images
- ✅ Jeux (RPS, TTT, Slots...)
- ✅ Événements (Boss, Énigmes...)
- ✅ **TOUT** gain d'XP !

---

## 📊 Équilibrage

### Scénario Réaliste

**Serveur avec 10 membres actifs :**

- 3 joueurs ajoutent 1 bûche/jour = +30%/jour
- Décroissance naturelle = -48%/jour (2% par heure)
- **Résultat** : Descente lente vers ~40-50%

**Engagement nécessaire :**

- Minimum 5 joueurs actifs pour maintenir > 60%
- Optimal : 7-8 joueurs pour maintenir > 80%

### Ajustements possibles

**Si trop difficile :**

```typescript
// Dans fireData.ts
DECAY_RATE: 0.5, // -0.5% au lieu de -1%
    LOG_BONUS
:
15,   // +15% au lieu de +10%
    USER_COOLDOWN
:
3 * 60 * 60 * 1000, // 3h au lieu de 4h
```

**Si trop facile :**

```typescript
DECAY_RATE: 1.5, // -1.5% au lieu de -1%
    LOG_BONUS
:
8,    // +8% au lieu de +10%
    USER_COOLDOWN
:
6 * 60 * 60 * 1000, // 6h au lieu de 4h
```

---

## 🗂️ Architecture Technique

### Fichiers créés

```
src/services/seasonal/
├─ fireData.ts              // Types, constantes, configs
├─ fireDataManager.ts       // Gestion des données JSON
├─ fireManager.ts           // Logique principale
└─ fireButtonHandler.ts     // Gestionnaire du bouton

src/commands/fire-stats/
└─ fire-stats.ts            // Commande /fire-stats

data/
├─ seasonal_fire.json       // État du feu
└─ fire_cooldowns.json      // Cooldowns utilisateurs
```

### Structure des données

**seasonal_fire.json :**

```json
{
  "intensity": 75,
  "lastUpdate": 1234567890000,
  "messageId": "123456789",
  "channelId": "987654321",
  "voiceChannelId": "456789123",
  "stats": {
    "logsToday": 18,
    "lastLog": {
      "userId": "111222333",
      "username": "JoueurA",
      "timestamp": 1234567890000
    },
    "totalLogs": 127
  }
}
```

**fire_cooldowns.json :**

```json
{
  "userId1": 1234567890000,
  "userId2": 1234567880000,
  "userId3": 1234567870000
}
```

---

## ⚙️ Processus Automatiques

### 1. Décroissance (toutes les 30 min)

```
Intensité actuelle : 75%
Décroissance : -1%
Nouvelle intensité : 74%
```

### 2. Mise à jour interface (toutes les 5 min)

```
1. Met à jour le nom du salon vocal
2. Met à jour l'embed permanent
3. Nettoie les cooldowns expirés
```

### 3. Reset quotidien (minuit)

```
stats.logsToday = 0
// Le total et l'intensité sont préservés
```

---

## 🎨 États du Feu

| État    | Emoji | Intensité | Multiplicateur | Couleur                |
|---------|-------|-----------|----------------|------------------------|
| Intense | 🔥    | 81-100%   | ×1.33          | Rouge vif (#FF4500)    |
| Fort    | 🔥    | 61-80%    | ×1.15          | Rouge (#E74C3C)        |
| Moyen   | 🔥    | 41-60%    | ×1.00          | Orange (#F39C12)       |
| Faible  | 🪵    | 21-40%    | ×0.66          | Orange foncé (#E67E22) |
| Éteint  | 💨    | 0-20%     | ×0.33          | Gris (#95A5A6)         |

---

## 🔥 Flux Complet

### Démarrage du bot

```
1. Charge seasonal_fire.json (ou crée avec 60%)
2. Démarre la décroissance automatique
3. Démarre la mise à jour de l'interface
4. Programme le reset quotidien
5. Crée/met à jour le salon vocal
6. Crée/met à jour l'embed permanent
```

### Joueur ajoute une bûche

```
1. Clique sur le bouton
2. Vérification du cooldown
3. Si OK : +10% d'intensité
4. Enregistre le cooldown (4h)
5. Met à jour les stats
6. Sauvegarde les données
7. Met à jour l'interface
8. Affiche le résultat au joueur
```

### Décroissance automatique

```
[Toutes les 30 minutes]
1. Charge les données
2. Calcule le temps écoulé
3. Applique la décroissance (-1%)
4. Sauvegarde
5. Log si changement d'état
```

---

## 🎯 Avantages du Système

### Pour les joueurs

- 🎮 **Gameplay coopératif** - Objectif commun
- 🎁 **Récompense claire** - Bonus d'XP visible
- ⏰ **Engagement quotidien** - Revenir toutes les 4h
- 📊 **Feedback immédiat** - Voir l'impact direct

### Pour le serveur

- 👥 **Engagement communautaire** - Coordination nécessaire
- 🔄 **Rétention** - Raison de revenir régulièrement
- 📈 **Activité stimulée** - Plus de messages = plus d'XP
- 🎭 **Contenu saisonnier** - Fraîcheur et variété

### Pour l'administration

- 🔧 **Facilement configurable** - Constantes dans fireData.ts
- 📊 **Statistiques trackées** - Voir l'engagement
- 🎯 **Équilibrage flexible** - Ajuster selon les résultats
- 🌍 **Extensible** - Base pour autres saisons

---

## ✅ Checklist de Test

- [ ] Le salon vocal se crée automatiquement
- [ ] Le salon vocal affiche le bon multiplicateur
- [ ] L'embed permanent apparaît dans le salon général
- [ ] Le bouton "Ajouter une bûche" fonctionne
- [ ] Le cooldown de 4h est appliqué
- [ ] La décroissance fonctionne (-1% toutes les 30 min)
- [ ] L'interface se met à jour toutes les 5 minutes
- [ ] Le multiplicateur XP est appliqué aux gains
- [ ] La commande `/fire-stats` affiche les stats
- [ ] Le reset quotidien fonctionne à minuit
- [ ] Les changements d'état sont loggés
- [ ] Les cooldowns expirés sont nettoyés

---

## 🚀 Déploiement

### 1. Premier lancement

```bash
npm run build
node dist/bot.js
```

### 2. Vérifications

- ✅ Salon vocal créé en haut
- ✅ Embed permanent dans salon général
- ✅ Intensité initiale : 60%
- ✅ Multiplicateur : ×1.00

### 3. Test

```
1. Cliquer sur le bouton → Intensité monte à 70%
2. Attendre 5 min → Interface se met à jour
3. Réessayer → Message de cooldown
4. Gagner de l'XP → Multiplicateur appliqué
```

---

**Le système de Feu de Foyer est maintenant complètement implémenté et fonctionnel ! 🔥**

**Tous les gains d'XP dans le serveur sont maintenant multipliés par l'intensité du feu !**

