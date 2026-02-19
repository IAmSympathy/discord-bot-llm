# 🎮 Guide de Configuration - Service de Jeux Gratuits FreeStuff

## ✅ Ce qui a été implémenté

### 1. Service complet d'intégration FreeStuff API

- ✅ Connexion à l'API FreeStuff (v2)
- ✅ Support complet des webhooks en temps réel
- ✅ Gestion des annonces de jeux gratuits
- ✅ Embeds riches et stylisés par plateforme
- ✅ Prévention des notifications en double
- ✅ Persistance de l'état

### 2. Fichiers créés/modifiés

#### Nouveaux fichiers :

- `src/services/freeGamesService.ts` - Service principal
- `src/services/freeStuffWebhook.ts` - Serveur webhook Express
- `src/commands/check-free-games/check-free-games.ts` - Commande de test
- `data/free_games_state.json` - État/persistence
- `FREE_GAMES_SERVICE_README.md` - Documentation
- `FREESTUFF_CONFIGURATION_GUIDE.md` - Ce guide

#### Fichiers modifiés :

- `.env` - Ajout des variables de configuration
- `src/utils/envConfig.ts` - Ajout des propriétés
- `src/bot.ts` - Initialisation du service
- `package.json` - Ajout de express (automatique)

---

## 📋 Configuration requise

### Étape 1 : Obtenir une clé API FreeStuff

1. **Visitez le dashboard FreeStuff :**
    - URL : https://dashboard.freestuffbot.xyz/

2. **Créez un compte ou connectez-vous**

3. **Créez une nouvelle application**
    - Donnez-lui un nom (ex: "Netricsa Bot")
    - Notez votre clé API

4. **Configurer votre fichier `.env` :**
   ```env
   FREESTUFF_API_KEY=votre_clé_api_ici
   ```

### Étape 2 : Configurer le webhook (IMPORTANT)

L'API FreeStuff fonctionne principalement via webhooks pour les notifications en temps réel.

#### Option A : Serveur avec IP publique

Si votre bot tourne sur un serveur accessible depuis Internet :

1. **Votre URL webhook sera :**
   ```
   http://votre-ip-ou-domaine:3000/webhooks/freestuff
   ```

2. **Dans le dashboard FreeStuff :**
    - Allez dans les paramètres de votre app
    - Section "Webhook"
    - Entrez votre URL webhook
    - Choisissez la compatibility date : `2025-03-01`
    - Sélectionnez les événements :
        - ✅ `announcement_created`
        - ✅ `product_updated`
        - ✅ `ping`
    - Sauvegardez

3. **Testez le webhook :**
    - Cliquez sur "Send test ping"
    - Vérifiez les logs de votre bot

#### Option B : Serveur local (développement)

Si votre bot tourne en local, utilisez un tunnel :

**Avec ngrok (recommandé) :**

```bash
# Installer ngrok : https://ngrok.com/
ngrok http 3000
```

ngrok vous donnera une URL comme : `https://abc123.ngrok.io`

Votre URL webhook sera :

```
https://abc123.ngrok.io/webhooks/freestuff
```

**Avec Cloudflare Tunnel :**

```bash
cloudflared tunnel --url http://localhost:3000
```

**Note :** Les URLs de tunnel changent à chaque redémarrage en version gratuite.

#### Option C : Oracle Cloud (configuration finale)

Si vous déployez sur Oracle Cloud :

1. **Configurez le port dans les règles de pare-feu :**
   ```bash
   # Sur votre instance Oracle
   sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
   sudo netfilter-persistent save
   ```

2. **Ajoutez une règle ingress dans Oracle Cloud Console :**
    - Allez dans Networking > Virtual Cloud Networks
    - Sélectionnez votre VCN
    - Security Lists > Default Security List
    - Add Ingress Rule :
        - Source CIDR : `0.0.0.0/0`
        - IP Protocol : TCP
        - Destination Port Range : `3000`

3. **Votre URL webhook sera :**
   ```
   http://votre-ip-oracle:3000/webhooks/freestuff
   ```
   Ou si vous avez un domaine :
   ```
   http://netricsa-bot.duckdns.org:3000/webhooks/freestuff
   ```

### Étape 3 : Configuration du salon Discord

Dans votre `.env`, vérifiez que le salon est bien configuré :

```env
FREE_GAMES_CHANNEL_ID=829523675594096650
```

Ce salon recevra toutes les notifications de jeux gratuits.

---

## 🚀 Utilisation

### Démarrage automatique

Le service démarre automatiquement avec le bot. Vous verrez dans les logs :

```
[FreeGamesService] Initializing free games service...
[FreeGamesService] ✅ Free games service initialized and connected to FreeStuff API
[FreeGamesService] ℹ️  FreeStuff API works via webhooks for real-time notifications
[FreeGamesService] ℹ️  Configure your webhook URL at: https://dashboard.freestuffbot.xyz/
[FreeGamesService] ℹ️  Notifications will be sent to channel: 829523675594096650
[FreeStuffWebhook] ✅ FreeStuff webhook server listening on port 3000
```

### Test manuel

Utilisez la commande `/check-free-games` (administrateur uniquement) pour :

- ✅ Vérifier la connexion à l'API
- ✅ Tester votre configuration

### Réception des webhooks

Quand un nouveau jeu gratuit est disponible :

