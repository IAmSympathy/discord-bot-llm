# 🎪 Guide des Achievements Fun

## Vue d'ensemble

Une nouvelle catégorie d'achievements **FUN** a été ajoutée pour toutes les commandes amusantes du bot. Les achievements meme ont été déplacés de la catégorie NETRICSA vers FUN.

---

## 📋 Liste Complète des Achievements Fun

### 🤣 Memes (/findmeme)

| Achievement                    | Description                         | XP  | Secret |
|--------------------------------|-------------------------------------|-----|--------|
| 🤣 **Chercheur de Memes**      | Rechercher 10 memes avec /findmeme  | 100 | Non    |
| 🎪 **Collectionneur de Memes** | Rechercher 50 memes avec /findmeme  | 200 | Non    |
| 🎭 **Roi des Memes**           | Rechercher 200 memes avec /findmeme | 500 | Non    |

### 🎰 Slots (/slots)

| Achievement              | Description                           | XP  | Secret  |
|--------------------------|---------------------------------------|-----|---------|
| 🎰 **Premier Jackpot**   | Jouer aux slots pour la première fois | 50  | Non     |
| 🎲 **Joueur de Casino**  | Jouer 25 fois aux slots               | 100 | Non     |
| 💰 **Accro aux Slots**   | Jouer 100 fois aux slots              | 200 | Non     |
| 💎 **Chance Légendaire** | Obtenir 7️⃣7️⃣7️⃣ aux slots           | 500 | **Oui** |

### 💘 Ship (/ship)

| Achievement              | Description                                   | XP  | Secret  |
|--------------------------|-----------------------------------------------|-----|---------|
| 💘 **Cupidon Amateur**   | Tester la compatibilité pour la première fois | 50  | Non     |
| 💕 **Entremetteur**      | Faire 25 tests de compatibilité               | 100 | Non     |
| 💖 **Maître de l'Amour** | Faire 100 tests de compatibilité              | 200 | Non     |
| 💗 **Match Parfait**     | Obtenir 100% de compatibilité                 | 300 | **Oui** |

### 🎲 Dés (/rollthedice)

| Achievement             | Description                        | XP  | Secret  |
|-------------------------|------------------------------------|-----|---------|
| 🎲 **Lanceur de Dés**   | Lancer un dé pour la première fois | 50  | Non     |
| 🎯 **Maître du Hasard** | Lancer 50 dés                      | 100 | Non     |
| ⭐ **Critique Naturel**  | Obtenir 20 sur un D20              | 200 | **Oui** |

### 🪙 Pile ou Face (/coinflip)

| Achievement             | Description                                           | XP   | Secret  |
|-------------------------|-------------------------------------------------------|------|---------|
| 🪙 **Lanceur de Pièce** | Lancer une pièce pour la première fois                | 50   | Non     |
| 💿 **Face ou Pile Pro** | Lancer 25 pièces                                      | 100  | Non     |
| ⚡ **Sur la Tranche !**  | Faire tomber la pièce sur la tranche (0.1% de chance) | 1000 | **Oui** |

### 🔮 Boule de Cristal (/crystalball)

| Achievement            | Description                                         | XP  | Secret |
|------------------------|-----------------------------------------------------|-----|--------|
| 🔮 **Voyant Débutant** | Consulter la boule de cristal pour la première fois | 50  | Non    |
| 🌟 **Médium Confirmé** | Poser 50 questions à la boule de cristal            | 100 | Non    |
| ✨ **Oracle**           | Poser 200 questions à la boule de cristal           | 300 | Non    |

### 🎯 Choix Aléatoire (/choose)

| Achievement                    | Description                            | XP  | Secret |
|--------------------------------|----------------------------------------|-----|--------|
| 🎯 **Premier Choix**           | Utiliser /choose pour la première fois | 50  | Non    |
| 🤔 **Indécis Chronique**       | Utiliser /choose 50 fois               | 100 | Non    |
| 🎲 **Délégateur de Décisions** | Utiliser /choose 200 fois              | 200 | Non    |

### 🔤 Art ASCII (/ascii)

| Achievement          | Description                   | XP  | Secret |
|----------------------|-------------------------------|-----|--------|
| 🔤 **Artiste ASCII** | Créer sa première œuvre ASCII | 50  | Non    |
| ✍️ **Typographe**    | Créer 25 œuvres ASCII         | 100 | Non    |
| 🎨 **Maître ASCII**  | Créer 100 œuvres ASCII        | 200 | Non    |

### 🥒 Concombre (/cucumber)

| Achievement                 | Description                                      | XP  | Secret  |
|-----------------------------|--------------------------------------------------|-----|---------|
| 🥒 **Première Mesure**      | Mesurer son concombre pour la première fois      | 50  | Non     |
| 🔬 **Scientifique**         | Mesurer son concombre 25 fois... pour la science | 100 | Non     |
| 🤯 **Concombre Légendaire** | Obtenir 25cm (le maximum)                        | 300 | **Oui** |
| 🔬 **Micro Concombre**      | Obtenir 1cm (le minimum)                         | 300 | **Oui** |

