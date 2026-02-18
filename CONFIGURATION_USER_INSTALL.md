# 🎯 Configuration des Boutons de Commandes dans le Profil Discord

## Qu'est-ce que c'est ?

Les boutons de commandes dans le profil Discord sont appelés **"User Apps"** ou **"User Install"**. Ils permettent aux utilisateurs d'installer votre bot directement sur leur compte Discord et d'accéder aux commandes depuis n'importe quel serveur, DM ou groupe.

## ✅ Votre bot est déjà préparé !

Votre code est déjà configuré pour supporter les User Apps :

- `integration_types: [0, 1]` → 0 = Guild Install, 1 = User Install
- `contexts: [0, 1, 2]` → 0 = Serveur, 1 = DM, 2 = Group DM

## 🔧 Activation dans le Portail Discord Developer

### Étape 1 : Accéder au Portail Développeur

1. Allez sur https://discord.com/developers/applications
2. Sélectionnez votre application bot (Netricsa)

### Étape 2 : Activer User Install

1. Dans le menu de gauche, cliquez sur **"Installation"**
2. Vous verrez deux sections :
    - **Guild Install** (Installation serveur) ← déjà activé
    - **User Install** (Installation utilisateur) ← À ACTIVER

3. **Cochez la case "User Install"**

4. Dans les paramètres de "User Install", configurez :
    - **Install Link** : `Discord Provided Link`
    - **Authorization Methods** : Cochez `In-app Authorization`

### Étape 3 : Configurer les Scopes

Pour **User Install**, sélectionnez les scopes suivants :

- ✅ `applications.commands` (requis pour les slash commands)

### Étape 4 : Configurer les Permissions par Défaut

Dans la section **"Default Install Settings"** :

#### Pour Guild Install :

- Scopes : `bot`, `applications.commands`
- Permissions : (vos permissions actuelles)

#### Pour User Install :

- Scopes : `applications.commands`
- Permissions : Aucune (les permissions seront celles de l'utilisateur)

### Étape 5 : Sauvegarder

Cliquez sur **"Save Changes"** en bas de la page.

## 🔄 Redéployer les Commandes

Une fois la configuration activée, redéployez vos commandes :

```powershell
npm run build
node dist/deploy/deployCommands.js
```

## 📱 Tester les User Apps

### Méthode 1 : Via le Profil du Bot

1. Faites un clic droit sur votre bot dans Discord
2. Cliquez sur **"Apps"** dans le menu
3. Vous devriez voir vos commandes disponibles !

### Méthode 2 : Via le Lien d'Installation

Générez un lien d'installation User Install :

```
https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID
```

Remplacez `VOTRE_CLIENT_ID` par l'ID de votre bot.

## 🎨 Comment ça Fonctionne ?

### Commandes Globales (User Apps)

Ces commandes apparaîtront dans le profil :

- `/ask` - Poser une question
- `/image` - Générer une image
- `/choose` - Choisir une option
- `/profile` - Voir le profil
- `/help` - Afficher l'aide
- Etc.

### Commandes Guild-Only

Ces commandes NE sont PAS des User Apps (serveur uniquement) :

- `/reset` - Commandes admin
- `/lowpower` - Commandes owner
- `/leaderboard` - Liées au serveur spécifique
- Etc.

## 📊 Différence entre les Types d'Installation

| Type              | Où installer ?   | Où utiliser ?                   | Cas d'usage      |
|-------------------|------------------|---------------------------------|------------------|
| **Guild Install** | Sur un serveur   | Dans ce serveur                 | Bot traditionnel |
| **User Install**  | Sur votre compte | Partout (serveurs, DM, groupes) | App personnelle  |

## 🎯 Contextes d'Exécution

Vos commandes globales supportent 3 contextes :

- **0 = Guild** : Exécution dans un serveur
- **1 = Bot DM** : Exécution en message privé avec le bot
- **2 = Group DM** : Exécution dans un groupe DM

## 🔍 Vérification de la Disponibilité

Dans votre code, vous pouvez vérifier le contexte :

```typescript
// Vérifier si la commande est exécutée dans un serveur
if (interaction.guild) {
    // Code pour serveur
} else {
    // Code pour DM/User App
}

// Obtenir le type d'installation
const installationType = interaction.context; // 0, 1, ou 2
```

## ⚠️ Points Importants

### 1. Permissions dans User Apps

Quand un utilisateur utilise une commande User App :

- Il utilise **SES propres permissions** dans le serveur
- Le bot n'a **pas** besoin d'être dans le serveur
- Les permissions sont celles de l'utilisateur qui invoque la commande

### 2. Répondre dans le Bon Contexte

Si la commande mentionne un rôle "next" et qu'on est dans un serveur, pingez le rôle normalement :

```typescript
if (interaction.guild) {
    // On est dans un serveur, on peut mentionner des rôles
    const nextRole = interaction.guild.roles.cache.find(r => r.name === 'next');
    if (nextRole) {
        await interaction.reply(`<@&${nextRole.id}> Votre tour !`);
    }
} else {
    // On est en DM/User App, pas de mention de rôle possible
    await interaction.reply("Cette commande nécessite d'être dans un serveur !");
}
```

### 3. Gestion des Données

Pour les commandes User App qui nécessitent des données serveur (XP, profils, etc.) :

- Vérifiez toujours si `interaction.guild` existe
- Gérez les erreurs si l'utilisateur n'est pas dans un serveur avec le bot
- Stockez les données par `guildId` + `userId`

## 🚀 Exemple de Code Amélioré

Voici comment adapter une commande pour supporter à la fois Guild et User Install :

```typescript
async
execute(interaction
:
ChatInputCommandInteraction
)
{
    const isInGuild = !!interaction.guild;

    if (!isInGuild) {
        return interaction.reply({
            content: "⚠️ Cette commande doit être utilisée dans un serveur !",
            ephemeral: true
        });
    }

    // Suite de la commande...
}
```

## 📝 Liste des Commandes User Apps (Actuelles)

Toutes les commandes SAUF celles dans `GUILD_ONLY_COMMANDS` sont des User Apps :

```typescript
const GUILD_ONLY_COMMANDS = [
    "reset", "reset-counter", "add-note", "set-birthday",
    "remove-birthday", "remove-note", "set-status", "stop-event",
    "test-event", "auto-lowpower", "blacklist", "blacklist-game",
    "whitelist-game", "lowpower", "leaderboard", "test-mission",
    "test-rewind", "standby-status", "findmeme", "answer", "harvest"
];
```

## ✨ Avantages des User Apps

1. **Accessibilité** : Les utilisateurs peuvent utiliser votre bot partout
2. **Visibilité** : Votre bot apparaît dans les profils Discord
3. **Portabilité** : Une seule installation pour tous les serveurs
4. **Expérience utilisateur** : Plus facile d'accéder aux commandes

## 🔗 Liens Utiles

- [Documentation Discord - User Installable Apps](https://discord.com/developers/docs/tutorials/developing-a-user-installable-app)
- [Guide des Integration Types](https://discord.com/developers/docs/resources/application#application-object-application-integration-types)
- [Contextes d'Interactions](https://discord.com/developers/docs/interactions/application-commands#interaction-contexts)

