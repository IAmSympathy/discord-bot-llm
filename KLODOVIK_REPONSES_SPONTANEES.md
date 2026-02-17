# Klodovik - Réponses Spontanées 🎲

## ✅ Fonctionnalité Implémentée !

**Question :** "Le vrai bot nMarkov a des faibles chances d'envoyer un message directement après qu'un autre utilisateur envoit le sien, est-ce que c'est implémenté?"

**Réponse :** OUI, maintenant c'est implémenté ! ✅

## 🎯 Fonctionnement

### Réponses Spontanées Aléatoires

Klodovik peut maintenant **répondre spontanément** aux messages des utilisateurs, exactement comme nMarkov !

#### Comment ça marche ?

1. **Un utilisateur envoie un message**
2. **Le bot analyse le message** (apprentissage continu)
3. **Probabilité aléatoire** : Le bot a une chance de répondre
4. **Délai naturel** : Attente de 1-3 secondes (pour sembler naturel)
5. **Génération contextuelle** : Utilise des mots-clés du message
6. **Envoi de la réponse** : Le bot répond dans le même salon

### Probabilité par Défaut

- **2%** de chance par message
- Environ **1 réponse toutes les 50 messages**
- Configurable de **0% à 100%**

## 🎮 Commandes

### `/klodovik`

Génération manuelle (comme avant)

```
/klodovik
/klodovik utilisateur:@ami
/klodovik seed:mot-clé
```

### `/klodovik-stats`

Affiche les statistiques

```
📊 Statistiques de Klodovik
📝 Messages analysés: 2,547
🔗 États du modèle: 3,891
➡️ Transitions: 8,234
👥 Utilisateurs suivis: 12
```

### `/klodovik-config` (NOUVEAU !)

Configure les réponses spontanées (admin uniquement)

#### Voir la config actuelle

```
/klodovik-config
```

Affiche :

```
⚙️ Configuration actuelle de Klodovik

🎲 Probabilité de réponse spontanée : 2%
📊 Environ 1 réponse toutes les 50 messages

💡 Pour modifier : /klodovik-config probabilite:<0-100>
```

#### Changer la probabilité

```
/klodovik-config probabilite:5
```

Résultat :

```
✅ Configuration mise à jour !

🎲 Probabilité de réponse spontanée : 5%
📊 Environ 1 réponse toutes les 20 messages
```

### `/klodovik-collect`

Lance la collecte historique (admin uniquement)

### `/klodovik-reset`

Réinitialise le modèle (admin uniquement)

## ⚙️ Configuration

### Fichier .env

```env
# Probabilité de réponse spontanée (0.0 à 1.0)
KLODOVIK_REPLY_CHANCE=0.02  # 2% par défaut

# Exemples :
# 0.01 = 1% = 1 réponse / 100 messages (rare)
# 0.02 = 2% = 1 réponse / 50 messages (défaut)
# 0.05 = 5% = 1 réponse / 20 messages (fréquent)
# 0.10 = 10% = 1 réponse / 10 messages (très fréquent)
```

### Fichier de Config (Auto-généré)

```
data/klodovik_config.json
```

Contenu :

```json
{
  "spontaneousReplyChance": 0.02,
  "lastUpdate": 1707264000000
}
```

## 📊 Exemples de Probabilités

| Probabilité | Fréquence      | Usage Recommandé     |
|-------------|----------------|----------------------|
| **1%**      | 1/100 messages | Serveur très actif   |
| **2%**      | 1/50 messages  | ✅ Défaut (équilibré) |
| **5%**      | 1/20 messages  | Serveur moyen        |
| **10%**     | 1/10 messages  | Serveur peu actif    |
| **20%**     | 1/5 messages   | ⚠️ Peut être spam    |
| **50%**     | 1/2 messages   | ❌ Trop fréquent      |

### Recommandations

#### Serveur Très Actif (100+ messages/jour)

```
/klodovik-config probabilite:1
```

- 1% = ~1 réponse par jour
- Pas trop envahissant

#### Serveur Moyen (20-50 messages/jour)

```
/klodovik-config probabilite:2
```

- 2% = ~1 réponse par jour (défaut)
- Équilibré et amusant

#### Serveur Peu Actif (5-10 messages/jour)

```
/klodovik-config probabilite:10
```

- 10% = ~1 réponse par jour
- Anime le serveur

## 🎭 Comportement Naturel

### Délai Aléatoire

Le bot attend **1 à 3 secondes** avant de répondre pour sembler plus humain.

### Génération Contextuelle

