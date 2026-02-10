# 📊 Intégration des Leaderboards Quotidiens et Hebdomadaires

## 📅 Date : 2026-02-09

---

## 🎯 Fonctionnalité Implémentée

Le système de leaderboard `/leaderboard` inclut maintenant les classements **quotidiens** et **hebdomadaires**, en plus des classements mensuel et all-time existants.

---

## ✨ Nouveaux Modes de Classement

### Modes Disponibles

| Mode              | Emoji | Période      | Description                             |
|-------------------|-------|--------------|-----------------------------------------|
| **Aujourd'hui**   | 📆    | Quotidien    | Classement du jour actuel               |
| **Cette semaine** | 📅    | Hebdomadaire | Classement de la semaine ISO en cours   |
| **Ce mois-ci**    | 📅    | Mensuel      | Classement du mois en cours (existant)  |
| **All-Time**      | 📊    | Total        | Classement de tous les temps (existant) |

---

## 🎮 Utilisation

### Commande de Base

```
/leaderboard
```

### Navigation par Boutons

1. **Ligne 1 - Catégories** :
    - 🏆 XP
    - 📨 Messages
    - 🎤 Vocal
    - 🎨 Images
    - 🎮 Jeux

2. **Ligne 2 - Modes Temporels** (NOUVEAU) :
    - 📊 All-Time
    - 📆 Aujourd'hui ← NOUVEAU
    - 📅 Cette semaine ← NOUVEAU
    - 📅 Ce mois-ci

---

## 📊 Affichage des Classements

### Classement Quotidien (Aujourd'hui)

```
🏆 Classement XP - 📅 Quotidien (Aujourd'hui)

```

🥇 User1 1,250 XP 🎤45min
🥈 User2 980 XP 🎤30min
🥉 User3 750 XP
#4 User4 520 XP 🎤15min
#5 User5 310 XP

```
```

**Caractéristiques** :

- Affiche l'XP gagné **aujourd'hui uniquement**
- Montre les **minutes vocales** si l'utilisateur a passé du temps en vocal
- Reset automatiquement à minuit

---

### Classement Hebdomadaire (Cette semaine)

```
🏆 Classement XP - 📅 Hebdomadaire (Cette semaine)

```

🥇 User1 8,450 XP 🎤320min
🥈 User2 6,890 XP 🎤180min
🥉 User3 5,230 XP 🎤90min
#4 User4 3,120 XP
#5 User5 2,870 XP 🎤60min

```
```

**Caractéristiques** :

- Affiche l'XP gagné **cette semaine** (semaine ISO)
- Total des **minutes vocales** de la semaine
- Reset automatiquement le lundi à 00:00

---

### Classement Mensuel (Ce mois-ci)

```
🏆 Classement XP - 📅 Mensuel (Février 2026)

```

🥇 User1 35,240 XP
🥈 User2 28,150 XP
🥉 User3 21,890 XP
#4 User4 18,450 XP
#5 User5 15,320 XP

```
```

**Inchangé** : Fonctionne comme avant, sans affichage des minutes vocales.

---

### Classement All-Time

```
🏆 Classement XP - 📊 All-Time

```

🥇 User1 Niv.45 250,450 XP
🥈 User2 Niv.42 198,320 XP
🥉 User3 Niv.38 142,890 XP
#4 User4 Niv.35 118,450 XP
#5 User5 Niv.32 98,320 XP

```
```

**Inchangé** : Affiche le total d'XP et le niveau.

---

## 🎤 Affichage des Minutes Vocales

### Dans les Classements Daily/Weekly

Les minutes vocales sont affichées **seulement si l'utilisateur en a** :

```
🥇  User1            1,250 XP 🎤45min   ← A du temps vocal
🥈  User2              980 XP              ← Pas de temps vocal
🥉  User3              750 XP 🎤30min   ← A du temps vocal
```

**Format** :

- `🎤Xmin` pour moins de 60 minutes
- Calculé automatiquement depuis les statistiques

---

## 🔄 Reset Automatique

### Quotidien

- **Moment** : Tous les jours à 00:00 (minuit)
- **Données** : Conservées 30 jours
- **Nettoyage** : Automatique des anciennes données

### Hebdomadaire

- **Moment** : Tous les lundis à 00:00
- **Format** : Semaine ISO 8601 (2026-W06)
- **Données** : Conservées 12 semaines

### Mensuel

- **Moment** : Le 1er de chaque mois à 00:00
- **Données** : Conservées plusieurs mois

---

## 📁 Sources de Données

### Fichiers JSON

```
data/daily_xp.json    ← Statistiques quotidiennes
data/weekly_xp.json   ← Statistiques hebdomadaires
data/monthly_xp.json  ← Statistiques mensuelles (existant)
data/user_xp.json     ← Total all-time (existant)
```

### Structure Daily/Weekly

```json
{
  "2026-02-09": {
    "123456789": {
      "username": "User1",
      "xpGained": 1250,
      "voiceMinutes": 45
    }
  }
}
```

---

## ✨ Avantages

