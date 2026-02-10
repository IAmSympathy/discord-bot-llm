# 🔗 Architecture Hybride - Résumé Rapide

## Vue d'ensemble

Votre bot Discord utilise une architecture hybride pour optimiser les coûts :

- **Bot Discord** → Hébergé sur **Oracle Cloud** (gratuit, toujours en ligne)
- **Ollama (LLM)** → Sur **votre PC local** (utilise votre RAM/GPU)
- **API Python (Stable Diffusion)** → Sur **votre PC local** (utilise votre GPU)

```
Internet
   │
   ├─→ Oracle Cloud VM (Bot Discord) ──┐
   │                                    │
   └─→ Votre PC Local                  │
       ├─ Ollama :11434 ←──────────────┘
       └─ Python API :8000 ←───────────┘
```

## 🚀 Démarrage rapide

### Sur votre PC local (Windows)

1. **Démarrer les services automatiquement** :
   ```powershell
   .\start-local-services.ps1
   ```

2. **OU manuellement** :
   ```powershell
   # Terminal 1 - Ollama
   ollama serve
   
   # Terminal 2 - Python API
   cd python_services
   .\venv\Scripts\Activate.ps1
   python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000
   ```

3. **Obtenir votre IP publique** :
   ```powershell
   (Invoke-WebRequest -Uri "https://api.ipify.org").Content
   ```

4. **Tester l'accès externe** (depuis smartphone en 4G) :
    - Ollama : `http://VOTRE_IP:11434/api/tags`
    - Python API : `http://VOTRE_IP:8000/`

### Sur Oracle Cloud

1. **Configurer le bot** :
   ```bash
   # Modifier constants.ts
   nano ~/discord-bot-llm/src/utils/constants.ts
   # Changer: export const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
   
   # Configurer .env
   nano ~/discord-bot-llm/.env
   # Ajouter:
   # OLLAMA_API_URL=http://VOTRE_IP_PUBLIQUE:11434
   # IMAGE_API_URL=http://VOTRE_IP_PUBLIQUE:8000
   
   # Recompiler
   npx tsc
   ```

2. **Tester la connexion** :
   ```bash
   bash ~/discord-bot-llm/test-connection.sh
   ```

3. **Démarrer le bot** :
   ```bash
   sudo systemctl start discord-bot.service
   sudo systemctl status discord-bot.service
   ```

## ⚙️ Configuration requise

### PC Local

- [ ] Port forwarding configuré (11434, 8000)
- [ ] Pare-feu Windows : ports 11434, 8000 ouverts
- [ ] Ollama installé et démarré
- [ ] Python API démarrée avec `--host 0.0.0.0`
- [ ] PC allumé 24/7 (ou quand vous voulez que le bot fonctionne)

### Oracle Cloud

- [ ] Instance créée (VM.Standard.E2.1.Micro suffit)
- [ ] Bot installé et configuré
- [ ] URLs pointant vers votre PC local dans `.env`
- [ ] Service systemd configuré

## 📝 Fichiers importants

- **`ORACLE_CLOUD_DEPLOYMENT_GUIDE.md`** : Guide complet étape par étape
- **`start-local-services.ps1`** : Script pour démarrer les services sur Windows
- **`test-connection.sh`** : Script pour tester la connexion depuis Oracle Cloud

## 🔒 Sécurité

### Recommandations

1. **Utilisez un DNS dynamique** (DuckDNS) si votre IP change
2. **Utilisez Cloudflare Tunnel ou ngrok** pour HTTPS (plus sécurisé)
3. **Configurez des IP whitelistées** si possible
4. **Surveillez les logs** régulièrement

### Alternative sécurisée : Cloudflare Tunnel

Au lieu d'ouvrir les ports directement, utilisez Cloudflare Tunnel (gratuit) :

```powershell
# Installer cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

# Créer un tunnel
cloudflared tunnel create monbot

# Configurer
# ollama.votredomaine.com → localhost:11434
# images.votredomaine.com → localhost:8000
```

Puis dans `.env` sur Oracle Cloud :

```bash
OLLAMA_API_URL=https://ollama.votredomaine.com
IMAGE_API_URL=https://images.votredomaine.com
```

## 🆘 Aide rapide

### Le bot ne se connecte pas aux services

```bash
# Sur Oracle Cloud
curl http://VOTRE_IP:11434/api/tags
curl http://VOTRE_IP:8000/

# Sur PC local
netstat -an | findstr "11434"
netstat -an | findstr "8000"
```

### Redémarrer les services

**Sur PC local** :

```powershell
# Arrêter Ollama
taskkill /IM ollama.exe /F

# Redémarrer
ollama serve
```

**Sur Oracle Cloud** :

```bash
sudo systemctl restart discord-bot.service
```

## 📊 Monitoring

### PC Local

- Vérifiez que les services tournent
- Surveillez l'utilisation RAM/GPU
- Vérifiez que votre IP n'a pas changé

### Oracle Cloud

- Logs : `tail -f ~/discord-bot-llm/logs/bot.log`
- Status : `sudo systemctl status discord-bot.service`

## 💰 Coûts

- **Oracle Cloud** : 0€ (Free Tier)
- **Électricité PC** : Variable selon votre usage
- **Internet** : Aucun coût supplémentaire (utilise votre connexion existante)

## 🎯 Avantages de cette architecture

✅ Bot toujours en ligne (Oracle Cloud)
✅ Utilise votre GPU local pour les images
✅ Pas de limite de RAM pour Ollama
✅ Gratuit (Free Tier Oracle)
✅ Latence acceptable (~500ms-2s)

## ⚠️ Inconvénients

❌ PC doit rester allumé
❌ Dépend de votre connexion internet
❌ Configuration initiale plus complexe

---

**Pour le guide complet** : Consultez `ORACLE_CLOUD_DEPLOYMENT_GUIDE.md`

