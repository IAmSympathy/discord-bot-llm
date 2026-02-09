# 🔢 Événement Suite Logique - Documentation

## 📋 Vue d'ensemble

L'événement **Suite Logique** est un nouveau type d'événement basé sur le système d'énigmes. Les joueurs doivent trouver le prochain élément d'une suite logique pour gagner de l'XP.

---

## 🎮 Fonctionnement

### Timing

- **Durée** : 12 heures (8h → 20h)
- **Indice** : Affiché automatiquement après 4 heures (à midi)
- **Fermeture** : Le salon se ferme 1 heure après la fin

### Commande

- **Même commande que les énigmes** : `/answer`
- Le système détecte automatiquement s'il s'agit d'une énigme ou d'une suite logique

### Récompenses (système de leaderboard)

- 🥇 **1er** : 100% de l'XP
- 🥈 **2ème** : 70% de l'XP
- 🥉 **3ème** : 50% de l'XP
- 🎖️ **Suivants** : 30% de l'XP

---

## 📊 Types de suites logiques

### Facile (100 XP)

**Exemples :**

- `2, 4, 6, 8, ?` → **10** (nombres pairs)
- `A, B, C, D, ?` → **E** (alphabet)
- `5, 10, 15, 20, ?` → **25** (table de 5)
- `Lundi, Mardi, Mercredi, ?` → **Jeudi** (jours)

### Moyen (200 XP)

**Exemples :**

- `1, 4, 9, 16, ?` → **25** (carrés parfaits)
- `1, 1, 2, 3, 5, 8, ?` → **13** (Fibonacci)
- `2, 6, 12, 20, ?` → **30** (différences croissantes)
- `Z, Y, X, W, ?` → **V** (alphabet inversé)

### Difficile (300 XP)

**Exemples :**

- `2, 3, 5, 7, 11, ?` → **13** (nombres premiers)
- `1, 8, 27, 64, ?` → **125** (cubes parfaits)
- `1, 2, 4, 8, 16, ?` → **32** (puissances de 2)
- `A, C, F, J, ?` → **O** (sauts croissants)

---

## 🤖 Génération LLM

### Système intelligent

- **Génération automatique** par le LLM (Ollama)
- **Fallback** sur la base de données si le LLM échoue
- **Mode low power** : Utilise directement la base de données

### Prompt optimisé

Le prompt du LLM est conçu pour générer des suites :

- ✅ Logiques et cohérentes
- ✅ Avec UNE SEULE réponse claire
- ✅ Basées sur des patterns mathématiques reconnaissables
- ❌ Évite les suites ambiguës ou culturelles

### Validation

Chaque suite générée doit avoir :

- Au moins 4 éléments avant le "?"
- Une réponse claire (nombre, lettre ou mot court)
- Un indice avec emoji
- 2-3 réponses alternatives possibles

---

## 📝 Base de données

### Statistiques

- **24 suites** pré-définies
- **6 faciles** (nombres pairs, alphabet, tables...)
- **6 moyennes** (Fibonacci, carrés, alphabet inversé...)
- **6 difficiles** (nombres premiers, cubes, patterns complexes...)

### Catégories

- 🔢 **Nombres** : Arithmétique, géométrique, carrés, cubes
- 🔤 **Lettres** : Alphabet, alphabet inversé, sauts
- 🧠 **Logique** : Fibonacci, patterns visuels
- 📅 **Temps** : Jours de la semaine

---

## 🎨 Embeds

### Annonce de la suite

```
┌─────────────────────────────────────┐
│ 🔢 SUITE LOGIQUE DU JOUR            │
├─────────────────────────────────────┤
│ Une suite logique est apparue !      │
│                                      │
│ 2, 4, 6, 8, ?                        │
│                                      │
│ 💡 Comment jouer                     │
│ Utilise `/answer` pour soumettre ta │
│ réponse !                            │
│                                      │
│ 📊 Difficulté: 🟢 Facile             │
│ 🏆 Récompenses:                      │
│ 🥇 1er: 100 XP                       │
│ 🥈 2ème: 70 XP                       │
│ 🥉 3ème: 50 XP                       │
│                                      │
│ ⏰ Fin: Dans 12 heures               │
└─────────────────────────────────────┘
Couleur: Bleu (#3498DB)
```

### Indice (après 4h)

```
┌─────────────────────────────────────┐
│ 💡 INDICE                           │
├─────────────────────────────────────┤
│ 🔢 Les nombres pairs.               │
└─────────────────────────────────────┘
Couleur: Orange (#F39C12)
```

### Succès (annonce publique)

```
┌─────────────────────────────────────┐
│ 🥇 @JoueurA a trouvé la réponse !   │
│ (1er en 25m 12s)                    │
└─────────────────────────────────────┘
Couleur: Or / Argent / Bronze / Vert
```

### Résultats finaux

```
┌─────────────────────────────────────┐
│ ⏰ ÉVÉNEMENT TERMINÉ !              │
├─────────────────────────────────────┤
│ La suite logique du jour est         │
│ maintenant terminée !                │
│                                      │
│ La réponse était : 10                │
│                                      │
│ Félicitations aux 8 participant(s) ! │
│                                      │
│ 🏆 Leaderboard                       │
│ 🥇 @JoueurA - 25m 12s                │
│ 🥈 @JoueurB - 1h 15m                 │
│ 🥉 @JoueurC - 2h 30m                 │
│ 4. @JoueurD - 3h 45m                 │
│ [...]                                │
└─────────────────────────────────────┘
Couleur: Rouge (#E74C3C)
```

