# 📌 Comment Mentionner un Rôle Uniquement dans un Serveur

## 🎯 Problématique

Avec les User Apps, les commandes peuvent être exécutées :

- Dans un serveur (Guild) → On peut mentionner des rôles
- En DM ou hors serveur → Pas de rôles disponibles

Il faut donc **vérifier le contexte** avant de mentionner un rôle.

## ✅ Solution : Vérifier `interaction.guild`

### Exemple 1 : Mention Simple du Rôle "next"

```typescript
async execute(interaction: ChatInputCommandInteraction) {
    // Vérifier si on est dans un serveur
    if (interaction.guild) {
        // On est dans un serveur, chercher le rôle "next"
        const nextRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase() === 'next'
        );
        
        if (nextRole) {
            // Mentionner le rôle
            await interaction.reply({
                content: `<@&${nextRole.id}> C'est à vous !`,
                allowedMentions: { roles: [nextRole.id] }
            });
        } else {
            // Rôle non trouvé
            await interaction.reply({
                content: "⚠️ Le rôle 'next' n'existe pas sur ce serveur.",
                ephemeral: true
            });
        }
    } else {
        // On est en DM ou hors serveur
        await interaction.reply({
            content: "⚠️ Cette commande doit être utilisée dans un serveur !",
            ephemeral: true
        });
    }
}
```

### Exemple 2 : Mention du Rôle avec Message Complexe

```typescript
async execute(interaction: ChatInputCommandInteraction) {
    let message = "La tâche est terminée !";
    const mentionedRoles: string[] = [];
    
    // Vérifier si on est dans un serveur
    if (interaction.guild) {
        const nextRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase() === 'next'
        );
        
        if (nextRole) {
            message += ` <@&${nextRole.id}>, c'est votre tour !`;
            mentionedRoles.push(nextRole.id);
        }
    }
    
    await interaction.reply({
        content: message,
        allowedMentions: { 
            roles: mentionedRoles.length > 0 ? mentionedRoles : []
        }
    });
}
```

### Exemple 3 : Fonction Utilitaire Réutilisable

Créez une fonction helper pour mentionner des rôles :

```typescript
// utils/roleHelper.ts
import { Guild } from "discord.js";

/**
 * Obtient la mention d'un rôle par nom
 * @param guild Le serveur Discord
 * @param roleName Le nom du rôle à chercher
 * @returns La mention du rôle ou null si non trouvé/hors serveur
 */
export function getRoleMention(guild: Guild | null, roleName: string): string | null {
    if (!guild) return null;
    
    const role = guild.roles.cache.find(r => 
        r.name.toLowerCase() === roleName.toLowerCase()
    );
    
    return role ? `<@&${role.id}>` : null;
}

/**
 * Obtient l'ID d'un rôle pour allowedMentions
 * @param guild Le serveur Discord
 * @param roleName Le nom du rôle
 * @returns L'ID du rôle ou null si non trouvé
 */
export function getRoleId(guild: Guild | null, roleName: string): string | null {
    if (!guild) return null;
    
    const role = guild.roles.cache.find(r => 
        r.name.toLowerCase() === roleName.toLowerCase()
    );
    
    return role ? role.id : null;
}
```

Puis l'utiliser dans vos commandes :

```typescript
import { getRoleMention, getRoleId } from "../../utils/roleHelper";

