# 📦 Dépendances et Installation - Klodovik Sons Vocaux

## ✅ Installation Complétée sur le Serveur

### Dépendances Installées

| Paquet             | Version | Statut     | Usage                       |
|--------------------|---------|------------|-----------------------------|
| `@discordjs/voice` | ^0.18.0 | ✅ Installé | Connexion vocale Discord    |
| `ffmpeg-static`    | ^5.2.0  | ✅ Installé | Traitement audio (FFmpeg)   |
| `opusscript`       | latest  | ✅ Installé | Encodeur Opus (alternative) |

### ❌ Non Installé

| Paquet            | Raison                          | Impact                           |
|-------------------|---------------------------------|----------------------------------|
| `@discordjs/opus` | ⚠️ Erreur de compilation native | Aucun - `opusscript` le remplace |

## 🔧 Solution Adoptée

Au lieu d'utiliser `@discordjs/opus` (qui nécessite une compilation native et peut échouer), nous utilisons **`opusscript`** :

- ✅ **Plus simple** - Pas de compilation native
- ✅ **Plus fiable** - Installation pure JavaScript
- ⚠️ **Légèrement moins performant** - Mais largement suffisant pour des sons courts

## 📋 Ce Qui a Été Fait

### 1. Installation sur le Serveur ✅

```bash
# Dépendances vocales
npm install @discordjs/voice@^0.18.0 ffmpeg-static@^5.2.0 opusscript
```

### 2. Mise à Jour du .env ✅

```env
KLODOVIK_VOICE_CHANCE=0.005
KLODOVIK_VOICE_CHECK_INTERVAL=60000
```

### 3. Compilation Locale ✅

```bash
npx tsc
# ✅ Aucune erreur
```

## 🚀 Ce Qui Reste à Faire

### 1. Ajouter des Sons Audio

```bash
# Sur le serveur
mkdir -p /home/ubuntu/discord-bot-llm/assets/klodovik_sounds

# Puis upload tes fichiers audio (.mp3, .wav, .ogg)
scp -i "chemin/vers/ssh-key" ton_son.mp3 ubuntu@151.145.51.189:/home/ubuntu/discord-bot-llm/assets/klodovik_sounds/
```

**Ou via SCP/SFTP :**

```
Hôte: 151.145.51.189
User: ubuntu
Clé: ssh-key-2026-02-10.key
Dossier: /home/ubuntu/discord-bot-llm/assets/klodovik_sounds/
```

### 2. Mettre à Jour les Permissions du Bot

Le bot a besoin de :

- ✅ Connect (Rejoindre les salons vocaux)
- ✅ Speak (Parler dans les salons vocaux)

**Nouvelle valeur permissions :** `67244032`

**URL d'invitation mise à jour :**

```
https://discord.com/oauth2/authorize?client_id=1473424972046270608&permissions=67244032&scope=bot+applications.commands
```

### 3. Déployer le Code

```bash
# Option A : Script de déploiement (si existant)
./deploy-to-oracle.ps1

# Option B : Manuel
ssh -i "ssh-key-2026-02-10.key" ubuntu@151.145.51.189
cd /home/ubuntu/discord-bot-llm
git pull origin main
npm run build
pm2 restart discord-bot-netricsa
```

### 4. Vérifier les Logs

```bash
ssh -i "ssh-key-2026-02-10.key" ubuntu@151.145.51.189
pm2 logs discord-bot-netricsa

# Tu devrais voir :
# [Klodovik Voice] 🔄 Surveillance périodique activée (vérification toutes les 1 minute)
```

## 🎵 Ajouter des Sons - Guide Rapide

### Méthode 1 : SCP (Recommandé)

```bash
# Depuis Windows (PowerShell)
scp -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" .\ton_son.mp3 ubuntu@151.145.51.189:/home/ubuntu/discord-bot-llm/assets/klodovik_sounds/
```

### Méthode 2 : Client SFTP (WinSCP, FileZilla)

1. **WinSCP :** https://winscp.net/
    - Protocole : SFTP
    - Hôte : 151.145.51.189
    - User : ubuntu
    - Clé privée : ssh-key-2026-02-10.key
    - Dossier : `/home/ubuntu/discord-bot-llm/assets/klodovik_sounds/`

2. **FileZilla :**
    - Fichier → Gestionnaire de sites
    - Protocole : SFTP
    - Hôte : 151.145.51.189
    - Type d'authentification : Fichier de clé
    - Utilisateur : ubuntu
    - Fichier de clé : ssh-key-2026-02-10.key

