# 🧪 Guide de Test des Ports Ouverts

## ✅ Checklist de Test

### Étape 1 : Démarrer vos services localement

#### 1.1 Démarrer Ollama

Ouvrez une fenêtre PowerShell et exécutez :

```powershell
ollama serve
```

✅ Laissez cette fenêtre **OUVERTE**. Vous devriez voir :

```
Listening on 127.0.0.1:11434 (version 0.x.x)
```

#### 1.2 Démarrer l'API Python

Ouvrez une **NOUVELLE** fenêtre PowerShell et exécutez :

```powershell
cd C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services
C:\Users\samyl\venv\Scripts\Activate.ps1
python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000
```

✅ Laissez cette fenêtre **OUVERTE**. Vous devriez voir :

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

⚠️ **IMPORTANT** : `--host 0.0.0.0` permet l'accès depuis Internet !

---

### Étape 2 : Obtenir votre IP publique

Ouvrez une **NOUVELLE** fenêtre PowerShell et exécutez :

```powershell
Invoke-RestMethod -Uri "https://api.ipify.org"
```

Ou allez sur : https://www.whatismyip.com/

📝 **Notez votre IP publique** (ex: `24.157.145.146`)

---

### Étape 3 : Tester en LOCAL (sur votre PC)

Dans une fenêtre PowerShell, testez que les services répondent localement :

#### Test Ollama (local)

```powershell
curl http://localhost:11434/api/tags
```

✅ Devrait retourner une liste JSON de modèles

#### Test Python API (local)

```powershell
curl http://localhost:8000/
```

✅ Devrait retourner `{"message":"Image Generation API"}`

Si ces tests échouent, vos services ne sont pas démarrés correctement. Retournez à l'Étape 1.

---

### Étape 4 : Tester DEPUIS INTERNET (Important !)

⚠️ **NE TESTEZ PAS depuis votre PC** - ça utilisera le réseau local !

#### Option A : Utiliser votre smartphone (RECOMMANDÉ)

1. **Désactivez le WiFi** sur votre téléphone (utilisez les données 4G/5G)
2. Ouvrez un navigateur web sur votre téléphone
3. Testez ces URLs (remplacez `VOTRE_IP` par votre IP publique) :

**Test Ollama :**

```
http://VOTRE_IP_PUBLIQUE:11434/api/tags
```

✅ Devrait afficher du JSON avec vos modèles

**Test Python API :**

```
http://VOTRE_IP_PUBLIQUE:8000/
```

✅ Devrait afficher `{"message":"Image Generation API"}`

#### Option B : Utiliser un site de test en ligne

Allez sur : https://www.yougetsignal.com/tools/open-ports/

- **Remote Address** : Votre IP publique
- **Port Number** : `11434` puis `8000`
- Cliquez **Check**

✅ Devrait dire "Port is OPEN"

#### Option C : Utiliser un VPN ou proxy web

Si vous avez un VPN, connectez-vous et testez depuis une autre fenêtre PowerShell :

```powershell
# Testez depuis votre VPN
curl http://VOTRE_IP_PUBLIQUE:11434/api/tags
curl http://VOTRE_IP_PUBLIQUE:8000/
```

---

### Étape 5 : Diagnostiquer les problèmes

#### ❌ "Connection refused" ou "Timeout"

**Problème** : Les ports ne sont pas accessibles depuis Internet.

**Solutions** :

1. **Vérifiez le port forwarding sur votre routeur** :
    - Connectez-vous à votre routeur (généralement http://192.168.1.1)
    - Vérifiez que vous avez bien créé ces règles :
        - Port externe `11434` → IP locale de votre PC → Port interne `11434`
        - Port externe `8000` → IP locale de votre PC → Port interne `8000`

2. **Vérifiez votre IP locale** :
   ```powershell
   ipconfig
   ```
   Cherchez `Adresse IPv4` (ex: `192.168.1.100`)
   ✅ Cette IP doit correspondre à celle dans le port forwarding de votre routeur

3. **Vérifiez le pare-feu Windows** :
   ```powershell
   # Vérifier les règles
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Ollama*" -or $_.DisplayName -like "*Python*"}
   ```
   Si aucune règle n'apparaît, créez-les :
   ```powershell
   # En tant qu'administrateur
   New-NetFirewallRule -DisplayName "Ollama API" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Python Image API" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```

4. **Vérifiez que les services écoutent sur 0.0.0.0** :
   ```powershell
   netstat -an | findstr "11434"
   netstat -an | findstr "8000"
   ```
   ✅ Vous devriez voir :
   ```
   TCP    0.0.0.0:11434          0.0.0.0:0              LISTENING
   TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING
   ```

   ❌ Si vous voyez `127.0.0.1:11434`, Ollama n'écoute que localement !

   **Solution pour Ollama** :
    - Éditez la variable d'environnement : `OLLAMA_HOST=0.0.0.0`
    - Redémarrez Ollama

---

### Étape 6 : Configuration finale pour Oracle Cloud

Une fois que les tests **depuis Internet** fonctionnent, notez ces informations :

**Votre IP publique :** `_________________________`

**URLs à utiliser dans Oracle Cloud :**

- Ollama : `http://VOTRE_IP_PUBLIQUE:11434`
- Python API : `http://VOTRE_IP_PUBLIQUE:8000`

Vous devrez ajouter ces URLs dans le fichier `.env` sur Oracle Cloud :

```bash
OLLAMA_API_URL=http://VOTRE_IP_PUBLIQUE:11434
IMAGE_API_URL=http://VOTRE_IP_PUBLIQUE:8000
```

---

## 🎯 Résumé : Tests Réussis

✅ **Ollama accessible depuis Internet** : `http://VOTRE_IP:11434/api/tags` retourne du JSON
✅ **Python API accessible depuis Internet** : `http://VOTRE_IP:8000/` retourne du JSON
✅ **IP publique notée** : `_________________________`
✅ **Services démarrés et laissés ouverts**

**Vous êtes prêt pour déployer sur Oracle Cloud !** 🚀

---

## 💡 Conseils de Sécurité

⚠️ Vos ports sont maintenant **ouverts sur Internet**. Pour plus de sécurité :

### Option 1 : DuckDNS (DNS Dynamique gratuit)

Si votre IP change souvent :

1. Créez un compte sur https://www.duckdns.org/
2. Créez un sous-domaine (ex: `netricsa-bot.duckdns.org`)
3. Utilisez ce domaine au lieu de l'IP

### Option 2 : Cloudflare Tunnel (HTTPS gratuit)

Pour sécuriser avec HTTPS :

1. Créez un compte Cloudflare
2. Installez `cloudflared`
3. Créez un tunnel qui redirige :
    - `ollama.votredomaine.com` → `localhost:11434`
    - `images.votredomaine.com` → `localhost:8000`

---

## 📞 Besoin d'aide ?

Si les tests échouent :

1. Vérifiez que vos services sont bien démarrés (Étape 1)
2. Testez en local d'abord (Étape 3)
3. Vérifiez le port forwarding sur votre routeur
4. Vérifiez le pare-feu Windows
5. Testez depuis votre smartphone en 4G (pas en WiFi !)

**Bonne chance !** 🎉

