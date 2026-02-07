# ✅ PAGINATION POUR TOUTES LES CATÉGORIES D'ACHIEVEMENTS

## 🎯 Changement effectué

**La pagination est maintenant disponible pour TOUTES les catégories d'achievements, pas seulement Netricsa.**

## 📊 Fonctionnement

### Seuil de pagination : **10 achievements**

Si une catégorie contient **plus de 10 achievements**, la pagination s'active automatiquement.

### Affichage :

- **Page 1** : Achievements 1-10
- **Page 2** : Achievements 11-20
- **Page 3** : Achievements 21-30
- etc.

## 🎮 Catégories affectées

| Catégorie       | Nombre d'achievements | Pagination ?    |
|-----------------|-----------------------|-----------------|
| 📋 **Profil**   | 4                     | ❌ Non (< 10)    |
| 🤖 **Netricsa** | 27                    | ✅ Oui (3 pages) |
| 💬 **Discord**  | 0                     | ❌ Non           |
| 🎮 **Jeux**     | 5 compteur            | ❌ Non (< 10)    |
| ⭐ **Niveau**    | 0                     | ❌ Non           |
| 🔒 **Secrets**  | 1 (Artiste Total)     | ❌ Non (< 10)    |

**Actuellement, seule la catégorie Netricsa a besoin de pagination (27 achievements = 3 pages).**

## 🔧 Implémentation

### 1. Fonction createAchievementEmbed modifiée

**Fichiers** : `profile.ts` et `userProfile.ts`

```typescript
function createAchievementEmbed(targetUser: any, category: AchievementCategory, page: number = 0) {
    // Pagination pour TOUTES les catégories si > 10 achievements
    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil(achievements.length / ITEMS_PER_PAGE);
    
    // S'assurer que la page est valide
    page = Math.max(0, Math.min(page, totalPages - 1));

    // Paginer les achievements
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedAchievements = achievements.slice(startIndex, endIndex);

    // Footer avec numéro de page si nécessaire
    const footerText = totalPages > 1
        ? `Page ${page + 1}/${totalPages} | Complétion globale: ${completion}%...`
        : `Complétion globale: ${completion}%...`;
}
```

### 2. Boutons de pagination créés dynamiquement

```typescript
function createPaginationButtons(currentPage: number, totalPages: number, userId: string) {
    if (totalPages <= 1) return null; // Pas de pagination si <= 10 achievements

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`achievement_page_prev_${userId}`)
            .setEmoji("⬅️")
            .setDisabled(currentPage === 0), // Désactivé si première page
        new ButtonBuilder()
            .setCustomId(`achievement_page_next_${userId}`)
            .setEmoji("➡️")
            .setDisabled(currentPage >= totalPages - 1) // Désactivé si dernière page
    );
}
```

### 3. Navigation entre pages

```typescript
else if (customId.startsWith("achievement_page_")) {
    const action = customId.includes("prev") ? "prev" : "next";
    
    if (action === "prev" && currentAchievementPage > 0) {
        currentAchievementPage--;
    } else if (action === "next") {
        const totalPages = Math.ceil(achievements.length / 10);
        if (currentAchievementPage < totalPages - 1) {
            currentAchievementPage++;
        }
    }
    
    // Recréer l'embed avec la nouvelle page
    const embed = createAchievementEmbed(targetUser, currentAchievementCategory, currentAchievementPage);
    // ... mise à jour du message
}
```

## 🎯 Comportement

### Catégorie avec > 10 achievements (ex: Netricsa - 27 achievements) :

```
Page 1/3
┌─────────────────────────┐
│ 🎨 Créateur Amateur     │
│ 🖌️ Artiste Confirmé     │
│ 🌟 Maître Artiste       │
│ 🎭 Légende de l'Art     │
│ ✨ Réimaginateur...     │
│ (6 autres)             │
└─────────────────────────┘
[⬅️] [➡️]  ← Boutons pagination
```

**Cliquer sur ➡️** :

