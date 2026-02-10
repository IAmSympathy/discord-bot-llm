# ⚡ Guide de démarrage rapide - Architecture Hybride

## 🎯 Ce que vous allez faire

1. **Sur votre PC** : Exposer Ollama et l'API Python à internet
2. **Sur Oracle Cloud** : Installer et configurer le bot Discord
3. **Connecter les deux** : Le bot cloud utilisera vos services locaux

---

## 📍 Étape 1 : Préparer votre PC local (Windows)

### 1.1 Obtenir votre IP publique

```powershell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

Notez cette IP (ex: `203.0.113.45`)

### 1.2 Configurer le pare-feu Windows

```powershell
# En tant qu'administrateur
New-NetFirewallRule -DisplayName "Ollama API" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Python Image API" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### 1.3 Configurer le port forwarding sur votre routeur

Accédez à votre routeur (généralement `192.168.1.1`) et ajoutez :

| Service    | Port Externe | Port Interne | IP Locale   |
|------------|--------------|--------------|-------------|
| Ollama     | 11434        | 11434        | 192.168.1.X |
| Python API | 8000         | 8000         | 192.168.1.X |

💡 Trouvez votre IP locale avec : `ipconfig` (cherchez "IPv4")

### 1.4 Démarrer les services

```powershell
# Méthode automatique (recommandé)
.\start-local-services.ps1

# OU manuellement
# Terminal 1
ollama serve

# Terminal 2
cd python_services
.\venv\Scripts\Activate.ps1
python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000
```

### 1.5 Tester l'accès externe

Depuis votre smartphone (en 4G, pas WiFi) :

- Allez sur : `http://VOTRE_IP:11434/api/tags`
- Allez sur : `http://VOTRE_IP:8000/`

Si vous voyez du JSON, c'est bon ✅

---

## 📍 Étape 2 : Créer l'instance Oracle Cloud

1. Allez sur https://cloud.oracle.com/
2. Créez une instance **VM.Standard.E2.1.Micro** (Always Free)
3. Image : Ubuntu 22.04
4. Téléchargez votre clé SSH privée
5. Notez l'IP publique de l'instance

---

## 📍 Étape 3 : Configurer le serveur Oracle Cloud

### 3.1 Se connecter en SSH

```powershell
ssh -i C:\chemin\vers\votre-cle.key ubuntu@IP_ORACLE_CLOUD
```

### 3.2 Installer les dépendances

```bash
# Mise à jour
sudo apt update && sudo apt upgrade -y

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Pare-feu (SSH uniquement)
sudo ufw allow 22/tcp
sudo ufw enable
```

### 3.3 Cloner et installer le bot

```bash
cd ~
git clone https://github.com/VOTRE_USERNAME/discord-bot-llm.git
cd discord-bot-llm
npm install
```

### 3.4 Modifier `constants.ts`

```bash
nano src/utils/constants.ts
```

Changez la ligne 50 :

```typescript
export const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
```

### 3.5 Compiler TypeScript

```bash
npx tsc
```

### 3.6 Créer le fichier `.env`

```bash
nano .env
```

Copiez le contenu de `.env.oracle-cloud-example` et remplacez :

- `DISCORD_LLM_BOT_TOKEN` par votre token Discord
- `VOTRE_IP_PUBLIQUE` par votre IP obtenue à l'étape 1.1
- Les IDs de channels Discord

Sauvegardez avec `Ctrl+O`, `Enter`, puis `Ctrl+X`

### 3.7 Tester la connexion

```bash
# Copier le script de test
nano test-connection.sh
# Collez le contenu du fichier test-connection.sh

# Modifier l'IP dans le script
nano test-connection.sh
# Remplacez LOCAL_IP="VOTRE_IP_PUBLIQUE"

# Rendre exécutable et lancer
chmod +x test-connection.sh
bash test-connection.sh
```

Si tout est ✅, continuez !

---

## 📍 Étape 4 : Configurer le démarrage automatique

### 4.1 Créer le service systemd

```bash
sudo nano /etc/systemd/system/discord-bot.service
```

Copiez :

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
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

### 4.2 Activer et démarrer

```bash
# Créer le dossier de logs
mkdir -p ~/discord-bot-llm/logs

# Activer le service
sudo systemctl daemon-reload
sudo systemctl enable discord-bot.service
sudo systemctl start discord-bot.service

# Vérifier le statut
sudo systemctl status discord-bot.service
```

### 4.3 Voir les logs

```bash
tail -f ~/discord-bot-llm/logs/bot.log
```

---

## ✅ Checklist finale

### Sur votre PC :

- [ ] IP publique notée
- [ ] Pare-feu Windows configuré
- [ ] Port forwarding configuré sur le routeur
- [ ] Ollama démarré (`ollama serve`)
- [ ] Python API démarrée (port 8000, avec `--host 0.0.0.0`)
- [ ] Test d'accès externe réussi depuis smartphone

### Sur Oracle Cloud :

- [ ] Instance créée et accessible en SSH
- [ ] Bot cloné et dépendances installées
- [ ] `constants.ts` modifié (ligne 50)
- [ ] TypeScript compilé (`npx tsc`)
- [ ] `.env` configuré avec votre IP publique
- [ ] Test de connexion réussi (`test-connection.sh`)
- [ ] Service systemd créé et démarré
- [ ] Bot connecté à Discord ✅

---

## 🆘 Problèmes courants

### ❌ "Connection refused" depuis Oracle Cloud

**Cause** : Le bot ne peut pas accéder à vos services locaux

**Solutions** :

1. Vérifiez le port forwarding sur votre routeur
2. Vérifiez le pare-feu Windows
3. Testez depuis votre smartphone en 4G
4. Vérifiez que les services tournent sur votre PC

### ❌ "Cannot find module" sur Oracle Cloud

**Cause** : TypeScript pas compilé ou dépendances manquantes

**Solutions** :

```bash
cd ~/discord-bot-llm
npm install
npx tsc
```

### ❌ Le bot se connecte mais ne répond pas

**Cause** : Problème de connexion aux services LLM/Image

**Solutions** :

```bash
# Vérifier les logs
tail -f ~/discord-bot-llm/logs/bot.log

# Tester manuellement
curl http://VOTRE_IP:11434/api/tags
curl http://VOTRE_IP:8000/
```

---

## 🎉 C'est terminé !

Votre bot Discord devrait maintenant être en ligne 24/7 sur Oracle Cloud, utilisant votre PC local pour :

- Les requêtes LLM (Ollama)
- La génération d'images (Stable Diffusion)
- L'upscaling d'images (Real-ESRGAN)

**Coût total : 0€** (avec Oracle Cloud Free Tier)

---

## 📚 Documentation complète

Pour plus de détails, consultez :

- [ORACLE_CLOUD_DEPLOYMENT_GUIDE.md](ORACLE_CLOUD_DEPLOYMENT_GUIDE.md) - Guide complet
- [HYBRID_ARCHITECTURE_README.md](HYBRID_ARCHITECTURE_README.md) - Architecture détaillée

