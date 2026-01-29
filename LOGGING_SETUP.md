# Guide de configuration des logs séparés

## 📋 Vue d'ensemble

Le système de logging a été amélioré pour séparer les logs en deux canaux Discord distincts :

### 🔔 Canal 1 : Logs serveur (`LOG_CHANNEL_ID`)

Tous les événements liés au serveur Discord :

- 👤 Arrivées/départs de membres
- 🚫 Bans, kicks, timeouts
- 🎭 Modifications de rôles
- 📝 Changements de surnom
- 📺 Création/suppression de salons
- 💬 **Messages supprimés**
- ✏️ **Messages édités** (NOUVEAU !)
- 🔊 Événements vocaux (déplacements, mute/deaf par modérateur)

### 🤖 Canal 2 : Logs Netricsa (`NETRICSA_LOG_CHANNEL_ID`)

Toutes les activités de l'IA :

- 🤖 Réponses de Netricsa
- 🖼️ Analyses d'images
- 🌐 Recherches web

## 🛠️ Configuration

### Étape 1 : Créer les canaux Discord

1. Créez deux canaux texte dans votre serveur Discord :
    - `📋-logs-serveur` (pour les événements serveur)
    - `🤖-logs-netricsa` (pour l'activité de l'IA)

2. Récupérez les ID de ces canaux :
    - Activez le mode développeur Discord (Paramètres → Avancés → Mode développeur)
    - Clic droit sur chaque canal → Copier l'identifiant

### Étape 2 : Configurer les variables d'environnement

Ajoutez les deux variables dans votre fichier `.env` :

```env
# Canal pour les logs d'événements serveur
LOG_CHANNEL_ID=VOTRE_ID_CANAL_LOGS_SERVEUR

# Canal pour les logs d'activité de Netricsa (IA)
NETRICSA_LOG_CHANNEL_ID=VOTRE_ID_CANAL_LOGS_NETRICSA
```

### Étape 3 : Redémarrer le bot

```bash
# Arrêter le bot si il est en cours d'exécution
# Puis le redémarrer
npm start
```

## ✨ Nouvelles fonctionnalités

### Messages édités

- **Avant** : Rien n'était loggé quand un message était modifié
- **Maintenant** : Chaque message édité est loggé avec l'ancien et le nouveau contenu
- **Limite** : Les 500 premiers caractères de chaque version pour éviter les embeds trop longs

### Filtrage des self-mute/self-deaf

- **Avant** : Tous les mute/deaf vocaux étaient loggés
- **Maintenant** : Seuls les mute/deaf appliqués par un modérateur sont loggés
- **Raison** : Éviter le spam quand les utilisateurs se mute/deaf eux-mêmes

## 🎨 Codes couleur

### Logs serveur

- 🟢 Vert vif : Membre rejoint
- 🔴 Rouge : Ban
- 🟠 Orange : Kick, timeout
- 🔵 Bleu : Rôles, mouvements vocaux
- 🟡 Jaune : Message supprimé
- 🟠 Orange clair : Message édité

### Logs Netricsa

- 🔵 Blurple : Réponse du bot
- 🩷 Rose : Analyse d'image
- 🟡 Jaune : Recherche web

## 🔍 Test de la configuration

### Tester les logs serveur

1. Éditez un de vos messages → devrait apparaître dans `LOG_CHANNEL_ID`
2. Supprimez un message → devrait apparaître dans `LOG_CHANNEL_ID`
3. Rejoignez/quittez un salon vocal → devrait apparaître dans `LOG_CHANNEL_ID`

### Tester les logs Netricsa

1. Posez une question au bot → devrait apparaître dans `NETRICSA_LOG_CHANNEL_ID`
2. Envoyez une image au bot → devrait apparaître dans `NETRICSA_LOG_CHANNEL_ID`
3. Demandez une recherche web → devrait apparaître dans `NETRICSA_LOG_CHANNEL_ID`

## ⚠️ Important

- Si `NETRICSA_LOG_CHANNEL_ID` n'est pas configuré, les logs de Netricsa **ne seront pas envoyés**
- Les deux canaux peuvent être le même si vous préférez tout centraliser (mais c'est moins organisé)
- Les notifications sont supprimées par défaut (flag `SUPPRESS_NOTIFICATIONS`)

## 🐛 Dépannage

### Problème : Aucun log n'apparaît

- Vérifiez que les ID de canaux sont corrects dans le `.env`
- Vérifiez que le bot a les permissions d'envoyer des messages dans ces canaux
- Vérifiez les logs console pour voir les erreurs

### Problème : Les logs apparaissent dans le mauvais canal

- Vérifiez que vous n'avez pas inversé `LOG_CHANNEL_ID` et `NETRICSA_LOG_CHANNEL_ID`
- Redémarrez le bot après avoir modifié le `.env`

### Problème : Trop de logs vocaux

- Les self-mute/self-deaf sont déjà filtrés
- Si vous voyez encore trop de logs, vous pouvez commenter les événements vocaux dans `bot.ts`
