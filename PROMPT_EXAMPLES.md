# 📋 Exemple de Prompt Complet Assemblé

Ce fichier montre comment un prompt complet sera assemblé avec les nouveaux formats.

## Scénario : Conversation Simple avec Historique

### Contexte

- **Utilisateur :** Alice (ID: 123456789)
- **Salon :** #général
- **Historique :** 3 messages passés
- **Message actuel :** "Tu fais quoi ?"

---

## 🔧 Prompt Assemblé (Tel que le LLM le reçoit)

```
[ROLE: SYSTEM]

Tu es Netricsa (Nettie), IA sarcastique et polyvalente du serveur Discord.

═══════════════════════════════════════════════════════════════════════════════
                            🎭 IDENTITÉ ET PERSONNALITÉ
═══════════════════════════════════════════════════════════════════════════════

TU ES : Une intelligence artificielle nommée Netricsa (surnommée "Nettie")
TON RÔLE : Assistant Discord conversationnel, créatif et informationnel

[... reste du system_prompt.txt ...]

═══ PROFIL DE L'UTILISATEUR ACTUEL: ALICE (UID Discord: 123456789) ═══
⚠️ Ce profil appartient à la personne qui t'envoie le message actuel.

👤 Pseudo Discord : Alice
🎮 Joue actuellement à : Minecraft
💬 Nombre de messages envoyés : 1,234
⭐ Niveau XP : 15 (2,450 XP)
🎨 Rôles Discord : Membre Actif, Gamer

Centres d'intérêt détectés : jeux vidéo, construction, créativité
Dernière activité : Il y a 5 minutes
═══ FIN DU PROFIL DE ALICE ═══


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 HISTORIQUE : Messages PASSÉS (déjà traités)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT : Les messages ci-dessous sont TERMINÉS et ont DÉJÀ reçu une réponse.
   → Utilise cet historique pour COMPRENDRE le contexte
   → NE RÉPÈTE PAS les salutations/questions déjà échangées
   → CONTINUE la conversation naturellement depuis ce point

[Salon : #général]
• Alice [il y a 10min] : "Salut Netricsa !"
  ↳ Tu as répondu : "👋 Hey Alice !"

• Bob [il y a 8min] : "Comment ça va ?"
  ↳ Tu as répondu : "😊 Ça roule ! Et vous ?"

• Alice [il y a 5min] : "Oui très bien merci !"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 FIN DE L'HISTORIQUE PASSÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


[ROLE: USER]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 MESSAGE ACTUEL → RÉPONDS À CECI MAINTENANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 UTILISATEUR : Alice
   └─ ID Discord : 123456789

📅 HORODATAGE : lundi 12 février 2026 à 14:30

📝 CONTENU DU MESSAGE :
   "Tu fais quoi ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 INSTRUCTIONS POUR TA RÉPONSE :
   → Ceci est le NOUVEAU message qui nécessite ta réponse MAINTENANT
   → L'historique ci-dessus te donne le CONTEXTE (ce qui s'est déjà passé)
   → Ne répète PAS ce qui est dans l'historique (salutations, questions déjà posées)
   → Réponds SPÉCIFIQUEMENT à CE message en tenant compte du contexte
   
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ✅ Réponse Attendue (Correcte)

```
💬 Je discute avec toi là ! Tu construis toujours ton château sur Minecraft ?
```

### Pourquoi c'est correct :

- ✅ Commence par un emoji
- ✅ Ne répète PAS "Salut" (déjà dans l'historique)
- ✅ Ne redemande PAS "Comment ça va ?" (Alice a déjà répondu "très bien")
- ✅ Répond directement à la question "Tu fais quoi ?"
- ✅ Fait référence à son profil (Minecraft) de manière naturelle
- ✅ Court et conversationnel (1 phrase)

---

## ❌ Réponses Incorrectes (Ancien Comportement)

### Erreur 1 : Répétition de Salutations

```
👋 Salut Alice ! Comment ça va ?
```

**Problème :** Resalue alors que l'échange de salutations est déjà dans l'historique.

### Erreur 2 : Reformulation

```
😊 Ah, tu me demandes ce que je fais ?
```

**Problème :** Reformule la question au lieu de répondre.

### Erreur 3 : Redémarrage

```
👋 Hey Alice ! Quoi de neuf ?
```

**Problème :** Redémarre la conversation comme si l'historique n'existait pas.

### Erreur 4 : Trop Long

```
😊 Eh bien, je suis en train de discuter avec toi et Bob ! Je m'occupe de répondre aux questions, d'aider les gens et de discuter. C'est plutôt sympa ! Et toi, qu'est-ce que tu fais de beau aujourd'hui ?
```

**Problème :** Trop long (devrait être 1-3 phrases), pose une question déjà répondue dans l'historique.

---

## 📊 Scénario 2 : Avec Images et Recherche Web

### Contexte

- **Utilisateur :** Bob (ID: 987654321)
- **Message :** "C'est quoi cette planète ?" [avec image de Jupiter]
- **Recherche Web :** Effectuée automatiquement

### Prompt Assemblé (Extrait)

```
[ROLE: SYSTEM]

