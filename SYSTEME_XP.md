# ✅ Système d'XP et de Niveaux Implémenté !

## 🎮 Présentation du Système

Un système complet d'XP (expérience) et de niveaux a été ajouté au bot ! Chaque action effectuée par les utilisateurs leur rapporte de l'XP.

## 💫 Gains d'XP par Action

### 📱 Actions Discord

- 📨 **Message envoyé** : 5 XP
- 👍 **Réaction ajoutée** : 2 XP
- ❤️ **Réaction reçue** : 3 XP
- ⚡ **Commande utilisée** : 10 XP
- 📢 **Mention reçue** : 5 XP
- 💬 **Réponse reçue** : 5 XP
- 🎤 **Minute en vocal** : 2 XP (par minute)

### 🤖 Actions Netricsa

- 🎨 **Image générée** : 50 XP
- 🖼️ **Image réimaginée** : 40 XP
- 🔍 **Image upscalée** : 30 XP
- 🌐 **Recherche web** : 15 XP
- 💬 **Conversation IA** : 20 XP

### 🎮 Actions Jeux

- 🏆 **Victoire** : 100 XP
- 💀 **Défaite** : 25 XP
- 🤝 **Égalité** : 50 XP

## ⭐ Système de Niveaux

### Formule de Calcul

Le niveau est calculé avec la formule : `Niveau = floor(sqrt(XP / 100))`

### Progression des Niveaux

| Niveau | XP Requis | XP Total pour Atteindre |
|--------|-----------|-------------------------|
| 1      | 100 XP    | 100 XP                  |
| 2      | 300 XP    | 400 XP                  |
| 3      | 500 XP    | 900 XP                  |
| 4      | 700 XP    | 1600 XP                 |
| 5      | 900 XP    | 2500 XP                 |
| 10     | 1900 XP   | 10000 XP                |
| 20     | 3900 XP   | 40000 XP                |
| 50     | 9900 XP   | 250000 XP               |
| 100    | 19900 XP  | 1000000 XP              |

### Caractéristiques

- ✅ Progression **équilibrée** (ni trop rapide ni trop lente)
- ✅ Récompense l'**engagement constant**
- ✅ Les actions **importantes** (jeux, images) rapportent plus d'XP
- ✅ Les actions **simples** (messages, réactions) contribuent aussi

## 📊 Affichage dans `/stats`

### Barre de Progression Visuelle

```
⭐ Niveau 5
██████████░░ 75%
💫 2,350 XP | 150 XP avant niveau 6
```

### Emplacement

Le niveau et l'XP s'affichent dans **toutes les catégories** de stats :

- 📱 Stats Discord
- 🤖 Stats Netricsa
- 🎮 Stats Jeux

**Note :** Netricsa n'affiche pas de niveau (c'est le bot).

## 🗂️ Stockage

### Fichier : `data/user_xp.json`

Structure :

```json
{
  "userId": {
    "userId": "string",
    "username": "string",
    "totalXP": 2350,
    "level": 5,
    "lastUpdate": 1738795234567
  }
}
```

## 🔄 Tracking Automatique

### Gain d'XP en Temps Réel

Chaque fois qu'un utilisateur effectue une action :

1. ✅ L'action est enregistrée dans les stats
2. ✅ L'XP correspondante est ajoutée automatiquement
3. ✅ Le niveau est recalculé
4. ✅ Si level up → log dans la console

### Exemple de Logs

```
[XPSystem] Username level up! 4 → 5 (2500 XP)
```

## 📁 Fichiers Créés/Modifiés

### Nouveaux Fichiers

1. **`src/services/xpSystem.ts`**
    - Service de gestion de l'XP et des niveaux
    - Calculs de niveau
    - Système de récompenses
    - Leaderboard (classement)

2. **`data/user_xp.json`**
    - Stockage de l'XP de chaque utilisateur

### Fichiers Modifiés

1. **`src/services/userStatsService.ts`**
    - Ajout d'`addXP()` dans toutes les fonctions de tracking
    - Import du système XP

2. **`src/games/common/globalStats.ts`**
    - Ajout d'XP pour victoires/défaites/égalités
    - Import du système XP

3. **`src/commands/stats/stats.ts`**
    - Ajout de `createXPBar()` pour la barre de progression
    - Ajout de `addLevelToEmbed()` pour afficher le niveau
    - Affichage du niveau dans tous les embeds de stats

## 🎯 Exemples de Progression

### Utilisateur Actif (messages + vocal)

```
- 50 messages/jour × 5 XP = 250 XP
- 2h vocal/jour × 120 min × 2 XP = 480 XP
- Total : 730 XP/jour
- Niveau 2 atteint en ~1 jour
- Niveau 5 atteint en ~3-4 jours
```

### Créateur d'Images

```
- 5 images/jour × 50 XP = 250 XP
- 3 conversations IA × 20 XP = 60 XP
- Total : 310 XP/jour
- Niveau 2 atteint en ~1-2 jours
- Niveau 5 atteint en ~8 jours
```

### Joueur Compétitif

```
- 10 victoires × 100 XP = 1000 XP
- 10 défaites × 25 XP = 250 XP
- Total : 1250 XP
- Niveau 3 atteint immédiatement
```

## ⚙️ Configuration

### Modifier les Récompenses

Éditer `src/services/xpSystem.ts` → constante `XP_REWARDS`

### Modifier la Formule de Niveau

Éditer `src/services/xpSystem.ts` → fonction `calculateLevel()`

Formule actuelle : `level = floor(sqrt(xp / 100))`

Alternatives possibles :

- Plus rapide : `level = floor(sqrt(xp / 50))`
- Plus lente : `level = floor(sqrt(xp / 200))`
- Linéaire : `level = floor(xp / 1000)`

## 🚀 Fonctionnalités Futures Possibles

- 🏆 **Leaderboard** : Commande `/leaderboard` pour voir le classement
- 🎁 **Récompenses de niveau** : Débloquer des avantages à certains niveaux
- 🌟 **Rôles automatiques** : Attribuer des rôles Discord selon le niveau
- 📈 **Graphiques de progression** : Visualiser l'XP gagnée par jour/semaine
- 🏅 **Achievements** : Badges spéciaux pour des exploits
- 💰 **Économie** : Utiliser l'XP comme monnaie
- 🎲 **Bonus XP** : Multiplicateurs temporaires d'XP

## ✅ Résultat

**Le système d'XP est entièrement fonctionnel !**

- ✅ Toutes les actions donnent de l'XP
- ✅ Les niveaux se calculent automatiquement
- ✅ L'affichage est intégré dans `/stats`
- ✅ Progression équilibrée et motivante
- ✅ Aucune action manuelle requise

**Redémarre le bot et commence à gagner de l'XP ! 🎉**

---

**Note Importante :** Les XP actuels sont calculés **à partir de maintenant**. Les actions passées ne sont pas comptabilisées automatiquement. Pour recalculer l'XP de tous les utilisateurs basé sur leurs stats existantes, une fonction `recalculateAllXP()` est disponible dans `xpSystem.ts`.
