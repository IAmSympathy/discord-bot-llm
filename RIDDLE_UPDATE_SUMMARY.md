# 🎉 Mise à jour de l'Événement Riddle - Résumé des changements

## 📊 Vue d'ensemble

L'événement Riddle a été complètement amélioré pour devenir un événement quotidien interactif avec génération d'énigmes par IA !

## ✨ Nouvelles fonctionnalités

### 1. 🤖 Génération d'énigmes par IA (LLM)

**Fichier créé :** `src/services/events/riddleLLMGenerator.ts`

- Utilise Ollama pour générer des énigmes uniques et originales
- Paramètres personnalisables (température, longueur)
- Fallback automatique sur la base de données si l'IA échoue
- Parse et valide les réponses JSON de l'IA
- Nettoie les réponses markdown si présentes

**Exemple de prompt système :**

```typescript
Tu
es
un
créateur
d
'énigmes expert. Tu dois créer une énigme originale et intéressante en français.

L
'énigme doit :
- Être
claire
et
bien
formulée
- Avoir
une
réponse
précise
et
unique
- Inclure
un
indice
qui
aide
sans
donner
directement
la
réponse
- Être
adaptée
au
niveau
de
difficulté
demandé
```

### 2. ⏰ Durée étendue à 24 heures

**Avant :** 10 minutes  
**Maintenant :** 24 heures (toute une journée)

- Permet à tout le monde de participer, même s'ils ne sont pas en ligne au moment du lancement
- L'indice apparaît après **2 heures** (au lieu de 3 minutes)
- Plus de temps pour réfléchir et trouver la réponse

### 3. 🏆 Système de Leaderboard

**Avant :** Le premier gagne tout l'XP, les autres rien  
**Maintenant :** Système de classement avec récompenses échelonnées

**Répartition de l'XP :**

- 🥇 **1er place** : 100% de l'XP (ex: 200 XP)
- 🥈 **2ème place** : 70% de l'XP (ex: 140 XP)
- 🥉 **3ème place** : 50% de l'XP (ex: 100 XP)
- 🎖️ **Places suivantes** : 30% de l'XP (ex: 60 XP)

**Avantages :**

- Tout le monde peut gagner de l'XP
- Encourage la participation même si on n'est pas le premier
- Crée une compétition saine

### 4. 📊 Leaderboard final affiché

À la fin de l'événement, un embed affiche :

- Le top 10 des participants
- Leur temps de réponse
- La réponse correcte
- Message de félicitations personnalisé

## 🔄 Modifications de code

### `riddleEvent.ts`

**Changements majeurs :**

1. **Import du générateur LLM**

```typescript
import {generateOrFallbackRiddle} from "./riddleLLMGenerator";
```

2. **Nouvelles constantes**

```typescript
const RIDDLE_DURATION = 24 * 60 * 60 * 1000; // 24 heures
const HINT_DELAY = 2 * 60 * 60 * 1000; // 2 heures
```

3. **Structure de données mise à jour**

```typescript
{
    // ...autres champs
    leaderboard: [] as Array<{ userId: string, username: string, time: number }>,
    // Remplace winnerId et solved
}
```

4. **Nouveau système de victoire**

- Vérifie si l'utilisateur a déjà trouvé (pas de double réponse)
- Ajoute au leaderboard avec le temps de réponse
- Calcule l'XP selon la position
- Affiche la position dans l'embed de victoire
- Ne termine plus l'événement après la première réponse

5. **Nouveaux embeds**

- `createRiddleAnnouncementEmbed` : Affiche les récompenses par position
- `createRiddleVictoryEmbed` : Affiche la position et l'XP gagné
- `createRiddleFailureEmbed` : Affiche le leaderboard complet à la fin

### `riddleLLMGenerator.ts` (nouveau)

**Fonctionnalités :**

1. **`generateRiddleWithLLM(difficulty)`**
    - Génère une énigme avec Ollama
    - Parse et valide la réponse JSON
    - Retourne `null` en cas d'erreur

2. **`generateOrFallbackRiddle(difficulty?)`**
    - Essaie d'abord avec le LLM
    - Si échec, utilise la base de données
    - Toujours retourne une énigme valide

**Gestion des erreurs :**

- Parse les réponses JSON malformées
- Nettoie les balises markdown
- Logs détaillés pour le debug
- Fallback automatique et transparent

## 📝 Fichiers modifiés

### Nouveaux fichiers

- ✅ `src/services/events/riddleLLMGenerator.ts` - Générateur LLM
- ✅ `RIDDLE_EVENT_README.md` - Documentation complète

### Fichiers modifiés

