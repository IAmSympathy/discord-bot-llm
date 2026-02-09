# 📖 Documentation des Événements de Combat de Boss

## 🎯 Vue d'ensemble

Deux nouveaux types d'événements ont été ajoutés au système d'événements aléatoires :

- **⚔️ Mini Boss** : Combat rapide avec récompense unique
- **👑 Boss** : Combat épique avec récompenses partagées

## ⚔️ Mini Boss

### Caractéristiques

- **Durée** : 20 minutes
- **Difficulté** : Moyenne (500-800 HP)
- **Récompense** : 300 XP pour le coup final uniquement
- **Participants** : Illimité

### Mécaniques

1. Un mini boss aléatoire apparaît avec un certain nombre de HP
2. Chaque message envoyé dans le salon inflige des dégâts
3. Les messages sont supprimés après 3 secondes (pour éviter le flood)
4. Le premier joueur à porter le coup final gagne 300 XP
5. Tous les participants sont notifiés à la fin

### Mini Boss disponibles

| Nom             | HP  | Dégâts/message | Description                      |
|-----------------|-----|----------------|----------------------------------|
| Slime Géant     | 500 | 10             | Un slime visqueux et gluant      |
| Golem de Pierre | 800 | 8              | Une créature rocheuse résistante |
| Esprit Corrompu | 600 | 12             | Un fantôme malveillant           |
| Araignée Géante | 700 | 9              | Une monstrueuse arachnide        |

## 👑 Boss

### Caractéristiques

- **Durée** : 40 minutes
- **Difficulté** : Élevée (2000-3000 HP)
- **Récompenses** :
    - 1000 XP partagés entre tous les participants
    - +500 XP bonus pour le coup final
- **Participants** : Illimité

### Mécaniques

1. Un boss puissant apparaît avec beaucoup de HP
2. Chaque message envoyé inflige des dégâts (moins par message)
3. Les messages sont supprimés après 3 secondes
4. Quand le boss est vaincu :
    - L'XP total (1000) est divisé entre tous les participants
    - Le joueur qui porte le coup final reçoit son XP partagé + 500 XP bonus
5. Tous les participants sont notifiés et pingés

### Boss disponibles

| Nom             | HP   | Dégâts/message | Description                       |
|-----------------|------|----------------|-----------------------------------|
| Dragon du Chaos | 2000 | 5              | Un dragon ancien et puissant      |
| Roi Liche       | 2500 | 4              | Un sorcier mort-vivant            |
| Hydre Abyssale  | 3000 | 3              | Une bête à plusieurs têtes        |
| Titan Forgé     | 2200 | 5              | Un colosse de métal et de flammes |

## 🎨 Système d'images

### Structure des fichiers

```
assets/
  bosses/
    # Mini Boss
    slime_geant.png
    golem_pierre.png
    esprit_corrompu.png
    araignee_geante.png
    
    # Boss
    dragon_chaos.png
    liche_roi.png
    hydre_abyssale.png
    titan_forge.png
```

### Format recommandé

- **Résolution** : 512x512 ou 256x256
- **Format** : PNG (pour transparence)
- **Noms** : Exactement comme listés ci-dessus

### Fallback

Si une image n'existe pas, l'événement fonctionnera quand même sans thumbnail.

## 🎮 Interface utilisateur

### Barre de vie

Les événements affichent une barre de vie visuelle :

- **Mini Boss** : 🟥🟥🟥🟥🟥⬛⬛⬛⬛⬛ (rouge)
- **Boss** : 🟪🟪🟪🟪🟪⬛⬛⬛⬛⬛ (violet)

### Messages

Les messages des joueurs sont automatiquement supprimés après 3 secondes pour :

- Éviter le flood du salon
- Garder le salon propre
- Permettre aux joueurs de voir leur contribution

### Notifications

- **Victoire** : Tous les participants sont pingés (embed vert)
- **Expiration** : Tous les participants sont pingés (embed rouge)
- **Annonce générale** : Message dans le salon général (sauf mode test)

## 🧪 Mode Test

Pour tester les événements :

```
/test-event type:Combat de Mini Boss
/test-event type:Combat de Boss
```

En mode test :

- ✅ L'événement se déroule normalement
- ✅ Les participants peuvent attaquer
- ❌ Aucun XP n'est distribué
- ✅ Le message de victoire/défaite s'affiche

## 📊 Statistiques

### Données trackées

- Nombre de participants
- Nombre total de messages
- HP restants (si échec)
- Gagnant (coup final)

### Historique

Les événements sont enregistrés dans l'historique avec :

- ID de l'événement
- Type (MINI_BOSS ou BOSS)
- Timestamp
- Liste des participants
- Gagnant(s)

## ⚙️ Configuration technique

### Fichiers créés

- `src/services/events/bossData.ts` - Données des boss
- `src/services/events/miniBossEvent.ts` - Logique mini boss
- `src/services/events/bossEvent.ts` - Logique boss
- `assets/bosses/` - Dossier des images

### Intégration

- Ajouté à `EventType` enum
- Exporté dans `randomEventsService.ts`
- Handler dans `watchChannel.ts`
- Commandes de test dans `test-event.ts`

## 🎯 Équilibrage

### Mini Boss

- **Objectif** : Combat rapide et compétitif
- **Temps moyen** : 5-10 minutes avec participation active
- **Messages requis** : 50-80 messages
- **Stratégie** : Course au coup final

### Boss

- **Objectif** : Combat collaboratif épique
- **Temps moyen** : 15-30 minutes avec participation active
- **Messages requis** : 400-1000 messages
- **Stratégie** : Coopération pour vaincre ensemble

## 🔄 Extensions futures possibles

1. **Boss hebdomadaires** avec HP et récompenses accrues
2. **Boss saisonniers** avec thèmes spéciaux
3. **Achievements** pour vaincre tous les boss
4. **Statistiques** de boss vaincus par joueur
5. **Phases de boss** avec changement de difficulté
6. **Buffs temporaires** pour aider contre les boss
7. **Leaderboard** des meilleurs chasseurs de boss

## 💡 Conseils pour les joueurs

### Mini Boss

- Soyez rapides ! Le premier à porter le coup final gagne
- Surveillez la barre de HP pour timing du coup final
- Stratégie : Spammer des messages courts et rapides

### Boss

- Travaillez ensemble ! Plus il y a de participants, plus l'XP individuel est réduit
- Pas de rush - tout le monde gagne de l'XP
- Le bonus de coup final (500 XP) reste important
- Stratégie : Participation régulière plutôt que spam intense
