# 🎮 Service de Notifications de Jeux Gratuits

## 📋 Description

Ce service permet au bot Discord de surveiller et notifier automatiquement les jeux gratuits disponibles sur différentes plateformes (Steam, Epic Games, GOG, etc.) via l'API FreeStuff.

## ⚙️ Configuration

### 1. Variables d'environnement (.env)

Ajoutez les variables suivantes dans votre fichier `.env` :

```bash
# Salon pour les notifications de jeux gratuits
FREE_GAMES_CHANNEL_ID=829523675594096650

# Clé API FreeStuff (à obtenir sur https://freestuffbot.xyz/partner)
FREESTUFF_API_KEY=VOTRE_CLE_API_ICI
```

### 2. Obtenir une clé API FreeStuff

Pour obtenir une clé API FreeStuff :

1. Visitez [https://freestuffbot.xyz/partner](https://freestuffbot.xyz/partner)
2. Suivez les instructions pour devenir partenaire
3. Récupérez votre clé API
4. Ajoutez-la dans votre fichier `.env`

## 🔧 Fonctionnalités

- ✅ Vérification automatique des jeux gratuits toutes les heures
- ✅ Notifications avec embed stylisé contenant :
    - Titre du jeu
    - Description
    - Image de couverture
    - Plateforme (Steam, Epic, GOG, etc.)
    - Prix original
    - Date de fin de la promotion
    - Lien vers la page du jeu
- ✅ Évite les notifications en double
- ✅ Logs détaillés

## 📁 Fichiers

- **`src/services/freeGamesService.ts`** : Service principal
- **`data/free_games_state.json`** : État des jeux déjà notifiés
- **`src/utils/envConfig.ts`** : Configuration des variables d'environnement
- **`.env`** : Variables d'environnement

## 🚀 Utilisation

Le service s'initialise automatiquement au démarrage du bot si :

- `FREE_GAMES_CHANNEL_ID` est configuré
- `FREESTUFF_API_KEY` est configuré et valide

Aucune commande manuelle n'est nécessaire.

## 📊 Exemple de notification

```
🎮 Tomb Raider - GRATUIT !
━━━━━━━━━━━━━━━━━━━━
Une aventure épique dans les tombes anciennes...

Plateforme: Steam
Prix original: 19.99 €
Disponible jusqu'à: dans 5 jours

🔗 Récupérer le jeu
```

## 🔄 À compléter

**Documentation API FreeStuff nécessaire pour finaliser l'implémentation :**

- Endpoints API
- Format des réponses
- Authentification
- Rate limits
- Structure des données des jeux

Collez la documentation complète de l'API FreeStuff pour que l'implémentation soit finalisée.

## 📝 Notes

- Le service vérifie les nouveaux jeux toutes les heures par défaut
- L'intervalle peut être modifié dans `freeGamesService.ts` (constante `CHECK_INTERVAL`)
- Les jeux déjà notifiés sont stockés dans `data/free_games_state.json`