### Méthode 3 : Via SSH (upload depuis URL)

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189

# Une fois connecté :
cd /home/ubuntu/discord-bot-llm/assets/klodovik_sounds/

# Télécharger depuis une URL
wget https://example.com/ton_son.mp3
# ou
curl -O https://example.com/ton_son.mp3
```

## 📊 Vérification de l'Installation

### Vérifier que les Dépendances sont Installées

```bash
ssh -i "ssh-key-2026-02-10.key" ubuntu@151.145.51.189
cd /home/ubuntu/discord-bot-llm

# Vérifier @discordjs/voice
npm list @discordjs/voice
# Devrait afficher: @discordjs/voice@0.18.0

# Vérifier ffmpeg-static
npm list ffmpeg-static
# Devrait afficher: ffmpeg-static@5.2.0

# Vérifier opusscript
npm list opusscript
# Devrait afficher: opusscript@...
```

### Vérifier que le Dossier des Sons Existe

```bash
ssh -i "ssh-key-2026-02-10.key" ubuntu@151.145.51.189
ls -la /home/ubuntu/discord-bot-llm/assets/klodovik_sounds/

# Devrait afficher le contenu du dossier
# (vide pour l'instant jusqu'à ce que tu ajoutes des sons)
```

## ⚠️ Important : Warnings NPM

Les warnings que tu as vus sont **normaux et sans danger** :

```
npm warn deprecated @discordjs/voice@0.17.0: This version uses deprecated encryption modes.
```

→ **Résolu** : Version mise à jour à 0.18.0 ✅

```
npm warn deprecated glob@7.2.3, rimraf@3.0.2, tar@6.2.1...
```

→ **Sans impact** : Ce sont des dépendances transitives de ffmpeg-static et opusscript. Elles fonctionnent correctement malgré les warnings.

## 🎯 Checklist Complète

- [x] **Dépendances locales installées** (@discordjs/voice, @discordjs/opus, ffmpeg-static)
- [x] **Dépendances serveur installées** (@discordjs/voice, ffmpeg-static, opusscript)
- [x] **Code compilé localement** (npx tsc - aucune erreur)
- [x] **.env mis à jour** (KLODOVIK_VOICE_CHANCE, KLODOVIK_VOICE_CHECK_INTERVAL)
- [x] **Documentation créée** (KLODOVIK_SONS_VOCAUX.md)
- [ ] **Dossier sons créé sur serveur** (assets/klodovik_sounds/)
- [ ] **Fichiers audio ajoutés** (.mp3, .wav, .ogg)
- [ ] **Permissions bot mises à jour** (Connect + Speak)
- [ ] **Code déployé sur serveur** (git pull + npm run build + pm2 restart)
- [ ] **Tests effectués** (rejoindre un vocal et attendre)

## 🐛 Dépannage

### "Cannot find module '@discordjs/opus'"

**Cause :** Le bot cherche @discordjs/opus qui n'est pas installé sur le serveur

**Solution :** Opusscript est installé et fonctionnera automatiquement en fallback. Pas de problème.

### "ENOENT: no such file or directory, scandir '.../assets/klodovik_sounds'"

**Cause :** Le dossier des sons n'existe pas encore

**Solution :**

```bash
ssh -i "ssh-key-2026-02-10.key" ubuntu@151.145.51.189
mkdir -p /home/ubuntu/discord-bot-llm/assets/klodovik_sounds
```

### "Aucun fichier audio trouvé"

**Cause :** Le dossier existe mais est vide

**Solution :** Ajoute au moins un fichier audio dans le dossier

### Le Bot ne Rejoint Jamais les Vocaux

**Causes possibles :**

1. Pas de sons dans le dossier → Ajoute des fichiers audio
2. Probabilité trop faible → Monte temporairement à 5% pour tester
3. Permissions manquantes → Vérifie Connect + Speak
4. Bot pas redémarré → `pm2 restart discord-bot-netricsa`

## 🎉 Résumé

### Ce Qui Est Prêt

✅ Code implémenté
✅ Dépendances installées (local + serveur)
✅ Configuration ajoutée
✅ Documentation complète

### Ce Qu'il Reste

1. **Créer le dossier des sons** sur le serveur
2. **Ajouter 3-5 fichiers audio** dans ce dossier
3. **Mettre à jour les permissions** du bot Discord
4. **Déployer** le code sur le serveur
5. **Tester !**

**Tout est prêt côté code ! Il ne reste que l'upload des sons et le déploiement.** 🚀🎵

