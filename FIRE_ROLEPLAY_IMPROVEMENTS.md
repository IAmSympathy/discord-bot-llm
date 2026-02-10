# 🔥 Améliorations du Feu de Foyer - Design Role-Play

## Date : 2026-02-09

---

## ✨ Nouvelles Fonctionnalités

### 1. ASCII Art Dynamique du Feu 🎨

L'embed affiche maintenant un feu de foyer en ASCII art qui change selon l'intensité !

#### Feu Intense (81-100%)

```
        (  )   (   )  )
         ) (   )  (  (
         ( )  (    ) )
         _____________
        <_____________> )))
          |         |
          |_________|
```

#### Feu Fort (61-80%)

```
         (   )  )
          ) (  (
         ( )  )
         _____________
        <_____________> ))
          |         |
          |_________|
```

#### Feu Moyen (41-60%)

```
          )  (
         ( ) )
         _____________
        <_____________> )
          |         |
          |_________|
```

#### Feu Faible (21-40%)

```
          ) (
         _____________
        <_____________>
          |         |
          |_________|
```

#### Feu Éteint (0-20%)

```
         _____________
        <_____________>
          |         |
          |_________|
```

---

### 2. Intégration Météo 🌡️

Le feu de foyer réagit maintenant aux conditions météorologiques de Sherbrooke !

#### Impacts Météo

| Condition        | Température | Impact sur le Feu                          |
|------------------|-------------|--------------------------------------------|
| 🌧️ Pluie/Orage  | -           | ⚠️ La pluie menace le feu ! (-2%/30min)    |
| ❄️ Neige         | -           | ❄️ La neige refroidit le feu (-1.5%/30min) |
| 🥶 Froid Extrême | < -10°C     | 🥶 Le feu a besoin de plus de bûches       |
| 🔥 Froid         | 0°C à -10°C | 🔥 Le feu réchauffe l'atmosphère           |
| ✅ Stable         | > 0°C       | ✅ Temps stable                             |

**Note** : Les impacts météo sont affichés visuellement dans l'embed. Le système de décroissance accélérée selon la météo peut être implémenté ultérieurement.

---

### 3. Design Role-Play Amélioré 📜

#### Nouveau Format de l'Embed

```
╔═══════════════════════════════╗
║  INTENSE - 95%  
║  ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰
╚═══════════════════════════════╝

✨ Multiplicateur d'Expérience : ×1.33
*Les flammes dansantes amplifient vos gains !*

🌡️ Météo à Sherbrooke
✅ Temps stable (5°C)

📜 Dernière Contribution
🪵 @Utilisateur - Il y a 2h 15min

📊 Statistiques du Jour
• 🪵 Bûches ajoutées : 12
• ⏳ Extinction : ~15h

💡 Comment Contribuer
• Cliquez sur le bouton ci-dessous
• Chaque bûche : +10% d'intensité
• Cooldown : 4 heures par personne
• Décroissance : -1% toutes les 30 min
```

#### Éléments de Style

- **Titre** : `🔥 LE FEU DE FOYER DE SHERBROOKE`
- **Footer** : `Hiver 2026 • Gardez les flammes vivantes pour maximiser vos gains d'XP !`
- **Couleurs** : Changent selon l'état du feu
- **Barre de progression** : 20 caractères (`▰` et `▱`)

---

### 4. Position du Salon Vocal 📍

Le salon vocal "Feu de Foyer" est maintenant **toujours positionné en 2ème position** (position 1), juste en dessous du salon météo (position 0).

#### Ordre des Salons Vocaux

```
┌─────────────────────────────────┐
│ Position 0: 🌡️ Nuageux, 5°      │ ← Météo
├─────────────────────────────────┤
│ Position 1: 🔥 Feu de Foyer - ×1.33 XP │ ← Feu de Foyer
├─────────────────────────────────┤
│ Position 2+: Autres salons...   │
└─────────────────────────────────┘
```

**Avantages** :

- Les deux systèmes saisonniers sont groupés ensemble
- Facilement visibles en haut du serveur
- Le lien météo/feu est visuellement évident

---

## 🔧 Modifications Techniques

### Fichiers Modifiés

1. **`src/services/seasonal/fireManager.ts`**

#### Nouvelles Fonctions

```typescript
// Génère l'ASCII art selon l'intensité
function getFireAsciiArt(intensity: number): string

// Récupère les données météo et calcule l'impact
async function getWeatherImpact(): Promise<{ text: string; icon: string }>

// Crée l'embed (maintenant async)
async function createFireEmbed(fireData: any): Promise<EmbedBuilder>
```

#### Modifications

- `createFireEmbed()` est maintenant **async** pour récupérer la météo
- `updateFireChannel()` positionne le salon à `position: 1` au lieu de `0`
- Appel à `await createFireEmbed()` dans `updateFireEmbed()`

---

## 🧪 Test

Pour tester les nouvelles fonctionnalités :

1. **Redémarrer le bot**
   ```powershell
   .\start-bot.ps1
   ```

2. **Vérifier l'ordre des salons vocaux**
    - Position 0 : Salon météo
    - Position 1 : Salon feu de foyer

3. **Vérifier l'embed du feu**
    - ASCII art présent
    - Impact météo affiché
    - Design role-play amélioré

4. **Tester différents états du feu**
   ```
   # Simuler différentes intensités
   Ajouter des bûches → Voir l'ASCII art changer
   Attendre la décroissance → Observer les changements
   ```

---

## 🎯 Résultat

### Avant

- ❌ Embed basique sans ASCII art
- ❌ Pas de lien avec la météo
- ❌ Salon vocal feu de foyer en haut (position 0)

### Après

- ✅ ASCII art dynamique du feu
- ✅ Intégration météo avec impacts visuels
- ✅ Design role-play immersif
- ✅ Salon vocal en position 1 (sous la météo)
- ✅ Lien visuel entre météo et feu de foyer

---

## 💡 Futures Améliorations Possibles

### Impact Météo Réel

Actuellement, la météo est **affichée** mais n'affecte pas le taux de décroissance. On pourrait implémenter :

```typescript
// Dans startDecay()
const weather = await getSherbrookeWeather();
let decayRate = FIRE_CONFIG.DECAY_RATE;

if (weather.condition.includes("pluie")) {
    decayRate *= 2; // Double décroissance sous la pluie
} else if (weather.condition.includes("neige")) {
    decayRate *= 1.5; // 50% plus rapide sous la neige
}

fireData.intensity -= decayRate * periodsElapsed;
```

### Bonus Météo

Ajouter des bonus selon les conditions :

- ☀️ **Soleil** : Décroissance ralentie (-0.5%/30min)
- ❄️ **Neige** : Décroissance accélérée (-1.5%/30min)
- 🌧️ **Pluie** : Décroissance très accélérée (-2%/30min)
- 🥶 **Froid Extrême** : Bonus de bûches (+15% au lieu de +10%)

---

## 🎨 Aperçu Visuel

L'embed du feu de foyer affiche maintenant une expérience immersive complète avec :

- 🔥 Animation ASCII du feu vivant
- 🌡️ Conditions météorologiques actuelles
- 📊 Statistiques détaillées en temps réel
- 💡 Instructions claires pour contribuer
- ✨ Design role-play avec bordures et emojis

**Le feu de foyer de Sherbrooke est maintenant un véritable système interactif qui réagit à l'environnement !** 🔥❄️

