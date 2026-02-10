# 🔥 Modifications du Système de Feu de Foyer - Résumé

## 📅 Dernière mise à jour : 2026-02-09

---

## ✅ Nouvelles Modifications (2026-02-09 - Partie 2)

### 6. ✅ Permissions du Bot dans le Salon

**Problème** : Le bot n'avait pas la permission d'écrire dans le salon du feu.

**Solution** : Ajout d'une règle de permission spécifique pour le bot.

**Permissions ajoutées** :

```typescript
{
    id: client.user!.id,
        allow
:
    ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks"]
}
```

---

### 7. ✅ Position du Salon

**Problème** : Le salon n'était pas placé dans la bonne catégorie.

**Solution** : Le salon est maintenant créé dans la catégorie `1470500820297711657` et placé tout en bas.

**Comportement** :

1. Le salon est créé avec `parent: "1470500820297711657"`
2. Calcul de la position maximale dans la catégorie
3. Placement du salon à `maxPosition + 1`

---

### 8. ✅ Emoji Dynamique du Salon

**Problème** : L'emoji du nom du salon ne changeait pas selon le statut du feu.

**Solution** : Le nom du salon s'update automatiquement avec l'emoji correspondant à l'état du feu.

**Exemples de noms** :

- `🔥・feu-de-foyer` (Intense - 81-100%)
- `🔥・feu-de-foyer` (Fort - 61-80%)
- `🪵・feu-de-foyer` (Moyen - 41-60%)
- `🌫️・feu-de-foyer` (Faible - 21-40%)
- `💨・feu-de-foyer` (Éteint - 0-20%)

**Mise à jour** :

- À chaque intervalle de mise à jour (5 minutes)
- Vérifie si le nom actuel correspond à l'état
- Met à jour si nécessaire

---

## ✅ Nouvelles Modifications (2026-02-09 - Partie 1)

### 4. ✅ Stats Saisonnières dans `/profile`

**Problème** : Les statistiques personnelles liées au feu de foyer n'apparaissaient que dans le menu contextuel `userProfile`, mais pas dans la commande `/profile`.

**Solution** : Ajout de la gestion du bouton "Saisonnier" dans la navigation des statistiques de `/profile`.

**Fichier modifié** :

- `src/commands/profile/profile.ts`

**Test** :

```
/profile @utilisateur
→ Cliquer sur "📊 Statistiques"
→ Cliquer sur "🔥 Saisonnier"
→ Vérifier que les contributions au feu s'affichent
```

---

### 5. ✅ Création Automatique du Salon Textuel

**Problème** : Le salon textuel pour interagir avec le feu de foyer n'était pas créé automatiquement.

**Solution** : Le système crée maintenant automatiquement un salon dédié `🔥・feu-de-foyer` s'il n'existe pas.

**Fichier modifié** :

- `src/services/seasonal/fireManager.ts`

**Caractéristiques du salon** :

- **Nom** : `🔥・feu-de-foyer`
- **Topic** : "🪵 Maintenez le feu allumé pour conserver le multiplicateur d'XP !"
- **Permissions** :
    - ✅ Voir le salon
    - ✅ Lire l'historique
    - ❌ Envoyer des messages (seul le bouton fonctionne)

**Comportement** :

1. Cherche d'abord l'ID sauvegardé
2. Sinon, cherche un salon contenant "feu-de-foyer"
3. Sinon, crée le salon automatiquement

---

## ✅ Tâches Complétées (Précédemment)

### 1. ✅ Le feu n'affecte PAS les succès (achievements)

**Modification** : Ajout d'un paramètre `skipMultiplier` à la fonction `addXP()`

```typescript
export async function addXP(
    userId: string,
    username: string,
    amount: number,
    channel?: TextChannel | VoiceChannel,
    isBot: boolean = false,
    skipMultiplier: boolean = false  // ← NOUVEAU
)
```

**Utilisation** :

- **Achievements** : `addXP(..., true)` → XP fixe, pas de multiplicateur ✅
- **Mystery Box** : `addXP(..., true)` → XP fixe, pas de multiplicateur ✅
- **Tous les autres gains** : `addXP(..., false)` ou par défaut → Multiplicateur appliqué ✅

