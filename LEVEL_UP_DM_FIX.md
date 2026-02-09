# 🔧 Correction : Mentions de rôles en DM

## ❌ Problème identifié

Les notifications de level up envoyées en DM affichaient **"@rôle inconnu"** à la place du nom du rôle.

### Cause

Les **mentions de rôles Discord** (`<@&ROLE_ID>`) ne fonctionnent **pas en DM** car :

- Les DMs ne sont pas liés à un serveur spécifique
- Discord ne peut pas résoudre les IDs de rôles hors du contexte d'un serveur
- Résultat : `<@&123456789>` s'affiche comme "@rôle inconnu"

### Exemples de problèmes

**Avant la correction :**

```
📊 Progression
Plus que 5 niveaux avant @rôle inconnu !

🏆 Rang
@rôle inconnu
```

---

## ✅ Solution appliquée

Remplacement de toutes les **mentions de rôles** (`<@&roleId>`) par le **nom du rôle** en texte brut dans les messages qui peuvent être envoyés en DM.

### Modifications effectuées

#### 1. Section "Prochain Objectif" (ligne 328)

**Avant :**

```typescript
description += `Plus que **${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}** avant <@&${nextRole.roleId}> !`;
```

**Après :**

```typescript
description += `Plus que **${nextRole.levelsNeeded} niveau${nextRole.levelsNeeded > 1 ? 'x' : ''}** avant **${nextRole.roleName}** !`;
```

**Résultat :**

```
Plus que 5 niveaux avant **Ancien** !
```

---

#### 2. Champ "Rang" dans level up (ligne 353)

**Avant :**

```typescript
{
    name: "🏆 Rang",
        value
:
    currentRoleId ? `<@&${currentRoleId}>` : currentRoleName,
        inline
:
    true
}
```

**Après :**

```typescript
{
    name: "🏆 Rang",
        value
:
    currentRoleName,
        inline
:
    true
}
```

**Résultat :**

```
🏆 Rang
Hatchling
```

---

#### 3. Champ "Rang" dans level down (ligne 523)

**Avant :**

```typescript
{
    name: "🏆 Rang",
        value
:
    currentRoleId ? `<@&${currentRoleId}>` : currentRoleName,
        inline
:
    true
}
```

**Après :**

```typescript
{
    name: "🏆 Rang",
        value
:
    currentRoleName,
        inline
:
    true
}
```

---

#### 4. Nettoyage du code

Suppression de la variable `currentRoleId` qui n'était plus utilisée :

**Avant :**

```typescript
const currentRoleName = levelRoleInfo?.roleKey || "HATCHLING";
const currentRoleId = LEVEL_ROLES[currentRoleName as keyof typeof LEVEL_ROLES];
imageAttachment = getRoleUpImage(currentRoleName);
```

**Après :**

```typescript
const currentRoleName = levelRoleInfo?.roleKey || "HATCHLING";
imageAttachment = getRoleUpImage(currentRoleName);
```

---

## 📊 Comparaison Avant/Après

### Notification de Level Up en DM

#### ❌ Avant

```
┌─────────────────────────────────────┐
│ 🎉 Niveau Gagné !                   │
├─────────────────────────────────────┤
│ ### Félicitations !                  │
│                                      │
│ Tu as atteint le niveau 15 !         │
│                                      │
│ ### 📊 Progression                   │
│ ```                                  │
│ ████████░░ 80%                       │
│ ```                                  │
│ 💫 1,200 XP / 1,500 XP               │
│                                      │
│ ### 🎯 Prochain Objectif             │
│ Plus que 5 niveaux avant @rôle inconnu ! │  ← PROBLÈME
│                                      │
├─────────────────────────────────────┤
│ 💫 XP Total                          │
│ 12,000 XP                            │
│                                      │
│ ⭐ Niveau                            │
│ 15                                   │
│                                      │
│ 🏆 Rang                              │
│ @rôle inconnu                        │  ← PROBLÈME
└─────────────────────────────────────┘
```

#### ✅ Après

