# 🎯 ÉVÉNEMENT : DÉFI DU COMPTEUR

## 📋 Vue d'ensemble

Le **Défi du Compteur** est un événement aléatoire temporaire qui challenge la communauté à atteindre un nombre spécifique dans le compteur avant la fin du temps imparti.

---

## ✨ Fonctionnement

### Déclenchement

- **Automatique** : L'événement peut se déclencher aléatoirement
- **Manuel** : L'owner peut déclencher l'événement avec `/test-event type:Défi du Compteur`

### Durée

- **30 minutes** à partir du déclenchement

### Objectif

- Atteindre un nombre **aléatoire** entre +50 et +200 par rapport au compteur actuel
- Exemple : Si le compteur est à 150, l'objectif sera entre 200 et 350

---

## 🎮 Déroulement

### 1. Création du Canal

Au déclenchement, une catégorie `🎉┃ÉVÉNEMENTS` est créée (si elle n'existe pas déjà) **en haut du serveur**, puis un canal textuel d'événement est créé dedans :

```
📁 🎉┃ÉVÉNEMENTS
   └─ 🎯┃défi-compteur
```

### 2. Message des Règles

Le premier message du canal explique :

- L'objectif à atteindre
- Le temps restant (affichage dynamique Discord)
- La récompense (500 XP)
- L'état actuel du compteur
- La progression

**Exemple de message :**

```
🎯 DÉFI DU COMPTEUR !

Un défi temporaire vient d'apparaître !

Objectif : Atteindre 250 dans le compteur !
Temps limite : Dans 30 minutes
Récompense : Le premier à atteindre exactement 250 gagne 500 XP ! 🏆

État actuel : Le compteur est à 150
Progression : 0/100 nombres restants

🏃 Rendez-vous dans #compteur et commencez à compter !

*Cet événement se terminera automatiquement dans 30 minutes ou dès que l'objectif est atteint.*
```

### 3. Participation

- Les utilisateurs comptent normalement dans le salon `#compteur`
- Le système vérifie automatiquement si le nombre cible est atteint
- **Le canal reste en lecture seule** (pas de spam)

### 4. Victoire

Dès que quelqu'un atteint **exactement** le nombre cible :

- Un message de victoire est envoyé dans le canal de l'événement
- Le gagnant reçoit **500 XP** immédiatement
- Le canal se ferme **10 secondes après**

**Message de victoire :**

```
🏆 DÉFI COMPLÉTÉ !

🎉 @Username a atteint l'objectif de 250 !

Récompense : 500 XP 💎

*Le canal se fermera dans quelques instants...*
```

### 5. Fin de l'Événement

Le canal est automatiquement supprimé après :

- **10 secondes** si l'objectif est atteint
- **30 minutes** si le temps est écoulé (pas de gagnant)

---

## 🎁 Récompenses

### Gagnant

- **500 XP** au premier qui atteint le nombre exact
- Notification de level up si applicable
- Enregistrement dans l'historique des événements

### Participants

- Progression normale du compteur
- XP normale des contributions au compteur (1 XP par nombre)
- Achievements du compteur si débloqués

---

## 💡 Stratégie

### Pour Gagner

1. **Soyez présent** quand l'événement se déclenche
2. **Coordonnez-vous** avec les autres dans le vocal
3. **Calculez** combien de nombres il reste
4. **Participez activement** mais respectez les règles (pas deux fois de suite)

### Conseils

- Surveillez le salon pour les nouveaux événements
- Activez les notifications pour `@everyone`
- Le compteur doit suivre les règles normales (pas deux fois de suite)
- Si quelqu'un fait une erreur, le compteur reset et l'objectif devient impossible

---

## 🔧 Détails Techniques

### Structure du Canal

- **Nom** : `🎯┃défi-compteur`
- **Position** : En haut du serveur (position 0)
- **Permissions** :
    - Tous peuvent voir
    - Tous peuvent lire l'historique
    - Personne ne peut envoyer de messages (lecture seule)

### Données Sauvegardées

```json
{
  "id": "counter_1738889600000",
  "type": "counter_challenge",
  "channelId": "123456789",
  "startTime": 1738889600000,
  "endTime": 1738891400000,
  "data": {
    "targetCount": 250,
    "startCount": 150,
    "winnerId": null
  }
}
```

### Vérification

- Après chaque nombre valide dans le compteur
- Compare avec `data.targetCount`
- Si égal et pas encore de gagnant → Victoire !

---

## 📊 Statistiques

### Enregistrement

Chaque événement complété est enregistré dans l'historique :

```json
{
  "eventId": "counter_1738889600000",
  "type": "counter_challenge",
  "timestamp": 1738891200000,
  "participants": [
    "userId1"
  ],
  "winners": [
    "userId1"
  ]
}
```

### Potentielles Stats Futures

- Nombre de défis complétés
- Taux de réussite
- Joueur avec le plus de victoires
- Temps moyen pour compléter

---

## ⚠️ Cas Particuliers

### Reset du Compteur Pendant l'Événement

Si le compteur reset pendant l'événement :

- L'objectif devient **impossible** à atteindre
- L'événement continue jusqu'à expiration (30 min)
- Pas de gagnant
- Le canal se ferme automatiquement

### Plusieurs Événements

- **Un seul défi compteur** peut être actif à la fois
- Si un défi est déjà actif, impossible d'en lancer un autre
- Évite les conflits et la confusion

### Bot Offline

Si le bot redémarre pendant un événement :

- L'événement persiste (données sauvegardées)
- La vérification continue
- Le timer continue
- À expiration, le canal est supprimé

---

## 🎯 Variantes Futures Possibles

### Difficulté Variable

- **Facile** : +20 à +50 nombres (15 min, 250 XP)
- **Moyen** : +50 à +100 nombres (30 min, 500 XP) ← Actuel
- **Difficile** : +100 à +200 nombres (60 min, 1000 XP)

### Récompenses Progressives

- Top 3 reçoivent des XP
- Tous les participants reçoivent un petit bonus

### Mode Communautaire

- Objectif très élevé
- Tous les participants gagnent si atteint
- Encourage la coopération

---

## 📝 Commandes Associées

### `/test-event`

**Réservé à l'owner**

- Déclenche manuellement un événement pour tester
- Paramètre : `type` → `counter_challenge`
- Utile pour debugger ou créer de l'animation

**Exemple :**

```
/test-event type:Défi du Compteur
```

---

## ✅ Checklist d'Implémentation

- [x] Système de création de canal en haut du serveur
- [x] Message des règles avec embed
- [x] Vérification automatique du nombre cible
- [x] Distribution de la récompense XP
- [x] Message de victoire
- [x] Suppression automatique du canal
- [x] Timer de 30 minutes
- [x] Sauvegarde de l'historique
- [x] Commande de test pour l'owner
- [x] Intégration avec le service du compteur
- [ ] Planification aléatoire (à venir)
- [ ] Notifications push (optionnel)
- [ ] Statistiques détaillées (à venir)

---

## 🎉 Impact Attendu

### Engagement

- ✅ Encourage l'utilisation du compteur
- ✅ Crée de l'excitation et de l'urgence
- ✅ Favorise l'interaction communautaire
- ✅ Donne un objectif clair et limité dans le temps

### XP

- **500 XP** pour le gagnant (équivalent à ~71 messages)
- Récompense substantielle mais pas excessive
- Encourage la participation active

### Communauté

- Crée des moments de rassemblement
- Encourage la coordination en vocal
- Ajoute de l'imprévisibilité et du fun
- Récompense la rapidité et l'attention

---

**Le premier événement aléatoire est prêt ! 🎯🎉**
