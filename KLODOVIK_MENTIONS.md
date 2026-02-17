# Klodovik - Mentions d'Utilisateurs Activées

## ✅ Modification Effectuée

**Avant :** ❌ Klodovik supprimait toutes les mentions lors de l'apprentissage
**Après :** ✅ Klodovik garde les mentions et peut ping des utilisateurs

## 🔧 Ce Qui a Changé

### Dans `markovChain.ts` (ligne ~197)

**Avant :**

```typescript
// Enlever les mentions
.replace(/<@!?\d+>/g, "")
```

**Après :**

```typescript
// ✅ GARDER les mentions d'utilisateurs <@!?123456> pour que le bot puisse ping
// .replace(/<@!?\d+>/g, "") // ← COMMENTÉ : On garde les mentions !
```

## 🎯 Résultat

### Ce Qui Fonctionne Maintenant

✅ **Apprentissage des mentions**

```
Input: "salut <@123456789> comment ça va"
Klodovik apprend: "salut <@123456789> comment ça va"
```

✅ **Génération avec mentions**

```
/klodovik
> "mdr <@123456789> t'es ouf bg oklm"
```

✅ **Réponses spontanées avec mentions**

```
User: "on joue ce soir ?"
Klodovik: "oklm <@987654321> jsuis chaud ce soir"
```

### Ce Qui Est Toujours Filtré

❌ **Mentions de canaux** - `<#123456>` (filtrées)
❌ **Mentions de rôles** - `<@&123456>` (filtrées pour éviter @everyone)
❌ **URLs** - `https://...` (filtrées)
❌ **Emojis custom** - `<:emoji:123456>` (filtrés)

## 📊 Exemples de Génération

### Avec des Mentions Apprises

Si les utilisateurs de ton serveur disent souvent :

```
"mdr <@User1> t'es nul"
"oklm <@User2> bg"
"<@User3> viens on joue"
```

Klodovik pourra générer :

```
"mdr <@User1> oklm on fait ça"
"<@User2> t'es nul bg viens on joue"
```

### Messages Réels Attendus

```
User1: "qui veut jouer ?"
Klodovik: "mdr <@User2> <@User3> oklm jsuis chaud" 🎲
```

## ⚠️ Points Importants

### 1. Mentions Aléatoires

- Le bot va ping des utilisateurs **aléatoirement** basé sur ce qu'il a appris
- Les mentions seront celles **des messages collectés**
- Plus un utilisateur est mentionné dans les messages originaux, plus il sera mentionné par le bot

### 2. Pas de Contrôle Direct

- Le bot ne "choisit" pas qui mentionner
- C'est basé sur les probabilités de la chaîne de Markov
- Si les gens se mentionnent souvent, le bot le fera aussi

### 3. Nouvelle Collecte Nécessaire

Pour que le bot apprenne les mentions :

```
/klodovik-collect
```

- Le bot va réanalyser tous les messages
- Cette fois, les mentions seront **gardées** dans le modèle
- Les anciennes données sans mentions seront remplacées

## 🚀 Activation

### Étape 1 : Recompiler ✅ FAIT

```bash
npx tsc
# ✅ Compilation réussie !
```

### Étape 2 : Redémarrer le Bot

```bash
npm start
# ou
pm2 restart discord-bot-netricsa
```

### Étape 3 : Re-collecter les Messages

```
/klodovik-collect
```

**Important :** Le bot va réapprendre avec les mentions cette fois

### Étape 4 : Tester

```
/klodovik
```

Tu devrais voir des mentions dans les réponses !

## 📈 Impact sur la Génération

### Probabilité de Mentions

Si dans les messages originaux :

- 10% des messages contiennent des mentions
- Le bot générera des mentions dans ~10% de ses réponses

### Variété des Mentions

- Le bot peut mentionner n'importe quel utilisateur apparu dans les messages collectés
- Les utilisateurs les plus mentionnés apparaîtront plus souvent

## 🎮 Exemples Concrets

### Serveur Gaming

```
Messages originaux:
"<@User1> viens on lance une game"
"gg <@User2> t'es trop fort"

Génération Klodovik:
"mdr <@User1> gg on lance une game t'es trop fort" 🎲
```

### Serveur Amis

```
Messages originaux:
"ptdr <@User1> t'es ouf"
"oklm <@User2> jsuis chaud"

Génération Klodovik:
"<@User1> ptdr jsuis ouf oklm <@User2>" 🎲
```

## ⚙️ Configuration des Mentions

### Permissions Discord Requises

✅ **Aucune permission supplémentaire nécessaire**

- Les bots peuvent mentionner des utilisateurs individuels par défaut
- Pas besoin de la permission "Mention Everyone"

### Permissions Actuelles Suffisantes

```
Permissions: 67110912
- Read Message History ✅
- Send Messages ✅
→ Les mentions fonctionnent déjà avec ces permissions !
```

## 🔒 Sécurité

### Ce Qui Est Protégé

✅ **Pas de @everyone** - Les mentions de rôles sont toujours filtrées
✅ **Pas de @here** - Idem
✅ **Pas de spam** - Le bot respecte le rate limiting

### Risques Potentiels

⚠️ **Mentions aléatoires** - Le bot peut mentionner n'importe qui
💡 **Solution :** C'est normal et amusant pour un bot Markov !

⚠️ **Pings fréquents** - Si le bot répond souvent (probabilité élevée)
💡 **Solution :** Ajuste avec `/klodovik-config probabilite:2`

## 📊 Statistiques Attendues

Avec 10 000 messages collectés contenant ~10% de mentions :

- Le bot connaîtra ~1000 patterns avec mentions
- Il générera des mentions dans ~10% de ses réponses
- Environ 1-2 mentions par message quand il en génère

## ✅ Checklist de Déploiement

- [x] Modifier `markovChain.ts` pour garder les mentions
- [x] Compiler le projet (`npx tsc`)
- [ ] Redémarrer le bot
- [ ] Lancer `/klodovik-collect` pour réapprendre avec mentions
- [ ] Tester avec `/klodovik`
- [ ] Vérifier les mentions dans les réponses spontanées

## 🎉 Résultat Final

**Klodovik peut maintenant mentionner des utilisateurs dans ses messages !**

Les mentions seront :

- ✅ Naturelles (basées sur les messages originaux)
- ✅ Aléatoires (chaîne de Markov)
- ✅ Amusantes (style du serveur préservé)

**Exemple attendu :**

```
User: "on fait quoi ce soir"
Klodovik: "mdr <@User1> <@User2> oklm on fait ça bg" 🎲
```

**C'est maintenant activé !** 🚀

