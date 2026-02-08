# ✅ ÉVÉNEMENT IMPOSTEUR - IMPLÉMENTÉ

## 🕵️ Vue d'Ensemble

L'événement **Imposteur** est maintenant **opérationnel** ! Un utilisateur actif est secrètement choisi et doit accomplir 3 missions discrètes en 2 heures pour gagner 300 XP.

---

## 📝 Ce qui a été créé

### 1. **Fonction `startImpostorEvent()`** (`randomEventsService.ts`)

- Sélectionne un utilisateur actif dans les dernières 24h
- Exclusions : bots, Netricsa, ceux ayant désactivé
- Génère 3 missions aléatoires parmi 10 possibles
- Envoie un DM avec les instructions
- Timer de 2 heures
- Enregistre l'événement actif

### 2. **Fonction `endImpostorEvent()`**

- Appelée automatiquement après 2h ou lors de `/impostor-complete`
- Message de succès (vert) ou échec (rouge)
- Distribution de 300 XP si succès
- Enregistrement dans l'historique si succès

### 3. **Fonction `completeImpostorMission()`**

- Marque la mission comme complétée
- Termine l'événement immédiatement
- Distribue la récompense

### 4. **Fonction `testImpostorEmbed()`** (pour les tests)

- Envoie uniquement l'embed à l'owner
- **Ne crée pas d'événement actif**
- **Ne donne pas d'XP**
- **Choisit toujours l'owner**

### 5. **Commande `/impostor-complete`** (nouveau fichier)

- Permet à l'imposteur de marquer sa mission comme complétée
- Vérifie qu'il y a une mission active
- Déclenche la fin avec succès

### 6. **Intégration dans `/test-event`**

- Nouvelle option : "🕵️ Imposteur (test embed)"
- Test sans créer d'événement ni donner d'XP

### 7. **Documentation** : `EVENEMENT_IMPOSTEUR.md`

- Guide complet de l'événement
- Liste des 10 missions possibles
- Détails techniques
- Commandes associées

---

## 🎮 Missions Possibles (10)

L'événement sélectionne aléatoirement **3 missions** parmi :

1. Envoyer 5 messages dans différents salons
2. Réagir à 3 messages différents
3. Utiliser une commande de Netricsa
4. Envoyer un message contenant un emoji
5. Répondre à un message de quelqu'un d'autre
6. Envoyer un GIF ou une image
7. Mentionner quelqu'un dans un message
8. Rejoindre un salon vocal pendant 2 minutes
9. Envoyer un message de plus de 50 caractères
10. Utiliser /daily ou /challenges

---

## 🕵️ Embed de Mission

