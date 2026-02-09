# 🧩 Événement Énigme du Jour (Riddle)

## 📋 Description

L'événement **Énigme du Jour** est un événement interactif d'une journée entière où Netricsa pose une énigme générée par IA. Tous les joueurs peuvent participer et ceux qui trouvent la réponse gagnent de l'XP selon un système de leaderboard !

## ✨ Fonctionnalités

- 🤖 **Énigmes générées par IA** (LLM) - Chaque énigme est unique !
- 🔄 **Fallback automatique** sur 30+ énigmes pré-écrites si l'IA échoue
- ⏰ **Durée : 24 heures** - Toute une journée pour trouver la réponse
- 🏆 **Système de Leaderboard** - Tout le monde peut participer et gagner de l'XP
- 🎯 **3 niveaux de difficulté** : Facile, Moyen, Difficile
- 📚 **7 catégories** : Logique, Jeux de mots, Nature, Objets, Gaming, Culture, Mathématiques
- 💡 **Indice automatique** après 2 heures
- 🎁 **Récompenses XP** basées sur la position dans le leaderboard
- ✅ **Réponses alternatives** acceptées

## 🎮 Comment jouer

### Démarrage

Quand l'événement Énigme du Jour commence, un salon temporaire est créé avec l'énigme générée par l'IA.

### Participer

1. Lisez l'énigme dans le salon dédié
2. Tapez votre réponse à tout moment pendant les 24 heures
3. ✅ Bonne réponse = Vous êtes ajouté au leaderboard et gagnez de l'XP !
4. ❌ Mauvaise réponse = Le bot réagit avec ❌
5. 🔄 Vous pouvez continuer à essayer jusqu'à trouver la bonne réponse

### Indice

- Un indice apparaît automatiquement après **2 heures**
- L'indice donne un coup de pouce sans révéler la réponse

### Fin de l'événement

- ⏱️ Durée : **24 heures** (toute une journée)
- 🏆 Leaderboard final affiché à la fin
- 📊 La réponse est révélée avec le classement complet

## 💰 Récompenses XP (Système de Leaderboard)

| Position     | XP Gagné             | Emoji |
|--------------|----------------------|-------|
| 🥇 1er       | 100% de l'XP de base | 🥇    |
| 🥈 2ème      | 70% de l'XP de base  | 🥈    |
| 🥉 3ème      | 50% de l'XP de base  | 🥉    |
| 🎖️ Suivants | 30% de l'XP de base  | 🎖️   |

**XP de base selon la difficulté :**

- Facile : 100 XP (1er = 100 XP, 2ème = 70 XP, etc.)
- Moyen : 200 XP (1er = 200 XP, 2ème = 140 XP, etc.)
- Difficile : 300 XP (1er = 300 XP, 2ème = 210 XP, etc.)

💡 **Plus vous répondez vite, mieux vous êtes classé !**

## 📚 Catégories d'énigmes

1. **🧠 Logique** - Énigmes de réflexion
2. **🔤 Jeux de mots** - Énigmes sur les lettres et mots
3. **🌳 Nature** - Énigmes sur la nature
4. **📦 Objets** - Énigmes sur des objets du quotidien
5. **🎮 Gaming** - Énigmes sur les jeux vidéo
6. **🌍 Culture** - Culture générale
7. **🔢 Mathématiques** - Énigmes mathématiques

## 🧪 Tester l'événement

En tant que propriétaire du bot, utilisez :

```
/test-event type:🧩 Énigme
```

Le mode test :

- ✅ Crée l'événement normalement
- ✅ Fonctionne comme en production
- ❌ **Aucun XP n'est distribué**
- 📝 Marqué "MODE TEST" dans le footer

## 📝 Exemples d'énigmes

### Générées par l'IA 🤖

L'IA (Ollama) génère des énigmes originales à chaque événement. Exemples de ce que l'IA peut créer :

> **Question :** Je vole sans ailes, je pleure sans yeux. Partout où je vais, l'obscurité me suit. Qui suis-je ?  
> **Réponse :** Nuage  
> **Indice :** ☁️ Regarde vers le ciel lors d'un jour de pluie.

> **Question :** Plus on m'utilise, plus je deviens propre. Qui suis-je ?  
> **Réponse :** Savon  
> **Indice :** 🧼 Tu m'utilises pour te laver les mains.

### Base de données de fallback 📚

Si l'IA échoue, le système utilise des énigmes pré-écrites :

#### Facile 🟢

> **Question :** Plus je sèche, plus je deviens mouillé. Qui suis-je ?  
> **Réponse :** Serviette  
> **Indice :** 🛁 On l'utilise après la douche.

#### Moyen 🟡

> **Question :** Plus tu m'enlèves, plus je deviens grand. Qui suis-je ?  
> **Réponse :** Trou  
> **Indice :** 🕳️ Creuse, creuse, et tu verras grandir...

