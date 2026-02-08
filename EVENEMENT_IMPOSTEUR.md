# 🕵️ ÉVÉNEMENT : IMPOSTEUR

## 📋 Vue d'ensemble

L'événement **Imposteur** est un événement secret où un utilisateur actif est choisi aléatoirement et doit accomplir 3 missions discrètes dans un délai de 2 heures sans se faire remarquer.

---

## ✨ Fonctionnement

### Déclenchement

- **Automatique** : L'événement peut se déclencher aléatoirement (à implémenter)
- **Test** : `/test-event type:Imposteur (test embed)` - Envoie uniquement l'embed à l'owner sans créer d'événement

### Sélection de l'Imposteur

- Un utilisateur est choisi **aléatoirement** parmi les utilisateurs **actifs dans les dernières 24h**
- Exclusions :
    - Les bots
    - Netricsa
    - Les utilisateurs ayant désactivé les missions imposteur
- **Mode test** : L'owner est toujours choisi

### Missions

- **3 missions secrètes** choisies aléatoirement parmi 10 possibles
- Durée : **2 heures** pour compléter toutes les missions
- Récompense : **400 XP** si toutes les missions sont complétées

---

## 🎮 Déroulement

### 1. Création du Canal de Chasse

Quand l'événement démarre, un canal **🔍┃chasse-imposteur** est créé dans la catégorie `🎉┃ÉVÉNEMENTS` :

```
🔍 CHASSE À L'IMPOSTEUR !

Un imposteur se cache parmi vous... 🕵️

Quelqu'un a reçu une mission secrète et doit agir discrètement.
Saurez-vous le démasquer ?

⚠️ Règles de dénonciation :
• Vous pouvez dénoncer un suspect en cliquant sur le bouton ci-dessous
• Bon guess : +200 XP 💎 (l'imposteur échoue sa mission)
• Mauvais guess : -50 XP 💔
• Vous ne pouvez dénoncer qu'une seule fois
• Attendez 30 minutes avant de pouvoir dénoncer (laisser l'imposteur agir)

Fin de l'événement : Dans 2 heures

🤫 Observez attentivement... Qui agit étrangement ?

[Bouton : 🔍 Dénoncer un suspect]
```

### 2. Notification de l'Imposteur

L'utilisateur choisi reçoit un **message privé** :

```
🕵️ MISSION IMPOSTEUR !

Tu as été secrètement choisi comme IMPOSTEUR ! 🎭

Ta mission : Accomplir les 3 tâches suivantes discrètement dans les 2 prochaines heures :

1️⃣ Envoyer 5 messages dans différents salons
2️⃣ Réagir à 3 messages différents
3️⃣ Utiliser une commande de Netricsa

⚠️ Règles :
• Agis naturellement - Ne te fais pas remarquer !
• Personne d'autre ne sait que tu es l'imposteur
• Tu as jusqu'à [heure] pour compléter

Récompense : 400 XP 💎

⏰ Temps limite : Dans 2 heures
```

