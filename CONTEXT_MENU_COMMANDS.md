# Commandes de Menu Contextuel (Context Menu Commands)

## Modifications effectuées

### Nouvelles fonctionnalités ajoutées

J'ai ajouté deux **commandes de menu contextuel** (User Context Menu Commands) qui permettent d'accéder rapidement au profil et aux statistiques d'un utilisateur en faisant un clic droit sur son nom dans Discord, puis en allant dans la section "Applications".

### Fichiers créés

1. **`src/commands/context/userProfile.ts`**
    - Commande contextuelle "Voir le profil"
    - Affiche le profil de l'utilisateur sélectionné
    - Permet de naviguer vers les statistiques avec un bouton

2. **`src/commands/context/userStats.ts`**
    - Commande contextuelle "Voir les stats"
    - Affiche directement les statistiques de l'utilisateur sélectionné
    - Permet de naviguer entre les différentes catégories (Discord, Netricsa, Jeux, Serveur)

### Fichiers modifiés

1. **`src/bot.ts`**
    - Ajout de la gestion des interactions de type `UserContextMenuCommand`
    - Les commandes contextuelles donnent maintenant de l'XP comme les commandes slash
    - Les statistiques d'utilisation de commandes sont enregistrées

2. **`src/utils/statsEmbedBuilder.ts`**
    - Ajout de `createDetailedGameStatsEmbed()` - Crée l'embed des stats de jeux détaillées avec sélection par type de jeu
    - Ajout de `createStatsNavigationButtons()` - Crée les boutons de navigation pour les stats
    - Ajout de `createBackToProfileButton()` - Crée le bouton retour au profil
    - Ajout de `createGameSelectMenu()` - Crée le menu de sélection des jeux avec Connect 4
    - **Évite la duplication de code** : toutes les fonctions utilitaires sont centralisées dans un seul fichier

3. **`src/commands/stats/stats.ts`**
    - Mise à jour pour utiliser les fonctions centralisées de `statsEmbedBuilder.ts`
    - Suppression des définitions de fonctions dupliquées
    - Import des nouvelles fonctions utilitaires
    - Ajout du jeu "Connect 4" dans le menu de sélection

### Comment utiliser les nouvelles commandes

1. **Voir le profil d'un utilisateur :**
    - Faites un clic droit sur le nom d'un utilisateur
    - Allez dans "Applications"
    - Cliquez sur "Voir le profil"
    - Un message éphémère (visible uniquement par vous) s'affichera avec le profil de l'utilisateur

2. **Voir les stats d'un utilisateur :**
    - Faites un clic droit sur le nom d'un utilisateur
    - Allez dans "Applications"
    - Cliquez sur "Voir les stats"
    - Un message éphémère s'affichera avec les statistiques de l'utilisateur
    - Vous pouvez naviguer entre les catégories (Discord, Netricsa, Jeux, Serveur)

### Avantages

- **Accès rapide** : Plus besoin de taper `/profile` ou `/stats` avec un paramètre utilisateur
- **Interface unifiée** : Les commandes contextuelles utilisent la même interface que les commandes slash
- **Éphémère** : Les messages sont privés et ne polluent pas les canaux
- **XP et stats** : L'utilisation des commandes contextuelles donne de l'XP et est comptabilisée dans les statistiques
- **Code centralisé** : Aucune duplication de code, toutes les fonctions utilitaires sont dans `statsEmbedBuilder.ts`

### Architecture du code

```
statsEmbedBuilder.ts (utils)
├── Fonctions de base (existantes)
│   ├── createXPBar()
│   ├── getLevelText()
│   ├── formatVoiceTime()
│   ├── createDiscordStatsEmbed()
│   ├── createNetricsaStatsEmbed()
│   ├── createGameStatsEmbed()
│   ├── createServerStatsEmbed()
│   └── createProfileEmbed()
│
└── Nouvelles fonctions utilitaires (ajoutées)
    ├── createDetailedGameStatsEmbed() - Stats détaillées par jeu
    ├── createStatsNavigationButtons() - Boutons de navigation
    ├── createBackToProfileButton() - Bouton retour
    └── createGameSelectMenu() - Menu de sélection de jeux

Ces fonctions sont réutilisées par :
├── src/commands/context/userProfile.ts
├── src/commands/context/userStats.ts
└── src/commands/stats/stats.ts
```

### Notes techniques

- Les commandes contextuelles sont automatiquement déployées lors du démarrage du bot
- Elles sont disponibles partout (serveur et DMs) car elles n'ont pas de restrictions
- Le code est réutilisé de manière optimale entre les commandes slash et contextuelles
- Les interactions sont gérées avec des collectors pour permettre la navigation interactive
- Toutes les fonctions utilitaires sont centralisées dans `statsEmbedBuilder.ts` pour éviter la duplication

### Déploiement

Les commandes ont été automatiquement déployées sur Discord lors du redémarrage du bot. Elles devraient être disponibles immédiatement dans le menu contextuel (clic droit) sur les utilisateurs.

---

**Date de création :** 6 février 2026  
**Dernière mise à jour :** 6 février 2026  
**Statut :** ✅ Implémenté, testé et déployé

