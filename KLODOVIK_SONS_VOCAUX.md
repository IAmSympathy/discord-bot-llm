# Klodovik - Sons Vocaux 🎵

## 🎯 Fonctionnalité

Klodovik **vérifie périodiquement** (toutes les minutes par défaut) s'il y a des personnes dans les salons vocaux. Quand c'est le cas, il a une **faible probabilité** de rejoindre aléatoirement pour jouer un son avec des effets aléatoires !

## 🔄 Fonctionnement du Système

### Vérification Périodique

Au lieu de se déclencher quand quelqu'un rejoint un vocal, Klodovik fonctionne **en boucle continue** :

```
1. ⏰ Toutes les X minutes (configurable)
2. 🔍 Vérifie tous les salons vocaux du serveur
3. 👥 Y a-t-il au moins 1 personne non-bot ?
4. 🎲 Oui → Lance le dé (0.5% par défaut)
5. ✅ Succès → Klodovik rejoint et joue un son !
6. ⏰ Attends X minutes → Recommence
```

### Avantages

✅ **Pas besoin de rejoindre** : Se déclenche même si les gens sont déjà dans le vocal
✅ **Plus prévisible** : Vérifie à intervalle régulier
✅ **Équitable** : Chaque salon vocal avec des membres a la même chance
✅ **Configurable** : Ajuste la fréquence selon tes préférences

## 🎲 Probabilité

