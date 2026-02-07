# ✅ CHANGEMENT DE PROGRESSION DE NIVEAU - 7 février 2026

## 🎯 Nouvelle Progression

La hiérarchie des rôles a été modifiée comme suit :

### Avant :

1. 🥚 **Hatchling** (1-9)
2. 🐣 **Juvenile** (10-19)
3. 🦎 **Adult** (20-34)
4. ⚔️ **Commando** (35-54)
5. 👑 **Elite** (55-79)
6. 🔱 **Elder** (80+)

### Après :

1. 🥚 **Hatchling** (1-9)
2. 🐣 **Juvenile** (10-19)
3. 🦎 **Adult** (20-34)
4. ⚔️ **Soldier** (35-54) ← NOUVEAU
5. 👑 **Elite** (55-79)
6. 🔱 **Commando** (80+) ← DÉPLACÉ AU SOMMET

---

## ✅ Modifications Effectuées

### Code

- [x] `src/utils/constants.ts` - LEVEL_ROLES et LEVEL_THRESHOLDS mis à jour
- [x] `src/services/levelUpImageService.ts` - Commentaires mis à jour
- [x] `assets/levelup/README.md` - Guide de création d'images mis à jour
- [x] `GUIDE_XP_DISCORD.md` - Documentation mise à jour

### Configuration Discord

Le bot utilise maintenant ces IDs de rôles :

- **SOLDIER** : `1469150429794402344` (ancien ID de Commando)
- **COMMANDO** : `1469150762259976327` (ancien ID de Elder)

---

## ⚠️ ACTIONS REQUISES

### 1. 📝 Renommer les Rôles Discord

Sur le serveur Discord, renommez les rôles :

1. Le rôle avec l'ID `1469150429794402344` :
    - Ancien nom : "Commando"
    - **Nouveau nom : "Soldier"**

2. Le rôle avec l'ID `1469150762259976327` :
    - Ancien nom : "Elder"
    - **Nouveau nom : "Commando"**

### 2. 🎨 Créer/Renommer les Images

Dans le dossier `assets/levelup/roleup/`, vous devez avoir :

**Images à renommer :**

- `role_commando.png` → `role_soldier.png`
- `role_elder.png` → `role_commando.png`

**Images finales requises :**

- [ ] `role_hatchling.png` - Niveaux 1-9 (gris)
- [ ] `role_juvenile.png` - Niveaux 10-19 (cyan)
- [ ] `role_adult.png` - Niveaux 20-34 (bleu)
- [ ] `role_soldier.png` - Niveaux 35-54 (vert) ← À RENOMMER
- [ ] `role_elite.png` - Niveaux 55-79 (violet)
- [ ] `role_commando.png` - Niveaux 80+ (rouge) ← À RENOMMER

### 3. 🎨 Style Recommandé

**Soldier (35-54)** - Nouveau rôle

- Couleurs : Vert (#48BB78)
- Thème : Combattant, déterminé
- Emoji : ⚔️

**Commando (80+)** - Maintenant au sommet

- Couleurs : Rouge (#F56565)
- Thème : Maître, légendaire
- Emoji : 🔱

---

## 🔄 Après Ces Changements

1. Redémarrez le bot
2. Les utilisateurs ayant atteint ces niveaux recevront automatiquement les bons rôles
3. Les nouvelles images s'afficheront lors des level ups

---

## 📊 Résumé des Changements

| Niveau | Avant     | Après        | Changement       |
|--------|-----------|--------------|------------------|
| 1-9    | Hatchling | Hatchling    | Aucun            |
| 10-19  | Juvenile  | Juvenile     | Aucun            |
| 20-34  | Adult     | Adult        | Aucun            |
| 35-54  | Commando  | **Soldier**  | Renommé          |
| 55-79  | Elite     | Elite        | Aucun            |
| 80+    | Elder     | **Commando** | Remplacé/Déplacé |

---

## ✅ Compilation

Le code compile sans erreurs. Les changements sont prêts à être déployés une fois les rôles Discord renommés et les images mises à jour.
