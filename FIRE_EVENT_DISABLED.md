# Événement Feu de Foyer et Système Saisonnier - DÉSACTIVÉ

Date de désactivation : 2026-02-17

## Résumé des modifications

L'événement saisonnier "Feu de Foyer" et le système de récompenses saisonnières ont été désactivés complètement. Voici les modifications apportées :

## Fichiers modifiés

### 1. **src/bot.ts**

- ❌ Désactivation de `initializeFireSystem(client)`
- ❌ Désactivation de `initializeSeasonEndCheck(client)`
- ❌ Désactivation des boutons d'interaction :
    - `fire_add_log`
    - `fire_use_protection`

### 2. **src/services/xpSystem.ts**

- ❌ Désactivation du multiplicateur XP global du feu de foyer
- Le multiplicateur XP est maintenant fixe à 1.0 (pas de bonus)

### 3. **src/commands/harvest/harvest.ts**

- ❌ Commande `/harvest` désactivée
- Retourne un message indiquant que l'événement est terminé
- Code original commenté pour référence future

### 4. **src/utils/seasonalStatsEmbed.ts**

- ❌ L'embed des statistiques saisonnières retourne maintenant un message de désactivation
- Imports inutilisés nettoyés

### 5. **src/services/seasonal/fireButtonHandler.ts**

- ❌ Bouton "Ajouter une bûche" désactivé
- Retourne un message de désactivation
- Code original commenté

### 6. **src/services/seasonal/fireProtectionHandler.ts**

- ❌ Bouton "Utiliser Stuff à Feu" désactivé
- Retourne un message de désactivation
- Fonctions inutilisées supprimées pour éviter les erreurs de compilation

### 7. **src/utils/statsEmbedBuilder.ts** (NOUVEAU)

- ❌ Bouton "Saisonnier" retiré de la navigation des statistiques
- Seul le bouton "Serveur" reste dans la deuxième ligne

### 8. **src/commands/profile/profile.ts** (NOUVEAU)

- ❌ Handler du bouton `stats_seasonal` commenté

### 9. **src/commands/context/userProfile.ts** (NOUVEAU)

- ❌ Handler du bouton `stats_seasonal` commenté

### 10. **src/services/rewardService.ts** (NOUVEAU)

- ❌ **Obtention automatique d'items de saison désactivée**
- La fonction `tryRandomSeasonalReward()` retourne toujours `false`
- Plus aucun item saisonnier n'est donné automatiquement (messages, vocal, réactions, commandes, jeux, Netricsa)

## Ce qui n'est PAS supprimé

✅ Tous les fichiers de données sont conservés :

- `data/seasonal_fire.json`
- `data/fire_cooldowns.json`
- `data/seasonal_user_stats.json`

✅ Tous les services et fichiers de gestion sont conservés :

- `src/services/seasonal/fireManager.ts`
- `src/services/seasonal/fireData.ts`
- `src/services/seasonal/fireDataManager.ts`
- `src/services/seasonal/fireSeasonManager.ts`
- `src/services/rewardService.ts` (fonction désactivée mais fichier conservé)
- etc.

✅ Le code est commenté, pas supprimé, pour faciliter la réactivation future

## Comment réactiver l'événement

Pour réactiver l'événement Feu de Foyer et les récompenses saisonnières :

1. Décommenter les lignes dans `src/bot.ts` (lignes ~187-193)
2. Décommenter les boutons d'interaction dans `src/bot.ts` (lignes ~820-829)
3. Décommenter le multiplicateur XP dans `src/services/xpSystem.ts` (lignes ~221-231)
4. Restaurer le code original dans :
    - `src/commands/harvest/harvest.ts`
    - `src/utils/seasonalStatsEmbed.ts`
    - `src/services/seasonal/fireButtonHandler.ts`
    - `src/services/seasonal/fireProtectionHandler.ts`
5. Décommenter le bouton "Saisonnier" dans `src/utils/statsEmbedBuilder.ts`
6. Décommenter les handlers dans `src/commands/profile/profile.ts` et `src/commands/context/userProfile.ts`
7. Restaurer la fonction `tryRandomSeasonalReward()` dans `src/services/rewardService.ts`

Ou consulter l'historique Git avant la désactivation pour restaurer les fichiers.

## Messages utilisateur

Lorsqu'un utilisateur tente d'utiliser une fonctionnalité désactivée, il verra :

```
🔒 Fonctionnalité désactivée

L'événement du Feu de Foyer est actuellement désactivé.

🔥 L'événement du Feu de Foyer est terminé pour cette saison.
Cette fonctionnalité reviendra lors d'une prochaine saison hivernale ! ❄️

Restez à l'écoute pour les prochains événements !
```

## Impact sur le jeu

### Désactivations du Feu de Foyer

- ❌ Plus de salon vocal "💫 Multiplicateur XP"
- ❌ Plus de salon textuel "#feu-de-foyer"
- ❌ Plus de commande `/harvest`
- ❌ Plus de multiplicateur XP global (fixé à ×1.0)
- ❌ Plus de boutons d'interaction pour le feu

### Désactivations du système saisonnier (NOUVEAU)

- ❌ Plus de bouton "Saisonnier" dans les statistiques du profil
- ❌ **Plus d'obtention automatique d'items de saison** :
    - Plus de récompenses pour les messages (était 3%)
    - Plus de récompenses pour le temps vocal (était 0.1%)
    - Plus de récompenses pour les réactions (était 1%)
    - Plus de récompenses pour les commandes (était 8%)
    - Plus de récompenses pour les victoires aux jeux (était 5%)
    - Plus de récompenses pour les commandes Netricsa (était 15%)

### Ce qui fonctionne toujours

- ✅ Les autres fonctionnalités du bot fonctionnent normalement
- ✅ L'inventaire est toujours accessible via `/profile` → 🎒 Inventaire
- ✅ Les items déjà dans l'inventaire sont conservés
- ✅ Les achievements fonctionnent toujours normalement


