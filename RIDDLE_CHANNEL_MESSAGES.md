# 🎉 Modifications finales de l'Événement Riddle

## 📋 Résumé des changements

Toutes les réponses (bonnes ou mauvaises) sont maintenant envoyées **dans le salon d'énigme** au lieu des DMs, avec suppression automatique pour garder le salon propre.

## ✨ Fonctionnement détaillé

### 1. 📝 Envoi des réponses

**Tous les messages des joueurs dans le salon sont supprimés immédiatement**, incluant :

- ✅ Bonnes réponses
- ❌ Mauvaises réponses
- 🔄 Tentatives répétées

### 2. 🎯 Réponse correcte

Quand un joueur trouve la bonne réponse :

**Message détaillé (supprimé après 10 secondes) :**

```
🥇 BONNE RÉPONSE !

@Joueur a trouvé la réponse en 15m 23s !

Position : 1er
🎁 +200 XP
```

**Message permanent (reste dans le salon) :**

```
🥇 @Joueur a trouvé la réponse ! (1er en 15m 23s)
```

### 3. ❌ Réponse incorrecte

**Message (supprimé après 5 secondes) :**

```
❌ Mauvaise réponse

@Joueur, ta réponse "chat" n'est pas correcte.

Réessaye ! L'énigme est toujours active.
```

### 4. 🔄 Tentative répétée

Si un joueur qui a déjà trouvé essaie de répondre à nouveau :

**Message (supprimé après 5 secondes) :**

```
🧩 Énigme du Jour

@Joueur, tu as déjà trouvé la réponse ! 🎉

Tu ne peux pas répondre une deuxième fois.
```

## 🕐 Durées de suppression

| Type de message                    | Durée avant suppression |
|------------------------------------|-------------------------|
| Message du joueur                  | Immédiate               |
| Bonne réponse (détaillée)          | 10 secondes             |
| Bonne réponse (annonce permanente) | Jamais supprimé         |
| Mauvaise réponse                   | 5 secondes              |
| Déjà trouvé                        | 5 secondes              |

## 🎨 Avantages de ce système

### ✅ Pour les joueurs

- Pas besoin d'ouvrir les DMs
- Feedback immédiat dans le salon
- Voir qui a trouvé en temps réel
- Salon reste propre (pas de spam)

### ✅ Pour le bot

- Moins de requêtes DM (qui peuvent échouer)
- Meilleure expérience utilisateur
- Salon organisé et facile à suivre

### ✅ Pour l'ambiance

- Crée une compétition visible
- Les joueurs voient les autres progresser
- Encourage la participation

## 📊 Exemple de flux

### Scénario complet

**00:00 - Lancement de l'énigme**

```
🧩 ÉNIGME DU JOUR

Une énigme quotidienne est apparue !

Je vole sans ailes, je pleure sans yeux. 
Partout où je vais, l'obscurité me suit. Qui suis-je ?

💡 Comment jouer
Envoie ta réponse dans ce salon ! Tes messages seront 
automatiquement supprimés. Plus tu réponds vite, plus tu gagnes d'XP.
```

**00:15 - JoueurA répond "oiseau" (mauvais)**

1. Message de JoueurA supprimé instantanément
2. Affichage pendant 5 secondes :
   ```
   ❌ Mauvaise réponse
   @JoueurA, ta réponse "oiseau" n'est pas correcte.
   Réessaye ! L'énigme est toujours active.
   ```
3. Message supprimé automatiquement

**00:20 - JoueurA répond "nuage" (correct)**

1. Message de JoueurA supprimé instantanément
2. Affichage pendant 10 secondes :
   ```
   🥇 BONNE RÉPONSE !
   @JoueurA a trouvé la réponse en 20m 15s !
   Position : 1er
   🎁 +200 XP
   ```
3. Message permanent ajouté :
   ```
   🥇 @JoueurA a trouvé la réponse ! (1er en 20m 15s)
   ```

**00:45 - JoueurB répond "nuage" (correct)**

1. Message de JoueurB supprimé instantanément
2. Affichage pendant 10 secondes :
   ```
   🥈 BONNE RÉPONSE !
   @JoueurB a trouvé la réponse en 45m 02s !
   Position : 2ème
   🎁 +140 XP
   ```