---

## 🔧 Fichiers créés

| Fichier                                       | Description                             |
|-----------------------------------------------|-----------------------------------------|
| `src/services/events/sequenceData.ts`         | Base de données des suites + validation |
| `src/services/events/sequenceLLMGenerator.ts` | Générateur LLM avec fallback            |
| `src/services/events/sequenceEvent.ts`        | Gestionnaire d'événement principal      |

## 📝 Fichiers modifiés

| Fichier                                 | Modifications                                        |
|-----------------------------------------|------------------------------------------------------|
| `src/services/events/eventTypes.ts`     | Ajout du type `SEQUENCE`                             |
| `src/commands/repondre/repondre.ts`     | Support des suites logiques dans `/answer`           |
| `src/commands/test-event/test-event.ts` | Ajout de l'option "Suite Logique"                    |
| `src/services/randomEventsService.ts`   | Export de `startSequence` et `handleSequenceMessage` |
| `src/watchChannel.ts`                   | Gestion des messages dans le salon de suite logique  |

---

## 🚀 Utilisation

### Test manuel

```
/test-event type:🔢 Suite Logique
```

### Lancement programmé

```typescript
import {startSequence} from "./services/randomEventsService";

// Lancer une suite logique
await startSequence(client, guild, false);
```

### Vérification de la réponse

La fonction `checkSequenceAnswer()` normalise automatiquement :

- ✅ Espaces enlevés : "10" = "1 0"
- ✅ Tirets enlevés : "vingt-cinq" = "vingtcinq"
- ✅ Casse ignorée : "E" = "e"
- ✅ Réponses alternatives : "10" = "dix"

---

## 📊 Exemples de flux

### Scénario complet

**08:00 - Lancement**

```
🔢 SUITE LOGIQUE DU JOUR

2, 4, 6, 8, ?

💡 Comment jouer
Utilise `/answer` pour soumettre ta réponse !
```

**08:15 - JoueurA répond**

```
/answer answer:10
```

**Réponse (éphémère) :**

```
🥇 BONNE RÉPONSE !
Tu as trouvé la réponse en 15m !
Position : 🥇 1er
XP gagné : +100 XP
```

**Annonce publique :**

```
🥇 @JoueurA a trouvé la réponse ! (1er en 15m)
```

**12:00 - Indice automatique**

```
💡 INDICE
🔢 Les nombres pairs.
```

**20:00 - Fin de l'événement**

```
⏰ ÉVÉNEMENT TERMINÉ !
La réponse était : 10

🏆 Leaderboard
🥇 @JoueurA - 15m
🥈 @JoueurB - 2h 30m
🥉 @JoueurC - 5h 15m
```

**21:00 - Salon fermé**

---

## 🎯 Différences avec l'événement Riddle

| Aspect              | Riddle (Énigme)     | Sequence (Suite Logique)    |
|---------------------|---------------------|-----------------------------|
| **Type**            | Question devinette  | Suite à compléter           |
| **Réponse**         | Mot ou concept      | Nombre, lettre ou mot court |
| **Couleur**         | Vert (#73A955)      | Bleu (#3498DB)              |
| **Emoji**           | 🧩                  | 🔢                          |
| **Base de données** | 30 énigmes          | 24 suites                   |
| **Validation**      | Enlève déterminants | Enlève espaces/tirets       |

**Similitudes :**

- ✅ Même commande `/answer`
- ✅ Même système de leaderboard
- ✅ Même timing (12h, indice à 4h)
- ✅ Même système LLM avec fallback
- ✅ Messages supprimés dans le salon

---

## ✅ Avantages du système

### Pour les joueurs

- 🎯 **Défi différent** : Logique mathématique vs devinette
- 🧠 **Stimulant** : Exercice de réflexion logique
- 🏆 **Compétitif** : Leaderboard en temps réel
- 📱 **Pratique** : Même commande `/answer`

### Pour le bot

- 🔄 **Variété** : Alternative aux énigmes
- 🤖 **Intelligent** : Génération LLM adaptée
- 📊 **Structuré** : Base de données organisée
- 🛡️ **Fiable** : Fallback garanti

### Pour le code

- ♻️ **Réutilisable** : Basé sur riddleEvent
- 🧹 **Propre** : Code modulaire et organisé
- 🔧 **Maintenable** : Facile à étendre
- ✅ **Testé** : Compilation sans erreurs

---

## 🔮 Améliorations futures possibles

1. **Suites visuelles** : Patterns de formes/couleurs
2. **Difficulté adaptative** : Basée sur le taux de réussite
3. **Indices progressifs** : Plusieurs indices de plus en plus précis
4. **Catégories spécifiques** : Suite mathématique du jour, suite de lettres du jour
5. **Mode compétition** : Deux équipes qui s'affrontent
6. **Suites personnalisées** : Les joueurs peuvent proposer leurs suites

---

**L'événement Suite Logique est maintenant complet et fonctionnel ! 🎉**

