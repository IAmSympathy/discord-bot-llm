# 🚀 Guide de démarrage rapide - Commande "Déplacer"

## ✅ Installation terminée !

La fonctionnalité de déplacement de messages a été ajoutée avec succès à votre bot Discord.

## 📋 Ce qui a été fait

- ✅ Création de la commande de menu contextuel
- ✅ Ajout du gestionnaire dans bot.ts
- ✅ Compilation du TypeScript réussie
- ✅ Documentation complète créée
- ✅ Script de vérification fourni

## 🎯 Prochaine étape : Démarrer le bot

### Option 1 : Démarrage local (test)

```powershell
# Dans le dossier du projet
node dist/bot.js
```

### Option 2 : Déploiement sur Oracle Cloud

```powershell
# Utiliser le script de déploiement fourni
.\deploy-to-oracle.ps1
```

## 🎮 Comment utiliser la commande

1. **Ouvrez Discord**
2. **Allez dans un salon où le bot est présent**
3. **Faites un clic droit sur n'importe quel message** (pas un message système)
4. **Sélectionnez "Applications" → "Déplacer"**
5. **Choisissez le salon de destination** dans le menu déroulant
6. **Le message sera déplacé automatiquement !**

## ⚙️ Configuration requise

### Permissions utilisateur :

- ✅ **Gérer les messages** - Pour utiliser la commande

### Permissions bot :

- ✅ **Envoyer des messages** - Dans le salon de destination
- ✅ **Gérer les webhooks** - Pour créer des webhooks
- ✅ **Gérer les messages** - Pour supprimer le message original

## 🔍 Vérification

Pour vérifier que tout est en ordre avant de démarrer :

```powershell
node verify-move-command.js
```

Vous devriez voir :

```
🎉 Toutes les vérifications ont réussi !
📌 La commande "Déplacer" est prête à être utilisée.
```

## 📚 Documentation complète

- **Guide utilisateur** : `src/commands/context/README_MOVE_MESSAGE.md`
- **Changelog** : `CHANGELOG_MOVE_MESSAGE.md`
- **Code source** : `src/commands/context/moveMessage.ts`

## 🎨 Fonctionnalités clés

- 🔐 **Sécurisé** : Vérification des permissions
- 👤 **Identité préservée** : Nom et photo de l'auteur original
- 📎 **Contenu complet** : Texte, embeds et pièces jointes
- 🔀 **Multi-canaux** : Salons, threads, annonces
- ⚡ **Instantané** : Déplacement en quelques secondes
- 🇫🇷 **En français** : Interface et messages en français

## ⚠️ Limitations

- ❌ Les messages système ne peuvent pas être déplacés
- ❌ Les salons Stage ne sont pas supportés
- ❌ Les réactions ne sont pas conservées (limitation Discord)

## 🐛 En cas de problème

1. **La commande n'apparaît pas** :
    - Vérifiez que le bot est redémarré
    - Attendez quelques minutes (synchronisation Discord)
    - Vérifiez que le bot a les permissions "applications.commands"

2. **Erreur "Permission refusée"** :
    - Vérifiez que vous avez la permission "Gérer les messages"
    - Vérifiez que le bot a les bonnes permissions dans le salon de destination

3. **Le message n'est pas déplacé** :
    - Vérifiez les logs du bot
    - Vérifiez que le bot peut créer des webhooks
    - Assurez-vous que ce n'est pas un message système

## 📞 Support

En cas de problème persistant, consultez les logs du bot ou contactez le développeur.

---

## 🎉 Bon déplacement de messages !

Cette fonctionnalité devrait maintenant fonctionner exactement comme **Pippin The Mover** !

