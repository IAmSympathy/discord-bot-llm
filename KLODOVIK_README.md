# Klodovik - Bot de Génération de Texte par Chaînes de Markov

Klodovik est un bot Discord intégré au projet Netricsa qui génère du texte aléatoire basé sur l'historique des messages du serveur en utilisant des chaînes de Markov.

## 🚀 Architecture

Klodovik fonctionne dans le **même processus Node.js** que Netricsa, avec un client Discord séparé :

- **Netricsa** : Bot principal avec toutes les fonctionnalités IA
- **Klodovik** : Bot de génération de texte (même processus, client Discord différent)

## 📋 Configuration

### 1. Créer l'application Discord

1. Allez sur https://discord.com/developers/applications
2. Créez une nouvelle application nommée "Klodovik"
3. Dans l'onglet "Bot", créez un bot
4. Copiez le token et le Client ID

### 2. Configurer le .env

Ajoutez ces lignes dans votre fichier `.env` :

```env
KLODOVIK_TOKEN=votre_token_klodovik
KLODOVIK_CLIENT_ID=votre_client_id_klodovik
```

### 3. Inviter le bot

URL d'invitation (remplacez `YOUR_CLIENT_ID` par votre Client ID) :

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
```

Permissions requises :

- ✅ Lire les messages/Voir les salons
- ✅ Envoyer des messages
- ✅ Historique des messages
- ✅ Utiliser les commandes slash

## 🎮 Commandes

### `/markov`

Génère un message aléatoire basé sur l'historique du serveur.

**Options :**

- `utilisateur` (optionnel) : Imiter un utilisateur spécifique
- `seed` (optionnel) : Mot-clé pour démarrer la génération

**Exemples :**

```
/markov
/markov utilisateur:@John
/markov seed:bonjour
```

### `/markov-stats`

Affiche les statistiques du modèle de Markov.

**Informations affichées :**

- 📝 Nombre de messages analysés
- 🔗 Nombre d'états du modèle
- ➡️ Nombre de transitions
- 👥 Nombre d'utilisateurs suivis

### `/markov-collect`

⚠️ **Admin uniquement**

Lance la collecte manuelle de messages historiques du serveur.
Cette commande analyse jusqu'à 50 000 messages du serveur.

**Note :** La collecte peut prendre plusieurs minutes selon la taille du serveur.

### `/markov-reset`

⚠️ **Admin uniquement**

Réinitialise complètement le modèle de Markov.
Toutes les données apprises seront supprimées.

## 🧠 Fonctionnement

### Chaînes de Markov

Klodovik utilise des chaînes de Markov d'ordre 2 pour générer du texte :

- Analyse les messages du serveur
- Construit un modèle statistique de transitions entre mots
- Génère de nouveaux messages en suivant les probabilités observées

### Apprentissage Automatique

- **Temps réel** : Analyse automatiquement tous les nouveaux messages
- **Historique** : Peut analyser l'historique avec `/markov-collect`
- **Persistance** : Le modèle est sauvegardé sur disque

### Nettoyage des Données

Klodovik filtre automatiquement :

- ❌ Messages de bots
- ❌ Commandes (commençant par `/` ou `!`)
- ❌ URLs
- ❌ Mentions (@utilisateur, #canal, @rôle)
- ❌ Emojis custom Discord
- ❌ Messages trop courts (< 3 caractères)

## 📁 Structure des Fichiers

```
src/services/klodovik/
├── klodovikBot.ts        # Bot principal et gestionnaire de commandes
├── markovChain.ts        # Implémentation de la chaîne de Markov
└── messageCollector.ts   # Collecte et analyse des messages

data/
├── klodovik_markov.json  # Modèle de Markov sauvegardé
└── klodovik_stats.json   # Statistiques
```

## 🔧 Paramètres Techniques

### Ordre de Markov

**Ordre 2** : Le bot regarde 2 mots précédents pour choisir le suivant

- Ordre 1 = texte plus aléatoire mais moins cohérent
- Ordre 2 = bon équilibre entre cohérence et variété
- Ordre 3+ = plus cohérent mais nécessite plus de données

### Longueur des Messages

- **Maximum** : 100 mots par défaut
- Le bot s'arrête naturellement aux points de fin de phrase
- Limite Discord : 2000 caractères

### Sauvegarde

- Le modèle est sauvegardé automatiquement toutes les 1000 messages
- Sauvegarde également à l'arrêt du bot

## 🎯 Cas d'Utilisation

### Génération Amusante

```
/markov
> "Je pense que le fromage est meilleur que les chaussettes"
```

### Imitation d'Utilisateur

```
/markov utilisateur:@Bob
> Message dans le style d'écriture de Bob
```

### Génération Contextuelle

```
/markov seed:pizza
> Message commençant avec le contexte "pizza"
```

## ⚠️ Notes Importantes

### Performance

- La première collecte peut prendre du temps (plusieurs minutes)
- Le bot analyse automatiquement les nouveaux messages en temps réel
- Le modèle grandit au fil du temps

### Vie Privée

- Klodovik n'analyse que les messages des salons textuels
- Les messages privés ne sont jamais analysés
- Le bot ne stocke pas les messages eux-mêmes, seulement les patterns statistiques

### Qualité du Texte

La qualité dépend de :

- 📊 Quantité de messages analysés (minimum ~1000)
- 🎯 Variété du vocabulaire du serveur
- 👥 Nombre d'utilisateurs actifs

## 🐛 Débogage

### Le bot ne répond pas

1. Vérifier que `KLODOVIK_TOKEN` est correct dans `.env`
2. Vérifier que le bot est bien invité sur le serveur
3. Vérifier les logs : `[Klodovik] ✓ Bot connecté: Klodovik#1234`

### "Je n'ai pas encore assez appris"

- Le modèle est vide ou trop petit
- Lancer `/markov-collect` pour analyser l'historique
- Attendre que le bot analyse plus de messages

### Messages incohérents

- Normal avec peu de données
- Lancer `/markov-collect` pour améliorer le modèle
- Plus il y a de messages, meilleure est la qualité

## 🔄 Mise à Jour

Pour mettre à jour Klodovik après modification du code :

```bash
npm run build
# Le bot se relancera automatiquement avec pm2 ou votre gestionnaire de processus
```

## 📝 Logs

Klodovik utilise des logs préfixés :

```
[Klodovik] ✓ Bot connecté: Klodovik#1234
[Klodovik] Modèle chargé : 15432 états
[Klodovik] 1000 messages analysés...
[Klodovik] ✓ Collecte terminée: 25847 messages analysés
```

## 🚀 Déploiement

Klodovik démarre automatiquement avec Netricsa :

- Même processus Node.js
- Même commande de démarrage
- Même script de déploiement Oracle Cloud

Il suffit d'ajouter les variables `KLODOVIK_TOKEN` et `KLODOVIK_CLIENT_ID` dans le `.env` du serveur.

