# 🚀 Guide de Déploiement sur Oracle Cloud (Gratuit)

## Architecture Hybride : Bot Cloud + Services Locaux

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Architecture du système](#architecture-du-système)
3. [Configuration de votre PC local](#configuration-de-votre-pc-local)
4. [Création de l'instance Oracle Cloud](#création-de-linstance-oracle-cloud)
5. [Configuration initiale du serveur](#configuration-initiale-du-serveur)
6. [Installation des dépendances](#installation-des-dépendances)
7. [Configuration du bot](#configuration-du-bot)
8. [Connexion bot → services locaux](#connexion-bot--services-locaux)
9. [Démarrage automatique](#démarrage-automatique)
10. [Monitoring et logs](#monitoring-et-logs)
11. [Dépannage](#dépannage)

---

## 🎯 Prérequis

- Un compte Oracle Cloud (gratuit : https://www.oracle.com/cloud/free/)
- **PC local** avec Ollama et l'API Python déjà fonctionnels
- Votre bot Discord créé sur le portail développeur Discord
- Token Discord (`DISCORD_LLM_BOT_TOKEN`)
- **IP publique ou DNS dynamique** pour votre PC local
- Clés API optionnelles (Brave Search, etc.)

---

## 🏗️ Architecture du système

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNET                                 │
└─────────────────────────────────────────────────────────────┘
           │                                    │
           │                                    │
  ┌────────▼──────────┐              ┌─────────▼──────────┐
  │  Oracle Cloud VM  │              │   Votre PC Local   │
  │  (Discord Bot)    │◄─────────────┤                    │
  │                   │   HTTPS/HTTP │  - Ollama :11434   │
  │  - Bot Node.js    │              │  - Python API:8000 │
  │  - Léger (1GB+)   │              │  - GPU (optionnel) │
  └───────────────────┘              └────────────────────┘
```

**Avantages :**

- ✅ Bot toujours en ligne sur Oracle Cloud (gratuit)
- ✅ GPU local pour génération d'images
- ✅ Pas de limite de RAM sur votre PC
- ✅ Latence acceptable (100-300ms)

**Inconvénients :**

- ⚠️ Votre PC doit rester allumé
- ⚠️ Nécessite exposition de ports (11434, 8000)

---

## 💻 Configuration de votre PC local

### 1. Obtenir votre IP publique

```powershell
# PowerShell - Obtenir votre IP publique
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

Notez cette IP (ex: `203.0.113.45`). Si votre IP change souvent, utilisez un service de DNS dynamique (No-IP, DuckDNS, etc.).

### 2. Configurer le pare-feu Windows

```powershell
# PowerShell (en tant qu'administrateur)
# Autoriser Ollama
New-NetFirewallRule -DisplayName "Ollama API" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow

# Autoriser Python Image API
New-NetFirewallRule -DisplayName "Python Image API" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### 3. Configurer votre routeur (Port Forwarding)

Vous devez rediriger les ports de votre routeur vers votre PC local :

1. Accédez à l'interface de votre routeur (généralement http://192.168.1.1)
2. Trouvez la section **Port Forwarding** ou **NAT**
3. Ajoutez ces règles :

| Nom        | Port Externe | Port Interne | IP Locale   | Protocole |
|------------|--------------|--------------|-------------|-----------|
| Ollama     | 11434        | 11434        | 192.168.1.X | TCP       |
| Python API | 8000         | 8000         | 192.168.1.X | TCP       |

💡 Remplacez `192.168.1.X` par l'IP locale de votre PC (visible dans `ipconfig`).

### 4. Démarrer Ollama (si pas déjà fait)

```powershell
# PowerShell
ollama serve
```

Ollama devrait écouter sur `http://0.0.0.0:11434` (accessible depuis internet).

### 5. Configurer l'API Python pour écouter sur toutes les interfaces

#### Option A : Démarrage automatique au boot Windows (recommandé)

Des scripts ont été créés pour démarrer automatiquement l'API au démarrage de Windows :

1. **Ouvrir PowerShell en tant qu'administrateur** :
    - Clic droit sur l'icône Windows → **Terminal (Admin)** ou **Windows PowerShell (Admin)**

2. **Naviguer vers le dossier** :
   ```powershell
   cd "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services"
   ```

3. **Exécuter le script de configuration** :
   ```powershell
   .\setup-autostart.ps1
   ```

4. **Suivre les instructions** affichées

✅ L'API Python démarrera automatiquement à chaque démarrage de Windows !

Pour plus de détails, consultez `python_services/README_AUTOSTART.md`

#### Option B : Démarrage manuel

Si vous préférez démarrer l'API manuellement :

```powershell
# PowerShell (dans python_services/)
cd python_services
C:\Users\samyl\venv\Scripts\Activate.ps1
python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000
```

⚠️ **Important** : `--host 0.0.0.0` permet l'accès depuis internet.

### 6. Tester l'accès externe

Depuis un autre appareil (smartphone en 4G par exemple) :

```bash
# Tester Ollama
curl http://VOTRE_IP_PUBLIQUE:11434/api/tags

# Tester Python API
curl http://VOTRE_IP_PUBLIQUE:8000/
```

Si ça fonctionne, vous verrez une réponse JSON ✅

### 7. (Optionnel) Utiliser un DNS dynamique

Si votre IP change souvent :

1. Créez un compte sur **DuckDNS** (gratuit) : https://www.duckdns.org/
2. Créez un sous-domaine (ex: `monbot.duckdns.org`)
3. Installez le client DuckDNS sur votre PC pour mettre à jour automatiquement l'IP

### 8. (TRÈS RECOMMANDÉ) Sécuriser avec HTTPS

Pour éviter les attaques, utilisez un reverse proxy avec HTTPS :

**Option A : Cloudflare Tunnel (gratuit, recommandé)**

```powershell
# Télécharger cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Créer un tunnel
cloudflared tunnel create monbot

# Configurer le tunnel
# Redirige monbot-ollama.votredomaine.com → localhost:11434
# Redirige monbot-images.votredomaine.com → localhost:8000
```

**Option B : ngrok (simple mais limité en gratuit)**

```powershell
# Installer ngrok : https://ngrok.com/download

# Tunnel Ollama
ngrok http 11434

# Tunnel Python API (dans un autre terminal)
ngrok http 8000
```

Notez les URLs générées (ex: `https://abc123.ngrok.io`)

---

## 🌐 Création de l'instance Oracle Cloud

### 1. Instance recommandée (Always Free)

Oracle Cloud offre **2 instances gratuites**. Comme vous n'installez QUE le bot (sans LLM/Stable Diffusion), vous pouvez utiliser :

- **VM.Standard.E2.1.Micro** (x86) - **SUFFISANT !**
    - 1 OCPU
    - 1 GB RAM ✅ (le bot seul utilise ~200-400 MB)
    - 50 GB stockage

OU (si vous voulez plus de ressources)

- **VM.Standard.A1.Flex** (ARM-based)
    - 2 OCPUs
    - 12 GB RAM (largement suffisant)
    - 100 GB stockage

**👉 VM.Standard.E2.1.Micro est parfait pour votre cas !**

### 2. Création de l'instance

1. Connectez-vous à Oracle Cloud Console
2. Menu hamburger → **Compute** → **Instances**
3. Cliquez **Create Instance**

**Configuration :**

- **Name** : `discord-bot-netricsa`
- **Image** : Ubuntu 22.04
- **Shape** : VM.Standard.E2.1.Micro (Always Free)
- **Networking** :
    - VCN : Créer nouveau ou sélectionner existant
    - Subnet : Public subnet
    - Assign public IP : ✅ Oui
- **SSH Keys** :
    - Générez une nouvelle paire ou uploadez votre clé publique
    - ⚠️ **IMPORTANT** : Téléchargez et sauvegardez la clé privée !

4. Cliquez **Create**

### 3. Configuration du pare-feu Oracle Cloud

⚠️ **AUCUN port supplémentaire nécessaire** ! Le bot se connecte à Discord (sortant) et à vos services locaux (sortant). Seul SSH est nécessaire.

1. Dans votre instance → **Virtual Cloud Network**
2. Cliquez sur votre VCN
3. **Security Lists** → Votre security list par défaut
4. Vérifiez que le port **22 (SSH)** est ouvert

✅ C'est tout ! Pas besoin d'ouvrir 11434 ou 8000 sur Oracle Cloud.

---

## 🔧 Configuration initiale du serveur

### 1. Connexion SSH

```bash
# Sur votre machine locale (Windows PowerShell)
ssh -i C:\chemin\vers\votre-cle-privee.key ubuntu@VOTRE_IP_PUBLIQUE
```

### 2. Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Configuration du pare-feu Ubuntu (UFW)

```bash
# Activer UFW - Seul SSH est nécessaire !
sudo ufw allow 22/tcp    # SSH uniquement
sudo ufw enable
sudo ufw status
```

✅ Pas besoin d'ouvrir d'autres ports, le bot fait des connexions **sortantes** vers vos services locaux.

---

## 📦 Installation des dépendances

### 1. Installer Node.js (v20+)

```bash
# Via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier
node --version
npm --version
```

### 2. Installer Python 3.11+ et pip

```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version
```

### 2. Installer Git

```bash
sudo apt install -y git
```

⚠️ **Note** : Vous n'avez PAS besoin d'installer Ollama ni Python sur Oracle Cloud ! Ils tournent sur votre PC local.

---

## 🤖 Configuration du bot

### 1. Cloner le repository

```bash
cd ~
git clone https://github.com/VOTRE_USERNAME/discord-bot-llm.git
cd discord-bot-llm
```

### 2. Installer les dépendances Node.js

```bash
npm install
```

### 3. Compiler TypeScript

```bash
npx tsc
```

⚠️ **Pas besoin d'installer les dépendances Python** sur Oracle Cloud, elles tournent sur votre PC local !

### 4. Créer le fichier `.env`

```bash
cd ~/discord-bot-llm
nano .env
```

**Contenu du fichier `.env` :**

```bash
# ===== DISCORD =====
DISCORD_LLM_BOT_TOKEN=votre_token_discord_ici

# ===== CHANNELS IDS =====
WATCH_CHANNEL_ID=123456789  # Channel où le bot écoute
WELCOME_CHANNEL_ID=123456789
LOG_CHANNEL_ID=123456789
NETRICSA_LOG_CHANNEL_ID=123456789
FORUM_CHANNEL_ID=123456789
CREATION_FORUM_ID=123456789
MEME_CHANNEL_ID=123456789

# ===== OLLAMA (Sur votre PC LOCAL) =====
OLLAMA_TEXT_MODEL=llama3.1:8b-instruct-q8_0
OLLAMA_VISION_MODEL=qwen2.5-vl:7b

# ===== API PYTHON (Sur votre PC LOCAL) =====
# Remplacez par votre IP publique ou domaine DuckDNS
IMAGE_API_URL=http://VOTRE_IP_PUBLIQUE:8000

# ===== API KEYS (optionnel) =====
BRAVE_SEARCH_API_KEY=votre_cle_brave_si_vous_en_avez

# ===== CHEMINS =====
SYSTEM_PROMPT_PATH=./data/system_prompt.txt
MEMORY_FILE=./data/memory.json

# ===== SUBREDDITS MEMES =====
MEME_SUBREDDITS=shitposting,memes,dankmemes

# ===== DEBUG =====
DEBUG_OLLAMA_RAW=0
```

**💾 Sauvegarder** : `Ctrl+O` → `Enter` → `Ctrl+X`

⚠️ **IMPORTANT** : Remplacez `VOTRE_IP_PUBLIQUE` par :

- Votre IP publique (ex: `203.0.113.45`)
- Ou votre domaine DuckDNS (ex: `monbot.duckdns.org`)
- Ou votre URL ngrok (ex: `abc123.ngrok.io`)

---

## 🔗 Connexion bot → services locaux

### Modifier les URLs dans le code

Vous devez modifier **1 fichier** pour que le bot sur Oracle Cloud se connecte à vos services locaux :

#### Modifier `src/utils/constants.ts`

```bash
nano ~/discord-bot-llm/src/utils/constants.ts
```

Trouvez la ligne (vers la ligne 52) :

```typescript
export const OLLAMA_API_URL = "http://localhost:11434";
```

Remplacez par :

```typescript
export const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
```

**Sauvegarder** : `Ctrl+O` → `Enter` → `Ctrl+X`

#### Ajouter `OLLAMA_API_URL` dans `.env`

```bash
nano ~/discord-bot-llm/.env
```

Ajoutez cette ligne (après les channels IDs) :

```bash
# ===== OLLAMA (Sur votre PC LOCAL) =====
OLLAMA_API_URL=http://VOTRE_IP_PUBLIQUE:11434
OLLAMA_TEXT_MODEL=llama3.1:8b-instruct-q8_0
OLLAMA_VISION_MODEL=qwen2.5-vl:7b
```

Remplacez `VOTRE_IP_PUBLIQUE` par :

- Votre IP publique (ex: `http://203.0.113.45:11434`)
- Ou votre domaine DuckDNS (ex: `http://monbot.duckdns.org:11434`)
- Ou votre URL ngrok (ex: `https://abc123.ngrok.io`)

**Sauvegarder** : `Ctrl+O` → `Enter` → `Ctrl+X`

#### Recompiler TypeScript

```bash
cd ~/discord-bot-llm
npx tsc
```

### Vérification de la connexion

Depuis Oracle Cloud, testez la connexion à vos services locaux :

```bash
# Tester Ollama
curl http://VOTRE_IP_PUBLIQUE:11434/api/tags

# Tester Python API
curl http://VOTRE_IP_PUBLIQUE:8000/

# Devrait retourner des JSON valides
```

Si ça ne fonctionne pas :

- ✅ Vérifiez que les ports 11434 et 8000 sont bien forwardés dans votre routeur
- ✅ Vérifiez que le pare-feu Windows autorise ces ports
- ✅ Vérifiez que votre PC local est allumé et les services démarrés
- ✅ Testez depuis votre smartphone en 4G pour valider l'accès externe

### Configuration finale

Votre fichier `.env` sur Oracle Cloud devrait ressembler à ça :

```bash
# ===== DISCORD =====
DISCORD_LLM_BOT_TOKEN=votre_token

# ===== CHANNELS IDS =====
WATCH_CHANNEL_ID=123456789
# ... autres channels ...

# ===== OLLAMA (PC Local) =====
OLLAMA_API_URL=http://203.0.113.45:11434
OLLAMA_TEXT_MODEL=llama3.1:8b-instruct-q8_0
OLLAMA_VISION_MODEL=qwen2.5-vl:7b

# ===== PYTHON API (PC Local) =====
IMAGE_API_URL=http://203.0.113.45:8000

# ===== Reste de la config... =====
```

✅ **Le bot sur Oracle Cloud se connectera maintenant à vos services locaux !**

---

## 🔄 Adaptation pour le cloud

### Important : Configuration des URLs

Votre bot utilise **3 services** :

1. **Bot Discord (Node.js)** - Port 3000 (non utilisé actuellement)
2. **Ollama (LLM)** - Port 11434
3. **Python Image API** - Port 8000

**Sur Oracle Cloud, tout fonctionne en LOCAL** :

- ✅ `OLLAMA_API_URL` reste `http://localhost:11434`
- ✅ `IMAGE_API_URL` reste `http://localhost:8000`

### Fichiers à vérifier

Les fichiers suivants utilisent déjà `localhost` par défaut (aucune modification nécessaire) :

- `src/utils/constants.ts` :
  ```typescript
  export const OLLAMA_API_URL = "http://localhost:11434";
  ```

- `src/services/imageGenerationService.ts` :
  ```typescript
  const IMAGE_API_URL = process.env.IMAGE_API_URL || "http://localhost:8000";
  ```

✅ **Rien à modifier si tout tourne sur le même serveur !**

---

## ⚙️ Démarrage automatique

### Option 1 : Utiliser `systemd` (recommandé)

#### 1. Service pour le bot Discord

```bash
sudo nano /etc/systemd/system/discord-bot.service
```

```ini
[Unit]
Description=Discord Bot Netricsa
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/discord-bot-llm
ExecStart=/usr/bin/node /home/ubuntu/discord-bot-llm/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/home/ubuntu/discord-bot-llm/logs/bot.log
StandardError=append:/home/ubuntu/discord-bot-llm/logs/bot-error.log

# Variables d'environnement
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

**💡 Note** : Le bot lit automatiquement le fichier `.env` au démarrage.

#### 2. Créer le dossier de logs

```bash
mkdir -p ~/discord-bot-llm/logs
```

#### 3. Activer et démarrer le service

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Activer au démarrage
sudo systemctl enable discord-bot.service

# Démarrer le service
sudo systemctl start discord-bot.service

# Vérifier le statut
sudo systemctl status discord-bot.service
```

### Option 2 : Utiliser `screen` (simple, mais moins robuste)

```bash
# Démarrer le bot dans un screen
screen -S discord-bot
cd ~/discord-bot-llm
node dist/index.js
# Ctrl+A puis D pour détacher

# Réattacher à un screen
screen -r discord-bot
```

---

## 📊 Monitoring et logs

### Commandes utiles sur Oracle Cloud

```bash
# Voir les logs du bot en temps réel
tail -f ~/discord-bot-llm/logs/bot.log

# Voir les erreurs du bot
tail -f ~/discord-bot-llm/logs/bot-error.log

# Voir les logs système
sudo journalctl -u discord-bot.service -f

# Redémarrer le bot
sudo systemctl restart discord-bot.service

# Arrêter le bot
sudo systemctl stop discord-bot.service

# Voir le statut
sudo systemctl status discord-bot.service
```

### Surveiller les ressources sur Oracle Cloud

```bash
# RAM et CPU
htop

# Espace disque
df -h

# Tester la connexion vers vos services locaux
curl http://VOTRE_IP_PUBLIQUE:11434/api/tags
curl http://VOTRE_IP_PUBLIQUE:8000/
```

### Surveiller votre PC local (Windows)

```powershell
# Vérifier que Ollama tourne
Get-Process ollama

# Vérifier que Python API tourne
Get-NetTCPConnection -LocalPort 8000

# Voir les ports ouverts
netstat -an | findstr "11434"
netstat -an | findstr "8000"
```

---

## ⚡ Optimisations

### 1. Rotation des logs sur Oracle Cloud

```bash
sudo nano /etc/logrotate.d/discord-bot
```

```
/home/ubuntu/discord-bot-llm/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### 2. Nettoyer les anciennes images localement

Sur votre PC Windows, créez un script PowerShell :

```powershell
# cleanup-images.ps1
$imagePath = "C:\Users\VOTRE_USER\path\to\discord-bot-llm\generated_images"
$daysToKeep = 7
Get-ChildItem $imagePath -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$daysToKeep) } | Remove-Item -Force
```

Puis créez une tâche planifiée Windows pour l'exécuter quotidiennement.

### 3. Optimiser Ollama sur votre PC local

Limitez l'utilisation de RAM si nécessaire :

```powershell
# Variables d'environnement Windows
[System.Environment]::SetEnvironmentVariable('OLLAMA_MAX_LOADED_MODELS', '1', 'User')
[System.Environment]::SetEnvironmentVariable('OLLAMA_NUM_PARALLEL', '1', 'User')
```

Redémarrez Ollama après modification.

---

## 🐛 Dépannage

### Le bot ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u discord-bot.service -n 50

# Vérifier que Node.js fonctionne
cd ~/discord-bot-llm
node dist/index.js

# Vérifier les permissions
ls -la ~/discord-bot-llm
```

### Le bot ne se connecte pas aux services locaux

**Erreur** : `ECONNREFUSED` ou `Connection timeout`

1. **Vérifier depuis Oracle Cloud** :

```bash
# Tester la connexion
curl -v http://VOTRE_IP_PUBLIQUE:11434/api/tags
curl -v http://VOTRE_IP_PUBLIQUE:8000/
```

2. **Vérifier sur votre PC local** :

```powershell
# PowerShell - Vérifier que les services écoutent
netstat -an | findstr "11434"
netstat -an | findstr "8000"

# Tester depuis l'extérieur (smartphone 4G)
# http://VOTRE_IP_PUBLIQUE:11434/api/tags
```

3. **Problèmes courants** :

- ❌ Port forwarding non configuré → Configurez votre routeur
- ❌ Pare-feu Windows bloque → Ajoutez les règles
- ❌ Ollama n'écoute que sur localhost → Changez en `0.0.0.0`
- ❌ IP publique a changé → Utilisez DuckDNS
- ❌ PC local éteint → Allumez-le ! 😅

### Ollama ne répond pas (sur PC local)

```powershell
# PowerShell - Redémarrer Ollama
taskkill /IM ollama.exe /F
ollama serve
```

### L'API Python plante (sur PC local)

```powershell
# PowerShell - Redémarrer l'API
# Ctrl+C dans le terminal où elle tourne
cd python_services
.\venv\Scripts\Activate.ps1
python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000
```

### Le bot se déconnecte souvent

Vérifiez votre connexion réseau Oracle Cloud :

```bash
# Test de latence
ping discord.com

# Test vers vos services locaux
ping VOTRE_IP_PUBLIQUE
```

### Latence élevée (>1s)

C'est normal avec une architecture hybride ! La requête doit :

1. Discord → Oracle Cloud (50-100ms)
2. Oracle Cloud → Votre PC (50-200ms)
3. Traitement LLM (500-2000ms)
4. Votre PC → Oracle Cloud (50-200ms)
5. Oracle Cloud → Discord (50-100ms)

**Total** : 700ms - 2.5s (acceptable)

---

## 🔐 Sécurité

### 1. Configurer un pare-feu strict

```bash
# Ne gardez que SSH ouvert publiquement
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw enable
```

### 2. Désactiver l'authentification par mot de passe SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Modifiez :

```
PasswordAuthentication no
```

```bash
sudo systemctl restart ssh
```

### 3. Configurer fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 📝 Mise à jour du bot

```bash
cd ~/discord-bot-llm
git pull origin main
npm install
npx tsc

# Redémarrer le service
sudo systemctl restart discord-bot.service
```

### Mise à jour des services locaux (sur votre PC)

```powershell
# PowerShell - Mise à jour du code
cd discord-bot-llm
git pull origin main

# Mise à jour Python API
cd python_services
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt --upgrade

# Redémarrer les services (Ctrl+C et relancer)
```

---

## 📋 Checklist de déploiement

### Sur votre PC local :

- [ ] IP publique connue (ou DNS dynamique configuré)
- [ ] Pare-feu Windows configuré (ports 11434, 8000)
- [ ] Port forwarding configuré sur le routeur
- [ ] Ollama démarré et accessible depuis internet
- [ ] Python API démarrée avec `--host 0.0.0.0`
- [ ] Test d'accès externe réussi (depuis smartphone 4G)

### Sur Oracle Cloud :

- [ ] Instance Oracle Cloud créée (VM.Standard.E2.1.Micro ou A1.Flex)
- [ ] Connexion SSH fonctionnelle
- [ ] Système à jour (`apt update && apt upgrade`)
- [ ] Node.js installé (v20+)
- [ ] Git installé
- [ ] Repository cloné
- [ ] Dépendances Node.js installées (`npm install`)
- [ ] TypeScript compilé (`npx tsc`)
- [ ] Fichier `.env` configuré avec les IPs/URLs de vos services locaux
- [ ] Fichier `constants.ts` modifié pour utiliser `process.env.OLLAMA_API_URL`
- [ ] Test de connexion vers services locaux réussi
- [ ] Service systemd créé et activé
- [ ] Pare-feu configuré (UFW - SSH uniquement)
- [ ] Logs accessibles et rotation configurée
- [ ] Bot démarré et connecté à Discord ✅

---

## 🎉 Résultat

Votre bot Discord devrait maintenant être **100% opérationnel** sur Oracle Cloud !

- ✅ Conversations avec LLM (Ollama)
- ✅ Analyse d'images (Vision)
- ✅ Génération d'images (Stable Diffusion)
- ✅ Upscaling (Real-ESRGAN)
- ✅ Démarrage automatique au boot
- ✅ Logs persistants

**Coût : 0€ avec Oracle Cloud Free Tier** 🎊

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs : `~/discord-bot-llm/logs/`
2. Testez chaque service individuellement
3. Consultez la documentation Oracle Cloud
4. Vérifiez que les ports sont bien ouverts

**Bon déploiement ! 🚀**














