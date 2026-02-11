# 🎯 Solution SIMPLE : IP publique + Port Forwarding (sans HTTPS)

## ✅ Pourquoi cette solution est parfaite pour vous

**HTTPS n'est PAS nécessaire** pour votre bot Discord car :

- La communication est entre **votre bot** et **vos services privés**
- Pas d'utilisateurs externes
- HTTP simple est suffisant et sécurisé pour ce cas

## 🚀 Configuration (15 minutes)

### Étape 1 : Trouver l'IP locale de votre PC ✅

**Votre IP locale** : `10.0.0.188`

### Étape 2 : Configurer le port forwarding sur votre routeur

#### A. Accéder au routeur

1. **Ouvrir un navigateur**
2. **Aller à l'une de ces adresses** :
    - http://192.168.0.1
    - http://10.0.0.1
    - http://192.168.1.1
    - Ou voir l'IP de la passerelle :
      ```powershell
      ipconfig | findstr "Passerelle"
      ```

3. **Se connecter** :
    - Identifiant : `admin` (ou voir sous le routeur)
    - Mot de passe : `admin` / `password` / (ou voir sous le routeur)

#### B. Créer les règles de port forwarding

**Cherchez dans les menus** :

- "Port Forwarding"
- "Virtual Server"
- "NAT"
- "Applications et jeux"

**Créez 2 règles** :

**Règle 1 : Ollama**

```
Nom/Description : Ollama
Type : TCP
Port externe/WAN : 11434
IP locale/LAN : 10.0.0.188
Port interne/LAN : 11434
Protocole : TCP
État : Activé
```

**Règle 2 : Python Image API**

```
Nom/Description : Python API
Type : TCP
Port externe/WAN : 8000
IP locale/LAN : 10.0.0.188
Port interne/LAN : 8000
Protocole : TCP
État : Activé
```

**Sauvegardez** les paramètres.

### Étape 3 : Configurer le pare-feu Windows

**Autoriser les ports entrants** :

```powershell
# PowerShell en Administrateur

# Ollama
New-NetFirewallRule -DisplayName "Ollama (Port 11434)" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow

# Python API
New-NetFirewallRule -DisplayName "Python Image API (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### Étape 4 : Tester l'accès depuis l'extérieur

**Option A : Depuis votre téléphone (4G, pas WiFi)**

Ouvrez un navigateur mobile et allez sur :

- `http://netricsa-bot.duckdns.org:11434/api/tags`

Vous devriez voir une réponse JSON d'Ollama.

**Option B : Test en ligne**

Utilisez https://www.yougetsignal.com/tools/open-ports/

- Entrez votre IP : `24.157.145.146` (ou utilisez `netricsa-bot.duckdns.org`)
- Port : `11434`
- Check

Si "open", c'est bon ! ✅

### Étape 5 : Mettre à jour Oracle Cloud

**SSH vers votre serveur** :

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189
```

**Éditer le .env** :

```bash
nano ~/discord-bot-llm/.env
```

**Modifier ces lignes** :

```bash
# ===== OLLAMA =====
OLLAMA_API_URL=http://netricsa-bot.duckdns.org:11434

# ===== PYTHON API =====
IMAGE_API_URL=http://netricsa-bot.duckdns.org:8000
```

**Ctrl+X**, **Y**, **Entrée** pour sauvegarder.

**Recompiler et redémarrer le bot** :

```bash
cd ~/discord-bot-llm
npx tsc
sudo systemctl restart discord-bot.service
sudo systemctl status discord-bot.service
```

Vérifiez que le bot démarre sans erreur.

---

## 🧪 Vérification complète

### Sur votre PC Windows

```powershell
# Vérifier DuckDNS
nslookup netricsa-bot.duckdns.org
Get-Content C:\DuckDNS\update-log.txt -Tail 3

# Vérifier que les services tournent
Get-Process | Where-Object { $_.ProcessName -like "*python*" -or $_.ProcessName -like "*ollama*" }

# Tester en local
curl http://localhost:11434/api/tags
curl http://localhost:8000/
```

### Depuis internet (téléphone 4G)

```
http://netricsa-bot.duckdns.org:11434/api/tags
http://netricsa-bot.duckdns.org:8000/
```

### Sur Oracle Cloud

```bash
# Voir les logs du bot
sudo journalctl -u discord-bot.service -n 50 --no-pager

