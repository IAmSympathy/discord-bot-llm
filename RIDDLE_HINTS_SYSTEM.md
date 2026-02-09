# 💡 Gestion des Indices dans le Système d'Énigmes

## 📋 Vue d'ensemble

Les indices sont affichés **automatiquement** après un certain délai pendant l'événement Riddle pour aider les joueurs à trouver la réponse.

---

## ⏱️ Timing des Indices

### Configuration actuelle

Dans `riddleEvent.ts` :

```typescript
const RIDDLE_DURATION = 24 * 60 * 60 * 1000; // 24 heures (événement complet)
const HINT_DELAY = 2 * 60 * 60 * 1000; // Indice après 2 heures
```

**Note :** Les valeurs ont été modifiées récemment :

- Avant : Événement de 24h, indice après 2h
- Maintenant : Événement de **12h** (8h → 20h), indice après **4h** (à midi)

### Planning type

| Heure     | Événement                         |
|-----------|-----------------------------------|
| **08:00** | 🚀 Énigme lancée                  |
| **12:00** | 💡 Indice affiché automatiquement |
| **20:00** | ⏰ Événement terminé               |
| **21:00** | 🔒 Salon fermé                    |

---

## 🔧 Mécanisme Technique

### 1. Structure de données

Quand l'événement démarre, l'indice est stocké dans les données de l'événement :

```typescript
{
    riddleId: riddle.id,
        question
:
    riddle.question,
        answer
:
    riddle.answer,
        hint
:
    riddle.hint,  // ← L'indice est stocké ici
        // ...autres données
        hintShown
:
    false    // ← Flag pour savoir si l'indice a été affiché
}
```

### 2. Programmation automatique

Dans `startRiddleEvent()`, un `setTimeout` est programmé :

```typescript
// Programmer l'indice après 4 heures
setTimeout(async () => {
    try {
        const currentEventsData = loadEventsData();
        const currentEvent = currentEventsData.activeEvents.find(e => e.id === eventId);

        // Vérifier que l'événement existe toujours et que l'indice n'a pas été montré
        if (currentEvent && !currentEvent.data.hintShown) {
            const hintEmbed = createHintEmbed(riddle.hint);
            await channel.send({embeds: [hintEmbed]});

            // Marquer l'indice comme affiché
            currentEvent.data.hintShown = true;
            saveEventsData(currentEventsData);

            logger.info(`Hint shown for riddle event ${eventId}`);
        }
    } catch (error) {
        logger.error("Error showing hint:", error);
    }
}, HINT_DELAY);
```

### 3. Affichage de l'indice

L'indice est affiché avec un embed orange :

```typescript
function createHintEmbed(hint: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xF39C12) // Orange
        .setTitle("💡 INDICE")
        .setDescription(hint)
        .setTimestamp();
}
```

**Exemple d'affichage :**

```
┌─────────────────────────────────────┐
│ 💡 INDICE                           │
├─────────────────────────────────────┤
│ 🛁 On l'utilise après la douche.    │
└─────────────────────────────────────┘
Couleur: Orange (#F39C12)
```

---

## 📝 Source des Indices

Les indices peuvent provenir de deux sources :

### 1. Base de données d'énigmes (Fallback)

Dans `riddleData.ts`, chaque énigme a un indice pré-défini :

```typescript
{
    id: 'riddle_easy_2',
        question
:
    "Plus je sèche, plus je deviens mouillé. Qui suis-je ?",
        answer
:
    "serviette",
        alternativeAnswers
:
    ["une serviette", "la serviette", "torchon"],
        hint
:
    "🛁 On l'utilise après la douche.",  // ← Indice pré-défini
        difficulty
:
    'facile',
        category
:
    'Logique',
        xpReward
:
    100
}
```

### 2. Génération LLM (Automatique)

Le LLM génère automatiquement un indice lors de la création de l'énigme.

**Prompt du LLM :**

```
Réponds UNIQUEMENT avec un objet JSON dans ce format exact :
{
  "question": "La question de l'énigme",
  "answer": "la réponse (en minuscules)",
  "alternativeAnswers": ["réponse alternative 1", "réponse alternative 2"],
  "hint": "Un indice avec un emoji au début",  ← L'indice est généré ici
  "category": "La catégorie"
}
```

**Règles pour les indices générés par LLM :**

- ✅ Doit commencer par un emoji approprié
- ✅ Doit aider sans révéler directement la réponse
- ✅ Doit être cohérent avec la question

**Exemple généré par LLM :**

```json
{
  "question": "Je cours sans jambes, j'ai un lit mais ne dors pas. Qui suis-je ?",
  "answer": "rivière",
  "alternativeAnswers": [
    "fleuve",
    "cours d'eau"
  ],
  "hint": "🌊 Je coule et j'ai des rives.",
  "category": "Nature"
}
```

---

## 🎯 Logique de Sécurité

### Vérifications avant affichage

Le système vérifie plusieurs conditions avant d'afficher l'indice :

1. **L'événement existe toujours**
   ```typescript
   if (currentEvent && !currentEvent.data.hintShown)
   ```

2. **L'indice n'a pas déjà été affiché**
   ```typescript
   !currentEvent.data.hintShown
   ```