```
Page 2/3
┌─────────────────────────┐
│ 🎪 Réimaginateur...     │
│ 🌈 Maître Réimag...     │
│ 📸 HD Amateur           │
│ (7 autres)             │
└─────────────────────────┘
[⬅️] [➡️]
```

### Catégorie avec <= 10 achievements (ex: Profil - 4 achievements) :

```
┌─────────────────────────┐
│ 📋 Carte d'identité     │
│ 🎂 Gâteau...            │
│ 🏷️ Surnommé             │
│ 📝 Livre ouvert         │
└─────────────────────────┘
❌ Pas de boutons pagination
```

## ✨ Avantages

### ✅ Évolutif

- Si une catégorie dépasse 10 achievements → Pagination automatique
- Pas besoin de code spécifique par catégorie

### ✅ Performance

- Seuls 10 achievements affichés par page
- Pas de surcharge visuelle

### ✅ Consistant

- Même logique pour toutes les catégories
- Interface prévisible

### ✅ Flexible

- Facile de changer `ITEMS_PER_PAGE` (actuellement 10)
- S'adapte au nombre d'achievements

## 📋 Détails techniques

### Reset de page automatique

Quand on change de catégorie, la page est **reset à 0** :

```typescript
else if (customId.startsWith("achievements_")) {
    const [, categoryStr] = customId.split("_");
    currentAchievementCategory = categoryStr as AchievementCategory;
    currentAchievementPage = 0; // ✅ Reset à la première page
}
```

### Validation de page

La page est toujours validée pour éviter les erreurs :

```typescript
page = Math.max(0, Math.min(page, totalPages - 1));
```

Cela garantit :

- ✅ Page >= 0
- ✅ Page < totalPages

### Composants dynamiques

Les boutons sont ajoutés seulement si nécessaire :

```typescript
const components = paginationButtons 
    ? [...navButtons, paginationButtons, backButton]  // Avec pagination
    : [...navButtons, backButton];                    // Sans pagination
```

## 📊 Exemple avec Netricsa (27 achievements)

### Distribution sur 3 pages :

| Page       | Achievements | Plage |
|------------|--------------|-------|
| **Page 1** | 10           | 1-10  |
| **Page 2** | 10           | 11-20 |
| **Page 3** | 7            | 21-27 |

### Footer dynamique :

- **Page 1** : `Page 1/3 | Complétion globale: 15% | 4/27 dans cette catégorie`
- **Page 2** : `Page 2/3 | Complétion globale: 15% | 4/27 dans cette catégorie`
- **Page 3** : `Page 3/3 | Complétion globale: 15% | 4/27 dans cette catégorie`

## 🎯 Fichiers modifiés

1. ✅ **`src/commands/profile/profile.ts`**
    - `createAchievementEmbed()` : pagination pour toutes les catégories
    - `createPaginationButtons()` : création dynamique
    - Gestion navigation entre pages

2. ✅ **`src/commands/context/userProfile.ts`**
    - Mêmes modifications pour le context menu
    - Interface identique

## 🎯 Statut

**✅ CODE COMPILÉ SANS ERREURS**

- ✅ Pagination dynamique pour toutes les catégories
- ✅ Seuil : 10 achievements
- ✅ Boutons ⬅️ ➡️ ajoutés automatiquement
- ✅ Reset de page lors du changement de catégorie
- ✅ Footer avec numéro de page
- ✅ Fonctionne dans `/profile` et context menu

**La pagination s'active automatiquement dès qu'une catégorie dépasse 10 achievements ! 🎉**

## 🧪 Test

### Pour tester maintenant :

1. **Ouvre `/profile`** ou **clic droit → Voir le profil**
2. **Clique sur 🏆 Achievements**
3. **Clique sur 🤖 Netricsa**
4. **Tu verras "Page 1/3"** en footer
5. **Clique sur ➡️** pour voir la page 2
6. **Clique sur ⬅️** pour revenir à la page 1

**Les autres catégories (< 10 achievements) n'ont pas de pagination ! ✅**
