# 🎮 FreeStuff Webhook - Configuration Correcte

## ⚠️ IMPORTANT : URL du Webhook

### ❌ URL INCORRECTE (votre PC local)

```
http://netricsa-bot.duckdns.org:3000/webhooks/freestuff
```

Cette URL pointe vers votre PC local, PAS vers le serveur Oracle où tourne le bot.

### ✅ URL CORRECTE (serveur Oracle Cloud)

```
http://151.145.51.189:3000/webhooks/freestuff
```

C'est l'adresse IP publique de votre serveur Oracle Cloud où le bot est hébergé.

---

## 🔧 Configuration dans le Dashboard FreeStuff

Rendez-vous sur : **https://dashboard.freestuffbot.xyz/**

### Paramètres à renseigner :

| Champ                  | Valeur                                                |
|------------------------|-------------------------------------------------------|
| **Webhook URL**        | `http://151.145.51.189:3000/webhooks/freestuff`       |
| **Compatibility Date** | `2025-03-01`                                          |
| **Events**             | ✅ announcement_created<br>✅ product_updated<br>✅ ping |
| **HTTP Method**        | `POST`                                                |
| **Content Type**       | `application/json`                                    |

---

## ✅ Vérification que le Serveur Oracle est Prêt

### 1. Vérifier que le bot est en ligne

```powershell
.\manage-bot.ps1
# Choisir option 1 (Statut)
```

Ou directement :

```powershell
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189 "pm2 status"
```

Vous devriez voir le bot **online**.

### 2. Vérifier que le port 3000 est ouvert sur Oracle Cloud

Le webhook Express doit être accessible depuis l'extérieur. Vérifiez :

#### a) Dans les logs du bot

```powershell
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189 "pm2 logs discord-bot-netricsa --lines 50 | grep -i webhook"
```

Vous devriez voir :

```
[FreeStuffWebhook] ✅ FreeStuff webhook server listening on port 3000
```

#### b) Test depuis votre PC

```powershell
Invoke-WebRequest -Uri "http://151.145.51.189:3000/health" -Method GET
```

**Résultat attendu :**

```json
{
  "status": "ok",
  "service": "freestuff-webhook",
  "timestamp": "2026-02-19T..."
}
```

**Si ça ne fonctionne pas :** Le port 3000 n'est probablement pas ouvert sur Oracle Cloud.

---

## 🔓 Ouvrir le Port 3000 sur Oracle Cloud

Si le test ci-dessus échoue, vous devez ouvrir le port 3000 :

### Étape 1 : Configuration dans Oracle Cloud Console

1. Connectez-vous à : https://cloud.oracle.com/
2. Menu **Compute** → **Instances**
3. Cliquez sur votre instance
4. Dans **Instance Details**, cliquez sur le sous-réseau (subnet)
5. Cliquez sur la **Security List** par défaut
6. Cliquez sur **Add Ingress Rules**
7. Ajoutez cette règle :

```
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Source Port Range: All
Destination Port Range: 3000
Description: FreeStuff Webhook
```

8. Cliquez sur **Add Ingress Rules**

### Étape 2 : Configuration du Pare-feu Ubuntu (iptables)

Connectez-vous au serveur et ajoutez la règle :

```bash
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189

# Sur le serveur
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save

# Vérifier
sudo iptables -L -n | grep 3000
```

Vous devriez voir :

```
ACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0            state NEW tcp dpt:3000
```

### Étape 3 : Revérifier l'accès

Depuis votre PC :

```powershell
Invoke-WebRequest -Uri "http://151.145.51.189:3000/health" -Method GET
```

Devrait maintenant fonctionner !

---

## 🧪 Test Final

### 1. Configurer le webhook sur le dashboard

Utilisez l'URL : `http://151.145.51.189:3000/webhooks/freestuff`

### 2. Cliquer sur "Send Test Ping"

Dans le dashboard FreeStuff, cliquez sur le bouton **"Send Test Ping"**.

### 3. Vérifier les logs du bot

```powershell
ssh -i "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key" ubuntu@151.145.51.189 "pm2 logs discord-bot-netricsa --lines 20"
```

Vous devriez voir :

```
[FreeStuffWebhook] Received webhook: xxx-xxx-xxx at 1708385130
[FreeStuffWebhook] Processing FreeStuff event: fsb:event:ping
[FreeStuffWebhook] Received ping event
[FreeStuffWebhook] Manual ping from dashboard
```

### 4. Le dashboard devrait afficher

```
✅ Webhook delivered successfully
Status: 204 No Content
```

---

## 🎯 Résumé

| Élément                 | Valeur                                          |
|-------------------------|-------------------------------------------------|
| **Serveur Oracle IP**   | `151.145.51.189`                                |
| **Webhook URL**         | `http://151.145.51.189:3000/webhooks/freestuff` |
| **Health Check**        | `http://151.145.51.189:3000/health`             |
| **Port à ouvrir**       | `3000` (TCP)                                    |
| **Dashboard FreeStuff** | https://dashboard.freestuffbot.xyz/             |

---

## 📝 Checklist

Avant de configurer le webhook FreeStuff, vérifiez :

- [ ] Le bot est en ligne sur Oracle (`pm2 status`)
- [ ] Le serveur webhook écoute sur le port 3000 (logs)
- [ ] Le port 3000 est ouvert dans Oracle Cloud Console
- [ ] Le port 3000 est ouvert dans iptables Ubuntu
- [ ] Le health check fonctionne : `http://151.145.51.189:3000/health`
- [ ] L'URL du webhook est : `http://151.145.51.189:3000/webhooks/freestuff`

Une fois tout coché, configurez le webhook sur le dashboard FreeStuff !

---

*Guide corrigé le 2026-02-19*

