# 📝 Limitations des DMs et DMs de Groupe

## 🎯 Résumé

Avec le support des **User Apps**, Netricsa peut maintenant être utilisée dans les DMs et les DMs de groupe. Cependant, certaines fonctionnalités dépendent du contexte serveur et ne fonctionneront pas complètement.

---

## ✅ Ce qui FONCTIONNE en DM/DM de groupe

### Commandes Fun

- ✅ `/imagine` - Génération d'images
- ✅ `/reimagine` - Régénération d'images
- ✅ `/upscale` - Agrandissement d'images
- ✅ `/ship` - Calcul de compatibilité
- ✅ `/crystalball` - Prédictions
- ✅ `/choose` - Choix aléatoire
- ✅ `/coinflip` - Pile ou face
- ✅ `/rollthedice` - Lancer de dés
- ✅ `/cucumber` - Mini-jeu du concombre
- ✅ `/slots` - Machine à sous
- ✅ `/ascii` - Art ASCII
- ✅ `/prompt-maker` - Générateur de prompts

### Système XP

- ✅ **Gain d'XP** - L'XP est enregistrée normalement
- ✅ **Level up** - Le niveau augmente correctement
- ✅ **Notifications de level up** - Envoyées en DM privé (**nouveau !**)
- ✅ **Statistiques** - Les stats sont trackées (commandes utilisées, etc.)
- ✅ **Achievements** - Les succès sont débloqués
- ✅ **Notifications d'achievements** - Envoyées en DM privé (**nouveau !**)
- ✅ **Profil** - `/profile` affiche les stats basiques

### Commandes Utilitaires

- ✅ `/reset-dm` - Réinitialiser la mémoire DM
- ✅ `/challenges` - Voir les défis quotidiens
- ✅ `/profile` - Voir son profil (version limitée)
- ✅ Conversation avec Netricsa - IA conversationnelle

---

## ❌ Ce qui NE FONCTIONNE PAS en DM/DM de groupe

### Système de Rôles

- ❌ **Attribution de rôles de niveau** - Pas de serveur = pas de rôles
    - Les rôles Elite, Commando, etc. ne peuvent pas être attribués
    - Les notifications de "nouveau rôle" ne s'affichent pas
    - Les couleurs de rôle ne sont pas disponibles

### Fonctionnalités Serveur

- ❌ **Leaderboard complet** - Nécessite les membres du serveur
- ❌ **Événements saisonniers** - Feu de foyer, événements boss, etc.
- ❌ **Salon compteur** - Pas de salon spécifique
- ❌ **Système de météo** - Lié au serveur
- ❌ **Rewind annuel** - Basé sur les stats du serveur

### Notifications

- ✅ **Messages de level up en DM** - Les notifications sont envoyées en DM privé
- ✅ **Annonces d'achievements en DM** - Tous les achievements sont notifiés en DM
- ❌ **Annonces publiques** - Pas de notifications publiques dans les salons serveur
- ❌ **Logs** - Les logs sont liés au serveur

---

## 🔧 Comment ça marche techniquement

### Protection du code

Toutes les fonctions qui utilisent `interaction.guild` ou `channel.guild` vérifient maintenant si le contexte est un serveur :

```typescript
// Exemple dans xpSystem.ts
if (!channel.guild) {
    logger.debug(`Level up in DM context - skipping guild-specific features`);
    return;
}
```

### Gain d'XP en DM

L'XP est enregistrée **globalement** pour l'utilisateur :

- ✅ `user_xp.json` - XP totale et niveau
- ✅ `daily_xp.json` - XP quotidienne
- ✅ `weekly_xp.json` - XP hebdomadaire
- ✅ `monthly_xp.json` - XP mensuelle
- ✅ `yearly_xp.json` - XP annuelle

### Achievements en DM

Les achievements sont également enregistrés **globalement** :

- ✅ Succès de commandes fun
- ✅ Succès de génération d'images
- ✅ Succès de jeux
- ✅ Succès Netricsa (conversations avec l'IA)

Seuls les achievements Discord spécifiques au serveur ne peuvent pas être débloqués (ex: "Réagir 100 fois").

---

## 💡 Recommandations

### Pour une utilisation optimale

1. **Commandes fun** → Utilisez-les partout (DM, DM de groupe, serveur)
2. **Génération d'images** → Fonctionne parfaitement en DM
3. **Profil et stats** → Utilisez dans le serveur principal pour voir les rôles et le leaderboard complet
4. **Challenges et achievements** → Gagnez de l'XP partout, consultez dans le serveur

### Cas d'usage idéaux en DM de groupe

- 🎨 Générer des images avec `/imagine` pour un projet entre amis
- 🎲 Jouer à des jeux comme `/ship`, `/cucumber`, `/slots`
- 🔮 Demander des prédictions avec `/crystalball`
- 🎯 Faire des choix avec `/choose`
- 💬 Discuter avec Netricsa

---

## 🐛 Signaler un problème

Si une commande devrait fonctionner en DM mais ne fonctionne pas :

1. Vérifiez les logs pour l'erreur exacte
2. Cherchez les références à `interaction.guild` sans protection
3. Ajoutez une vérification `if (!interaction.guild) return;`
4. Testez à nouveau

---

**Note** : Cette documentation sera mise à jour au fur et à mesure que de nouvelles fonctionnalités sont ajoutées ou que des bugs sont découverts.