```
┌─────────────────────────────────────┐
│ 🎉 Niveau Gagné !                   │
├─────────────────────────────────────┤
│ ### Félicitations !                  │
│                                      │
│ Tu as atteint le niveau 15 !         │
│                                      │
│ ### 📊 Progression                   │
│ ```                                  │
│ ████████░░ 80%                       │
│ ```                                  │
│ 💫 1,200 XP / 1,500 XP               │
│                                      │
│ ### 🎯 Prochain Objectif             │
│ Plus que 5 niveaux avant **Ancien** !│  ✅ CORRIGÉ
│                                      │
├─────────────────────────────────────┤
│ 💫 XP Total                          │
│ 12,000 XP                            │
│                                      │
│ ⭐ Niveau                            │
│ 15                                   │
│                                      │
│ 🏆 Rang                              │
│ Hatchling                            │  ✅ CORRIGÉ
└─────────────────────────────────────┘
```

---

## 🎯 Fichiers modifiés

| Fichier                    | Lignes modifiées   | Type de modification         |
|----------------------------|--------------------|------------------------------|
| `src/services/xpSystem.ts` | 285, 328, 353, 523 | Remplacement mentions → noms |

---

## 📝 Note importante

### Pourquoi ne pas désactiver complètement les mentions ?

Les mentions de rôles **fonctionnent dans les salons publics**, donc :

- ✅ En DM : Utiliser le nom du rôle (texte brut)
- ✅ En public (role up) : Les mentions fonctionnent normalement

**Notre solution :**

- Les level ups normaux sont envoyés en **DM** → Pas de mentions
- Les role ups sont envoyés **publiquement** → Les mentions fonctionnent

---

## 🧪 Test de validation

### Scénario 1 : Level up normal (DM)

1. Gagner de l'XP pour atteindre un nouveau niveau
2. Vérifier le DM reçu
3. ✅ Le rang doit afficher le nom du rôle (ex: "Hatchling")
4. ✅ Le prochain objectif doit afficher le nom du rôle (ex: "Ancien")

### Scénario 2 : Role up (Public)

1. Gagner de l'XP pour atteindre un nouveau rôle
2. Vérifier le message public dans le salon
3. ✅ Le message peut contenir des mentions (elles fonctionnent en public)

### Scénario 3 : Level down (DM)

1. Perdre de l'XP pour descendre de niveau
2. Vérifier le DM reçu
3. ✅ Le rang doit afficher le nom du rôle sans mention

---

## 🎨 Avantages de cette solution

### ✅ Pour l'utilisateur

- **Lisible** : Affiche le vrai nom du rôle au lieu de "@rôle inconnu"
- **Cohérent** : Même format pour tous les rôles
- **Clair** : Le nom du rôle est visible et compréhensible

### ✅ Pour le code

- **Simple** : Pas besoin de logique conditionnelle complexe
- **Maintenable** : Utilise directement `nextRole.roleName`
- **Fiable** : Fonctionne partout (DM et salons)

### ✅ Pour la performance

- **Léger** : Pas besoin de fetch le rôle depuis Discord
- **Rapide** : Le nom est déjà disponible dans les données

---

## 🔍 Détection des autres cas

J'ai vérifié tout le code pour trouver d'autres mentions de rôles :

### Autres occurrences trouvées (OK)

```
src/utils/statsEmbedBuilder.ts:82
  → Utilisé dans les stats (envoyé dans un salon, pas en DM) ✅

src/roleReactionHandler.ts:130, 194
  → Logs Discord (contexte serveur) ✅

src/services/events/impostorMissionTracker.ts:210
  → Nettoyage de mentions (regex) ✅
```

**Conclusion :** Toutes les autres occurrences sont dans des contextes où les mentions fonctionnent. ✅

---

## ✅ Résumé

| Problème                               | Solution                    | Status    |
|----------------------------------------|-----------------------------|-----------|
| @rôle inconnu en DM                    | Remplacé par le nom du rôle | ✅ Corrigé |
| Mention dans "Prochain Objectif"       | Utilisé `nextRole.roleName` | ✅ Corrigé |
| Mention dans champ "Rang" (level up)   | Utilisé `currentRoleName`   | ✅ Corrigé |
| Mention dans champ "Rang" (level down) | Utilisé `currentRoleName`   | ✅ Corrigé |
| Variable inutilisée                    | Supprimé `currentRoleId`    | ✅ Nettoyé |

---

**Le problème des mentions de rôles en DM est maintenant complètement résolu ! 🎉**

