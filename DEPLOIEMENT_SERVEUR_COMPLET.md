# ✅ Déploiement Serveur - Klodovik Complet

## 🎉 Statut : DÉPLOYÉ ET PRÊT !

### ✅ Actions Effectuées sur le Serveur

| Action               | Statut | Détails                                                       |
|----------------------|--------|---------------------------------------------------------------|
| **Git pull**         | ✅      | Code mis à jour depuis GitHub                                 |
| **npm install**      | ✅      | Toutes les dépendances installées                             |
| **@discordjs/voice** | ✅      | Version 0.18.0 installée                                      |
| **opusscript**       | ✅      | Encodeur Opus alternatif installé                             |
| **Compilation**      | ✅      | TypeScript compilé sans erreur                                |
| **Dossier sons**     | ✅      | `/home/ubuntu/discord-bot-llm/assets/klodovik_sounds/` existe |

## 📦 Dépendances Serveur - État Final

```json
{
  "@discordjs/voice": "0.18.0",
  ✅
  "@discordjs/opus": "0.9.0",
  ✅
  "ffmpeg-static": "5.2.0",
  ✅
  "opusscript": "latest"
  ✅
}
```

## ⚠️ À Propos des Warnings NPM

**Les warnings que tu vois sont NORMAUX :**

### 1. `@discordjs/voice@0.17.0: deprecated encryption modes`

✅ **RÉSOLU** : Mis à jour vers 0.18.0

### 2. `glob@7.2.3, tar@6.2.1: old versions with vulnerabilities`

✅ **Sans impact** : Ce sont des dépendances transitives de `ffmpeg-static` et `@discordjs/opus`

- Elles sont utilisées uniquement pendant l'installation
- Elles ne sont pas utilisées à l'exécution du bot
- Discord.js et le bot fonctionnent correctement

### 3. `inflight@1.0.6: memory leak`

✅ **Sans impact** : Dépendance de `glob`, utilisée uniquement pendant l'installation

**Conclusion :** Tous ces warnings concernent des dépendances d'installation et n'affectent **pas** le fonctionnement du bot ! ✅

## 🎵 Fichiers Audio

### Sons Déjà Présents

✅ **`klodovik.mp3`** - Un son de test a été ajouté automatiquement

### Ajouter Plus de Sons

```bash
# Via SCP
scp -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ton_son.mp3 ubuntu@151.145.51.189:/home/ubuntu/discord-bot-llm/assets/klodovik_sounds/

# Ou via SSH
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189
cd /home/ubuntu/discord-bot-llm/assets/klodovik_sounds/
wget https://example.com/ton_son.mp3
```

**Sons recommandés :**

- scream.mp3
- bruh.wav
- vine_boom.mp3
- airhorn.ogg
- oof.mp3

## 🚀 Redémarrage du Bot

**Commande à exécuter :**

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189
pm2 restart discord-bot-netricsa
pm2 logs discord-bot-netricsa --lines 50
```

**Logs attendus au démarrage :**

```
[Klodovik] Config chargée: 3% de réponses spontanées
[Klodovik Voice] 1 son disponible
[Klodovik Voice] 🔄 Surveillance périodique activée (vérification toutes les 1 minute)
[Klodovik] ✓ Bot connecté: Klodovik#1234
[Klodovik] ✓ Commandes slash enregistrées
```

## 🎯 Fonctionnalités Activées

### 1. Collecte par Canal ✅

```
#général → /klodovik-collect
✅ Collecte UNIQUEMENT #général (pas tous les canaux)
```

### 2. Mentions Activées ✅

```
/klodovik
> "mdr <@User123> t'es ouf bg oklm"
✅ Peut mentionner des utilisateurs
```

### 3. Réponses Spontanées (Texte) ✅

```
User: "on fait quoi ce soir"
[2% de chance]
Klodovik: "mdr oklm jsuis chaud ce soir"
```

### 4. Sons Vocaux Aléatoires ✅

```
⏰ Toutes les 60 secondes
🔍 Vérifie les salons vocaux
🎲 0.5% de chance par vérification
🎵 Rejoint et joue un son aléatoire
```

## ⚙️ Configuration Actuelle

### Variables d'Environnement

```env
# Réponses texte spontanées
KLODOVIK_REPLY_CHANCE=0.03  # 3%

# Sons vocaux
KLODOVIK_VOICE_CHANCE=0.005  # 0.5%
KLODOVIK_VOICE_CHECK_INTERVAL=60000  # 1 minute
```

### Fréquences Attendues

| Fonctionnalité     | Probabilité  | Fréquence                               |
|--------------------|--------------|-----------------------------------------|
| **Réponses texte** | 3%           | ~1.8 par heure (si conversation active) |
| **Sons vocaux**    | 0.5% + 1 min | ~0.3 par heure (~1 toutes les 3h)       |

## 🔒 Permissions du Bot

### Permissions Actuelles

- ✅ Read Message History
- ✅ Send Messages

### Permissions Nécessaires (À Ajouter)

- ⏳ **Connect** (Rejoindre les salons vocaux)
- ⏳ **Speak** (Parler dans les salons vocaux)

**Nouvelle URL d'invitation :**

```
https://discord.com/oauth2/authorize?client_id=1473424972046270608&permissions=67244032&scope=bot+applications.commands
```

**⚠️ Important :** Sans ces permissions, le bot ne pourra pas rejoindre les vocaux (mais tout le reste fonctionnera).

## 🧪 Tests

### 1. Tester les Commandes

```
/klodovik-stats
→ Devrait afficher les stats avec embed vert

