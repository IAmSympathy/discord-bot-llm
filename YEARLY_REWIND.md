# 🎬 The Not So Serious Rewind

## Description

Chaque mi-décembre (entre le 10 et le 20), Netricsa publie automatiquement un **"The Not So Serious Rewind"** - un récapitulatif amusant et décalé de l'année écoulée sur le serveur.

## Contenu du Rewind

### 📊 Statistiques Globales

- Total de messages envoyés
- Total de réactions ajoutées
- Total d'images générées (par Netricsa)
- Total de conversations IA
- Total de commandes utilisées

### 🏆 Les Awards

Le rewind inclut des awards fun pour célébrer les membres les plus actifs dans différentes catégories :

1. **🏆 Le plus actif** - Membre avec le plus d'actions combinées (messages + réactions)
2. **💬 Le bavard** - Membre avec le plus de messages envoyés
3. **😂 Le roi des réactions** - Membre avec le plus de réactions ajoutées
4. **🎤 Le vocal addict** - Membre avec le plus de temps passé en vocal
5. **🎨 Le créatif** - Membre avec le plus d'images générées/réimaginées
6. **🎮 Le gamer** - Membre avec le plus de victoires aux jeux
7. **🧠 L'intellectuel** - Membre avec le plus de conversations avec Netricsa
8. **📈 La meilleure série** - Membre avec la plus longue série de victoires
9. **👑 Le champion** - Membre avec le niveau le plus élevé

## Fonctionnement Technique

### Périodicité

- Le système vérifie toutes les **24 heures** si on est entre le 10 et le 20 décembre
- Une seule publication par an est garantie (l'état est sauvegardé dans `data/rewind_state.json`)

### Sources de Données

- **Statistiques utilisateurs** : `data/user_stats.json`
- **Statistiques de jeux** : `data/game_stats.json`
- **Système d'XP** : `data/user_xp.json`

### Fichiers Impliqués

- **Service principal** : `src/services/yearlyRewindService.ts`
- **Initialisation** : `src/bot.ts` (fonction `initializeYearlyRewindService`)
- **État** : `data/rewind_state.json` (créé automatiquement)

## Configuration

Le rewind nécessite les variables d'environnement suivantes :

- `ANNOUNCEMENTS_CHANNEL_ID` : Salon où le rewind sera publié (salon annonces)
- `GUILD_ID` : ID du serveur Discord

Si ces variables ne sont pas configurées, le service est automatiquement désactivé.

### Notification

Le rewind ping `@everyone` lors de sa publication pour notifier tous les membres du serveur.

## Exclusions

- **Netricsa** (le bot) est exclu de tous les awards pour laisser la place aux vrais membres
- Les awards n'apparaissent que si des données pertinentes existent (ex: pas d'award "gamer" si personne n'a joué)

## Personnalisation

### Messages d'Introduction

Plusieurs variantes de messages d'introduction sont disponibles et choisies aléatoirement :

- 🎉 C'est l'heure du bilan annuel ! Qui a été le plus actif ?
- 🎬 Lumières, caméra, statistiques !
- 📊 Vous pensiez que personne ne comptait ? Détrompez-vous !
- 🎊 Une année de plus, une tonne de stats !
- 🏆 L'heure des récompenses a sonné !

### Couleur de l'Embed

- **Rouge festif** (`0xff6b6b`) pour donner un côté chaleureux et fun

## Notes Importantes

⚠️ Le rewind affiche les statistiques de l'**année en cours**. Par exemple, en décembre 2026, il affiche les stats de 2026, comme les rewinds classiques (YouTube, Spotify, etc.).

📅 Le rewind est publié **une seule fois par an** entre le 10 et le 20 décembre. Si le bot est éteint durant cette période, le rewind sera publié dès qu'il sera rallumé (tant que la date est valide).

🔄 Le système vérifie automatiquement au démarrage du bot, donc pas besoin de redémarrage spécifique.

🔔 Le rewind ping **@everyone** pour notifier tous les membres du serveur lors de sa publication.

## Exemple de Sortie

```
@everyone

🎉 C'est l'heure du bilan annuel ! Qui a été le plus actif ? Qui a passé sa vie en vocal ? Découvrez-le maintenant ! 🍿

╔════════════════════════════════╗
║  🎬 The Not So Serious Rewind 2026  ║
╚════════════════════════════════╝

📊 Statistiques globales
━━━━━━━━━━━━━━━━━━━━
💬 12,456 messages envoyés
😂 3,789 réactions ajoutées
🖼️ 234 images générées
💬 567 conversations avec Netricsa
⚡ 891 commandes utilisées

🏆 Les Awards
━━━━━━━━━━━━━━━━━━━━

🏆 Le plus actif
@Username
15,245 actions

💬 Le bavard
@Username2
12,456 messages

[etc...]
```
