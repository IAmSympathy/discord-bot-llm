# 🎯 SYSTÈME DE DÉFIS QUOTIDIENS

## 📋 Vue d'ensemble

Le système de défis quotidiens (`/challenges`) offre aux utilisateurs 3 défis aléatoires chaque jour pour gagner de l'XP bonus en restant actifs sur le serveur.

---

## ✨ Fonctionnalités

### 🔄 Renouvellement Automatique

- **3 nouveaux défis** générés chaque jour à minuit
- Les défis sont **aléatoires** parmi 21 défis possibles
- La progression se **réinitialise** chaque jour

### 📊 Suivi de Progression

- Progression en **temps réel** basée sur les statistiques du jour
- Barre de progression visuelle
- Indication claire du statut (⬜ Pas commencé, 🔄 En cours, ✅ Complété)

### 💎 Récompenses

- **XP bonus** pour chaque défi complété
- Les récompenses varient de **50 à 250 XP** selon la difficulté
- Maximum possible : **450 XP par jour** (si les 3 défis les plus difficiles)

---

## 🎮 Types de Défis

### 💬 Défis Messages (50-150 XP)

- **Bavard** : Envoyer 5 messages (50 XP)
- **Causeur** : Envoyer 10 messages (100 XP)
- **Grand Parleur** : Envoyer 20 messages (150 XP)

### 👍 Défis Réactions (50-100 XP)

- **Réactif** : Ajouter 10 réactions (50 XP)
- **Super Réactif** : Ajouter 25 réactions (100 XP)

### 🎤 Défis Vocal (75-250 XP)

- **Causette Vocale** : Passer 15 minutes en vocal (75 XP)
- **Bavardage Vocal** : Passer 30 minutes en vocal (150 XP)
- **Marathon Vocal** : Passer 1 heure en vocal (250 XP)

### 🎮 Défis Jeux (75-150 XP)

- **Joueur** : Jouer 3 parties (75 XP)
- **Gamer** : Jouer 5 parties (125 XP)
- **Victorieux** : Gagner 2 parties (150 XP)

### 🎨 Défis Images (75-150 XP)

- **Artiste du Jour** : Générer 1 image (75 XP)
- **Créateur Actif** : Générer 3 images (150 XP)

### 🔢 Défis Compteur (75-150 XP)

- **Compteur Pro** : Contribuer 5 fois (75 XP)
- **Maître du Compteur** : Contribuer 10 fois (150 XP)

### 🤖 Défis IA (75-125 XP)

- **Causeur avec Netricsa** : 3 conversations (75 XP)
- **Ami de Netricsa** : 5 conversations (125 XP)

### ⚡ Défis Commandes (50 XP)

- **Commandant** : Utiliser 5 commandes (50 XP)

---

## 🎯 Utilisation

### Commande

```
/challenges
```

### Ce que vous verrez :

1. **Liste des 3 défis du jour** avec :
    - Nom et description du défi
    - Barre de progression visuelle
    - Progression actuelle (ex: 3/10)
    - Récompense en XP
    - Statut (⬜/🔄/✅)

2. **Messages spéciaux** :
    - 🎉 Félicitations si vous venez de compléter un/des défi(s)
    - 🏆 Message spécial si tous les défis sont complétés

### Distribution automatique des récompenses

- L'XP est **automatiquement donnée** quand vous utilisez `/challenges`
- Vous n'avez pas besoin de "claim" manuellement
- Chaque défi ne peut être complété qu'**une seule fois par jour**

---

## 📊 Système de Progression

### Comment ça fonctionne :

1. À minuit, 3 nouveaux défis sont générés aléatoirement
2. Votre progression est calculée en **temps réel** depuis minuit
3. Quand vous atteignez l'objectif, le défi passe à ✅ COMPLÉTÉ
4. La prochaine fois que vous utilisez `/challenges`, vous recevez l'XP

### Exemple :

```
Défi : "Envoyer 10 messages"
- Vous aviez 50 messages hier
- Aujourd'hui vous en avez 58
- Progression du défi : 8/10 🔄
- Après 2 messages de plus : 10/10 ✅ COMPLÉTÉ !
- Prochain `/challenges` : +100 XP
```

