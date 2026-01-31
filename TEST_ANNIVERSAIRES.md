# 🧪 TEST RAPIDE - Système d'Anniversaires

## ⚡ Test en 3 étapes (aujourd'hui = 31 janvier 2026)

### 1️⃣ Démarrer le bot

```powershell
cd "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm"
node dist/bot.js
```

### 2️⃣ Dans Discord, définir ton anniversaire pour AUJOURD'HUI

```
/set-birthday jour:31 mois:1 annee:1995 notify:true
```

*Remplace 1995 par ton année de naissance ou laisse vide*

### 3️⃣ Attendre 5 secondes

Le bot va automatiquement :

- ✅ Détecter que c'est ton anniversaire
- 🎉 Générer un message personnalisé via LLM
- 📤 L'envoyer dans le welcome channel
- 👑 Te donner le rôle d'anniversaire (si configuré)

---

## 📊 Logs à surveiller

**Démarrage** :

```
[BirthdayService] ✅ Birthday service initialized
```

**Après 5 secondes** :

```
[BirthdayService] 🎂 New day detected, checking for birthdays...
[BirthdayService] 🎉 Found 1 birthday(s) today!
[BirthdayService] Generating birthday message for TonPseudo via LLM...
[BirthdayService] ✅ Birthday message sent for TonPseudo (31 ans)
```

---

## ✅ Résultat attendu

**Dans le welcome channel** :

```
🎉🎂 Joyeux anniversaire @TonPseudo ! 🎂🎉

[Message personnalisé généré par Netricsa]
```

**Dans ta liste de rôles** :

- Nouveau rôle d'anniversaire (si configuré)

---

## 🔄 Pour tester à nouveau

1. **Supprimer l'état** :
   Supprime le contenu de `data/birthday_state.json` et remets :
   ```json
   {
     "lastCheck": "",
     "celebratedToday": []
   }
   ```

2. **Redémarrer le bot**

3. **Attendre 5 secondes**

---

## 🐛 Si ça ne marche pas

### Vérifier les permissions Discord

Le bot doit avoir :

- ✅ Envoyer des messages dans le welcome channel
- ✅ Gérer les rôles (si rôle configuré)
- ✅ Le rôle du bot doit être AU-DESSUS du rôle d'anniversaire

### Vérifier le .env

```env
GUILD_ID=827364829567647774              # ID du serveur
WELCOME_CHANNEL_ID=827364829567647777    # ID du salon
BIRTHDAY_ROLE_ID=                        # ID du rôle (optionnel)
```

### Vérifier qu'Ollama est lancé

Le bot a besoin d'Ollama pour générer les messages personnalisés.
Si Ollama n'est pas disponible, un message fallback sera utilisé.

---

## 🎯 Test avec une date différente

Pour tester avec le 1er février (demain) :

```
/set-birthday jour:1 mois:2 notify:true
```

Puis modifie `data/birthday_state.json` :

```json
{
  "lastCheck": "2026-01-30",
  "celebratedToday": []
}
```

Redémarre le bot → Il pensera être le 1er février et célébrera !

---

## 💡 Commandes utiles

```
/set-birthday jour:31 mois:1 notify:true          # Définir anniversaire
/set-birthday jour:31 mois:1 notify:false         # Sans notifications
/remove-birthday                                   # Supprimer
/profile                                          # Voir son profil
/lowpower                                         # Activer/désactiver Low Power
```

---

**🚀 C'est parti ! Lance le bot et teste !**
