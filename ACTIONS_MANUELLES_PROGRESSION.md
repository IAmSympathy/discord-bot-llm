# ⚠️ ACTIONS MANUELLES REQUISES

## 📝 1. Renommer les Rôles sur Discord

### Étapes :

1. Allez dans **Paramètres du serveur** → **Rôles**
2. Trouvez les rôles suivants et renommez-les :

#### Rôle ID: `1469150429794402344`

- ❌ Ancien nom : **Commando**
- ✅ Nouveau nom : **Soldier**

#### Rôle ID: `1469150762259976327`

- ❌ Ancien nom : **Elder**
- ✅ Nouveau nom : **Commando**

---

## 🎨 2. Renommer/Créer les Images de Level Up

### Dans le dossier : `assets/levelup/roleup/`

#### Si les images existent déjà :

```bash
# Renommer l'ancienne image Commando
mv role_commando.png role_soldier.png

# Renommer l'ancienne image Elder
mv role_elder.png role_commando.png
```

#### Images finales requises (800x400px) :

- ✅ `role_hatchling.png` - Gris/Argent (#4A5568) 🥚
- ✅ `role_juvenile.png` - Cyan (#38B2AC) 🐣
- ✅ `role_adult.png` - Bleu (#4299E1) 🦎
- ⚠️ `role_soldier.png` - Vert (#48BB78) ⚔️ ← À créer/renommer
- ✅ `role_elite.png` - Violet (#9F7AEA) 👑
- ⚠️ `role_commando.png` - Rouge (#F56565) 🔱 ← À créer/renommer

---

## 🎨 3. Créer les Nouvelles Images (Optionnel)

Si vous voulez créer de nouvelles images adaptées aux nouveaux thèmes :

### Soldier (35-54)

- **Couleur** : Vert (#48BB78)
- **Thème** : Combattant déterminé, guerrier actif
- **Style** : Badges militaires, armes, détermination
- **Emoji** : ⚔️

### Commando (80+)

- **Couleur** : Rouge (#F56565)
- **Thème** : Maître légendaire, élite absolue
- **Style** : Couronne, aura puissante, prestige maximal
- **Emoji** : 🔱

---

## 🔄 4. Redémarrer le Bot

Après avoir effectué les changements ci-dessus :

```bash
# Arrêter le bot
.\stop-bot.ps1

# Redémarrer le bot
.\start-bot.ps1
```

---

## ✅ 5. Vérification

### Test des rôles :

1. Vérifiez qu'un utilisateur niveau 40 a le rôle "Soldier"
2. Vérifiez qu'un utilisateur niveau 85 a le rôle "Commando"

### Test des images :

1. Gagnez de l'XP et vérifiez que les bonnes images s'affichent
2. Assurez-vous qu'un changement de rôle affiche la nouvelle image

---

## 📊 Résumé Rapide

| Action        | Statut     | Détails                                         |
|---------------|------------|-------------------------------------------------|
| Code modifié  | ✅ Fait     | constants.ts, levelUpImageService.ts            |
| Documentation | ✅ Fait     | README.md, GUIDE_XP_DISCORD.md                  |
| Compilation   | ✅ OK       | Aucune erreur                                   |
| Rôles Discord | ⚠️ À faire | Renommer Commando → Soldier et Elder → Commando |
| Images        | ⚠️ À faire | Renommer les fichiers PNG                       |
| Redémarrage   | ⚠️ À faire | Après les étapes ci-dessus                      |

---

## 🆘 En cas de problème

Si quelque chose ne fonctionne pas :

1. Vérifiez que les IDs de rôles sur Discord n'ont pas changé
2. Vérifiez que les noms de fichiers d'images sont exacts (minuscules, underscore)
3. Consultez les logs du bot pour les erreurs
4. Redémarrez le bot après chaque modification

---

## 📝 Notes

- Les utilisateurs actuels conservent leur progression XP
- Les rôles se mettront à jour automatiquement au prochain gain d'XP
- Vous pouvez forcer une mise à jour en redémarrant le bot