- **50%** du temps : Utilise un mot-clé du message original
- **50%** du temps : Génération complètement aléatoire

#### Exemple 1 : Avec Contexte

```
User: "on joue ce soir à Minecraft ?"
[1-3 sec...]
Klodovik: "mdr Minecraft oklm jsuis chaud ce soir"
```

#### Exemple 2 : Sans Contexte

```
User: "gg"
[1-3 sec...]
Klodovik: "ptdr jsp mais javoue c'est ouf"
```

### Filtrage Intelligent

Le bot **ne répond pas** si :

- Le modèle n'est pas encore assez entraîné
- La génération échoue
- C'est un autre bot qui parle

## 🔍 Logs

### Lors d'une Réponse Spontanée

```
[Klodovik] Réponse spontanée dans #général
```

### Au Démarrage (avec config)

```
[Klodovik] Config chargée: 2% de réponses spontanées
[Klodovik] ✓ Bot connecté: Klodovik#1234
```

### Changement de Config

```
[Klodovik] Probabilité de réponse spontanée mise à jour : 5%
```

## 🎯 Cas d'Usage

### Serveur d'Amis Gaming

```
User1: "on lance une game ?"
User2: "ok jsuis chaud"
Klodovik: "mdr gg oklm on fait ça"  🎲
User3: "lol le bot"
```

### Serveur Étudiant

```
User: "ptdr j'ai raté mon exam"
Klodovik: "jsp mais javoue c'est ouf oklm"  🎲
User: "😂😂😂"
```

### Serveur Détente

```
User1: "quelqu'un veut faire quoi ce soir"
User2: "jsp toi"
Klodovik: "on verra oklm bg"  🎲
User1: "lmao"
```

## 📈 Statistiques

### Impact sur les Messages

Avec **2%** de probabilité et **50 messages/jour** :

- Environ **1 réponse spontanée par jour**
- Le bot reste discret
- Surprend les utilisateurs de temps en temps

### Charge Serveur

- **Négligeable** : Seulement génération + envoi
- Pas de collecte massive
- Pas de rate limit (1 message occasionnel)

## 🛡️ Sécurité

### Pas de Spam

- Probabilité contrôlée
- Maximum configurable (100%)
- Désactivable (0%)

### Pas de Boucle Infinie

- Le bot ignore les autres bots
- Le bot ignore ses propres messages

### Respect Discord

- Pas de rate limit
- Messages espacés naturellement
- Totalement conforme ToS

## ⚙️ Désactivation

### Temporaire (via commande)

```
/klodovik-config probabilite:0
```

✅ Réponses spontanées désactivées
❌ Le bot continue d'apprendre

### Permanente (via .env)

```env
KLODOVIK_REPLY_CHANCE=0.0
```

Puis redémarrer le bot.

## 🔄 Comparaison nMarkov

| Fonctionnalité            | nMarkov | Klodovik |
|---------------------------|---------|----------|
| **Réponses spontanées**   | ✅       | ✅        |
| **Probabilité ajustable** | ❌       | ✅        |
| **Config persistante**    | ❌       | ✅        |
| **Délai naturel**         | ❌       | ✅        |
| **Contexte du message**   | ❌       | ✅ (50%)  |
| **Commande config**       | ❌       | ✅        |

**Klodovik a des fonctionnalités supplémentaires !** 🎉

## 💡 Conseils

### Pour Commencer

1. Garder **2%** par défaut
2. Observer pendant quelques jours
3. Ajuster selon l'activité du serveur

### Si Trop Fréquent

```
/klodovik-config probabilite:1
```

### Si Pas Assez Fréquent

```
/klodovik-config probabilite:5
```

### Pour Tester

```
/klodovik-config probabilite:50
```

(Puis remettre à 2% après)

## 🎊 Résumé

✅ **Réponses spontanées implémentées** comme nMarkov
✅ **Probabilité ajustable** (0-100%)
✅ **Délai naturel** (1-3 secondes)
✅ **Génération contextuelle** (50% avec mots-clés)
✅ **Configuration persistante** (sauvegardée)
✅ **Commande admin** pour configurer
✅ **Logs détaillés** pour monitoring

**Klodovik est maintenant complet et même plus avancé que nMarkov !** 🚀

## 🎮 Prêt à Utiliser !

1. **Démarrer le bot** : `npm start`
2. **Collecter des messages** : `/klodovik-collect`
3. **Laisser faire** : Le bot répondra spontanément ! 🎲
4. **Ajuster si besoin** : `/klodovik-config probabilite:X`

**Amusez-vous bien !** 😄

