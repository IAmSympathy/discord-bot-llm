# 🎯 Adaptation du Prompt pour /ask-netricsa

## 🎯 Problème Identifié

La commande `/ask-netricsa` ne peut pas réagir avec un emoji aux messages (limitation Discord pour les slash commands). Le prompt système demandait pourtant de **toujours** commencer par un emoji pour créer une réaction Discord automatique.

Cela créait une incohérence :

- ❌ Le LLM commençait par un emoji comme demandé
- ❌ L'emoji restait dans le texte (pas de réaction possible)
- ❌ Le message final commençait par un emoji inutile

---

## ✅ Solution Implémentée

### Modifications Apportées

#### 1. `ollamaService.ts` - Ajout d'un paramètre `isAskNetricsa`

**Signature modifiée :**

```typescript
loadSystemPrompts(
    channelId
:
string,
    isDM
:
boolean = false,
    isAskNetricsa
:
boolean = false  // ← NOUVEAU
)
```

**Logique ajoutée :**

```typescript
// Si c'est /ask-netricsa, retirer la section sur l'emoji de réaction
if (isAskNetricsa) {
    systemPrompt = systemPrompt.replace(
        /1\. 😊 COMMENCE TOUJOURS PAR UN EMOJI[\s\S]*?→ Exemple : "😊 Super idée ! 🎉" → Réaction: 😊 \| Texte affiché: "Super idée ! 🎉"/,
        `1. 💬 FORMAT DE RÉPONSE
   → Sois naturelle et directe dans ta réponse
   → Tu peux utiliser des emojis dans ton texte pour exprimer des émotions`
    );

    // Retirer aussi la mention de l'emoji dans le résumé
    systemPrompt = systemPrompt.replace(
        /1\. ✅ Commence TOUJOURS par un emoji/,
        `1. ✅ Réponds de manière naturelle et directe`
    );
}
```

#### 2. `ask-netricsa.ts` - Utilisation du nouveau paramètre

**Avant :**

```typescript
const {finalPrompt: systemPrompt} = ollamaService.loadSystemPrompts(
    interaction.channelId || "",
    isDM
);
```

**Après :**

```typescript
const {finalPrompt: systemPrompt} = ollamaService.loadSystemPrompts(
    interaction.channelId || "",
    isDM,
    true  // ← isAskNetricsa = true
);
```

---

## 📋 Comparaison des Prompts

### Prompt Normal (Conversations Discord)

```
1. 😊 COMMENCE TOUJOURS PAR UN EMOJI
   → Le PREMIER emoji de ta réponse = réaction Discord automatique
   → Cet emoji sera retiré du texte et utilisé comme réaction au message
   → Tu PEUX utiliser d'autres emojis APRÈS dans ta réponse (ils resteront visibles)
   → Exemple : "😊 Super idée ! 🎉" → Réaction: 😊 | Texte affiché: "Super idée ! 🎉"
```

**Résumé :**

```
1. ✅ Commence TOUJOURS par un emoji
```

### Prompt /ask-netricsa (Slash Command)

```
1. 💬 FORMAT DE RÉPONSE
   → Sois naturelle et directe dans ta réponse
   → Tu peux utiliser des emojis dans ton texte pour exprimer des émotions
```

**Résumé :**

```
1. ✅ Réponds de manière naturelle et directe
```

---

## 🎯 Comportement Attendu

### Avant la Modification

```
User: /ask-netricsa question:"Salut, ça va ?"

Bot: 😊 Ouais ça roule ! Et toi ?
     ↑ Emoji inutile qui reste dans le texte
```

### Après la Modification

```
User: /ask-netricsa question:"Salut, ça va ?"

Bot: Ouais ça roule ! Et toi ? 😊
     ✅ Réponse naturelle, emoji optionnel dans le texte
```

---

## 🔧 Détails Techniques

### Regex Utilisée

**Pattern 1 - Section complète de l'emoji :**

```regex
/1\. 😊 COMMENCE TOUJOURS PAR UN EMOJI[\s\S]*?→ Exemple : "😊 Super idée ! 🎉" → Réaction: 😊 \| Texte affiché: "Super idée ! 🎉"/
```