# Tester la connexion depuis Oracle Cloud
curl http://netricsa-bot.duckdns.org:11434/api/tags
curl http://netricsa-bot.duckdns.org:8000/
```

---

## 🔐 Sécurité (Optionnel mais recommandé)

### Limiter l'accès à Oracle Cloud uniquement

Si vous voulez que SEULEMENT votre serveur Oracle Cloud puisse accéder :

**Méthode 1 : IP Whitelist dans le pare-feu Windows**

```powershell
# Supprimer les règles générales
Remove-NetFirewallRule -DisplayName "Ollama (Port 11434)"
Remove-NetFirewallRule -DisplayName "Python Image API (Port 8000)"

# Créer des règles restreintes à l'IP d'Oracle Cloud
New-NetFirewallRule -DisplayName "Ollama (Oracle Only)" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow -RemoteAddress 151.145.51.189

New-NetFirewallRule -DisplayName "Python API (Oracle Only)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -RemoteAddress 151.145.51.189
```

**Inconvénient** : Si l'IP d'Oracle Cloud change, vous devrez mettre à jour.

---

## 📊 Ce qui démarre automatiquement

Avec cette configuration :

1. ✅ **DuckDNS Update** - Toutes les 5 minutes
2. ✅ **Python Image API** - Au démarrage (si configuré)
3. ✅ **Ollama** - Doit être démarré manuellement ou configuré en service
4. ✅ **Port Forwarding** - Toujours actif (routeur)

---

## 🆘 Dépannage

### Le bot ne peut pas se connecter

**Vérifier depuis Oracle Cloud** :

```bash
# Test de connexion
curl -v http://netricsa-bot.duckdns.org:11434/api/tags
curl -v http://netricsa-bot.duckdns.org:8000/
```

Si ça ne fonctionne pas :

1. **Vérifier que les services tournent sur votre PC**
   ```powershell
   curl http://localhost:11434/api/tags
   curl http://localhost:8000/
   ```

2. **Vérifier le port forwarding**
    - Retourner dans les paramètres du routeur
    - Vérifier que les règles sont bien activées

3. **Vérifier le pare-feu Windows**
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Ollama*" -or $_.DisplayName -like "*Python*"}
   ```

4. **Vérifier que DuckDNS pointe vers la bonne IP**
   ```powershell
   nslookup netricsa-bot.duckdns.org
   # Compare avec :
   curl https://api.ipify.org
   ```

### Le port forwarding ne fonctionne pas

**Certains FAI bloquent les ports**. Si c'est le cas :

**Solution** : Utilisez des ports alternatifs non bloqués (ex: 8080, 443)

**Routeur** :

- Port externe : `8080` → Port interne : `11434`
- Port externe : `443` → Port interne : `8000`

**Oracle Cloud .env** :

```bash
OLLAMA_API_URL=http://netricsa-bot.duckdns.org:8080
IMAGE_API_URL=http://netricsa-bot.duckdns.org:443
```

---

## ✅ Checklist finale

- [ ] IP locale trouvée : `10.0.0.188`
- [ ] Port forwarding configuré sur le routeur (11434, 8000)
- [ ] Règles pare-feu Windows créées
- [ ] Test depuis téléphone 4G réussi
- [ ] `.env` sur Oracle Cloud mis à jour
- [ ] Bot redémarré sur Oracle Cloud
- [ ] Bot fonctionne et peut accéder aux services
- [ ] DuckDNS continue de mettre à jour l'IP

---

## 🎉 Résultat final

**URLs utilisées par le bot** :

- Ollama : `http://netricsa-bot.duckdns.org:11434`
- Python API : `http://netricsa-bot.duckdns.org:8000`

**Avantages** :

- ✅ 100% gratuit
- ✅ Simple (pas de tunnel complexe)
- ✅ Fonctionne parfaitement pour un bot Discord
- ✅ DuckDNS gère l'IP dynamique automatiquement

**Coût total** : **0$** 🎉

---

**C'est la solution la plus simple et la plus adaptée à votre cas !**

