# 🔧 Correction - Persistance des Données de Temps Vocal Quotidien

## 📅 Date : 2026-02-09

---

## 🐛 Problème Identifié

Les statistiques d'**XP Vocal Accumulé** affichées dans la commande `/challenges` se réinitialisaient à **zéro à chaque redémarrage** du bot, même si l'utilisateur avait déjà accumulé du temps vocal dans la journée.

### Symptômes

```
🎤 XP Vocal Accumulé
▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱ 💫 0 XP gagné
• 1 XP/min (100%)
• ⏰ Reset dans 3h 53min
```

**Problème** : Même après avoir passé 30 minutes en vocal, un redémarrage du bot réinitialisait tout à 0 XP.

---

## 🔍 Cause Racine

Dans `src/voiceTracker.ts`, le système utilisait une `Map` JavaScript en mémoire pour stocker le temps vocal quotidien :

```typescript
const dailyVoiceTime = new Map<string, DailyVoiceTime>();
```

**Problème** : Cette Map n'était **jamais sauvegardée sur disque**. À chaque redémarrage du bot, toutes les données étaient perdues.

---

## ✅ Solution Implémentée

### 1. Fichier de Persistance

Création d'un fichier JSON pour sauvegarder les données :

```
data/daily_voice_time.json
```

### 2. Fonctions de Sauvegarde/Chargement

**Fonction de chargement** (au démarrage) :

```typescript
function loadDailyVoiceTime(): void {
    if (fs.existsSync(DAILY_VOICE_FILE)) {
        const data = JSON.parse(fs.readFileSync(DAILY_VOICE_FILE, "utf-8"));
        const today = new Date().toISOString().split('T')[0];

        // Charger seulement les données du jour actuel
        for (const [userId, voiceTime] of Object.entries(data)) {
            if (voiceTime.lastReset === today) {
                dailyVoiceTime.set(userId, voiceTime);
            }
        }
    }
}
```

**Fonction de sauvegarde** (après chaque mise à jour) :

```typescript
function saveDailyVoiceTime(): void {
    const data: Record<string, DailyVoiceTime> = {};
    for (const [userId, voiceTime] of dailyVoiceTime.entries()) {
        data[userId] = voiceTime;
    }

    fs.writeFileSync(DAILY_VOICE_FILE, JSON.stringify(data, null, 2), "utf-8");
}
```

### 3. Sauvegarde Automatique

Modification de `incrementDailyVoiceTime()` pour sauvegarder après chaque minute :

```typescript
function incrementDailyVoiceTime(userId: string, minutes: number): void {
    // ...existing code...
    dailyTime.totalMinutes += minutes;
    dailyVoiceTime.set(userId, dailyTime);

    // Sauvegarder après chaque mise à jour
    saveDailyVoiceTime();
}
```

### 4. Chargement au Démarrage

Modification de `registerVoiceTracker()` :

```typescript
export function registerVoiceTracker(client: Client): void {
    logger.info("Voice tracker initialized with real-time XP system");

    // Charger les données de temps vocal quotidien
    loadDailyVoiceTime();

    // ...existing code...
}
```

---

## 📊 Structure du Fichier JSON

```json
{
  "123456789012345678": {
    "totalMinutes": 45,
    "lastReset": "2026-02-09"
  },
  "987654321098765432": {
    "totalMinutes": 120,
    "lastReset": "2026-02-09"
  }
}
```

**Champs** :

- `totalMinutes` : Nombre de minutes en vocal accumulées aujourd'hui
- `lastReset` : Date du dernier reset (format YYYY-MM-DD)

---

## 🎯 Comportement Après Correction

### Avant le Redémarrage

```
🎤 XP Vocal Accumulé
▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱ 💫 45 XP gagné
• 1 XP/min (100%)
• ⏰ Reset dans 3h 53min
```

### Après le Redémarrage

```
🎤 XP Vocal Accumulé
▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱ 💫 45 XP gagné  ← Données conservées !
• 1 XP/min (100%)
• ⏰ Reset dans 3h 53min
```

✅ **Les données sont maintenant persistantes !**

---

## 🔄 Reset Quotidien

Le système reset automatiquement les données à minuit :

1. **Vérification de date** : À chaque accès aux données
2. **Nouveau jour détecté** : Si `lastReset !== today`
3. **Réinitialisation** : `totalMinutes = 0`
4. **Nouvelle date** : `lastReset = today`

**Résultat** : Les données du jour précédent sont automatiquement effacées, mais les données du jour actuel sont conservées même après un redémarrage.

---

## 🧪 Test

### Scénario de Test

1. **Rejoindre un salon vocal** pendant 30 minutes
2. **Vérifier** `/challenges` → Devrait afficher ~30 XP gagné
3. **Redémarrer le bot**
4. **Vérifier** `/challenges` → Devrait **encore** afficher ~30 XP gagné

**Résultat attendu** : Les données sont conservées après le redémarrage.

---

## 📝 Logs

Le système génère maintenant des logs pour le suivi :

```
[VoiceTracker] Loaded daily voice time data for 5 users
[VoiceTracker] Saved daily voice time data for 5 users
```

En cas d'erreur :

```
[VoiceTracker] Error loading daily voice time data: [détails]
[VoiceTracker] Error saving daily voice time data: [détails]
```

---

## 📁 Fichiers Modifiés

✅ **`src/voiceTracker.ts`**

- Ajout des imports `fs` et `path`
- Constante `DAILY_VOICE_FILE` pour le chemin du fichier
- Fonction `loadDailyVoiceTime()` pour charger les données
- Fonction `saveDailyVoiceTime()` pour sauvegarder les données
- Modification de `incrementDailyVoiceTime()` pour appeler `saveDailyVoiceTime()`
- Modification de `registerVoiceTracker()` pour appeler `loadDailyVoiceTime()` au démarrage

---

## 🔒 Sécurité et Performance

### Sécurité

- ✅ Le fichier est créé automatiquement si inexistant
- ✅ Le dossier `data/` est créé automatiquement
- ✅ Gestion des erreurs avec try-catch
- ✅ Seules les données du jour actuel sont chargées (pas de données obsolètes)

### Performance

- ✅ Sauvegarde après chaque minute (pas d'impact notable)
- ✅ Chargement uniquement au démarrage du bot
- ✅ Fichier JSON léger (quelques Ko pour des centaines d'utilisateurs)
- ✅ Pas de sauvegarde inutile si aucune donnée

---

## 🎉 Résultat Final

Le système de temps vocal quotidien est maintenant **persistant et fiable** !

- ✅ **Données sauvegardées** après chaque minute en vocal
- ✅ **Données restaurées** au redémarrage du bot
- ✅ **Reset automatique** à minuit
- ✅ **Performances optimales** avec sauvegarde incrémentale
- ✅ **Logs détaillés** pour le debugging

**Les utilisateurs ne perdront plus leurs progrès de la journée lors d'un redémarrage du bot !** 🎤✨

---

## 🔮 Améliorations Futures

Pour optimiser davantage, on pourrait :

1. **Sauvegarde différée** : Sauvegarder toutes les 5 minutes au lieu de chaque minute
2. **Compression** : Compresser le fichier pour économiser de l'espace
3. **Historique** : Garder un historique des jours précédents
4. **Statistiques** : Afficher les tendances sur plusieurs jours

Mais pour l'instant, le système actuel est **solide et fonctionnel** ! 🎯