async execute(interaction: ChatInputCommandInteraction) {
    const nextMention = getRoleMention(interaction.guild, "next");
    const nextId = getRoleId(interaction.guild, "next");
    
    let message = "Tâche terminée !";
    const allowedRoles: string[] = [];
    
    if (nextMention && nextId) {
        message += ` ${nextMention}, à vous de jouer !`;
        allowedRoles.push(nextId);
    }
    
    await interaction.reply({
        content: message,
        allowedMentions: { roles: allowedRoles }
    });
}
```

## 🔍 Recherche de Rôles par ID ou Nom

### Par Nom (Case-insensitive)

```typescript
const role = interaction.guild?.roles.cache.find(r =>
    r.name.toLowerCase() === 'next'
);
```

### Par ID

```typescript
const role = interaction.guild?.roles.cache.get('ROLE_ID_HERE');
```

### Par Mention

```typescript
// Si vous avez une mention comme "<@&123456789>"
const roleId = roleMention.match(/^<@&(\d+)>$/)?.[1];
const role = interaction.guild?.roles.cache.get(roleId || '');
```

## ⚠️ Gestion d'Erreurs

### Vérifications Importantes

```typescript
async execute(interaction: ChatInputCommandInteraction) {
    // 1. Vérifier qu'on est dans un serveur
    if (!interaction.guild) {
        return interaction.reply({
            content: "⚠️ Cette commande nécessite d'être dans un serveur.",
            ephemeral: true
        });
    }
    
    // 2. Vérifier que le rôle existe
    const nextRole = interaction.guild.roles.cache.find(r => 
        r.name.toLowerCase() === 'next'
    );
    
    if (!nextRole) {
        return interaction.reply({
            content: "⚠️ Le rôle 'next' n'existe pas sur ce serveur.",
            ephemeral: true
        });
    }
    
    // 3. Vérifier les permissions du bot
    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has('MentionEveryone')) {
        // Le bot peut quand même mentionner les rôles si allowedMentions est correct
        // mais c'est bon de vérifier
    }
    
    // 4. Mentionner le rôle
    await interaction.reply({
        content: `<@&${nextRole.id}> C'est votre tour !`,
        allowedMentions: { roles: [nextRole.id] }
    });
}
```

## 📝 allowedMentions : Pourquoi c'est Important

Par défaut, Discord peut bloquer les mentions pour éviter le spam. Utilisez `allowedMentions` pour autoriser explicitement :

```typescript
await interaction.reply({
    content: `<@&${roleId}> Ping !`,
    allowedMentions: {
        roles: [roleId],        // IDs des rôles à mentionner
        users: [],              // IDs des utilisateurs à mentionner
        parse: [],              // Types de mentions autorisées ('roles', 'users', 'everyone')
        repliedUser: false      // Mentionner l'utilisateur auquel on répond
    }
});
```

## 🎨 Exemples Pratiques

### Exemple : Commande de Jeu avec Tour Suivant

```typescript
// commands/game/next-turn.ts
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("next-turn")
        .setDescription("Passe au tour suivant et notifie le rôle 'next'"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        // Vérifier le contexte serveur
        if (!interaction.guild) {
            return interaction.reply({
                content: "⚠️ Cette commande doit être utilisée dans un serveur !",
                ephemeral: true
            });
        }
        
        // Chercher le rôle "next"
        const nextRole = interaction.guild.roles.cache.find(r => 
            r.name.toLowerCase() === 'next'
        );
        
        if (!nextRole) {
            return interaction.reply({
                content: "⚠️ Le rôle 'next' n'existe pas. Créez-le d'abord !",
                ephemeral: true
            });
        }
        
        // Créer le message avec la mention
        const embed = new EmbedBuilder()
            .setTitle("🎮 Tour Suivant !")
            .setDescription(`<@&${nextRole.id}>, c'est à vous de jouer !`)
            .setColor(0x00ff00)
            .setTimestamp();
        
        await interaction.reply({
            embeds: [embed],
            allowedMentions: { roles: [nextRole.id] }
        });
    }
};
```

### Exemple : Notification avec Plusieurs Rôles

```typescript
async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        return interaction.reply({
            content: "⚠️ Commande serveur uniquement !",
            ephemeral: true
        });
    }
    
    // Chercher plusieurs rôles
    const rolesToMention = ['next', 'moderator', 'admin'];
    const foundRoles: string[] = [];
    let message = "🔔 Notification : ";
    
    for (const roleName of rolesToMention) {
        const role = interaction.guild.roles.cache.find(r => 
            r.name.toLowerCase() === roleName.toLowerCase()
        );
        
        if (role) {
            message += `<@&${role.id}> `;
            foundRoles.push(role.id);
        }
    }
    
    if (foundRoles.length === 0) {
        return interaction.reply({
            content: "⚠️ Aucun des rôles requis n'existe sur ce serveur.",
            ephemeral: true
        });
    }
    
    message += "Une action est requise !";
    
    await interaction.reply({
        content: message,
        allowedMentions: { roles: foundRoles }
    });
}
```

## 🚀 Utilisation dans votre Bot

Pour intégrer cela dans votre bot existant, ajoutez simplement ces vérifications dans les commandes où vous voulez mentionner des rôles. Par exemple, si vous avez une commande qui devrait notifier le rôle "next" :

```typescript
// Dans votre commande existante
if (interaction.guild) {
    const nextRole = interaction.guild.roles.cache.find(r => r.name === 'next');
    if (nextRole) {
        // Ajouter la mention à votre réponse
        replyContent += ` <@&${nextRole.id}>`;
        allowedRoles.push(nextRole.id);
    }
}
```

## 🔗 Documentation Discord

- [Roles](https://discord.js.org/#/docs/discord.js/main/class/Role)
- [Guild Roles](https://discord.js.org/#/docs/discord.js/main/class/GuildRoleManager)
- [Allowed Mentions](https://discord.js.org/#/docs/discord.js/main/typedef/MessageMentionOptions)