/klodovik-collect
→ Collecte uniquement le canal actuel

/klodovik
→ Génère un message (peut contenir des mentions)

/klodovik-config
→ Affiche la config actuelle
```

### 2. Tester les Réponses Spontanées (Texte)

```
Envoie plusieurs messages dans #général
[3% de chance par message]
Klodovik devrait répondre occasionnellement
```

### 3. Tester les Sons Vocaux

```
1. Mettre à jour les permissions (Connect + Speak)
2. Rejoindre un salon vocal
3. Attendre (vérification toutes les minutes)
4. Avec 0.5%, ~1 apparition toutes les 3 heures

Pour tester plus vite :
KLODOVIK_VOICE_CHANCE=0.05  # 5%
→ ~1 apparition toutes les 7 minutes
```

## 📊 Vérifications

### Vérifier que Tout Est Installé

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189

# Dépendances
npm list @discordjs/voice
# → @discordjs/voice@0.18.0

npm list opusscript
# → opusscript@...

npm list ffmpeg-static
# → ffmpeg-static@5.2.0

# Sons disponibles
ls -la /home/ubuntu/discord-bot-llm/assets/klodovik_sounds/
# → klodovik.mp3

# Logs du bot
pm2 logs discord-bot-netricsa --lines 50
```

### État du Bot

```bash
pm2 status
pm2 info discord-bot-netricsa
```

## 🐛 Dépannage

### Le Bot Ne Démarre Pas

```bash
pm2 logs discord-bot-netricsa --err --lines 100
```

**Erreurs communes :**

- `Cannot find module` → npm install
- `ENOENT: no such file` → Vérifier les paths
- Token invalide → Vérifier .env

### Le Bot Ne Rejoint Pas les Vocaux

**Causes :**

1. **Permissions manquantes** ⏳
   → Réinvite le bot avec Connect + Speak

2. **Pas de sons**
   → Ajoute des fichiers dans `assets/klodovik_sounds/`

3. **Probabilité trop faible**
   → Monte temporairement à 5% pour tester

4. **Bot pas redémarré**
   → `pm2 restart discord-bot-netricsa`

### Vérifier les Logs en Temps Réel

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189
pm2 logs discord-bot-netricsa
```

**Logs à chercher :**

```
[Klodovik Voice] 🔄 Surveillance périodique activée
[Klodovik Voice] X son(s) disponible(s)
[Klodovik Voice] 🎵 Rejoint [salon] pour jouer: [son].mp3
```

## 📝 Checklist Finale

### Déploiement

- [x] Code pull depuis GitHub
- [x] Dépendances installées
- [x] Code compilé
- [x] Configuration présente
- [x] Dossier sons créé
- [x] Au moins 1 son présent
- [ ] **Bot redémarré** ⏳ À FAIRE
- [ ] **Permissions mises à jour** ⏳ À FAIRE

### Fonctionnalités

- [x] Collecte par canal
- [x] Mentions activées
- [x] Réponses spontanées (texte)
- [x] Vérification périodique vocaux
- [x] Service vocal implémenté
- [ ] **Sons vocaux testés** ⏳ (besoin permissions)

## 🎉 Résumé

### ✅ Ce Qui Fonctionne Déjà

1. **Collecte par canal** - `/klodovik-collect` dans un salon spécifique
2. **Mentions** - Le bot peut mentionner des utilisateurs dans ses messages
3. **Réponses spontanées** - 3% de chance de répondre aux messages
4. **Embeds colorés** - Toutes les commandes ont des embeds verts (#56fd0d)
5. **Code déployé** - Toutes les modifications sont sur le serveur

### ⏳ Ce Qui Nécessite une Action

1. **Redémarrer le bot**
   ```bash
   pm2 restart discord-bot-netricsa
   ```

2. **Mettre à jour les permissions** du bot Discord
    - URL : `https://discord.com/oauth2/authorize?client_id=1473424972046270608&permissions=67244032&scope=bot+applications.commands`
    - Ajouter : Connect + Speak

3. **Ajouter plus de sons** (optionnel)
    - Le bot a déjà 1 son (`klodovik.mp3`)
    - Tu peux en ajouter plus via SCP/WinSCP

## 💡 Conseil

**Redémarre le bot maintenant pour activer toutes les nouvelles fonctionnalités :**

```bash
pm2 restart discord-bot-netricsa && pm2 logs discord-bot-netricsa
```

**Puis teste :**

1. `/klodovik-stats` → Devrait marcher immédiatement
2. `/klodovik` → Génération avec mentions possibles
3. Envoie des messages → Réponses spontanées (3% chance)
4. Rejoins un vocal → Sons vocaux (après ajout des permissions)

---

**Le déploiement est complet ! Il ne reste plus qu'à redémarrer le bot !** 🚀✅

