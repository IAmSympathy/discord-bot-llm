# Rate Limits Discord et Collecte de Messages - Klodovik

## 🚨 Réponse à tes Questions

### 1. ✅ Modèles Utilisateurs Maintenant Sauvegardés

**Avant :** Les modèles utilisateurs étaient recréés à chaque redémarrage
**Maintenant :**

- ✅ Sauvegarde automatique dans `data/klodovik_user_models.json`
- ✅ Seuil minimum de 100 transitions pour être sauvegardé
- ✅ Chargement au démarrage

### 2. 📊 Discord Rate Limits et Protection

## Rate Limits Discord

Discord impose des limites pour éviter les abus :

### Limites Générales

- **50 requêtes par seconde** par bot
- **Fetch messages** : ~5 requêtes par 5 secondes par salon
- **Rate limit 429** : Erreur si dépassement

### Ce que Klodovik Fait pour Éviter les Blocages

#### 1. ⏱️ Délais Automatiques

```typescript
// 1 seconde entre chaque fetch de 100 messages
await new Promise(resolve => setTimeout(resolve, 1000));

// 5 secondes entre chaque salon
await new Promise(resolve => setTimeout(resolve, 5000));
```

#### 2. 🛡️ Gestion des Erreurs

- **Code 50013** : Pas de permission → Skip le salon
- **Status 429** : Rate limit → Pause de 60 secondes
- Continue même si un salon échoue

#### 3. 📦 Batch Intelligent

- Fetch par lots de **100 messages** (maximum Discord)
- Maximum **1000 messages par salon**
- Limite globale configurable (défaut: 10 000)

## Exemple de Temps de Collecte

### Petit Serveur (5 000 messages)

```
5000 messages ÷ 100 par requête = 50 requêtes
50 requêtes × 1 seconde = ~50 secondes
+ Pauses entre salons = ~2-3 minutes TOTAL
```

### Moyen Serveur (50 000 messages)

```
50000 messages ÷ 100 par requête = 500 requêtes
500 requêtes × 1 seconde = ~8-9 minutes
+ Pauses entre salons = ~15-20 minutes TOTAL
```

### Gros Serveur (100 000+ messages)

```
100000 messages (limité à 10k par défaut)
10000 messages ÷ 100 = 100 requêtes
100 requêtes × 1 seconde = ~2-3 minutes
+ Pauses = ~5-10 minutes TOTAL
```

## Pourquoi Discord Ne Bloque Pas

### 1. 📜 Permissions Requises

Le bot a besoin de :

- ✅ **Read Message History** : Lire l'historique
- ✅ **View Channel** : Voir les salons

Si accordées → **Autorisé par Discord**

### 2. 🤖 Bot Officiel

- Le bot utilise l'API officielle Discord
- Pas de scraping ou hack
- Respecte les Terms of Service

### 3. ⚖️ Rate Limiting Respecté

- On reste **sous** les limites (1 req/sec vs 50/sec possible)
- Pauses automatiques si rate limit atteint
- Gestion propre des erreurs

### 4. 🎯 Usage Légitime

- Analyse de texte pour génération
- Pas de spam ou abus
- Données utilisées localement (pas partagées)

## Logs de Collecte

Tu verras dans la console :

```bash
[Klodovik] Démarrage de la collecte de messages...
[Klodovik] ⚠️ Rate Limiting Discord: La collecte sera lente pour éviter les blocages
[Klodovik] Analyse du salon #général...
[Klodovik] ✓ #général: 847 messages
[Klodovik] Analyse du salon #memes...
[Klodovik] ✓ #memes: 1000 messages
[Klodovik] Analyse du salon #admin...
[Klodovik] ⚠️ #admin: Pas de permission
[Klodovik] ✓ Collecte terminée: 8543 messages analysés
[Klodovik] 3 modèles utilisateurs sauvegardés
```

## Optimisations Implémentées

### 1. Collecte Progressive

- Ne collecte pas tout d'un coup
- 1000 messages max par salon
- Pause entre chaque salon