- ✅ `src/services/events/riddleEvent.ts` - Logique de l'événement
- ✅ `src/services/events/riddleData.ts` - Base de données de fallback
- ✅ `src/services/events/eventTypes.ts` - Type RIDDLE ajouté
- ✅ `src/services/randomEventsService.ts` - Export du riddle
- ✅ `src/commands/test-event/test-event.ts` - Commande de test
- ✅ `src/watchChannel.ts` - Gestionnaire de messages

## 🧪 Comment tester

### Lancer un événement de test

```
/test-event type:🧩 Énigme
```

**Ce qui se passe :**

1. Le bot génère une énigme avec l'IA (ou fallback)
2. Un salon temporaire est créé
3. L'énigme est affichée avec les récompenses
4. Tapez des réponses pour tester le système
5. L'indice apparaît après 2 heures (en production)
6. Le leaderboard final s'affiche à la fin

**Mode test :**

- ✅ Tout fonctionne normalement
- ❌ Aucun XP n'est distribué
- 📝 Marqué "MODE TEST" dans les embeds

## 📊 Logs à surveiller

**Génération LLM :**

```
[RiddleLLMGenerator] Generating riddle with LLM (difficulty: moyen)...
[RiddleLLMGenerator] LLM response received: {...
[RiddleLLMGenerator] ✅ Successfully generated riddle: "..." (Answer: ...)
```

**En cas d'échec :**

```
[RiddleLLMGenerator] LLM generation failed, falling back to database riddle
```

**Événement :**

```
[RiddleEvent] Riddle event started! Question: "...", Answer: "...", Duration: 24 hours
[RiddleEvent] Hint shown for riddle event ...
[RiddleEvent] Riddle solved by ... in ...ms - Position: 1, XP: 200
[RiddleEvent] Riddle event ... ended. Participants: 5, Attempts: 12
```

## 🎯 Exemple de scénario complet

### Lancement (00:00)

```
🧩 ÉNIGME DU JOUR

Une énigme quotidienne est apparue !

Je vole sans ailes, je pleure sans yeux. 
Partout où je vais, l'obscurité me suit. Qui suis-je ?

⏱️ Tout le monde peut participer

💡 Comment jouer
Envoie ta réponse dans ce salon ! Plus tu réponds vite, plus tu gagnes d'XP.

📊 Difficulté: 🟡 Moyen

🏆 Récompenses
🥇 1er: 200 XP
🥈 2ème: 140 XP
🥉 3ème: 100 XP
🎖️ Suivants: 60 XP

⏰ Fin: Dans 24 heures
```

### Première réponse (00:15)

```
🥇 BONNE RÉPONSE !

@JoueurA a trouvé la réponse en 15m 23s !

Position : 1er
🎁 +200 XP
```

### Deuxième réponse (01:30)

```
🥈 BONNE RÉPONSE !

@JoueurB a trouvé la réponse en 1h 30m 12s !

Position : 2ème
🎁 +140 XP
```

### Indice (02:00)

```
💡 INDICE

☁️ Regarde vers le ciel lors d'un jour de pluie.
```

### Fin de l'événement (24:00)

```
⏰ ÉVÉNEMENT TERMINÉ !

L'énigme du jour est maintenant terminée !

La réponse était : nuage

Félicitations aux 8 participant(s) ! 🎉

🏆 Leaderboard
🥇 @JoueurA - 15m 23s
🥈 @JoueurB - 1h 30m 12s
🥉 @JoueurC - 2h 15m 45s
4. @JoueurD - 3h 22m 10s
5. @JoueurE - 5h 45m 30s
...
```

## ✅ Avantages de cette mise à jour

1. **Énigmes uniques** - Chaque jour une énigme différente générée par IA
2. **Plus inclusif** - Tout le monde peut participer et gagner
3. **Plus de temps** - 24h pour réfléchir tranquillement
4. **Compétitif** - Leaderboard encourage la rapidité
5. **Flexible** - Fallback automatique si l'IA échoue
6. **Transparent** - Logs détaillés pour le debug

## 🚀 Prochaines améliorations possibles

- 📅 Planifier l'événement automatiquement chaque jour
- 📊 Statistiques globales des joueurs (meilleur résolveur, moyenne, etc.)
- 🎨 Énigmes thématiques (Halloween, Noël, événements spéciaux)
- 🖼️ Énigmes visuelles avec génération d'images
- 🎵 Énigmes musicales ou audio
- 🌍 Énigmes multilingues

---

**L'événement Riddle est maintenant prêt pour des énigmes quotidiennes passionnantes ! 🧩🎉**