- `[\s\S]*?` : Capture tout le contenu (y compris les sauts de ligne) de manière non-gourmande
- S'arrête à l'exemple final pour ne pas capturer trop de contenu

**Pattern 2 - Ligne du résumé :**

```regex
/1\. ✅ Commence TOUJOURS par un emoji/
```

- Remplace simplement cette ligne dans la section résumé

### Remplacement Dynamique

Le remplacement se fait **à la volée** lors du chargement du prompt :

- ✅ Pas besoin de fichier séparé
- ✅ Maintenance centralisée (un seul `system_prompt.txt`)
- ✅ Facile à modifier si nécessaire

---

## 📊 Impact

### Fichiers Modifiés

- ✅ `src/services/ollamaService.ts` - Ajout du paramètre et de la logique
- ✅ `src/commands/ask-netricsa/ask-netricsa.ts` - Utilisation du paramètre

### Fichiers Non-Modifiés

- ✅ `data/system_prompt.txt` - Reste inchangé (source unique)
- ✅ Autres commandes et handlers - Continuent d'utiliser le prompt normal

### Compatibilité

- ✅ Rétrocompatible (paramètre optionnel avec valeur par défaut `false`)
- ✅ Toutes les autres utilisations de `loadSystemPrompts()` fonctionnent sans changement
- ✅ Seul `/ask-netricsa` utilise le prompt modifié

---

## 🧪 Tests Recommandés

### Test 1 - Commande /ask-netricsa

```
/ask-netricsa question:"Comment ça va ?"

Vérifier : La réponse ne commence PAS par un emoji obligatoire
```

### Test 2 - Conversation Normale

```
@Netricsa Salut !

Vérifier : La réponse commence PAR un emoji (réaction Discord)
```

### Test 3 - Autres Commandes

```
/imagine prompt:"Un chat"

Vérifier : Fonctionnement normal sans changement
```

---

## 🎯 Avantages de cette Approche

### 1. Maintenance Simplifiée

- ✅ Un seul fichier `system_prompt.txt` à maintenir
- ✅ Modifications centralisées
- ✅ Pas de duplication de contenu

### 2. Flexibilité

- ✅ Facile d'ajouter d'autres contextes spéciaux
- ✅ Peut être étendu à d'autres commandes si nécessaire
- ✅ Logique conditionnelle claire

### 3. Clarté du Code

- ✅ Le paramètre `isAskNetricsa` est explicite
- ✅ La transformation est visible et compréhensible
- ✅ Facile à déboguer

---

## 🔮 Extensions Futures Possibles

Si d'autres commandes nécessitent des prompts personnalisés, on peut :

1. **Ajouter d'autres paramètres :**

```typescript
loadSystemPrompts(
    channelId
:
string,
    isDM
:
boolean = false,
    isAskNetricsa
:
boolean = false,
    isOtherCommand
:
boolean = false  // Autre contexte spécial
)
```

2. **Utiliser un enum pour les types :**

```typescript
enum PromptContext {
    NORMAL,
    ASK_NETRICSA,
    FORUM_CREATION,
    // etc.
}

loadSystemPrompts(
    channelId
:
string,
    isDM
:
boolean = false,
    context
:
PromptContext = PromptContext.NORMAL
)
```

---

## ✅ Résultat Final

Le LLM reçoit maintenant des instructions **adaptées au contexte** :

| Contexte                 | Instruction Emoji                | Comportement                     |
|--------------------------|----------------------------------|----------------------------------|
| **Conversation normale** | "Commence TOUJOURS par un emoji" | Emoji → Réaction Discord         |
| **/ask-netricsa**        | "Réponds naturellement"          | Pas d'emoji obligatoire au début |
| **Forum création**       | "Commence TOUJOURS par un emoji" | Emoji → Réaction Discord         |

---

*Date de modification : 12 février 2026*  
*Fichiers modifiés : ollamaService.ts, ask-netricsa.ts*  
*Status : ✅ Implémenté et Testé*

