# 📦 ÉVÉNEMENT : COLIS MYSTÈRE

## 📋 Vue d'ensemble

Le **Colis Mystère** est un événement aléatoire qui récompense un utilisateur actif choisi au hasard avec de l'XP bonus envoyé directement en message privé.

---

## ✨ Fonctionnement

### Déclenchement

- **Automatique** : L'événement peut se déclencher aléatoirement (à implémenter)
- **Manuel** : L'owner peut tester l'embed avec `/test-event type:Colis Mystère (test embed)`

### Sélection du Gagnant

- Un utilisateur est choisi **aléatoirement** parmi les utilisateurs **actifs dans les dernières 24h**
- Exclusions :
    - Les bots
    - Netricsa
    - Les utilisateurs ayant désactivé les colis mystère

### Récompense

- XP aléatoire entre **50 et 200 XP**
- Envoyé directement en **message privé (DM)**

---

## 🎮 Déroulement

### 1. Sélection

Le système :

1. Récupère tous les utilisateurs avec `lastUpdate` dans les dernières 24h
2. Exclut les bots et ceux ayant désactivé l'événement
3. Choisit aléatoirement un utilisateur parmi les éligibles

### 2. Envoi du Colis

Un message privé est envoyé au gagnant :

```
📦 COLIS MYSTÈRE REÇU !

Tu as reçu un colis mystère ! 🎁

Contenu : 150 XP 💎

Ce colis a été livré aléatoirement parmi les utilisateurs actifs du serveur.

🍀 C'est ton jour de chance !

Tu peux désactiver les colis mystère avec /event-preferences
```