**Couleur** : Rouge (#ED4245)

### 2. Canal de Chasse (Public)

Un canal **🔍┃chasse-imposteur** est créé dans `🎉┃ÉVÉNEMENTS` avec :

- Embed explicatif des règles
- Bouton **🔍 Dénoncer un suspect**
- Timer visible jusqu'à la fin

### 3. Système de Guess

#### Comment dénoncer un suspect ?

1. Cliquer sur le bouton **🔍 Dénoncer un suspect** dans le canal
2. Sélectionner un utilisateur dans le menu déroulant
3. Attendre le résultat

#### Règles du Guess

- ⏰ **Cooldown** : 5 minutes après le début (laisser l'imposteur agir)
- 🎯 **Une seule tentative** par personne et par événement
- ✅ **Bon guess** : +200 XP pour le détective, 0 XP pour l'imposteur (mission échouée)
- ❌ **Mauvais guess** : -50 XP pour celui qui accuse

#### Si l'imposteur est découvert :

```
🎉 IMPOSTEUR DÉMASQUÉ !

@Détective a démasqué l'imposteur ! 🕵️

L'imposteur était @Imposteur !

Récompense du détective : 200 XP 💎
L'imposteur a échoué sa mission et ne gagne rien. 💔

*Le canal se fermera dans 1 minute...*
```

L'imposteur reçoit aussi un DM :

```
😰 TU AS ÉTÉ DÉMASQUÉ !

@Détective t'a démasqué ! 🔍

Ta mission a échoué et tu ne gagnes aucune récompense.

Sois plus discret la prochaine fois ! 🤫
```

### 4. Fin de l'Événement

#### Succès (missions complétées) :

```
🎉 MISSION IMPOSTEUR RÉUSSIE !

Félicitations ! Tu as accompli toutes tes missions secrètes sans te faire remarquer ! 🕵️

Récompense : 400 XP 💎

Tu es un véritable maître de la discrétion ! 😎
```

**Couleur** : Vert (#57F287)

- XP distribué automatiquement
- Enregistré dans l'historique

#### Échec (temps écoulé) :

```
⏰ MISSION IMPOSTEUR ÉCHOUÉE

Le temps est écoulé ! Tu n'as pas accompli toutes tes missions à temps. 😔

Dommage ! Tu pourras réessayer lors d'une prochaine mission.

Mieux vaut être plus rapide la prochaine fois ! 🏃
```

**Couleur** : Rouge (#ED4245)

- Pas d'XP distribué
- Pas d'enregistrement dans l'historique

---

## 🎯 Missions Possibles

Liste des 10 missions aléatoires :

1. **Envoyer 5 messages dans différents salons**
2. **Réagir à 3 messages différents**
3. **Utiliser une commande de Netricsa**
4. **Envoyer un message contenant un emoji**
5. **Répondre à un message de quelqu'un d'autre**
6. **Envoyer un GIF ou une image**
7. **Mentionner quelqu'un dans un message**
8. **Rejoindre un salon vocal pendant 2 minutes**
9. **Envoyer un message de plus de 50 caractères**
10. **Utiliser /daily ou /challenges**

Chaque événement sélectionne **3 missions aléatoires** parmi ces 10.

---

## 💎 Récompenses

### Imposteur

- **En cas de succès** (missions complétées sans être découvert) : **400 XP**
- **En cas d'échec** : Aucune récompense
- **Si découvert** : Aucune récompense (mission échouée)

### Détectives

- **Bon guess** (trouve l'imposteur) : **+200 XP** 💎
- **Mauvais guess** : **-50 XP** 💔

### Équivalences

- 400 XP (imposteur) = ~57 messages
- 200 XP (détective) = ~29 messages
- -50 XP (mauvais guess) = pénalité de ~7 messages

---

## 🎮 Commandes

- `/impostor-complete` - Marquer la mission comme complétée
- `/test-event type:Imposteur (test embed)` - Tester l'embed (owner uniquement)

---

## ⚙️ Configuration

**Éligibilité** : Utilisateurs actifs dans les dernières 24h (excluant bots et Netricsa)  
**Désactivation** : Via `/event-preferences impostor:désactiver` (à implémenter)  
**Fichier** : `data/random_events.json`

---

## ✅ Résumé

L'événement **Imposteur** est maintenant **opérationnel** et offre :

- ✅ **Missions secrètes** pour un utilisateur aléatoire
- ✅ **3 missions** parmi 10 possibles
- ✅ **2 heures** pour compléter
- ✅ **400 XP** en cas de succès
- ✅ **DM privé** pour la discrétion
- ✅ **Fonction de test** sans créer d'événement
- ✅ **Commande de complétion** `/impostor-complete`
- ✅ **Gestion des préférences** (désactivable)

**Les fonctions de test sont accessibles via `/test-event type:Imposteur (test embed)` !** 🕵️✨

L'événement ajoute une dimension de roleplay et de défi personnel unique qui encourage l'activité variée sur le serveur ! 🎭