[... system_prompt.txt ...]

═══ PROFIL DE L'UTILISATEUR ACTUEL: BOB (UID Discord: 987654321) ═══
⚠️ Ce profil appartient à la personne qui t'envoie le message actuel.

👤 Pseudo Discord : Bob
🎮 Joue actuellement à : Kerbal Space Program
💬 Nombre de messages envoyés : 567
⭐ Niveau XP : 12 (1,800 XP)
🎨 Rôles Discord : Membre, Scientifique Amateur

Centres d'intérêt détectés : espace, astronomie, sciences
═══ FIN DU PROFIL DE BOB ═══


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 CONTEXTE WEB (Recherche effectuée)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ INFORMATIONS RÉCENTES : Ces faits proviennent d'une recherche web en temps réel
   → Utilise ces informations pour répondre avec des données actualisées
   → Ces faits sont vérifiés et pertinents pour le message actuel

🔍 REQUÊTE DE RECHERCHE : "planète Jupiter caractéristiques"

📊 FAITS VÉRIFIÉS (5) :
   1. Jupiter est la plus grande planète du système solaire
   2. Diamètre : environ 142,984 km
   3. Composition : principalement hydrogène et hélium (géante gazeuse)
   4. Possède la Grande Tache Rouge, une tempête géante
   5. Au moins 95 lunes connues, dont Ganymède (la plus grande du système solaire)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 FIN DU CONTEXTE WEB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


[ROLE: USER]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 MESSAGE ACTUEL → RÉPONDS À CECI MAINTENANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 UTILISATEUR : Bob
   └─ ID Discord : 987654321

📅 HORODATAGE : lundi 12 février 2026 à 14:35

📝 CONTENU DU MESSAGE :
   "C'est quoi cette planète ?"

📎 MÉDIAS ATTACHÉS (1) :
   1. Image montrant Jupiter avec ses bandes nuageuses caractéristiques et la Grande Tache Rouge visible. La planète apparaît dans des tons oranges, bruns et blancs. Arrière-plan : espace noir étoilé.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 INSTRUCTIONS POUR TA RÉPONSE :
   → Ceci est le NOUVEAU message qui nécessite ta réponse MAINTENANT
   → L'historique ci-dessus te donne le CONTEXTE (ce qui s'est déjà passé)
   → Ne répète PAS ce qui est dans l'historique (salutations, questions déjà posées)
   → Réponds SPÉCIFIQUEMENT à CE message en tenant compte du contexte
   
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Réponse Attendue (Correcte)

```
🪐 C'est Jupiter ! La plus grosse planète du système solaire, avec ses bandes nuageuses et la fameuse Grande Tache Rouge (cette énorme tempête).
```

### Pourquoi c'est correct :

- ✅ Emoji approprié (🪐 planète)
- ✅ Répond directement en identifiant Jupiter
- ✅ Utilise les infos de l'analyse d'image (bandes nuageuses, Grande Tache Rouge)
- ✅ Utilise les infos du contexte web (plus grosse planète)
- ✅ Court et informatif (2 phrases)
- ✅ Pas de question inutile

---

## 📊 Scénario 3 : Thread avec Message d'Origine

### Contexte

- **Thread starter :** Charlie a posté "Quelqu'un sait comment optimiser Python ?"
- **Message actuel :** Alice répond dans le thread

### Prompt Assemblé (Extrait)

```
[ROLE: SYSTEM]

[... system_prompt.txt ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧵 MESSAGE D'ORIGINE DU THREAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CONTEXTE IMPORTANT : Ceci est le message qui a DÉMARRÉ ce thread.
   → C'est le SUJET PRINCIPAL de cette conversation
   → Tous les messages suivants sont des réponses à ce message initial

👤 AUTEUR : Charlie

📝 CONTENU :
Quelqu'un sait comment optimiser Python ? Mon script prend 10 secondes pour traiter 1000 lignes...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧵 FIN DU MESSAGE D'ORIGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


[... historique si existant ...]


[ROLE: USER]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 MESSAGE ACTUEL → RÉPONDS À CECI MAINTENANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 UTILISATEUR : Alice
   └─ ID Discord : 123456789

📅 HORODATAGE : lundi 12 février 2026 à 15:00

📝 CONTENU DU MESSAGE :
   "Utilise numpy au lieu de listes classiques"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[... instructions ...]
```

