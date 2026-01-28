# 🚀 Guide de Démarrage Rapide - Production

## ✅ Pré-requis

- Node.js (v18+)
- Ollama installé et en cours d'exécution
- Modèle LLM téléchargé : `llama3.1:8b-instruct-q8_0`
- Token Discord Bot

---

## 📦 Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Compiler le TypeScript
npm run build
# ou
tsc

# 3. Vérifier qu'Ollama tourne
curl http://localhost:11434/api/tags
```

---

## ⚙️ Configuration

### 1. Créer le fichier `.env`

```env
# Discord
DISCORD_LLM_BOT_TOKEN=votre_token_discord_ici
DISCORD_LLM_BOT_CLIENT_ID=votre_client_id_ici

# Channels (optionnel)
WATCH_CHANNEL_ID=id_du_salon_a_surveiller
FORUM_CHANNEL_ID=id_du_forum_si_applicable

# Ollama
OLLAMA_TEXT_MODEL=llama3.1:8b-instruct-q8_0
OLLAMA_VISION_MODEL=qwen2.5-vl:7b

# Prompts
SYSTEM_PROMPT_PATH=./data/system_prompt.txt
SERVER_PROMPT_PATH=./data/server_prompt.txt

# Mémoire
MEMORY_FILE=./data/memory.json
```

### 2. Vérifier les fichiers de données

```bash
# Ces fichiers doivent exister :
data/system_prompt.txt       # ✅ Adapté pour serveur privé
data/server_prompt.txt        # Contexte du serveur
data/memory.json              # Créé automatiquement
data/profiles/                # Créé automatiquement
```

---

## 🎯 Démarrage

### Méthode 1 : PowerShell (Windows)

```powershell
# Démarrage simple
npm start

# ou avec Node directement
node dist/bot.js
```

### Méthode 2 : Script automatique

```powershell
# Utiliser le script de démarrage
.\start-bot.ps1

# ou le .bat
.\start.bat
```

### Méthode 3 : Mode développement (auto-reload)

```bash
npm run dev
```

---

## ✅ Vérifications Post-Démarrage

### 1. Console

```
✓ Bot is online!
✓ [watchChannel] Watching channel: ...
✓ Successfully reloaded X application (/) commands
```

### 2. Discord

- Le bot apparaît en ligne
- Son statut est " " (espace)
- Taper `/` montre les commandes disponibles

### 3. Tests rapides

```discord
# Test 1 : Mention simple
@Netricsa salut

# Test 2 : Langage SMS
@Netricsa sa va toa?

# Test 3 : Troll
@Netricsa t'es conne mdr

# Test 4 : Fautes
@Netricsa pourkoi tu di sa?

# Test 5 : Commande
/profile @YourName
```

---

## 🛠️ Commandes Disponibles

### Gestion Mémoire

```
/reset              # Efface TOUT (mémoire + profils)
/reset-memory       # Efface uniquement la mémoire
/reset-profiles     # Efface uniquement les profils
```

### Profils Utilisateurs

```
/profile [@user]    # Affiche le profil d'un utilisateur
/forget-profile [@user]  # Supprime le profil d'un utilisateur
/note <user> <type> <content>  # Ajoute une note manuelle
```

### Contrôle

```
/stop               # Arrête la réponse en cours
```

---

## 🔧 Troubleshooting

### Problème : Bot ne répond pas

**Solutions :**

1. Vérifier qu'Ollama tourne : `curl http://localhost:11434`
2. Vérifier les logs dans la console
3. Vérifier les permissions Discord (Read Messages, Send Messages)
4. Essayer dans le `WATCH_CHANNEL_ID` si configuré

### Problème : Erreur de compilation

```bash
# Nettoyer et recompiler
rm -rf dist/
tsc
```

### Problème : "Unknown interaction"

**Cause** : Commandes pas déployées ou token expiré

**Solution** :

```bash
# Redéployer les commandes
node dist/deploy/deployCommands.js
```

### Problème : Mémoire pleine

```bash
# Vider la mémoire via Discord
/reset-memory

# ou manuellement
rm data/memory.json
```

### Problème : Profils corrompus

```bash
# Vider les profils via Discord
/reset-profiles

# ou manuellement
rm -rf data/profiles/*
```

---

## 📊 Monitoring

### Logs à surveiller

```
[Memory Passive]: 👁️ Recorded from...  # Bon signe
[Extraction Passive] Starting...         # Bon signe
[UserProfile] ➕ Added fact...           # Bon signe

[ERROR] ...                              # Problème !
[processLLMRequest] Error...             # Problème !
```

### Fichiers à vérifier

```bash
# Taille de la mémoire
ls -lh data/memory.json

# Nombre de profils
ls data/profiles/ | wc -l

# Logs (si configurés)
tail -f logs/bot.log
```

---

## 🎭 Comportement Attendu

### ✅ L'IA DEVRAIT :

- Comprendre le langage SMS ("sa va", "jveu")
- Accepter les insultes amicales sans se plaindre
- Répondre avec humour au trolling
- Ne PAS corriger les fautes d'orthographe
- Garder les vraies infos, ignorer le troll

### ❌ L'IA NE DEVRAIT PAS :

- Se vexer des insultes
- Corriger l'orthographe automatiquement
- Enregistrer "impoli" pour quelqu'un qui dit "t'es con"
- Refuser de répondre à cause du ton
- Faire la morale

---

## 🔄 Mise à Jour

```bash
# 1. Arrêter le bot
Ctrl+C

# 2. Sauvegarder les données
cp -r data/ data_backup/

# 3. Pull les changements
git pull

# 4. Réinstaller les dépendances (si nécessaire)
npm install

# 5. Recompiler
tsc

# 6. Redémarrer
npm start
```

---

## 🆘 Support

### En cas de problème :

1. **Vérifier les logs** dans la console
2. **Tester Ollama** : `ollama list` et `ollama run llama3.1:8b-instruct-q8_0 "test"`
3. **Vérifier le .env** : tokens corrects, paths corrects
4. **Redéployer les commandes** : `node dist/deploy/deployCommands.js`
5. **Nettoyer et recompiler** : `rm -rf dist/ && tsc`

### Commandes de diagnostic

```bash
# Vérifier Ollama
ollama ps
ollama list

# Vérifier Node
node --version
npm --version

# Vérifier les fichiers
ls -la data/
ls -la dist/

# Vérifier les permissions
# (Discord Developer Portal > Bot > Permissions)
```

---

## 🎉 Le Bot est Prêt !

Si tout fonctionne :

- ✅ Le bot répond aux mentions
- ✅ Il comprend le langage SMS
- ✅ Il accepte les vannes/trolling
- ✅ Il ne corrige pas les fautes
- ✅ Il enregistre les vraies infos

**Enjoy ! 🚀**

---

**Documentation complète** : `PRODUCTION_READY_2026-01-28.md`
**Refactoring** : `REFACTORING_2026-01-28.md`