3. Message permanent ajouté :
   ```
   🥈 @JoueurB a trouvé la réponse ! (2ème en 45m 02s)
   ```

**01:00 - JoueurA essaie de répondre à nouveau**

1. Message de JoueurA supprimé instantanément
2. Affichage pendant 5 secondes :
   ```
   🧩 Énigme du Jour
   @JoueurA, tu as déjà trouvé la réponse ! 🎉
   Tu ne peux pas répondre une deuxième fois.
   ```
3. Message supprimé automatiquement

## 🔧 Détails techniques

### Modifications apportées

**1. Description de l'énigme**

```typescript
"**Envoie ta réponse dans ce salon !** Tes messages seront 
automatiquement
supprimés.Plus
tu
réponds
vite, plus
tu
gagnes
d
'XP."
```

**2. Gestion des réponses**

- Tous les messages des joueurs sont supprimés avec `message.delete()`
- Les embeds de réponse sont envoyés dans le salon
- Utilisation de `setTimeout()` pour la suppression automatique

**3. Messages permanents**

```typescript
const publicVictoryEmbed = new EmbedBuilder()
    .setDescription(
        `${positionEmoji} <@${userId}> a trouvé la réponse ! (${positionText} en ${timeString})`
    );
// Ce message n'est jamais supprimé
```

**4. Messages temporaires**

```typescript
const detailedMsg = await channel.send({embeds: [victoryEmbed]});

// Supprimer après X secondes
setTimeout(async () => {
    try {
        await detailedMsg.delete();
    } catch (error) {
        // Ignorer les erreurs
    }
}, delayInMs);
```

## 🎯 Comportement du salon

### État du salon pendant l'événement

```
[Embed de l'énigme]
[Indice (si affiché)]
🥇 @JoueurA a trouvé la réponse ! (1er en 20m 15s)
🥈 @JoueurB a trouvé la réponse ! (2ème en 45m 02s)
🥉 @JoueurC a trouvé la réponse ! (3ème en 1h 30m 10s)
🎖️ @JoueurD a trouvé la réponse ! (4ème en 2h 05m 45s)
[Messages temporaires qui apparaissent et disparaissent]
```

### Après la fin de l'événement

```
[Embed de l'énigme]
[Indice]
🥇 @JoueurA a trouvé la réponse ! (1er en 20m 15s)
🥈 @JoueurB a trouvé la réponse ! (2ème en 45m 02s)
🥉 @JoueurC a trouvé la réponse ! (3ème en 1h 30m 10s)
🎖️ @JoueurD a trouvé la réponse ! (4ème en 2h 05m 45s)

⏰ ÉVÉNEMENT TERMINÉ !

L'énigme du jour est maintenant terminée !

La réponse était : nuage

Félicitations aux 8 participant(s) ! 🎉

🏆 Leaderboard
🥇 @JoueurA - 20m 15s
🥈 @JoueurB - 45m 02s
🥉 @JoueurC - 1h 30m 10s
4. @JoueurD - 2h 05m 45s
[...]

⏰ Fermeture du salon
Ce salon sera fermé dans 1 heure.
Profitez-en pour consulter les résultats !
```

## 🚀 Avantages vs DM

| Aspect      | DM             | Salon (nouveau)  |
|-------------|----------------|------------------|
| Visibilité  | ❌ Privé        | ✅ Public         |
| Engagement  | ❌ Isolé        | ✅ Communautaire  |
| Compétition | ❌ Cachée       | ✅ Visible        |
| Fiabilité   | ❌ Peut échouer | ✅ Garanti        |
| Propreté    | ✅ Personnel    | ✅ Auto-nettoyage |
| Expérience  | 🤷 Neutre      | 🎉 Excitante     |

## 💡 Pourquoi ce choix ?

1. **Expérience sociale** - Les joueurs voient la progression en temps réel
2. **Motivation** - Voir les autres trouver encourage à participer
3. **Transparence** - Tout le monde voit le leaderboard se construire
4. **Simplicité** - Pas besoin d'ouvrir les DMs
5. **Fiabilité** - Pas de problème de DMs fermés
6. **Propreté** - Suppression automatique garde le salon organisé

---

**L'événement Riddle est maintenant optimisé pour une expérience sociale et compétitive ! 🧩🎉**