### Réponse Attendue (Correcte)

```
💡 Excellent conseil Alice ! NumPy est 10-100x plus rapide pour les opérations sur tableaux. Charlie, essaie de convertir tes listes en arrays numpy avec `np.array()` !
```

### Pourquoi c'est correct :

- ✅ Reconnaît le conseil d'Alice
- ✅ Fait le lien avec le problème de Charlie (message d'origine du thread)
- ✅ Donne des infos concrètes (10-100x plus rapide)
- ✅ Fournit une solution technique (`np.array()`)
- ✅ S'adresse aux deux personnes de manière naturelle

---

## 📊 Scénario 4 : Profils Multiples (Distinction Critique)

### Contexte

- **Utilisateur actuel :** David (joue à Valorant)
- **Message :** "À quoi joue Alice ?"
- **Profils fournis :** David (actuel) + Alice (mentionnée)

### Prompt Assemblé (Extrait)

```
[ROLE: SYSTEM]

[... system_prompt.txt ...]

═══ PROFIL DE L'UTILISATEUR ACTUEL: DAVID (UID Discord: 111222333) ═══
⚠️ Ce profil appartient à la personne qui t'envoie le message actuel.

👤 Pseudo Discord : David
🎮 Joue actuellement à : Valorant
💬 Nombre de messages envoyés : 890
⭐ Niveau XP : 18 (3,200 XP)

Centres d'intérêt détectés : FPS, compétition
═══ FIN DU PROFIL DE DAVID ═══


[ROLE: USER]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 MESSAGE ACTUEL → RÉPONDS À CECI MAINTENANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 UTILISATEUR : David
   └─ ID Discord : 111222333

📅 HORODATAGE : lundi 12 février 2026 à 15:15

📝 CONTENU DU MESSAGE :
   "À quoi joue Alice ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[... instructions ...]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PROFILS DES PERSONNES MENTIONNÉES (1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT : Ces profils concernent d'AUTRES personnes (PAS l'utilisateur actuel)
   → Utilise ces infos SEULEMENT si le message actuel parle de ces personnes
   → Ne confonds PAS ces profils avec celui de l'utilisateur actuel
   → Vérifie toujours l'UID pour identifier correctement chaque personne

═══ PROFIL DE ALICE (UID Discord: 123456789) ═══

👤 Pseudo Discord : Alice
🎮 Joue actuellement à : Minecraft
💬 Nombre de messages envoyés : 1,234
⭐ Niveau XP : 15 (2,450 XP)

Centres d'intérêt détectés : construction, créativité, jeux sandbox
═══ FIN PROFIL DE ALICE ═══

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FIN DES PROFILS MENTIONNÉS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Réponse Attendue (Correcte)

```
🎮 Alice joue à Minecraft en ce moment !
```

### Pourquoi c'est correct :

- ✅ Répond avec les infos du profil d'ALICE (section "Profils Mentionnés")
- ✅ Ne confond PAS avec le profil de David (utilisateur actuel)
- ✅ Court et direct

### ❌ Réponse Incorrecte (Ancien Comportement)

```
🎮 Tu joues à Valorant !
```

**Problème :** A confondu le profil de David (utilisateur actuel) avec celui d'Alice (personne mentionnée).

---

## 🎯 Résumé des Améliorations

### Structure Visuelle

- ✅ Séparateurs uniformes (`━━━`)
- ✅ Emojis identifiables pour chaque section
- ✅ Hiérarchie claire de l'information
- ✅ Instructions explicites avec ⚠️

### Clarté Temporelle

- ✅ "Messages PASSÉS" vs "MESSAGE ACTUEL"
- ✅ Timestamps précis (minutes/heures/jours)
- ✅ Format "↳ Tu as répondu" pour l'historique

### Contexte Enrichi

- ✅ Profils clairement séparés (actuel vs mentionnés)
- ✅ Contexte web avec requête visible
- ✅ Thread starter identifié comme sujet principal
- ✅ Médias décrits en détail

### Instructions Explicites

- ✅ Section "INSTRUCTIONS POUR TA RÉPONSE" dans chaque message actuel
- ✅ Rappels de ne pas répéter l'historique
- ✅ Guidance sur l'utilisation des profils
- ✅ Clarification sur la temporalité