### 1. Engagement Quotidien

- Les utilisateurs voient leur **progression du jour**
- Encourage la **participation quotidienne**
- **Compétition friendly** renouvelée chaque jour

### 2. Objectifs Hebdomadaires

- Vue d'ensemble de la **semaine en cours**
- Permet de voir les **plus actifs de la semaine**
- Renouvellement chaque lundi

### 3. Transparence Complète

- **4 niveaux temporels** pour voir sa progression
- Du **court terme** (aujourd'hui) au **long terme** (all-time)
- Suivi du **temps vocal** inclus

---

## 🎯 Cas d'Usage

### Scénario 1 : Nouveau Membre

```
Lundi matin, un nouveau membre rejoint

/leaderboard → Mode: Aujourd'hui
🥇  NewMember         50 XP  ← Déjà dans le top !

/leaderboard → Mode: Cette semaine  
#12 NewMember         50 XP  ← Encore du chemin

/leaderboard → Mode: All-Time
#89 NewMember         50 XP  ← Normal, débute
```

**Motivation** : Peut être #1 du jour même en étant nouveau !

---

### Scénario 2 : Utilisateur Vocal

```
Passe 2 heures en vocal aujourd'hui

/leaderboard → Mode: Aujourd'hui
🥇  VocalUser       150 XP 🎤120min  ← Leader vocal !
```

**Reconnaissance** : Le temps vocal est visible et valorisé.

---

### Scénario 3 : Utilisateur Régulier

```
Actif tous les jours cette semaine

/leaderboard → Mode: Cette semaine
🥇  RegularUser   5,250 XP 🎤180min  ← Régularité payante
```

**Progression** : Voir l'accumulation sur la semaine.

---

## 🔧 Implémentation Technique

### Fichiers Modifiés

1. ✅ **`src/commands/leaderboard/leaderboard.ts`**
    - Ajout des types `"daily"` et `"weekly"` à `LeaderboardMode`
    - Import de `getDailyXP`, `getWeeklyXP`, `getCurrentDate`, `getCurrentWeek`
    - Ajout de la logique pour les modes daily/weekly dans `createLeaderboardEmbed`
    - Modification de l'affichage pour inclure les minutes vocales
    - Ajout des boutons "Aujourd'hui" et "Cette semaine"

2. ✅ **`src/services/dailyWeeklyXPService.ts`**
    - Export de `getCurrentDate()` et `getCurrentWeek()`
    - Fonctions déjà créées pour `getDailyXP()` et `getWeeklyXP()`

---

## 🧪 Tests

### Test Quotidien

1. **Gagner de l'XP** aujourd'hui
2. **Utiliser** `/leaderboard`
3. **Cliquer** sur "📆 Aujourd'hui"
4. **Vérifier** :
    - ✅ Votre nom apparaît avec l'XP d'aujourd'hui
    - ✅ Si vous étiez en vocal, les minutes s'affichent
    - ✅ Le titre indique "Quotidien (Aujourd'hui)"

### Test Hebdomadaire

1. **Accumuler de l'XP** sur plusieurs jours
2. **Utiliser** `/leaderboard`
3. **Cliquer** sur "📅 Cette semaine"
4. **Vérifier** :
    - ✅ L'XP total de la semaine s'affiche
    - ✅ Les minutes vocales de la semaine sont cumulées
    - ✅ Le titre indique "Hebdomadaire (Cette semaine)"

### Test de Reset

1. **Attendre minuit**
2. **Vérifier** `/leaderboard` mode "Aujourd'hui"
3. **Résultat attendu** : Nouveau classement vide/minimal

---

## 📊 Statistiques Disponibles

Pour chaque utilisateur, on peut maintenant voir :

| Période       | XP | Minutes Vocales | Niveau |
|---------------|----|-----------------|--------|
| Aujourd'hui   | ✅  | ✅               | ❌      |
| Cette semaine | ✅  | ✅               | ❌      |
| Ce mois-ci    | ✅  | ❌               | ❌      |
| All-Time      | ✅  | ❌               | ✅      |

**Note** : Le niveau n'est pertinent que pour all-time.

---

## 🎉 Résultat Final

Le système de leaderboard est maintenant **complet avec 4 niveaux temporels** :

- ✅ **Quotidien** - Compétition du jour
- ✅ **Hebdomadaire** - Vue de la semaine
- ✅ **Mensuel** - Classement du mois
- ✅ **All-Time** - Classement total

**Les utilisateurs peuvent maintenant suivre leur progression à court, moyen et long terme ! 📊✨**

---

## 🚀 Améliorations Futures Possibles

1. **Graphiques** : Afficher l'évolution sur plusieurs jours/semaines
2. **Achievements** : Débloquer des succès pour être #1 du jour/semaine
3. **Notifications** : Alerter quand on atteint le top 3
4. **Comparaison** : Comparer avec la semaine/journée précédente
5. **Filtres** : Par catégorie (vocal, messages, etc.) en daily/weekly

**Mais pour l'instant, le système est fonctionnel et prêt à l'emploi ! 🎯**