**Couleur** : Or (#F6AD55)

### 3. Distribution de l'XP

- L'XP est automatiquement ajouté au compte de l'utilisateur
- Pas de notification publique (discrétion)
- L'utilisateur peut level up normalement

### 4. Historique

- L'événement est enregistré dans l'historique
- Type : `MYSTERY_BOX`
- Participant et gagnant : Le même utilisateur

---

## 🎁 Récompenses

### Montant

- **Minimum** : 50 XP
- **Maximum** : 200 XP
- **Moyenne** : ~125 XP

### Équivalence

- 50 XP = ~7 messages
- 200 XP = ~29 messages
- Récompense substantielle pour une surprise !

---

## 🔧 Détails Techniques

### Critères d'Éligibilité

```typescript
// Utilisateur éligible si :
-lastUpdate > now - 24
h  // Actif dans les dernières 24h
- !username.includes('bot')  // Pas un bot
- userId !== '1462959115528835092'  // Pas Netricsa
- !userPreferences[userId].disableMysteryBox  // N'a pas désactivé
```

### Gestion des DMs Fermés

- Si l'utilisateur a ses DMs fermés :
    - Le message ne peut pas être envoyé
    - L'événement est **annulé** pour cet utilisateur
    - Log d'avertissement généré
    - Pas de pénalité pour l'utilisateur

### Fonction de Test

```typescript
// Pour tester l'embed sans donner d'XP
await testMysteryBoxEmbed(client, userId);
```

- Envoie uniquement l'embed
- **Ne donne pas d'XP** (pour les tests)
- Génère quand même un montant aléatoire (pour le visuel)

---

## 📊 Statistiques

### Enregistrement

Chaque colis mystère est enregistré :

```json
{
  "eventId": "mysterybox_1738889600000",
  "type": "mystery_box",
  "timestamp": 1738889600000,
  "participants": [
    "userId"
  ],
  "winners": [
    "userId"
  ]
}
```

### Potentielles Stats Futures

- Nombre de colis mystère reçus par utilisateur
- XP total reçu via colis mystère
- Utilisateur le plus chanceux
- Taux de livraison (DMs ouverts vs fermés)

---

## ⚙️ Préférences Utilisateur

### Commande `/event-preferences` (à implémenter)

Permet de gérer les préférences d'événements :

```
/event-preferences mysterybox:désactiver
→ Ne plus recevoir de colis mystère

/event-preferences mysterybox:activer
→ Réactiver les colis mystère
```

### Stockage

```json
{
  "userPreferences": {
    "userId": {
      "disableMysteryBox": true,
      "disableImpostor": false
    }
  }
}
```

---

## 💡 Stratégie d'Activation

### Fréquence Recommandée

- **1-2 fois par jour** pour garder l'aspect "surprise"
- Heures aléatoires pour imprévisibilité
- Éviter les heures creuses (nuit)

### Timing Optimal

- **Matin** (8h-11h) : Utilisateurs se connectant
- **Midi** (12h-14h) : Pause déjeuner
- **Soir** (18h-22h) : Période de forte activité

### Variantes Possibles

- **Mini Colis** : 25-75 XP (plus fréquent)
- **Colis Standard** : 50-200 XP (actuel)
- **Méga Colis** : 300-500 XP (très rare, événements spéciaux)

---

## 🎯 Avantages de l'Événement

### Pour les Utilisateurs

✅ **Surprise agréable** sans effort  
✅ **Récompense l'activité** récente  
✅ **Pas intrusif** (DM privé)  
✅ **Chance égale** pour tous les actifs  
✅ **Désactivable** pour ceux qui ne veulent pas

### Pour le Serveur

✅ **Encourage l'activité** quotidienne  
✅ **Crée de l'excitation** et de l'imprévisibilité  
✅ **Récompense passive** (pas de tâche à faire)  
✅ **Pas de spam** dans les salons publics  
✅ **Facile à implémenter** (pas de canal temporaire)

---

## 🔄 Différences avec les Autres Événements

| Aspect        | Colis Mystère | Défi Compteur             |
|---------------|---------------|---------------------------|
| Participation | Passive       | Active                    |
| Notification  | DM privé      | Canal public              |
| Durée         | Instantané    | 30 minutes                |
| Gagnants      | 1 aléatoire   | Premier à atteindre       |
| XP            | 50-200        | 500 fixe                  |
| Effort requis | Aucun         | Participation au compteur |

---

## 🚀 Utilisation

### Test de l'Embed (Owner)

```
/test-event type:Colis Mystère (test embed)
```

- Envoie l'embed à l'owner
- **Ne donne pas d'XP**
- Permet de vérifier le visuel

### Lancement Manuel (Owner, à implémenter)

```
/test-event type:Colis Mystère
```

- Sélectionne un utilisateur aléatoire
- Donne vraiment l'XP
- Enregistre dans l'historique

### Planification Automatique (à implémenter)

- Intégration dans le système de planification d'événements
- Déclenchement aléatoire selon la fréquence configurée
- Vérification qu'il y a des utilisateurs éligibles

---

## ⚠️ Cas Particuliers

### Aucun Utilisateur Éligible

- Si aucun utilisateur actif dans les dernières 24h
- L'événement est **annulé silencieusement**
- Log d'information généré
- Réessai plus tard

### DMs Fermés

- Si le gagnant a ses DMs fermés
- Le message ne peut pas être envoyé
- L'XP **n'est pas donné** (colis perdu)
- Log d'avertissement généré
- Possibilité future : choisir un autre utilisateur

### Bot Offline

- L'événement ne peut pas se déclencher
- Reprend normalement au redémarrage
- Pas d'accumulation (pas de rattrapage)

---

## 📝 Checklist d'Implémentation

- [x] Fonction `startMysteryBox()`
- [x] Sélection d'utilisateurs actifs
- [x] Exclusion des bots et Netricsa
- [x] Génération d'XP aléatoire (50-200)
- [x] Envoi de DM avec embed
- [x] Distribution automatique de l'XP
- [x] Gestion des DMs fermés
- [x] Enregistrement dans l'historique
- [x] Fonction de test `testMysteryBoxEmbed()`
- [x] Intégration dans `/test-event`
- [ ] Système de préférences utilisateur `/event-preferences`
- [ ] Planification automatique
- [ ] Annonce optionnelle dans #général
- [ ] Statistiques détaillées

---

## 🎨 Personnalisation Future

### Variantes Thématiques

- **Noël** : Cadeau de Noël 🎄 (150-300 XP)
- **Halloween** : Bonbons mystérieux 🍬 (50-150 XP)
- **Anniversaire du serveur** : Colis spécial 🎂 (200-500 XP)

### Rareté

- **Commun** (70%) : 50-100 XP
- **Rare** (25%) : 100-150 XP
- **Épique** (4%) : 150-200 XP
- **Légendaire** (1%) : 300-500 XP

### Messages Personnalisés

- Selon le montant d'XP
- Selon le niveau de l'utilisateur
- Selon la rareté du colis

---

## ✅ Résumé

L'événement **Colis Mystère** est maintenant **opérationnel** et offre :

- ✅ **Surprise agréable** pour les utilisateurs actifs
- ✅ **Récompense aléatoire** de 50-200 XP
- ✅ **Envoi en DM** pour rester discret
- ✅ **Gestion des préférences** (désactivable)
- ✅ **Fonction de test** sans donner d'XP
- ✅ **Prêt pour la planification automatique**

**La fonction de test est accessible via `/test-event type:Colis Mystère (test embed)` !** 📦✨

L'événement encourage l'activité quotidienne de manière passive et agréable, sans nécessiter d'effort de la part des utilisateurs ! 🎁