3. **Marquage après affichage**
   ```typescript
   currentEvent.data.hintShown = true;
   saveEventsData(currentEventsData);
   ```

### Cas particuliers

**Si l'événement se termine avant le délai :**

- ✅ Le `setTimeout` s'exécute quand même
- ✅ Mais la vérification `if (currentEvent)` empêche l'affichage
- ✅ Aucune erreur, juste un log

**Si le bot redémarre pendant l'événement :**

- ❌ Le `setTimeout` est perdu (il existe seulement en mémoire)
- ❌ L'indice ne sera pas affiché automatiquement
- ⚠️ Point d'amélioration potentiel : sauvegarder le timestamp du hint

---

## 📊 Flux Complet

### Scénario normal

```
08:00 ─┬─ startRiddleEvent()
       │
       ├─► Créer l'événement
       │   └─ hint: "🛁 On l'utilise après la douche."
       │   └─ hintShown: false
       │
       ├─► Afficher l'énigme
       │   "Plus je sèche, plus je deviens mouillé..."
       │
       └─► setTimeout(afficherIndice, 4h)
           │
           │  [Les joueurs essaient de deviner]
           │
           ▼
12:00 ─────► Afficher l'indice
            ├─ Créer embed orange
            ├─ Envoyer dans le salon
            ├─ Marquer hintShown = true
            └─ Logger "Hint shown for riddle event XXX"

           [Les joueurs continuent avec l'indice]

20:00 ─────► Événement terminé
            └─ Afficher le leaderboard
```

---

## 🎨 Personnalisation des Indices

### Modifier le délai

**Option 1 : Modifier la constante**

```typescript
// Dans riddleEvent.ts
const HINT_DELAY = 4 * 60 * 60 * 1000; // 4 heures

// Exemples d'autres valeurs :
const HINT_DELAY = 30 * 60 * 1000;      // 30 minutes
const HINT_DELAY = 1 * 60 * 60 * 1000;  // 1 heure
const HINT_DELAY = 6 * 60 * 60 * 1000;  // 6 heures
```

**Option 2 : Délai dynamique basé sur la difficulté**

```typescript
const getHintDelay = (difficulty: string): number => {
    switch (difficulty) {
        case 'facile':
            return 2 * 60 * 60 * 1000;    // 2h
        case 'moyen':
            return 4 * 60 * 60 * 1000;     // 4h
        case 'difficile':
            return 6 * 60 * 60 * 1000; // 6h
        default:
            return 4 * 60 * 60 * 1000;
    }
};
```

### Ajouter des indices multiples

**Concept d'indices progressifs :**

```typescript
// Dans l'événement
{
    hints: [
        "🛁 Premier indice léger",
        "💧 Deuxième indice plus précis",
        "🧴 Dernier indice très clair"
    ],
        hintsShown
:
    0  // Nombre d'indices déjà affichés
}

// Programmer plusieurs timeouts
setTimeout(() => showHint(0), 2 * 60 * 60 * 1000);  // 2h
setTimeout(() => showHint(1), 6 * 60 * 60 * 1000);  // 6h
setTimeout(() => showHint(2), 10 * 60 * 60 * 1000); // 10h
```

---

## 🐛 Debugging

### Logs à surveiller

**Succès :**

```
[RiddleEvent] Riddle event started! Question: "...", Answer: "...", Duration: 12 hours
[RiddleEvent] Hint shown for riddle event evt_riddle_1234567890
```

**Erreurs possibles :**

```
[RiddleEvent] Error showing hint: [error details]
```

### Vérifications manuelles

**1. Vérifier que l'indice est bien stocké :**

```typescript
// Dans data/random_events.json
{
    "activeEvents"
:
    [{
        "type": "RIDDLE",
        "data": {
            "hint": "🛁 On l'utilise après la douche.",  // ✅ Présent
            "hintShown": false                            // ✅ Pas encore affiché
        }
    }]
}
```

**2. Tester avec un délai court :**

```typescript
// Pour tester, temporairement :
const HINT_DELAY = 10 * 1000; // 10 secondes au lieu de 4 heures
```

---

## ✅ Résumé

| Aspect            | Détails                                   |
|-------------------|-------------------------------------------|
| **Déclenchement** | Automatique via `setTimeout()`            |
| **Délai actuel**  | 4 heures après le lancement               |
| **Source**        | Base de données OU généré par LLM         |
| **Format**        | Emoji + texte court                       |
| **Affichage**     | Embed orange dans le salon                |
| **Sécurité**      | Flag `hintShown` pour éviter les doublons |
| **Persistance**   | Sauvegardé dans `random_events.json`      |

---

## 🚀 Améliorations Possibles

1. **Persistence du timer** : Sauvegarder le timestamp du hint pour le relancer après redémarrage
2. **Indices progressifs** : Plusieurs indices de plus en plus précis
3. **Commande manuelle** : `/hint` pour demander l'indice plus tôt (avec pénalité XP)
4. **Indices basés sur tentatives** : Afficher après X mauvaises réponses au lieu d'un temps fixe
5. **Indices adaptatifs** : Plus précis si peu de gens trouvent

---

**La gestion des indices est automatique, fiable et bien intégrée au système ! 💡**

