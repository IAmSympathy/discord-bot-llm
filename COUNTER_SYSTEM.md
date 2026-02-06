# 🔢 Système de Compteur - Documentation

## Vue d'ensemble

Le système de compteur est une fonctionnalité interactive où les utilisateurs doivent compter en séquence dans un salon dédié. C'est un jeu de coopération qui teste la coordination du serveur !

## Fonctionnement

### Règles

1. **Comptage séquentiel** : Les utilisateurs doivent écrire les nombres dans l'ordre (1, 2, 3, 4, ...)
2. **Pas de double comptage** : Un utilisateur ne peut pas écrire deux nombres consécutifs
3. **Validation automatique** : Les messages invalides sont automatiquement supprimés
4. **Messages numériques uniquement** : Seuls les nombres sont acceptés

### Messages invalides supprimés

- ❌ Texte non numérique ("hello", "test", etc.)
- ❌ Mauvais nombre (écrire "5" quand c'est "4")
- ❌ Double comptage (même utilisateur deux fois de suite)
- ❌ Messages de bots (ignorés)

### Récompenses automatiques

Le bot réagit automatiquement aux jalons :

- ✨ Tous les 10 nombres
- 🎊 Tous les 50 nombres
- 🎉💯 Tous les 100 nombres

## Configuration

### Variable d'environnement requise

Ajouter dans `.env` :

```env
COUNTER_CHANNEL_ID=<ID_du_salon_compteur>
```

### Obtenir l'ID du salon

1. Activer le mode développeur Discord
2. Clic droit sur le salon compteur
3. "Copier l'identifiant"

## Fonctionnalités

### 1. Validation en temps réel

```typescript
// Exemple de validation
Message: "42" → ✅ Accepté
si
c
'est le bon nombre et bon utilisateur
Message: "hello" → ❌ Supprimé
automatiquement
Message: "43"
alors
qu
'on est à 41 → ❌ Supprimé
```

### 2. Statistiques individuelles

Chaque utilisateur accumule des contributions au compteur qui sont affichées dans :

- `/stats` - Statistiques Discord
- `/profile` - Profil utilisateur
- Affichage : `🔢 Compteur : X contributions`

### 3. État du compteur

Le système garde en mémoire :

- **Nombre actuel** : Où on en est dans le comptage
- **Dernier utilisateur** : Qui a compté en dernier
- **Record** : Le nombre le plus élevé atteint
- **Contributions** : Compteur par utilisateur

### 4. Reset automatique

Si quelqu'un écrit "1" alors que le compteur est > 0 :

- Le compteur se réinitialise automatiquement
- Un message annonce le reset avec l'ancien nombre et le record
- Tout le monde peut recommencer

## Fichiers de données

### `data/counter_state.json`

Structure :

```json
{
  "currentNumber": 42,
  "lastUserId": "123456789",
  "highestReached": 156,
  "contributions": {
    "123456789": {
      "username": "User1",
      "count": 23
    },
    "987654321": {
      "username": "User2",
      "count": 19
    }
  }
}
```

## Intégration avec le système XP

Les contributions au compteur donnent de l'XP :

- ✅ Message valide = XP pour un message normal (5 XP)
- ✅ Enregistré dans les statistiques Discord
- ❌ Message invalide = Pas d'XP, message supprimé

## Fonctions principales

### `handleCounterMessage(message: Message)`

Traite un message dans le salon compteur :

- Valide le contenu
- Vérifie les règles
- Met à jour l'état
- Supprime si invalide
- Réagit aux jalons

### `getCounterState()`

Récupère l'état actuel du compteur.

### `getUserCounterContributions(userId: string)`

Récupère le nombre de contributions d'un utilisateur.

### `getTopCounterContributors(limit: number)`

Récupère le classement des meilleurs contributeurs.

### `forceResetCounter(channel: TextChannel)`

Reset forcé par un admin (à implémenter en commande si besoin).

## Exemples d'utilisation

### Scénario 1 : Comptage normal ✅

```
User1: 1
User2: 2
User3: 3
User1: 4
User2: 5
...
```

### Scénario 2 : Erreur de séquence ❌

```
User1: 1
User2: 2
User3: 5  ← Message supprimé (mauvais nombre)
User3: 3  ✅ Accepté
```

### Scénario 3 : Double comptage ❌

```
User1: 1
User1: 2  ← Message supprimé (même utilisateur)
User2: 2  ✅ Accepté
```

### Scénario 4 : Reset

```
Compteur à 156...
User1: 42  ← Message supprimé
User1: 1   → Reset automatique !
Bot: "❌ Compteur réinitialisé ! Le compteur était à 156. Record : 156. Recommencez à 1 !"
```

## Statistiques affichées

### Dans `/stats` ou `/profile`

```
📊 Statistiques Discord

📨 Messages envoyés : 150
👍 Réactions ajoutées : 45
...
🔢 Compteur : 23 contributions
😄 Emoji préféré : 😂 (×42)
```

## Notes techniques

### Performance

- ✅ Validation instantanée
- ✅ Suppression automatique des messages invalides
- ✅ Pas de spam possible (messages supprimés immédiatement)
- ✅ Synchronisation temps réel avec les stats

### Sécurité

- Les bots sont automatiquement ignorés
- Seuls les nombres entiers positifs sont acceptés
- Impossible de tricher (validation côté serveur)

### Maintenance

- État sauvegardé après chaque contribution valide
- Backup automatique dans `counter_state.json`
- Synchronisation avec `user_stats.json`

## Améliorations futures possibles

1. **Commandes admin**
    - `/counter-reset` - Reset forcé
    - `/counter-stats` - Stats globales du compteur
    - `/counter-leaderboard` - Top contributeurs

2. **Événements**
    - Notification à chaque 100
    - Célébration des records
    - Attribution de rôles temporaires

3. **Variantes**
    - Mode "compte à rebours"
    - Mode "nombres pairs/impairs"
    - Mode "multiples de X"

4. **Intégration rewind**
    - Award "Le mathématicien" pour le plus de contributions
    - Afficher le record de l'année dans le rewind

## Conclusion

Le système de compteur est maintenant complètement fonctionnel et prêt à être utilisé ! 🎉

Configure simplement `COUNTER_CHANNEL_ID` dans ton `.env` et c'est parti !
