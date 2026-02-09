# ⚔️ Ajustement des durées des événements Boss

## 📊 Modifications effectuées

Les durées des événements de boss ont été ajustées pour passer de **minutes** à **heures**, permettant une participation plus large sur la journée.

---

## 🎯 Mini-Boss

### Avant (minutes)

| Boss                | Durée      | HP   | Difficulté      |
|---------------------|------------|------|-----------------| 
| Marsh Hoppers       | **5 min**  | 150  | Très facile     |
| Kenny               | **8 min**  | 600  | Facile          |
| Major Bio-mechanoid | **10 min** | 900  | Moyen           |
| Adult Arachnoid     | **12 min** | 1200 | Moyen-Difficile |
| Khnum               | **15 min** | 1500 | Difficile       |
| Witch-Bride         | **18 min** | 1800 | Très difficile  |
| Technopolyp         | **20 min** | 2100 | Extrême         |
| Beheaded Kamikaze   | **2 min**  | 1    | Urgence         |

### Maintenant (heures)

| Boss                | Durée     | HP   | Changement         |
|---------------------|-----------|------|--------------------| 
| Marsh Hoppers       | **1h**    | 150  | ×12                |
| Kenny               | **1h30**  | 600  | ×11.25             |
| Major Bio-mechanoid | **2h**    | 900  | ×12                |
| Adult Arachnoid     | **2h30**  | 1200 | ×12.5              |
| Khnum               | **3h**    | 1500 | ×12                |
| Witch-Bride         | **3h30**  | 1800 | ×11.67             |
| Technopolyp         | **4h**    | 2100 | ×12                |
| Beheaded Kamikaze   | **5 min** | 1    | Inchangé (urgence) |

---

## 👑 Boss

### Avant (minutes)

| Boss        | Durée      | HP   | XP Partagé |
|-------------|------------|------|------------| 
| Ugh-Zan VI  | **25 min** | 1800 | 560 XP     |
| Serious Sam | **40 min** | 3600 | 1050 XP    |
| Mental..?   | **60 min** | 6000 | 1750 XP    |

### Maintenant (heures)

| Boss        | Durée   | HP   | XP Partagé | Changement |
|-------------|---------|------|------------|------------| 
| Ugh-Zan VI  | **5h**  | 1800 | 560 XP     | ×12        |
| Serious Sam | **8h**  | 3600 | 1050 XP    | ×12        |
| Mental..?   | **12h** | 6000 | 1750 XP    | ×12        |

---

## 🎮 Impact sur le gameplay

### ✅ Avantages

1. **Participation accrue**
    - Les joueurs ont toute la journée pour participer
    - Pas besoin d'être présent immédiatement
    - Fuseau horaire moins important

2. **Événement communautaire**
    - Le boss devient un objectif de la journée
    - Plus de coordination possible
    - Plus de messages = plus d'engagement

3. **Moins de stress**
    - Pas de rush de 5-20 minutes
    - Temps pour organiser les attaques
    - Événements plus détendus

4. **Meilleure visibilité**
    - Les joueurs peuvent voir l'événement même s'ils se connectent tard
    - Donne le temps de se connecter après voir la notification

### 📊 Statistiques attendues

**Avant (durées courtes) :**

- Participants actifs : 3-6 joueurs
- Messages nécessaires : 50-700
- Fenêtre de participation : Très courte
- Taux d'échec : Élevé si peu de monde

**Maintenant (durées longues) :**

- Participants potentiels : 10-20 joueurs
- Messages nécessaires : Identique (50-2100)
- Fenêtre de participation : Toute la journée
- Taux d'échec : Plus faible

---

## ⏱️ Planning type

### Mini-Boss (1h - 4h)

**Exemple : Adult Arachnoid (2h30)**

```
10:00 → Boss apparaît
10:30 → Premiers joueurs attaquent
12:00 → Pic d'activité (midi)
12:30 → Boss vaincu !
```

### Boss (5h - 12h)

**Exemple : Mental (12h)**

```
08:00 → Boss apparaît
10:00 → Premiers joueurs attaquent
12:00 → Pic d'activité (midi)
14:00 → Mi-parcours (50% HP)
18:00 → Pic d'activité (soirée)
19:30 → Boss vaincu !
20:00 → Événement terminé, salon fermé
```

---

## 🔧 Cas particulier : Beheaded Kamikaze

**Durée : 5 minutes (INCHANGÉE)**

Ce mini-boss reste à 5 minutes car :

- ✅ C'est un événement d'urgence
- ✅ Il nécessite une réaction rapide
- ✅ Le stress fait partie du gameplay
- ✅ Quelqu'un doit se sacrifier rapidement

---

## 📈 Calculs de messages requis

### Avec 4 joueurs actifs (comme avant)

| Boss               | HP   | Messages/joueur | Temps estimé       |
|--------------------|------|-----------------|--------------------| 
| Marsh Hoppers (1h) | 150  | 38 messages     | Facile             |
| Mental (12h)       | 6000 | 500 messages    | Long mais faisable |

### Avec 10 joueurs actifs (attendu maintenant)

| Boss               | HP   | Messages/joueur | Temps estimé |
|--------------------|------|-----------------|--------------| 
| Marsh Hoppers (1h) | 150  | 15 messages     | Très facile  |
| Mental (12h)       | 6000 | 200 messages    | Raisonnable  |

---

## 🎯 Stratégie recommandée

### Pour les joueurs

1. **Vérifier les événements actifs** avec `/events` ou le salon
2. **Participer progressivement** tout au long de la journée
3. **Coordonner** avec d'autres membres
4. **Suivre la barre de vie** du boss en temps réel

### Pour l'administration

1. **Lancer les boss le matin** (8h-10h) pour maximiser la participation
2. **Varier les types** : Mini-boss en semaine, Boss le weekend
3. **Observer** les taux de réussite et ajuster si nécessaire

---

## 📝 Notes techniques

### Fichier modifié

- `src/services/events/bossData.ts`

### Changements

```typescript
// AVANT (mini-boss)
duration: 5 * 60 * 1000  // 5 minutes

// MAINTENANT (mini-boss)
duration: 1 * 60 * 60 * 1000  // 1 heure

// AVANT (boss)
duration: 25 * 60 * 1000  // 25 minutes

// MAINTENANT (boss)
duration: 5 * 60 * 60 * 1000  // 5 heures
```

### Multiplicateur appliqué

- **Mini-Boss** : ×11-12.5 (sauf Kamikaze)
- **Boss** : ×12

---

## ✅ Résumé

| Catégorie     | Avant     | Maintenant | Multiplicateur |
|---------------|-----------|------------|----------------|
| **Mini-Boss** | 5-20 min  | 1-4h       | ×12            |
| **Boss**      | 25-60 min | 5-12h      | ×12            |
| **Kamikaze**  | 2 min     | 5 min      | ×2.5           |

**Les événements de boss durent maintenant des heures, permettant une participation communautaire sur toute la journée ! ⚔️**