1. FreeStuff envoie un webhook à votre serveur
2. Le bot reçoit l'événement `announcement_created`
3. Pour chaque jeu de l'annonce :
    - Vérifie s'il n'a pas déjà été notifié
    - Filtre les produits "trash"
    - Crée un embed stylisé
    - Envoie dans le salon configuré

---

## 📊 Format des notifications

Les notifications incluent :

### Informations principales :

- 🎮 **Titre du jeu**
- 📝 **Description**
- 🖼️ **Image de couverture**
- 🔗 **Lien direct**

### Détails :

- **Type** : Jeu, DLC, Butin, etc.
- **Plateforme** : Steam, Epic, GOG, etc.
- **Prix** : Original vs Gratuit
- **Disponibilité** : Date de fin avec countdown
- **Type d'offre** : À conserver, Temporaire, Prime Gaming, etc.
- **Systèmes** : Windows, Mac, Linux, etc.
- **Note** : Étoiles (si disponible)
- **Tags** : Catégories du jeu
- **Staff Pick** : Recommandations FreeStuff

### Couleurs par plateforme :

- Steam : Bleu foncé (#1b2838)
- Epic : Gris (#313131)
- Humble : Rouge (#cc2929)
- GOG : Violet (#86328a)
- Origin : Orange (#f56c2d)
- Ubisoft : Bleu (#0080ff)
- itch.io : Rose (#fa5c5c)
- Prime : Cyan (#00a8e1)

---

## 🔧 Dépannage

### Le bot ne se connecte pas à l'API

```
[FreeGamesService] ❌ Cannot connect to FreeStuff API. Check your API key.
```

**Solutions :**

1. Vérifiez que `FREESTUFF_API_KEY` est bien configuré dans `.env`
2. Vérifiez que la clé n'est pas `YOUR_API_KEY_HERE`
3. Vérifiez que la clé est valide sur https://dashboard.freestuffbot.xyz/
4. Testez avec `/check-free-games`

### Les webhooks ne fonctionnent pas

```
# Aucune notification reçue
```

**Solutions :**

1. Vérifiez que votre serveur webhook est accessible depuis Internet
2. Testez l'URL avec curl :
   ```bash
   curl -X GET http://votre-url:3000/health
   ```
   Devrait retourner : `{"status":"ok","service":"freestuff-webhook",...}`
3. Vérifiez les logs du webhook dans la console
4. Envoyez un "test ping" depuis le dashboard FreeStuff
5. Vérifiez que le port 3000 n'est pas bloqué par un pare-feu

### Le port 3000 est déjà utilisé

**Changez le port dans `.env` :**

```env
FREESTUFF_WEBHOOK_PORT=3001
```

Puis mettez à jour l'URL webhook dans le dashboard FreeStuff.

### Problème de déploiement sur Oracle Cloud

Voir les instructions détaillées dans `ORACLE_CLOUD_DEPLOYMENT_GUIDE.md`.

---

## 🎯 Événements supportés

### `announcement_created`

Déclenché quand un ou plusieurs nouveaux jeux gratuits sont disponibles.

- Envoie une notification pour chaque jeu
- Évite les doublons

### `product_updated`

Déclenché quand un jeu existant est mis à jour.

- Actuellement logué uniquement
- Peut être étendu pour notifier les changements importants

### `ping`

Test de connexion depuis le dashboard.

- Répond avec un statut 204
- Utile pour vérifier la configuration

---

## 📁 Structure des données

### État persisté (`data/free_games_state.json`)

```json
{
  "notifiedGames": [
    12345,
    12346,
    12347
  ],
  "lastCheck": "2025-03-01T12:00:00.000Z"
}
```

- `notifiedGames` : Liste des IDs de jeux déjà notifiés (max 1000)
- `lastCheck` : Dernière vérification réussie

---

## 📝 Prochaines étapes recommandées

### 1. Configurer l'API Key

```env
FREESTUFF_API_KEY=votre_vraie_clé_ici
```

### 2. Tester la connexion

```
/check-free-games
```

### 3. Configurer le webhook

- URL : `http://votre-serveur:3000/webhooks/freestuff`
- Dashboard : https://dashboard.freestuffbot.xyz/

### 4. Recevoir votre première notification ! 🎉

---

## 🔐 Sécurité (TODO)

**À améliorer en production :**

La vérification de signature Ed25519 n'est pas encore implémentée dans `freeStuffWebhook.ts`.

Pour l'implémenter :

1. Récupérer la clé publique Ed25519 depuis le dashboard
2. Utiliser une bibliothèque comme `@noble/ed25519`
3. Vérifier chaque webhook reçu

Actuellement, la sécurité repose sur l'obscurité de l'URL.

---

## ℹ️ Informations supplémentaires

- **Documentation FreeStuff API :** https://docs.freestuffbot.xyz/
- **Dashboard :** https://dashboard.freestuffbot.xyz/
- **Support :** https://discord.gg/freestuff
- **Tier gratuit :** Accès aux endpoints "Static" uniquement
- **Upgrade :** Nécessaire pour les endpoints "Content" (API REST)
- **Webhooks :** Disponibles sur tous les tiers (recommandé)

---

## 🎉 C'est prêt !

Votre bot est maintenant configuré pour recevoir et notifier automatiquement les jeux gratuits !

Dès qu'un nouveau jeu sera disponible sur Steam, Epic Games, GOG, Prime Gaming, etc., vos utilisateurs recevront une belle notification dans le salon configuré. 🚀