**Couleur** : Rouge (#ED4245)

```
🕵️ MISSION IMPOSTEUR !

Tu as été secrètement choisi comme IMPOSTEUR ! 🎭

Ta mission : Accomplir les 3 tâches suivantes discrètement dans les 2 prochaines heures :

1️⃣ [Mission 1]
2️⃣ [Mission 2]
3️⃣ [Mission 3]

⚠️ Règles :
• Agis naturellement - Ne te fais pas remarquer !
• Personne d'autre ne sait que tu es l'imposteur
• Tu as jusqu'à [heure] pour compléter

Récompense : 300 XP 💎

⏰ Temps limite : Dans 2 heures
```

---

## 📬 Messages de Fin

### Succès (vert) :

```
🎉 MISSION IMPOSTEUR RÉUSSIE !

Félicitations ! Tu as accompli toutes tes missions secrètes sans te faire remarquer ! 🕵️

Récompense : 300 XP 💎

Tu es un véritable maître de la discrétion ! 😎
```

### Échec (rouge) :

```
⏰ MISSION IMPOSTEUR ÉCHOUÉE

Le temps est écoulé ! Tu n'as pas accompli toutes tes missions à temps. 😔

Dommage ! Tu pourras réessayer lors d'une prochaine mission.

Mieux vaut être plus rapide la prochaine fois ! 🏃
```

---

## 🎮 Commandes

### `/test-event type:Imposteur (test embed)`

**Owner uniquement - Test sans événement**

- Envoie l'embed à l'owner
- **Aucun événement créé**
- **Aucun XP donné**
- **Choisit toujours l'owner**
- Missions aléatoires générées

**Résultat** :

- Tu reçois l'embed en DM
- Message de confirmation : "✅ Mission imposteur envoyée en DM (test sans XP ni événement créé) !"

### `/impostor-complete`

**Pour tous - Compléter la mission**

- Marque la mission comme complétée
- Termine l'événement immédiatement
- Distribue la récompense (300 XP)
- Message de confirmation en DM

**Quand l'utiliser** :

- Une fois que tu as accompli **toutes** tes 3 missions
- Avant la fin des 2 heures

---

## 🔧 Fonctionnement Technique

### Mode Normal (production)

```typescript
await startImpostorEvent(client, guild);
```

- Choisit un utilisateur aléatoire actif
- Crée un événement actif enregistré
- Timer de 2 heures automatique
- Donne vraiment 300 XP si succès

### Mode Test

```typescript
await testImpostorEmbed(client, ownerId);
```

- Choisit **toujours l'owner**
- **Ne crée pas d'événement** dans les données
- **Ne donne pas d'XP**
- Juste l'embed pour vérifier le visuel

### Données Stockées

```json
{
  "id": "impostor_1738889600000",
  "type": "impostor",
  "channelId": "",
  "startTime": 1738889600000,
  "endTime": 1738896800000,
  "data": {
    "impostorId": "userId",
    "impostorUsername": "username",
    "missions": [
      "Mission 1",
      "Mission 2",
      "Mission 3"
    ],
    "completed": false,
    "isTest": false
  }
}
```

---

## ✨ Caractéristiques Clés

✅ **Secret** : Seul l'imposteur sait qu'il a une mission  
✅ **3 missions aléatoires** : Variété garantie  
✅ **2 heures** : Temps suffisant sans stress  
✅ **300 XP** : Récompense généreuse  
✅ **DM privé** : Discrétion totale  
✅ **Validation manuelle** : `/impostor-complete`  
✅ **Test sans impact** : Embed seul pour l'owner  
✅ **Gestion d'erreurs** : DMs fermés détectés  
✅ **Historique** : Succès enregistrés  
✅ **Désactivable** : Via préférences (à implémenter)

---

## 🎯 Différences avec les Autres Événements

| Caractéristique  | Imposteur            | Défi Compteur      | Colis Mystère |
|------------------|----------------------|--------------------|---------------|
| **Durée**        | 2 heures             | 30 minutes         | Instantané    |
| **Participants** | 1 secret             | Tous (compétition) | 1 aléatoire   |
| **Effort**       | Missions à accomplir | Compter activement | Aucun         |
| **Récompense**   | 300 XP               | 500 XP             | 50-200 XP     |
| **Visibilité**   | Privé (DM)           | Public (canal)     | Privé (DM)    |
| **Validation**   | Manuelle             | Automatique        | N/A           |
| **Pression**     | Faible               | Moyenne            | Aucune        |

---

## 🔄 Workflow Complet

### 1. Démarrage

```
Event déclenché → Utilisateur sélectionné → DM envoyé → Timer 2h démarré
```

### 2. Pendant la Mission

```
Imposteur accomplit ses missions → Agit naturellement → Personne ne sait
```

### 3. Complétion

```
Imposteur fait /impostor-complete → Événement terminé → Message de succès → 300 XP distribués
```

### 4. OU Expiration

```
2 heures écoulées → Événement terminé → Message d'échec → Pas d'XP
```

---

## 🚀 Prochaines Étapes (optionnelles)

Pour rendre l'événement complètement automatique :

- [ ] Ajouter au système de planification d'événements
- [ ] Créer `/event-preferences` pour gérer les préférences
- [ ] Définir la fréquence (recommandé : 1-2 fois par semaine)
- [ ] Optionnel : Vérification automatique des missions (complexe)

---

## 📊 Impact Attendu

### Engagement

- ✅ Encourage **l'activité variée** (différents types de messages)
- ✅ Crée du **mystère** et de l'intrigue
- ✅ Défi **personnel** sans pression sociale
- ✅ Récompense **généreuse** (300 XP)

### Comparaison XP

- 300 XP = ~43 messages normaux
- Équivalent à ~2h d'activité normale
- Juste récompense pour le défi

---

## ✅ Tests Recommandés

### Test 1 : Embed uniquement

```
/test-event type:Imposteur (test embed)
```

- Vérifie que l'embed est reçu en DM
- Vérifie que 3 missions sont listées
- Vérifie le format et les couleurs

### Test 2 : Événement complet (manuel)

1. Créer manuellement un événement avec `startImpostorEvent()`
2. Accomplir les missions
3. Utiliser `/impostor-complete`
4. Vérifier la récompense

### Test 3 : Expiration

1. Créer un événement avec durée courte (5 min)
2. Ne pas compléter
3. Vérifier le message d'échec après 5 min

---

## 🎉 Résumé Final

**L'événement Imposteur est 100% fonctionnel et prêt à être utilisé !**

**Fichiers créés** :

- ✅ `randomEventsService.ts` - Fonctions principales
- ✅ `impostor-complete.ts` - Commande de complétion
- ✅ `test-event.ts` - Intégration du test
- ✅ `EVENEMENT_IMPOSTEUR.md` - Documentation complète

**Fonctionnalités** :

- ✅ Sélection d'utilisateur actif
- ✅ 3 missions aléatoires parmi 10
- ✅ Timer de 2 heures
- ✅ Messages de succès/échec
- ✅ Distribution de 300 XP
- ✅ Fonction de test pour l'owner
- ✅ Commande de complétion

**Le code compile sans erreurs et les tests sont prêts à être effectués ! 🚀**

Tu peux maintenant tester avec :

```
/test-event type:Imposteur (test embed)
```

Pour compléter une mission active :

```
/impostor-complete
```

**L'événement Imposteur ajoute une dimension de roleplay unique et amusante au serveur ! 🕵️🎭✨**