---

## 🎨 Interface Visuelle

### Barre de Progression

```
▰▰▰▰▰▰▰▱▱▱ 7/10
```

- **▰** : Portion complétée
- **▱** : Portion restante
- 10 segments au total

### Codes Couleur

- 🔵 **Bleu** : Défis en cours
- 🟢 **Vert** : Au moins un défi complété aujourd'hui
- 🟡 **Or** : Tous les défis complétés !

---

## 💡 Conseils

### Optimiser vos Gains

1. Vérifiez vos défis **dès le matin** pour planifier votre journée
2. Combinez les activités (ex: jouer aux jeux + discuter en vocal)
3. Les défis vocaux donnent beaucoup d'XP mais prennent du temps
4. Les défis messages/réactions sont faciles et rapides

### Stratégies

- **Joueur occasionnel** : Visez les défis courts (messages, réactions, commandes)
- **Joueur actif** : Combinez plusieurs défis à la fois
- **Joueur hardcore** : Tentez de compléter les 3 défis chaque jour !

---

## 🔧 Détails Techniques

### Fichier de données

- `data/daily_challenges.json`
- Contient les défis du jour et la progression de tous les utilisateurs
- Se réinitialise automatiquement à minuit

### Compatibilité

- Fonctionne avec le système de statistiques existant
- Compatible avec tous les autres systèmes (XP, achievements, etc.)
- Pas de conflit avec la commande `/daily`

### Sécurité

- Impossible de tricher (progression basée sur les vraies stats)
- Chaque défi ne peut être complété qu'une fois par jour
- Les récompenses sont distribuées une seule fois

---

## 🆚 Différence avec `/daily`

| Feature    | `/daily`               | `/challenges`           |
|------------|------------------------|-------------------------|
| Récompense | XP fixe + bonus streak | XP variable selon défis |
| Objectif   | Réclamer chaque jour   | Compléter des activités |
| Complexité | Simple (1 clic)        | Interactif (3 défis)    |
| Streak     | Oui                    | Non                     |
| Contenu    | Identique chaque jour  | Change chaque jour      |

**Recommandation** : Utilisez les **deux** !

- `/daily` pour votre récompense de connexion quotidienne
- `/challenges` pour l'XP bonus en étant actif

---

## 📈 Impact sur la Progression

### XP Quotidien Potentiel

- **Minimum** : 150 XP (3 défis faciles)
- **Moyen** : 250 XP (mix de défis)
- **Maximum** : 450 XP (3 défis difficiles)

### Comparaison avec autres sources

- `/daily` : 50-600 XP (avec streak)
- Messages : 7 XP par message
- Jeux : 3-20 XP par partie
- **Défis** : 150-450 XP supplémentaires !

### Avantages

✅ Encourage la variété d'activités  
✅ Récompense l'engagement quotidien  
✅ Bonus substantiel sans être excessif  
✅ Ajoute de la rejouabilité

---

## 🎯 Objectifs du Système

1. **Encourager l'activité quotidienne** diversifiée
2. **Récompenser l'engagement** au-delà de la simple présence
3. **Ajouter de la variété** pour éviter la monotonie
4. **Créer des objectifs** clairs et atteignables
5. **Renforcer le sentiment de progression**

---

## 🚀 Prochaines Améliorations Possibles

- [ ] Défis hebdomadaires (récompenses plus grandes)
- [ ] Défis d'équipe (coopération entre joueurs)
- [ ] Défis spéciaux pour événements
- [ ] Historique des défis complétés
- [ ] Succès liés aux défis (ex: "Compléter 30 jours de défis")
- [ ] Bonus pour les streaks de jours consécutifs

---

## ✅ Résumé

Le système de défis quotidiens enrichit l'expérience utilisateur en :

- Offrant des **objectifs quotidiens variés**
- Récompensant la **diversité des activités**
- Ajoutant une **dimension stratégique** à la progression
- Renforçant l'**engagement communautaire**

**Commencez dès aujourd'hui avec `/challenges` !** 🎯