### 2. Gestion des Permissions

- Skip automatiquement les salons inaccessibles
- Pas d'erreur fatale si permission manquante

### 3. Récupération sur Erreur

- Si rate limit → Attente de 60 secondes
- Continue avec le prochain salon après erreur

### 4. Sauvegarde Périodique

- Tous les 1000 messages analysés
- Pas de perte de données si interruption

## Comparaison avec nMarkov

| Aspect              | nMarkov            | Klodovik            |
|---------------------|--------------------|---------------------|
| **Rate Limiting**   | Basique            | Avancé avec pauses  |
| **Gestion Erreurs** | Peut crasher       | Continue sur erreur |
| **Sauvegarde**      | Manuel             | Automatique         |
| **Permissions**     | Peut bloquer       | Skip si pas accès   |
| **Vitesse**         | Rapide mais risqué | Lent mais sûr       |

## Configuration Avancée

Si tu veux ajuster les limites :

```typescript
// Dans messageCollector.ts, tu peux modifier :

// Délai entre requêtes (défaut: 1000ms)
await new Promise(resolve => setTimeout(resolve, 1000));
// → Augmente si tu veux être + prudent
// → Diminue si ton serveur a peu de messages

// Délai entre salons (défaut: 5000ms)
await new Promise(resolve => setTimeout(resolve, 5000));
// → 5 secondes est un bon compromis

// Messages max par salon (défaut: 1000)
while (channelMessages < 1000 && totalCollected < maxMessages)
// → Limite pour ne pas surcharger

// Messages max total (défaut: 10000 dans la commande)
    await this.messageCollector.collectFromGuild(client, guildId, 50000)
// → Change le 50000 pour collecter plus/moins
```

## Best Practices

### ✅ À FAIRE

- Lancer la collecte en dehors des heures de pointe
- Prévenir les admins avant une grosse collecte
- Vérifier les logs pour détecter les erreurs
- Utiliser `/markov-stats` après la collecte

### ❌ À ÉVITER

- Ne pas lancer plusieurs collectes simultanées
- Ne pas forcer si erreur 429 répétée
- Ne pas collecter trop souvent (1x par jour max)
- Ne pas ignorer les erreurs de permission

## Sécurité et Confidentialité

### Ce qui est Stocké

- ✅ Patterns statistiques de mots
- ✅ Transitions entre mots
- ✅ Statistiques anonymes

### Ce qui N'est PAS Stocké

- ❌ Messages complets
- ❌ Métadonnées sensibles
- ❌ IDs de messages
- ❌ Timestamps précis

### Protection des Données

- Stockage local uniquement (`data/`)
- Pas d'envoi vers serveurs externes
- Filtrage automatique des URLs/mentions
- Conforme RGPD (données anonymisées)

## Dépannage

### "Rate limit atteint"

```
[Klodovik] ⚠️ Rate limit atteint, pause de 60 secondes...
```

→ **Normal**, le bot attend automatiquement

### "Pas de permission"

```
[Klodovik] ⚠️ #salon-privé: Pas de permission
```

→ **Normal**, le bot skip ce salon

### Collecte très lente

→ **Normal**, c'est pour respecter les limites Discord
→ Environ 1000 messages par minute

### "Serveur non trouvé"

→ Vérifier que le bot est bien sur le serveur
→ Vérifier que `guildId` est correct

## Conclusion

✅ **Discord ne bloque pas** car :

1. Usage légitime de l'API officielle
2. Rate limits respectés avec marges de sécurité
3. Gestion propre des erreurs
4. Permissions accordées par l'admin du serveur

✅ **Modèles utilisateurs maintenant sauvegardés** :

1. Fichier `data/klodovik_user_models.json`
2. Seuil minimum intelligent
3. Chargement automatique au démarrage

🚀 **La collecte est lente par design**, c'est voulu pour :

- Respecter Discord
- Éviter les blocages
- Assurer la stabilité
- Protéger ton bot

📊 **Temps estimé** : 5-20 minutes pour 10 000 messages, c'est acceptable !

