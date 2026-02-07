# Images de Level Up - Guide Simplifié

## 📁 Structure

```
assets/levelup/
└── roleup/
    ├── role_hatchling.png   (niveaux 1-9)
    ├── role_juvenile.png    (niveaux 10-19)
    ├── role_adult.png       (niveaux 20-34)
    ├── role_soldier.png     (niveaux 35-54)
    ├── role_elite.png       (niveaux 55-79)
    └── role_commando.png    (niveaux 80+)
```

**Total : 6 images à créer** 🎨

## 🎯 Comment ça fonctionne

Les images dans `roleup/` sont utilisées pour **TOUS les level ups**, selon le rôle actuel du joueur.

### Exemples :

- **Joueur niveau 5** (Hatchling) monte au niveau 6 → Affiche `role_hatchling.png`
- **Joueur niveau 15** (Juvenile) monte au niveau 16 → Affiche `role_juvenile.png`
- **Joueur niveau 19** (Juvenile) monte au niveau 20 (Adult) → Affiche `role_adult.png` avec titre spécial "🎖️ Nouveau Rôle !"

### Différence d'affichage :

| Type                   | Titre              | Image                 |
|------------------------|--------------------|-----------------------|
| **Level up normal**    | 🎉 Level Up !      | Image du rôle actuel  |
| **Changement de rôle** | 🎖️ Nouveau Rôle ! | Image du nouveau rôle |

## 🎨 Spécifications

- **Format** : PNG (transparence optionnelle)
- **Dimensions** : 800x400 pixels recommandé
- **Poids** : < 8 MB (limite Discord)
- **Nommage** : `role_ROLENAME.png` (en minuscules)

## 🌈 Guide de style par rôle

| Rôle          | Niveaux | Couleurs              | Thème                   | Emoji |
|---------------|---------|-----------------------|-------------------------|-------|
| **Hatchling** | 1-9     | Gris/Argent (#4A5568) | Débutant, humble        | 🥚    |
| **Juvenile**  | 10-19   | Cyan (#38B2AC)        | Progression, croissance | 🐣    |
| **Adult**     | 20-34   | Bleu (#4299E1)        | Mature, établi          | 🦅    |
| **Soldier**   | 35-54   | Vert (#48BB78)        | Combattant, déterminé   | ⚔️    |
| **Elite**     | 55-79   | Violet (#9F7AEA)      | Élite, puissant         | 👑    |
| **Commando**  | 80+     | Rouge (#F56565)       | Maître, légendaire      | 🔱    |

## 💡 Suggestions de design

### Éléments communs :

- Badge ou médaille centrale
- Fond avec gradient des couleurs du rôle
- Particules, étoiles ou effets lumineux
- Police claire et lisible
- Style cohérent avec Serious Sam

### Pour les changements de rôle :

Le bot change juste le titre de l'embed, donc l'image peut être conçue pour fonctionner dans les deux contextes.

## 🛠️ Outils recommandés

- **Canva** - Templates gratuits, facile d'utilisation
- **Photopea** - Éditeur gratuit en ligne (comme Photoshop)
- **GIMP** - Logiciel gratuit open source
- **Stable Diffusion** - Votre API pour générer les bases

## 🚀 Démarrage rapide

1. Créez 6 images PNG (800x400px)
2. Nommez-les exactement : `role_hatchling.png`, `role_juvenile.png`, etc.
3. Placez-les dans `assets/levelup/roleup/`
4. Redémarrez le bot
5. Testez en gagnant de l'XP !

## 📋 Checklist de création

- [ ] `role_hatchling.png` - Niveaux 1-9 (gris)
- [ ] `role_juvenile.png` - Niveaux 10-19 (cyan)
- [ ] `role_adult.png` - Niveaux 20-34 (bleu)
- [ ] `role_soldier.png` - Niveaux 35-54 (vert)
- [ ] `role_elite.png` - Niveaux 55-79 (violet)
- [ ] `role_commando.png` - Niveaux 80+ (rouge)

## ❓ FAQ

**Q : Que se passe-t-il si je ne crée pas toutes les images ?**  
R : Le bot affichera l'embed sans image pour les rôles manquants.

**Q : Puis-je utiliser la même image pour tous les rôles temporairement ?**  
R : Oui ! Copiez la même image 6 fois avec des noms différents.

**Q : Les images doivent-elles avoir un fond transparent ?**  
R : Non, ce n'est pas obligatoire. Un fond opaque fonctionne très bien.

**Q : Puis-je changer les images après coup ?**  
R : Oui, remplacez les fichiers et redémarrez le bot (ou attendez le prochain level up).
