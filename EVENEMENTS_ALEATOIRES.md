# 📋 ÉVÉNEMENTS ALÉATOIRES - VUE D'ENSEMBLE

## 🎉 Introduction

Les **événements aléatoires** sont des activités temporaires qui apparaissent sur le serveur pour encourager l'interaction, créer de la surprise et récompenser les utilisateurs actifs.

---

## 🎯 Événements Disponibles

### 1. 🎯 Défi du Compteur

**Type** : Compétitif public  
**Durée** : 30 minutes  
**Récompense** : 500 XP pour le gagnant

Un objectif aléatoire (+100 à +250) est fixé dans le compteur. Le premier à l'atteindre exactement gagne !

➡️ [Documentation complète](EVENEMENT_DEFI_COMPTEUR.md)

---

### 2. 📦 Colis Mystère

**Type** : Passif aléatoire  
**Durée** : Instantané  
**Récompense** : 50-200 XP (ou 🖕 1% de chance)

Un utilisateur actif choisi aléatoirement reçoit un colis mystère en DM avec de l'XP bonus.

➡️ [Documentation complète](EVENEMENT_COLIS_MYSTERE.md)

---

### 3. 🕵️ Imposteur

**Type** : Social/Déduction  
**Durée** : 2 heures  
**Récompense** : 400 XP (imposteur) / 200 XP (détective)

Un utilisateur reçoit secrètement 3 missions à accomplir. Les autres peuvent tenter de le démasquer !

➡️ [Documentation complète](EVENEMENT_IMPOSTEUR.md)

---

## 📊 Comparaison des Événements

| Événement            | Durée      | Participants       | XP Max | Type   | Visibilité  |
|----------------------|------------|--------------------|--------|--------|-------------|
| 🎯 **Défi Compteur** | 30 min     | Tous (compétition) | 500    | Actif  | Public      |
| 📦 **Colis Mystère** | Instantané | 1 aléatoire        | 200    | Passif | DM privé    |
| 🕵️ **Imposteur**    | 2 heures   | 1 secret + tous    | 400    | Social | Public + DM |

---

## 🎮 Comment Participer

### Événements Actifs

Les événements actifs créent un canal temporaire dans la catégorie **🎉┃ÉVÉNEMENTS** en haut du serveur :

- 🎯┃défi-compteur
- 🔍┃chasse-imposteur

### Événements Passifs

Les événements passifs se passent en **DM** sans canal public :

- 📦 Colis Mystère

### Annonces

Tous les événements (sauf Colis Mystère) sont annoncés dans **#général** sans ping.

---

## 🔧 Commandes

### Pour les Utilisateurs

- `/impostor-complete` - Marquer les missions imposteur comme complétées

### Pour l'Owner (Tests)

- `/test-event type:Défi du Compteur` - Lance un défi compteur
- `/test-event type:Colis Mystère (test embed)` - Envoie l'embed de colis en DM
- `/test-event type:Imposteur (test embed)` - Envoie l'embed imposteur en DM

---

## ⚙️ Préférences Utilisateur

### `/event-preferences` (à implémenter)

Permet de désactiver certains événements :

- `mysterybox:désactiver` - Ne plus recevoir de colis mystère
- `impostor:désactiver` - Ne plus recevoir de missions imposteur

---

## 🎨 Système de Canaux Temporaires

### Catégorie ÉVÉNEMENTS

Tous les événements publics créent leurs canaux dans `🎉┃ÉVÉNEMENTS` :

- Créée automatiquement en haut du serveur
- Position : 0 (toujours visible)
- Supprimée automatiquement quand le dernier événement se termine

### Cycle de Vie

1. **Création** : Canal créé avec embed informatif
2. **Actif** : Les utilisateurs participent
3. **Fin** : Message d'expiration ou de victoire
4. **Suppression** : 1 minute après la fin
5. **Nettoyage** : Catégorie supprimée si vide

---

## 📈 Statistiques

Tous les événements enregistrent :

- **Historique** : Événements complétés
- **Participants** : Qui a participé
- **Gagnants** : Qui a gagné (si applicable)
- **Timestamp** : Quand l'événement s'est déroulé

Fichier : `data/random_events.json`

---

## 🚀 Planification Automatique (À Venir)

Les événements pourront se déclencher automatiquement selon :

- **Fréquence** configurée
- **Heures actives** du serveur
- **Nombre d'utilisateurs** en ligne
- **Cooldown** entre événements

---

## 📝 Fichiers Techniques

### Code Source

- `src/services/randomEventsService.ts` - Logique principale
- `src/commands/test-event/` - Commande de test
- `src/commands/impostor-complete/` - Complétion imposteur

### Données

- `data/random_events.json` - Événements actifs et historique

### Documentation

- `EVENEMENTS_ALEATOIRES.md` - Ce fichier (vue d'ensemble)
- `EVENEMENT_DEFI_COMPTEUR.md` - Documentation détaillée
- `EVENEMENT_COLIS_MYSTERE.md` - Documentation détaillée
- `EVENEMENT_IMPOSTEUR.md` - Documentation détaillée
- `SYSTEME_GUESS_IMPOSTEUR.md` - Documentation du système de guess

---

## 🎯 Roadmap

### Implémenté ✅

- [x] Défi du Compteur
- [x] Colis Mystère
- [x] Imposteur avec système de guess
- [x] Catégorie temporaire
- [x] Messages d'expiration
- [x] Commandes de test
- [x] Système de guess avec boutons

### À Implémenter 🚧

- [ ] Système de préférences `/event-preferences`
- [ ] Planification automatique
- [ ] Mini Boss
- [ ] Mega Boss
- [ ] Mot Mystère
- [ ] Événements saisonniers (Noël, Halloween, etc.)

---

## 💡 Contribution

Pour ajouter un nouvel événement :

1. Créer la fonction dans `randomEventsService.ts`
2. Ajouter au `EventType` enum
3. Créer la documentation dans `EVENEMENT_[NOM].md`
4. Ajouter l'option dans `/test-event` si nécessaire
5. Mettre à jour ce fichier

---

## 📞 Support

Pour toute question sur les événements :

- Consulter la documentation spécifique de chaque événement
- Utiliser `/test-event` pour tester en tant qu'owner
- Vérifier `data/random_events.json` pour l'état actuel

---

**Les événements aléatoires ajoutent de l'imprévisibilité et du fun au serveur ! 🎉✨**

*Dernière mise à jour : 7 février 2026*
