# Implémentation du Système de Statistiques

## Résumé des Modifications

### 1. ✅ La commande `/stats` est maintenant éphémère

La commande `/stats` utilise maintenant `MessageFlags.Ephemeral` pour que seul l'utilisateur puisse voir ses statistiques.

### 2. ✅ Système de navigation avec boutons et select menu

La commande `/stats` propose maintenant 4 catégories accessibles via des boutons :

- **🎮 Jeux** : Statistiques des jeux (avec select menu pour choisir le jeu)
- **📱 Discord** : Statistiques Discord (messages, réactions, commandes, etc.)
- **🤖 Netricsa** : Statistiques d'utilisation de Netricsa (images, recherches, conversations)
- **🌐 Serveur** : Statistiques globales du serveur

### 3. ✅ Statistiques Discord trackées

Les statistiques Discord suivantes sont maintenant enregistrées :

- Messages envoyés
- Réactions ajoutées
- Réactions reçues
- Commandes utilisées
- Mentions reçues
- Réponses (replies) reçues

### 4. ✅ Statistiques Netricsa trackées

Les statistiques Netricsa suivantes sont maintenant enregistrées :

- Images générées (`/imagine`)
- Images réimaginées (`/reimagine`)
- Images upscalées (`/upscale`)
- Recherches web (automatiques)
- Conversations IA (interactions avec le bot)

### 5. ✅ Bouton "Voir les stats" dans le profil

Un bouton "📊 Voir les statistiques" a été ajouté à la commande `/profile` pour accéder directement aux statistiques de l'utilisateur.

## Fichiers Créés

### `src/services/userStatsService.ts`

Service principal pour gérer les statistiques utilisateur :

- Interfaces pour les structures de données
- Fonctions d'incrémentation pour chaque statistique
- Fonction pour récupérer les stats d'un utilisateur
- Fonction pour calculer les stats globales du serveur
- Stockage dans `data/user_stats.json`

### `data/user_stats.json`

Fichier de stockage des statistiques utilisateur (créé automatiquement).

## Fichiers Modifiés

### `src/commands/stats/stats.ts`

- Refonte complète avec système de boutons et select menu
- Ajout des embeds pour Discord, Netricsa et Serveur
- Export de `showStatsForUser()` pour utilisation dans d'autres commandes
- Interface éphémère

### `src/commands/profile/profile.ts`

- Ajout d'un bouton "Voir les statistiques"
- Import et utilisation de `showStatsForUser()`
- Gestion du collector pour le bouton

### `src/bot.ts`

- Import des fonctions de tracking
- Tracking des commandes utilisées (dans le gestionnaire `InteractionCreate`)
- Tracking des réactions ajoutées et reçues (dans le gestionnaire `MessageReactionAdd`)

### `src/watchChannel.ts`

- Import des fonctions de tracking
- Tracking des messages envoyés
- Tracking des mentions reçues
- Tracking des réponses (replies) reçues
- Tracking des conversations IA

### `src/queue/queue.ts`

- Import de `recordWebSearch`
- Tracking des recherches web effectuées

### `src/commands/imagine/imagine.ts`

- Import de `recordImageGenerated`
- Tracking des images générées (une stat par image)

### `src/commands/reimagine/reimagine.ts`

- Import de `recordImageReimagined`
- Tracking des images réimaginées (une stat par image)

### `src/commands/upscale/upscale.ts`

- Import de `recordImageUpscaled`
- Tracking des images upscalées

## Structure des Données

```typescript
{
    "userId"
:
    {
        "userId"
    :
        "string",
            "username"
    :
        "string",
            "discord"
    :
        {
            "messagesEnvoyes"
        :
            0,
                "reactionsAjoutees"
        :
            0,
                "reactionsRecues"
        :
            0,
                "commandesUtilisees"
        :
            0,
                "mentionsRecues"
        :
            0,
                "repliesRecues"
        :
            0
        }
    ,
        "netricsa"
    :
        {
            "imagesGenerees"
        :
            0,
                "imagesReimaginee"
        :
            0,
                "imagesUpscalee"
        :
            0,
                "recherchesWeb"
        :
            0,
                "conversationsIA"
        :
            0
        }
    ,
        "lastUpdate"
    :
        1234567890
    }
}
```

## Comment ça fonctionne

### Tracking Automatique

Toutes les statistiques sont trackées automatiquement lors de l'utilisation du bot :

- Les messages sont comptés via l'événement `messageCreate`
- Les réactions via l'événement `MessageReactionAdd`
- Les commandes via l'événement `InteractionCreate`
- Les actions Netricsa via les commandes correspondantes

### Affichage des Statistiques

1. Utiliser `/stats` ou `/stats @utilisateur` pour voir les statistiques
2. Naviguer entre les catégories avec les boutons
3. Sélectionner un jeu spécifique dans le menu déroulant (catégorie Jeux)
4. Les statistiques sont mises à jour en temps réel

### Accès depuis le Profil

1. Utiliser `/profile` ou `/profile @utilisateur`
2. Cliquer sur le bouton "📊 Voir les statistiques"
3. La même interface que `/stats` s'ouvre

## Points Techniques

- Les statistiques sont persistées dans un fichier JSON
- Le système utilise un chargement/sauvegarde à chaque modification (simple mais efficace pour un bot Discord)
- Les statistiques serveur sont calculées à la volée en agrégeant toutes les stats utilisateur
- Les collectors ont un timeout de 5 minutes
- Les messages sont éphémères pour la confidentialité

## Améliorations Futures Possibles

- Ajouter des graphiques ou des leaderboards
- Ajouter des statistiques par période (jour/semaine/mois)
- Ajouter plus de métriques (temps d'utilisation, etc.)
- Exporter les statistiques en CSV ou autres formats
- Ajouter des badges ou achievements basés sur les stats