**Fichiers modifiés** :

- `src/services/xpSystem.ts` - Ajout du paramètre skipMultiplier
- `src/services/achievementService.ts` - Utilise skipMultiplier=true
- `src/services/events/mysteryBoxEvent.ts` - Utilise skipMultiplier=true

---

### 2. ⚠️ Mentionner le multiplicateur dans les messages d'XP

**Status** : En attente - Nécessiterait de modifier tous les endroits où l'XP est affiché

**Endroits concernés** :

- Messages de jeux (RPS, TTT, Connect4, Pendu, Slots, etc.)
- Notifications de level up
- Embeds d'événements
- Logs Discord

**Suggestion** : Créer une fonction utilitaire `formatXPGain(baseXP)` qui retourne une string formatée avec le multiplicateur

---

### 3. ✅ Suppression de /fire-stats

**Action** : Commande supprimée

```bash
Supprimé : src/commands/fire-stats/fire-stats.ts
```

Les stats du feu sont maintenant accessibles via le profil utilisateur uniquement.

---

### 4. ✅ Ajout de qui a ajouté la dernière bûche dans l'embed

**Avant** :

```
• Dernière bûche : il y a 25 min
```

**Maintenant** :

```
• Dernière bûche : il y a 25 min par @JoueurA
```

**Fichier modifié** : `src/services/seasonal/fireManager.ts`

---

### 5. ✅ Stats du feu dans le profil utilisateur

**Nouveau bouton** : `❄️ Événement Saisonnier`

**Emplacement** : Menu contextuel `Profil de @Utilisateur`

**Navigation** :

```
Profil de @Utilisateur
├─ 📊 Statistiques
├─ ❄️ Événement Saisonnier  ← NOUVEAU
└─ 🏆 Succès
```

**Contenu de l'embed** :

- État actuel du feu (intensité, multiplicateur)
- Contributions personnelles de l'utilisateur
    - Dernière bûche ajoutée
    - Temps restant du cooldown
    - Statut (prêt ou en cooldown)
- Statistiques globales du serveur
- Guide de participation

**Fichiers modifiés** :

- `src/utils/seasonalStatsEmbed.ts` - Nouvel embed créé
- `src/commands/context/userProfile.ts` - Bouton et navigation ajoutés

---

## 📊 Récapitulatif Technique

### Système de Multiplicateur

```typescript
// Multiplicateur appliqué automatiquement
let finalAmount = amount;
if (!skipMultiplier) {
    const fireMultiplier = getCurrentFireMultiplier();
    finalAmount = Math.round(amount * fireMultiplier);
}
xpData[userId].totalXP += finalAmount;
```

### Cas d'utilisation

| Type de gain XP         | Multiplicateur appliqué ?   |
|-------------------------|-----------------------------|
| Messages Discord        | ✅ Oui                       |
| Commandes fun           | ✅ Oui                       |
| Temps vocal             | ✅ Oui                       |
| Réactions               | ✅ Oui                       |
| Jeux (RPS, TTT, etc.)   | ✅ Oui                       |
| IA/Images               | ✅ Oui                       |
| Boss/Énigmes/Événements | ✅ Oui                       |
| **Achievements**        | ❌ Non (skipMultiplier=true) |
| **Mystery Box**         | ❌ Non (skipMultiplier=true) |

### Embed Saisonnier - Exemple

```
┌────────────────────────────────────┐
│ ❄️ Événement Saisonnier - JoueurA │
├────────────────────────────────────┤
│ ### 🔥 Feu de Foyer (Hiver 2026)   │
│                                    │
│ État actuel : Fort                 │
│ ████████████████░░░░ 75%           │
│                                    │
│ 🎁 Multiplicateur XP global: ×1.15 │
│                                    │
│ ### 👤 Tes Contributions           │
│ Dernière bûche ajoutée: il y a 2h  │
│ ⏰ Cooldown: 1h 55min               │
│                                    │
│ ### 📊 Statistiques Globales       │
│ • Bûches aujourd'hui: 18           │
│ • Total saison: 127                │
│ • Dernière bûche globale: il y a   │
│   25min par @JoueurB               │
│                                    │
│ ### ℹ️ Comment participer          │
│ • Utilise le bouton dans l'embed   │
│   permanent du feu                 │
│ • +10% par bûche ajoutée           │
│ • Cooldown de 4h entre chaque      │
│   contribution                     │
│ • Le feu décroît de -1% toutes les │
│   30 minutes                       │
│                                    │
│ ### 🔥 Paliers de multiplicateur   │
│ • 81-100%: ×1.33 (Intense)         │
│ • 61-80%: ×1.15 (Fort)             │
│ • 41-60%: ×1.00 (Moyen)            │
│ • 21-40%: ×0.66 (Faible)           │
│ • 0-20%: ×0.33 (Éteint)            │
└────────────────────────────────────┘
```

