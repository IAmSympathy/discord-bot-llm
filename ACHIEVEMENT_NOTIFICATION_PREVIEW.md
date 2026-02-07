# 🎉 Aperçu de la Notification d'Achievement

## 📱 Message Discord

```
@Username 🎉
```

## 🎨 Embed "Succès !"

```
┌─────────────────────────────────────────┐
│ ✨ Succès !                             │
├─────────────────────────────────────────┤
│                                         │
│  ## 💬 Bavard IA                        │
│                                         │
│  *Avoir 100 conversations avec          │
│   Netricsa*                             │
│                                         │
│  🎁 **+250 XP** gagné !                 │
│                                         │
│  Consulte tous tes succès avec          │
│  `/profile` ou en faisant clic droit    │
│  sur ton nom → **Voir le profil** !     │
│                                         │
│                              [BADGE]    │
│                               🏆        │
│                                         │
├─────────────────────────────────────────┤
│ ⏰ 6 février 2026 à 23:45               │
│ Continue comme ça pour débloquer        │
│ plus de succès !                        │
└─────────────────────────────────────────┘
```

## 🎨 Détails de l'Embed

### Couleur

- **Gold** (#FFD700) - Couleur dorée pour mettre en valeur

### Titre

- **"✨ Succès !"**

### Description

Structure en plusieurs parties :

1. **Titre du succès** (grand titre avec emoji) : `## 💬 Bavard IA`
2. **Description** (italique) : `*Avoir 100 conversations avec Netricsa*`
3. **Récompense XP** : `🎁 **+250 XP** gagné !`
4. **Invitation à voir le profil** : Instructions pour accéder aux autres succès

### Thumbnail (Coin supérieur droit)

- Image du badge d'achievement (trophée rouge/jaune/noir)
- Si l'image n'est pas présente, l'embed fonctionne quand même sans

### Footer

- **Texte** : "Continue comme ça pour débloquer plus de succès !"
- **Timestamp** : Date et heure actuelles

### Mention

- L'utilisateur est **pinged** : `<@userId> 🎉`
- Le ping est visible et notifie l'utilisateur

## 📊 Exemple concret avec différents achievements

### Achievement "Première Parole"

```
@TonNom 🎉

┌─────────────────────────────────────┐
│ ✨ Succès !                         │
│                                     │
│ ## 💬 Première Parole               │
│                                     │
│ *Envoyer son premier message*       │
│                                     │
│ 🎁 **+100 XP** gagné !              │
│                                     │
│ Consulte tous tes succès avec       │
│ `/profile` ou en faisant clic       │
│ droit sur ton nom !                 │
│                          [🏆 Badge] │
└─────────────────────────────────────┘
```

### Achievement "Maître Artiste"

```
@TonNom 🎉

┌─────────────────────────────────────┐
│ ✨ Succès !                         │
│                                     │
│ ## 🖌️ Maître artiste               │
│                                     │
│ *Générer 200 images*                │
│                                     │
│ 🎁 **+500 XP** gagné !              │
│                                     │
│ Consulte tous tes succès avec       │
│ `/profile` !                        │
│                          [🏆 Badge] │
└─────────────────────────────────────┘
```

### Achievement Secret

```
@TonNom 🎉

┌─────────────────────────────────────┐
│ ✨ Succès !                         │
│                                     │
│ ## 🔒 Mystère                       │
│                                     │
│ *Faire quelque chose de très        │
│  spécial...*                        │
│                                     │
│ 🎁 **+1000 XP** gagné !             │
│                                     │
│ Consulte tous tes succès !          │
│                          [🏆 Badge] │
└─────────────────────────────────────┘
```

## 🔧 Fonctionnalités

✅ **Ping l'utilisateur** - Notification Discord standard  
✅ **Embed stylisé** - Titre "Succès !" en or  
✅ **Nom du succès** - En grand titre avec emoji  
✅ **Description** - En italique pour la lisibilité  
✅ **Récompense XP** - Mise en évidence avec emoji 🎁  
✅ **Image badge** - Trophée dans le coin (si disponible)  
✅ **Invitation profil** - Instructions claires pour voir plus  
✅ **Footer motivant** - "Continue comme ça..."  
✅ **Timestamp** - Date et heure du déblocage

## 📝 Notes d'implémentation

- Si l'image `assets/achievement_badge.png` n'existe pas, l'embed s'affiche quand même sans thumbnail
- Place l'image fournie (trophée rouge/jaune) dans `assets/achievement_badge.png`
- L'XP est automatiquement ajouté après l'envoi de la notification
- Le système ne notifie qu'une seule fois par achievement (flag `notified`)

## 🎯 Résultat final

Un message Discord visuellement attrayant qui :

1. **Attire l'attention** avec le ping et l'emoji 🎉
2. **Célèbre le succès** avec un embed doré
3. **Informe clairement** sur ce qui a été débloqué
4. **Motive à continuer** avec le message du footer
5. **Guide l'utilisateur** vers son profil pour voir plus

C'est exactement le type de notification qu'on retrouve dans les jeux modernes ! 🎮✨
