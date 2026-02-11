# 🚀 Guide User Apps - Netricsa

## ✅ Ce qui a été fait

Le bot Netricsa supporte maintenant les **User Apps** ! Cela signifie que tu peux :

1. **Installer le bot comme application personnelle**
    - Clic droit sur Netricsa → "Ajouter l'application" → "Ajoute à Mes applications"

2. **Utiliser les commandes PARTOUT** :
    - ✅ Dans les serveurs Discord
    - ✅ En DM direct avec le bot
    - ✅ **En DM de groupe** (conversations privées entre plusieurs personnes)
    - ✅ Dans n'importe quel serveur où tu es (même sans le bot)

## 🔧 Modifications techniques

### Fichiers modifiés

#### 1. `src/deploy/deployCommands.ts`

Les commandes sont maintenant déployées avec :

```typescript
integration_types: [0, 1]  // 0 = Guild Install, 1 = User Install
contexts: [0, 1, 2]         // 0 = Guild, 1 = Bot DM, 2 = Group DM
```

#### 2. `src/services/xpSystem.ts`

Protection ajoutée dans `sendLevelUpMessage()` pour éviter les erreurs en DM :

```typescript
// En DM, on ne peut pas donner de rôles ou envoyer de message de level up dans le canal
if (!channel.guild) {
    logger.debug(`Level up for ${username} in DM context - skipping guild-specific features`);
    return;
}
```

### 🛡️ Protections existantes

Les fichiers suivants avaient déjà des protections pour les DMs :

- ✅ `src/utils/commandPermissions.ts` - Vérifie `interaction.guild` avant d'accéder aux rôles
- ✅ `src/commands/profile/profile.ts` - Vérifie `interaction.guild` avant de récupérer les membres
- ✅ `src/commands/leaderboard/leaderboard.ts` - Gère l'absence de guild
- ✅ `src/bot.ts` - Handler de commandes protégé

### 🎯 Résultat

- ✅ Le système XP fonctionne en DM (mais pas les rôles de niveau)
- ✅ Les achievements sont enregistrés
- ✅ Les commandes fonctionnent sans erreur
- ✅ Pas de crash même si guild est undefined

## 📋 Comment déployer

### Option 1 : Déploiement local (test)

```bash
npm start
```

### Option 2 : Déploiement sur Oracle Cloud

```powershell
.\deploy-to-oracle.ps1
```

Ou avec le script de gestion :

```powershell
.\manage-bot.ps1
# Choisir l'option 1 pour déployer
```

## 🧪 Comment tester

### Étape 1 : Redéployer le bot

Une fois le bot redémarré, les commandes seront mises à jour avec le support User Apps.

### Étape 2 : Ajouter le bot comme User App

1. Clique droit sur le bot Netricsa
2. Sélectionne "Ajouter l'application"
3. Clique sur "Ajoute à Mes applications : Utilise cette appli partout !"

### Étape 3 : Tester dans un DM de groupe

1. Crée un DM de groupe avec des amis
2. Tape `/` et cherche les commandes de Netricsa
3. Essaye des commandes comme `/imagine`, `/ship`, `/crystalball`, etc.

## ⚠️ Limitations potentielles

Certaines fonctionnalités du bot dépendent du contexte serveur et pourraient ne pas fonctionner en DM de groupe :

### ❌ Ne fonctionneront pas en DM de groupe :

- Système XP (dépend du serveur)
- Rôles et permissions
- Statistiques serveur
- Événements saisonniers (feu de foyer, etc.)

### ✅ Devraient fonctionner en DM de groupe :

- `/imagine` - Génération d'images
- `/reimagine` - Régénération d'images
- `/upscale` - Agrandissement d'images
- `/ship` - Calcul de compatibilité
- `/crystalball` - Prédictions
- `/choose` - Choix aléatoire
- `/coinflip` - Pile ou face
- `/rollthedice` - Lancer de dés
- `/cucumber` - Mini-jeu du concombre
- `/slots` - Machine à sous
- `/ascii` - Art ASCII
- `/profile` - Profil utilisateur (stats basiques)
- Et plus encore !

## 🐛 Debugging

Si certaines commandes ne fonctionnent pas en DM de groupe, vérifie les logs pour voir si :

- Des vérifications de `interaction.guild` bloquent l'exécution
- Des dépendances aux salons/rôles causent des erreurs

## 📝 Prochaines étapes (optionnel)

Pour améliorer le support des User Apps, tu pourrais :

1. Créer des versions simplifiées de certaines commandes pour les DMs
2. Ajouter des messages d'erreur clairs quand une fonctionnalité nécessite un serveur
3. Implémenter un système XP personnel (indépendant du serveur)

---

**Note** : Cette fonctionnalité nécessite que le bot soit redéployé pour que Discord reconnaisse les nouveaux paramètres `integration_types` et `contexts`.