- **Défaut : 0.5%** (1 chance sur 200 quand quelqu'un rejoint/est dans un vocal)
- Configurable via `KLODOVIK_VOICE_CHANCE` dans le `.env`

## 🎵 Effets Aléatoires

Chaque son est modifié aléatoirement :

- **Pitch** : 0.5x (grave/lent) à 2.0x (aigu/rapide)
- **Speed** : 0.7x (lent) à 1.5x (rapide)
- **Volume** : 50% à 100%
- **Reverb** : 20% de chance d'ajouter un écho

**Résultat :** Chaque apparition est unique et surprenante ! 😄

## 📁 Ajouter des Sons

### Étape 1 : Créer le Dossier

Le dossier est créé automatiquement au démarrage :

```
discord-bot-llm/assets/klodovik_sounds/
```

### Étape 2 : Ajouter des Fichiers Audio

Formats supportés :

- `.mp3` ✅
- `.wav` ✅
- `.ogg` ✅
- `.webm` ✅

**Exemples de sons recommandés :**

```
assets/klodovik_sounds/
├── scream1.mp3          (Cri classique)
├── scream2.wav          (Cri aigu)
├── wilhelm_scream.mp3   (Le fameux Wilhelm Scream)
├── surprised.ogg        (Son de surprise)
├── bruh.mp3             (Bruh moment)
├── vine_boom.mp3        (Vine boom sound)
└── ... (autant que tu veux !)
```

### Étape 3 : Redémarrer le Bot

Le bot détectera automatiquement tous les sons disponibles.

## 🎮 Fonctionnement

### Déclenchement

1. **Quelqu'un rejoint un salon vocal**
2. **Tirage aléatoire** (0.5% par défaut)
3. **Si succès :**
    - Attente de 5-15 secondes (aléatoire)
    - Vérification que le salon a toujours des membres
    - Sélection d'un son aléatoire
    - Application d'effets aléatoires
    - Klodovik rejoint le vocal
    - Joue le son
    - Quitte automatiquement

### Exemple de Logs

```
[Klodovik Voice] 🎵 Rejoint Général - Vocal pour jouer: scream1.mp3
[Klodovik Voice] Effets: -af atempo=1.2,asetrate=44100*1.5,aresample=44100 | Volume: 75%
[Klodovik Voice] Son terminé, déconnexion...
[Klodovik Voice] 🎲 Son joué dans Général - Vocal
```

## ⚙️ Configuration

### Variables d'Environnement

Dans `.env` :

```env
# Probabilité d'apparition vocale (par vérification)
KLODOVIK_VOICE_CHANCE=0.005  # 0.5% par défaut

# Exemples de probabilité :
# 0.001 = 0.1% (très rare)
# 0.005 = 0.5% (recommandé)
# 0.01  = 1%   (fréquent)
# 0.02  = 2%   (très fréquent)

# Intervalle de vérification en millisecondes
KLODOVIK_VOICE_CHECK_INTERVAL=60000  # 1 minute par défaut

# Exemples d'intervalle :
# 30000  = 30 secondes (vérifications fréquentes)
# 60000  = 1 minute (recommandé)
# 120000 = 2 minutes (vérifications espacées)
# 300000 = 5 minutes (vérifications rares)
```

### Calcul de la Fréquence d'Apparition

**Formule :** `(60 / intervalleMinutes) × probabilité × 100 = apparitions/heure`

**Exemples avec intervalle de 1 minute :**

- 0.5% → ~0.3 apparitions/heure → **1 fois toutes les 3 heures**
- 1% → ~0.6 apparitions/heure → **1 fois toutes les 2 heures**
- 2% → ~1.2 apparitions/heure → **1 fois par heure**

**Exemples avec intervalle de 2 minutes :**

- 0.5% → ~0.15 apparitions/heure → **1 fois toutes les 7 heures**
- 1% → ~0.3 apparitions/heure → **1 fois toutes les 3 heures**

### Recommandations

| Usage                     | Intervalle  | Probabilité | Fréquence                |
|---------------------------|-------------|-------------|--------------------------|
| **Serveur actif 24/7**    | 1 minute    | 0.5%        | ~1 fois toutes les 3h    |
| **Serveur actif le soir** | 1 minute    | 1%          | ~1 fois toutes les 2h    |
| **Tests**                 | 30 secondes | 5%          | ~1 fois toutes les 7 min |
| **Très rare**             | 5 minutes   | 0.5%        | ~1 fois toutes les 17h   |

## 🔒 Protections

### Anti-Spam

- ✅ **Une seule instance** : Klodovik ne peut pas jouer plusieurs sons en même temps
- ✅ **Vérification des membres** : Ne rejoint que si au moins 1 personne non-bot est présente
- ✅ **Timeout de sécurité** : Déconnexion forcée après 30 secondes max
- ✅ **Pas de boucle** : Ne se déclenche pas si déjà connecté

### Permissions Requises

Le bot doit avoir :

- ✅ **Connect** (Rejoindre les salons vocaux)
- ✅ **Speak** (Parler dans les salons vocaux)

## 🎯 Exemples de Sons à Utiliser

### Sons de Cri

- **Wilhelm Scream** (classique du cinéma)
- **Screaming Marmot** (marmotte qui crie)
- **Goofy Scream** (cri de Dingo)

### Sons Memes

- **Vine Boom** (boom de vine)
- **Bruh Sound Effect** (effet bruh)
- **Oof Sound** (Roblox oof)
- **Emotional Damage** (Steven He)

### Sons Surprise

- **Airhorn** (klaxon)
- **Record Scratch** (scratch de disque)
- **John Cena Theme** (And his name is...)

### Où Trouver des Sons ?

- **MyInstants.com** - Bibliothèque de sons memes
- **YouTube** - Télécharge avec youtube-dl
- **Freesound.org** - Sons libres de droits
- **Reddit r/SoundsLikeMusic** - Suggestions communautaires

## 📊 Statistiques

### Vérifier le Nombre de Sons

Au démarrage du bot, tu verras :

```
[Klodovik Voice] Dossier créé: /path/to/assets/klodovik_sounds/
[Klodovik Voice] ⚠️ Ajoutez des fichiers audio dans assets/klodovik_sounds/
```

Ou si des sons sont présents :

```
[Klodovik Voice] 5 sons disponibles
```

## 🐛 Dépannage

### "Aucun fichier audio trouvé"

```
[Klodovik Voice] Aucun fichier audio trouvé dans assets/klodovik_sounds/
```

**Solution :**

1. Vérifie que le dossier `assets/klodovik_sounds/` existe
2. Ajoute au moins un fichier `.mp3`, `.wav`, `.ogg` ou `.webm`
3. Redémarre le bot

### Le Bot ne Rejoint Jamais

**Causes possibles :**

- Probabilité trop faible (0.5% = rare)
- Aucun son dans le dossier
- Permissions vocales manquantes
- Le bot est déjà en train de jouer un son

**Solution :**

- Augmente `KLODOVIK_VOICE_CHANCE` à `0.05` (5%) pour tester
- Vérifie les logs `[Klodovik Voice]`

### Erreur "FFmpeg not found"

**Solution :**

```bash
# Le paquet ffmpeg-static s'installe automatiquement avec npm install
npm install ffmpeg-static
```

## 🎉 Exemples d'Utilisation

### Serveur Gaming

**Sons recommandés :**

- Victory fanfare (Final Fantasy)
- Level up sound (Zelda)
- Death sound (Minecraft)
- Headshot sound

**Probabilité :** 0.5% (rare mais amusant)

### Serveur Amis

**Sons recommandés :**

- Memes du moment
- Références internes
- Sons de films/séries

**Probabilité :** 1% (régulier)

### Serveur Études

**Sons recommandés :**

- Notification douce
- Son de cloche
- Bruit de crayon

**Probabilité :** 0.1% (très rare, pour ne pas déranger)

## 🔧 Commandes Associées

Actuellement, il n'y a pas de commande dédiée, mais tu peux :

- Ajuster `KLODOVIK_VOICE_CHANCE` dans `.env`
- Ajouter/retirer des sons dans `assets/klodovik_sounds/`
- Redémarrer le bot pour appliquer les changements

## 📝 Logs Utiles

```
[Klodovik Voice] 🎵 Rejoint Général - Vocal pour jouer: scream.mp3
[Klodovik Voice] Effets: -af atempo=0.9,asetrate=44100*1.8,aresample=44100,aecho=0.8:0.88:60:0.4 | Volume: 85%
[Klodovik Voice] Son terminé, déconnexion...
[Klodovik Voice] 🎲 Son joué dans Général - Vocal
```

**Signification :**

- `atempo=0.9` : Vitesse à 90% (un peu plus lent)
- `asetrate=44100*1.8` : Pitch à 180% (plus aigu)
- `aecho=...` : Effet de reverb ajouté
- `Volume: 85%` : Volume à 85%

## ✅ Checklist de Configuration

- [ ] Installer les dépendances : `npm install`
- [ ] Créer le dossier : `assets/klodovik_sounds/`
- [ ] Ajouter des fichiers audio (au moins 3-5 sons)
- [ ] Configurer `KLODOVIK_VOICE_CHANCE` dans `.env`
- [ ] Vérifier les permissions vocales du bot
- [ ] Redémarrer le bot
- [ ] Tester en rejoignant un vocal plusieurs fois
- [ ] Ajuster la probabilité selon les résultats

## 🎊 Résultat Attendu

Quand quelqu'un rejoint un vocal, **très rarement**, Klodovik va :

1. 🎲 Attendre 5-15 secondes
2. 🎵 Rejoindre le vocal
3. 🔊 Jouer un son avec un pitch/speed aléatoire
4. 👋 Partir immédiatement

**Effet de surprise garanti !** 😄

---

**Note :** Cette fonctionnalité est entièrement optionnelle. Si tu ne veux pas de sons vocaux, ne mets simplement aucun fichier dans `assets/klodovik_sounds/`.



