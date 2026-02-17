# Configuration Bot Discord - User App Uniquement

## 🎯 Objectif

Permettre à Klodovik d'être installé comme **User App** (application utilisateur) mais **PAS sur des serveurs**.

## 📋 Étapes de Configuration

### 1. Accéder au Discord Developer Portal

1. Va sur https://discord.com/developers/applications
2. Sélectionne ton application **Klodovik**

### 2. Configurer l'Installation (Section "Installation")

#### Dans l'onglet "Installation" :

**A. Installation Contexts (Contextes d'installation)**

✅ **Cocher :** `User Install` (Autoriser l'installation utilisateur)
❌ **Décocher :** `Guild Install` (Désactiver l'installation serveur)

**B. Install Link (Lien d'installation)**

Sélectionne : `Discord Provided Link`

**C. Default Install Settings**

##### Pour "User Install" :

- **Scopes :**
    - ✅ `applications.commands` (Obligatoire pour les slash commands)

- **Permissions :**
    - Aucune permission n'est nécessaire pour une User App
    - Les User Apps n'ont pas de permissions serveur

##### Pour "Guild Install" :

- **Important :** Si tu as décoché "Guild Install", cette section sera grisée/désactivée

### 3. Sauvegarder

Clique sur **"Save Changes"** en bas de la page.

## 🔗 Lien d'Invitation

Une fois configuré, Discord génère automatiquement un lien d'invitation.

### Récupérer le Lien

1. Dans l'onglet "Installation"
2. Copie le lien sous **"Install Link"**
3. Ce lien ressemble à :
   ```
   https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID
   ```

### Partager le Lien

Tu peux partager ce lien avec n'importe qui :

- ✅ Les utilisateurs pourront installer Klodovik comme User App
- ❌ Ils ne pourront PAS l'ajouter sur un serveur

## ✅ Vérification

### Comment Tester ?

1. **Utilise le lien d'installation**
2. Tu devrais voir :
   ```
   ┌─────────────────────────────────┐
   │  Ajouter Klodovik               │
   ├─────────────────────────────────┤
   │  ○ Installer pour moi           │ ✅ (Seule option disponible)
   │                                 │
   │  Pas d'option serveur           │ ❌ (Désactivée)
   └─────────────────────────────────┘
   ```

3. Clique sur **"Installer pour moi"**
4. Le bot sera accessible via :
    - Menu contextuel sur les messages
    - Slash commands dans n'importe quel salon

## 🎮 Utilisation User App

### Où les Commandes Fonctionnent ?

Avec une User App, les commandes Klodovik fonctionneront :

✅ **Dans les DMs** (Messages privés avec le bot)
✅ **Dans n'importe quel serveur** (sans que le bot y soit membre)
✅ **Dans les groupes DM**

### Exemple d'Utilisation

1. L'utilisateur installe Klodovik comme User App
2. Il tape `/klodovik` **n'importe où**
3. Le bot répond via l'API Discord
4. **Le bot n'a pas besoin d'être membre du serveur**

## ⚠️ Limitations des User Apps

### Ce qui NE fonctionnera PAS

❌ **Lecture de l'historique du serveur** (`/klodovik-collect`)

- Nécessite que le bot soit membre du serveur
- Nécessite la permission "Read Message History"

❌ **Réponses spontanées**

- Nécessite l'événement `MessageCreate`
- Nécessite que le bot soit membre du serveur

❌ **Apprentissage automatique**

- Le bot ne peut pas voir les messages sans être sur le serveur

### Ce qui FONCTIONNERA

✅ **Génération manuelle** (`/klodovik`)

- Utilise le modèle pré-entraîné
- Fonctionne partout

✅ **Statistiques** (`/klodovik-stats`)

- Affiche les stats du modèle global

✅ **Configuration** (`/klodovik-config`)

- Si l'utilisateur est propriétaire du bot

## 🤔 Recommandation

### Option 1 : User App Pure (Ce que tu demandes)

- ✅ Installation facile pour tous
- ❌ Pas d'apprentissage automatique
- ❌ Pas de réponses spontanées
- ✅ Fonctionne avec le modèle pré-collecté

**Bon pour :** Partager le bot facilement sans donner accès aux serveurs

### Option 2 : Hybride (Recommandé pour Klodovik)

- ✅ `User Install` : Pour utilisation personnelle
- ✅ `Guild Install` : Pour apprentissage sur un serveur spécifique

**Configuration :**

1. Coche **les deux** (User Install + Guild Install)
2. Pour Guild Install, limite les permissions au strict minimum
3. L'utilisateur choisit lors de l'installation

**Bon pour :** Flexibilité maximale

### Option 3 : Guild Install Uniquement (Actuel)

- ✅ Apprentissage automatique
- ✅ Réponses spontanées
- ❌ Doit être invité sur chaque serveur

## 🔧 Adapter le Code (Si User App Pure)

Si tu choisis User App uniquement, certaines fonctionnalités doivent être ajustées :

### Désactiver les Fonctionnalités Serveur

```typescript
// Dans klodovikBot.ts

// Désactiver l'écoute des messages (pas accessible en User App)
// this.client.on(Events.MessageCreate, async (message) => { ... });

// Désactiver la collecte serveur
// case "klodovik-collect": // Commenter ou retirer
```

### Adapter les Commandes

```typescript
// Commandes qui fonctionnent en User App :
-/klodovik ✅
- /klodovik-stats ✅
- /klodovik-config ✅ (si admin du bot)

// Commandes à désactiver :
- /klodovik-collect ❌ (nécessite accès serveur)
- /klodovik-reset ✅ (fonctionne toujours)
```

## 📊 Comparaison Rapide

| Fonctionnalité      | Guild Install        | User Install |
|---------------------|----------------------|--------------|
| Installation facile | ❌ (invite requise)   | ✅ (1 clic)   |
| Permissions serveur | ✅                    | ❌            |
| Lire historique     | ✅                    | ❌            |
| Réponses spontanées | ✅                    | ❌            |
| Génération manuelle | ✅                    | ✅            |
| Fonctionne partout  | ❌ (serveurs invités) | ✅            |

## 🎯 Configuration Finale Recommandée

### Pour Klodovik (Bot Markov)

**Je recommande l'Option 2 (Hybride) :**

1. **Activer User Install** (Utilisation perso)
2. **Activer Guild Install** (Apprentissage)
3. Permissions Guild Install minimales :
    - `Read Message History`
    - `Send Messages`

**Pourquoi ?**

- Flexibilité maximale
- L'utilisateur choisit comment l'installer
- Meilleure expérience utilisateur

### Configuration dans Discord Portal

```
Installation Contexts:
✅ User Install
✅ Guild Install

User Install Scopes:
- applications.commands

Guild Install Scopes:
- applications.commands
- bot

Guild Install Permissions:
- Read Message History (67108864)
- Send Messages (2048)
```

## ✅ Checklist

- [ ] Aller sur Discord Developer Portal
- [ ] Sélectionner l'application Klodovik
- [ ] Ouvrir l'onglet "Installation"
- [ ] Configurer "Installation Contexts"
- [ ] Configurer les scopes et permissions
- [ ] Sauvegarder les changements
- [ ] Tester avec le lien d'installation
- [ ] Vérifier que seule l'option désirée apparaît

## 🔗 Ressources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Documentation User Apps](https://discord.com/developers/docs/tutorials/developing-a-user-installable-app)
- [Discord Permissions Calculator](https://discordapi.com/permissions.html)

---

**Note :** Les User Apps sont une fonctionnalité récente de Discord. Assure-toi que ton application est bien configurée pour supporter les deux modes si tu veux la flexibilité maximale.