#### Difficile 🔴

> **Question :** Je suis au début de l'éternité, à la fin du temps et de l'espace. Je suis au début de chaque fin et à la fin de chaque place. Qui suis-je ?  
> **Réponse :** E (la lettre)  
> **Indice :** 🔤 Cherche la lettre commune dans ces mots.

## 🔧 Fonctionnalités techniques

### Réponses flexibles

Le système accepte plusieurs variantes de réponses :

```typescript
{
    answer: "serviette",
        alternativeAnswers
:
    ["une serviette", "la serviette", "torchon"]
}
```

### Normalisation

- Les réponses sont comparées en **minuscules**
- Les espaces en début/fin sont **supprimés**
- Les articles (le, la, un, une) sont **optionnels**

### Validation instantanée

- ✅ Bonne réponse → Embed de victoire + XP
- ❌ Mauvaise réponse → Réaction ❌
- 🤖 Le bot ne répond pas → Pas d'événement actif

## 📊 Statistiques

L'événement enregistre :

- 👥 **Participants** : Liste des userId qui ont tenté
- 🏆 **Gagnant** : L'userId du gagnant (si trouvé)
- ⏱️ **Temps** : Temps pris pour résoudre
- 💡 **Indice** : Si l'indice a été montré

## 🎨 Personnalisation

### Modifier les paramètres de génération LLM

Éditez `src/services/events/riddleLLMGenerator.ts` :

```typescript
// Température (créativité) : 0.7 = conservateur, 1.2 = très créatif
temperature: 0.9,

// Longueur de la réponse
    num_predict
:
300
```

### Ajouter des énigmes de fallback

Éditez `src/services/events/riddleData.ts` :

```typescript
{
    id: 'riddle_custom_1',
        question
:
    "Votre question ici ?",
        answer
:
    "reponse",
        alternativeAnswers
:
    ["autre réponse", "variante"],
        hint
:
    "💡 Votre indice ici",
        difficulty
:
    'moyen',
        category
:
    'Logique',
        xpReward
:
    200
}
```

### Modifier les durées

Dans `riddleEvent.ts` :

```typescript
const RIDDLE_DURATION = 24 * 60 * 60 * 1000; // 24 heures
const HINT_DELAY = 2 * 60 * 60 * 1000; // Indice après 2 heures
```

### Ajuster les récompenses du leaderboard

Dans `riddleEvent.ts`, fonction `handleRiddleMessage` :

```typescript
let xpMultiplier: number;
if (position === 1) xpMultiplier = 1.0; // 100%
else if (position === 2) xpMultiplier = 0.7; // 70%
else if (position === 3) xpMultiplier = 0.5; // 50%
else xpMultiplier = 0.3; // 30% pour les suivants
```

## 🌟 Énigmes spéciales

### Énigmes Sherbrooke 🇨🇦

Énigmes sur la ville de Sherbrooke et le Québec :

- "Quel est le surnom de Sherbrooke ?"
- "Combien de rivières traversent Sherbrooke ?"

### Énigmes Gaming 🎮

Pour les gamers :

- Questions sur Mario, Minecraft, etc.
- Récompenses bonus

## 🔮 Développement futur

Idées pour améliorer l'événement :

- ✅ ~~Mode "Énigme du jour" récurrente~~ **Implémenté!**
- ✅ ~~Leaderboard des meilleurs résolveurs~~ **Implémenté!**
- ✅ ~~Énigmes générées par IA~~ **Implémenté!**
- 🌈 Variante "Emoji Mystère" avec des émojis
- 🔊 Énigmes vocales
- 🖼️ Énigmes visuelles avec images
- 🎯 Énigmes en équipe
- 📊 Statistiques de performance par joueur
- 🎨 Thèmes d'énigmes (Halloween, Noël, etc.)

## 🐛 Dépannage

### L'événement ne démarre pas

- Vérifier qu'il n'y a pas déjà un événement actif
- Vérifier les permissions du bot (Manage Channels)
- Vérifier qu'Ollama est démarré et accessible

### Les réponses ne sont pas détectées

- Vérifier que le salon est bien celui de l'événement
- Les messages du bot sont ignorés automatiquement
- Les utilisateurs qui ont déjà trouvé ne reçoivent plus de réaction

### L'indice n'apparaît pas

- Il apparaît après 2 heures
- Vérifier les logs pour voir si l'indice a été envoyé

### L'IA ne génère pas d'énigmes

- Vérifier qu'Ollama est en cours d'exécution
- Le système passe automatiquement en mode fallback (énigmes pré-écrites)
- Vérifier les logs avec `[RiddleLLMGenerator]`

---

**Amusez-vous bien avec les énigmes ! 🧩**