### 🎪 Achievements Globaux

| Achievement              | Description                                        | XP  | Secret |
|--------------------------|----------------------------------------------------|-----|--------|
| 🎪 **Touche-à-Tout Fun** | Essayer toutes les commandes fun au moins une fois | 200 | Non    |
| 🎉 **Accro au Fun**      | Utiliser 500 commandes fun au total                | 500 | Non    |

---

## 🔧 Implémentation Technique

### Nouveau Fichier de Données

Les statistiques des commandes fun sont stockées dans :

```
data/fun_command_stats.json
```

Structure :

```json
{
  "userId": {
    "username": "nom",
    "slots": 0,
    "ship": 0,
    "dice": 0,
    "coinflip": 0,
    "crystalball": 0,
    "choose": 0,
    "ascii": 0,
    "cucumber": 0,
    "meme": 0,
    "total": 0,
    "lastUpdate": 1234567890
  }
}
```

### Fonctions de Tracking

Chaque commande fun appelle maintenant sa fonction de tracking :

- `trackSlotsAchievements(userId, username, symbols, client?, channelId?)`
- `trackShipAchievements(userId, username, compatibility, client?, channelId?)`
- `trackDiceAchievements(userId, username, diceType, result, client?, channelId?)`
- `trackCoinflipAchievements(userId, username, result, client?, channelId?)`
- `trackCrystalballAchievements(userId, username, client?, channelId?)`
- `trackChooseAchievements(userId, username, client?, channelId?)`
- `trackAsciiAchievements(userId, username, client?, channelId?)`
- `trackCucumberAchievements(userId, username, size, client?, channelId?)`
- `trackMemeAchievements(userId, username, client?, channelId?)`

### Migration des Achievements Meme

Les achievements meme ont été déplacés de NETRICSA vers FUN :

**Anciens IDs :**

- `netricsa_meme_10` → `fun_meme_10`
- `netricsa_meme_50` → `fun_meme_50`
- `netricsa_meme_200` → `fun_meme_200`

**Fichiers mis à jour :**

- `achievementService.ts` : Définition des achievements
- `netricsaAchievementChecker.ts` : Vérification des achievements
- `achievementStartupChecker.ts` : Vérification au démarrage

---

## 🎮 Commandes Concernées

Toutes ces commandes déclenchent maintenant le tracking d'achievements :

1. `/slots` - Machine à sous
2. `/ship` - Test de compatibilité
3. `/rollthedice` - Lancer de dés
4. `/coinflip` - Pile ou face
5. `/crystalball` - Boule de cristal
6. `/choose` - Choix aléatoire
7. `/ascii` - Art ASCII
8. `/cucumber` - Mesure de concombre
9. `/findmeme` - Recherche de meme

---

## 📊 Statistiques

### Total des Achievements Fun

- **38 achievements** au total dans la catégorie FUN
- **7 achievements secrets** avec récompenses XP élevées
- **31 achievements normaux** progressifs

### Répartition XP

| Niveau        | XP         | Nombre |
|---------------|------------|--------|
| Débutant      | 50 XP      | 9      |
| Intermédiaire | 100-200 XP | 22     |
| Expert        | 300-500 XP | 6      |
| Légendaire    | 1000 XP    | 1      |

---

## 🎯 Achievements Spéciaux à Débloquer

### Les Plus Rares

1. **⚡ Sur la Tranche !** (1000 XP) - Probabilité 0.1%
2. **💎 Chance Légendaire** (500 XP) - Obtenir 7️⃣7️⃣7️⃣
3. **🎉 Accro au Fun** (500 XP) - 500 commandes fun
4. **🤯 Concombre Légendaire** (300 XP) - Obtenir exactement 25cm
5. **💗 Match Parfait** (300 XP) - 100% de compatibilité

### Les Plus Faciles

1. Tous les achievements "**première fois**" (50 XP chacun)
2. **🎪 Touche-à-Tout Fun** (200 XP) - Essayer chaque commande une fois

---

## ✅ Tests Recommandés

1. ✅ Vérifier que chaque commande fun déclenche le tracking
2. ✅ Tester les achievements secrets (777, tranche, 25cm, etc.)
3. ✅ Vérifier l'achievement "Touche-à-Tout Fun"
4. ✅ Tester l'achievement "Accro au Fun" (500 commandes)
5. ✅ Vérifier que les anciens achievements meme fonctionnent toujours

---

## 🔄 Migration des Données

**Important :** Les utilisateurs qui avaient déjà débloqué des achievements meme avec les anciens IDs (`netricsa_meme_*`) devront les débloquer à nouveau avec les nouveaux IDs (`fun_meme_*`).

**Solution :** Un script de migration pourrait être créé si nécessaire pour transférer les anciens déblocages vers les nouveaux IDs.

---

## 📝 Notes

- Tous les achievements fun utilisent le même système de récompenses saisonnières que les autres catégories
- Les achievements secrets donnent des récompenses de type "large" (rare)
- Les achievements normaux donnent des récompenses de type "medium" (uncommon)
- Le tracking est automatique et ne nécessite aucune action de l'utilisateur