---

## 📁 Fichiers Créés/Modifiés

### Créés (1)

- `src/utils/seasonalStatsEmbed.ts` - Embed des stats saisonnières

### Modifiés (6)

1. `src/services/xpSystem.ts` - Paramètre skipMultiplier
2. `src/services/achievementService.ts` - Utilise skipMultiplier
3. `src/services/events/mysteryBoxEvent.ts` - Utilise skipMultiplier
4. `src/services/seasonal/fireManager.ts` - Affiche qui a ajouté la bûche
5. `src/commands/context/userProfile.ts` - Bouton saisonnier
6. `src/utils/seasonalStatsEmbed.ts` - Nouvel embed

### Supprimés (1)

- `src/commands/fire-stats/` - Dossier complet supprimé

---

## 🎯 Points Importants

### Achievements et Mystery Box

Les récompenses fixes (achievements et mystery box) ne sont **PAS affectées** par le multiplicateur saisonnier. Cela garantit :

- ✅ Équité : Tous les joueurs reçoivent le même XP pour les mêmes achievements
- ✅ Balance : Les achievements ont des valeurs XP prédéfinies et équilibrées
- ✅ Prévisibilité : Les joueurs savent exactement combien d'XP ils gagneront

### Multiplicateur Appliqué

Tous les autres gains d'XP (messages, vocal, jeux, événements, etc.) bénéficient du multiplicateur :

- ✅ Encourage la participation au feu
- ✅ Récompense l'engagement communautaire
- ✅ Crée un objectif partagé

### Profil Utilisateur

Le nouveau bouton "❄️ Événement Saisonnier" permet de :

- Voir ses propres contributions
- Vérifier son cooldown
- Comprendre le système
- Voir les stats globales

---

## 🔮 Suggestions Futures (Non Implémentées)

### 2. Afficher le multiplicateur partout

**Exemple de fonction utilitaire** :

```typescript
export function formatXPGain(baseXP: number, skipMultiplier: boolean = false): string {
    if (skipMultiplier) {
        return `+${baseXP} XP`;
    }

    const multiplier = getCurrentFireMultiplier();
    const finalXP = Math.round(baseXP * multiplier);

    if (multiplier === 1.0) {
        return `+${finalXP} XP`;
    }

    return `+${finalXP} XP (×${multiplier.toFixed(2)} 🔥)`;
}
```

**Utilisation** :

```typescript
// Dans les jeux, événements, etc.
const xpText = formatXPGain(15); // "+20 XP (×1.33 🔥)"
```

**Endroits à modifier** :

- Tous les embeds de jeux (RPS, TTT, C4, Pendu, Slots)
- Tous les événements (Boss, Énigmes, Suites logiques)
- Messages de level up
- Logs Discord

---

## ✅ Résumé Final

| Tâche                             | Status        | Notes                            |
|-----------------------------------|---------------|----------------------------------|
| 1. Feu n'affecte pas les succès   | ✅ Fait        | Paramètre `skipMultiplier`       |
| 2. Multiplicateur affiché         | ⚠️ Suggestion | Fonction utilitaire recommandée  |
| 3. Suppression /fire-stats        | ✅ Fait        | Commande supprimée               |
| 4. Afficher qui a ajouté la bûche | ✅ Fait        | Mention dans l'embed             |
| 5. Stats du feu dans le profil    | ✅ Fait        | Bouton "❄️ Événement Saisonnier" |

**Tout compile sans erreurs ! 🎉**

