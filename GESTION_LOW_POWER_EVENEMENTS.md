# ✅ Gestion du Low Power Mode Pendant les Événements Imposteur

## 🎯 Problème Résolu

Quand Netricsa passe en **Low Power Mode pendant qu'un événement imposteur est actif**, certaines missions deviennent **impossibles** à compléter :

- ❌ "Générer 3 images" (nécessite /imagine ou /reimagine)
- ❌ "Avoir une conversation avec Netricsa d'au moins 3 messages"
- ❌ "Avoir une conversation avec recherche web"
- ❌ "Créer 2 prompts avec /prompt-maker"

---

## ✅ Solution Implémentée

### **Système de Missions Alternatives avec Restauration**

Quand Netricsa passe en Low Power Mode, le système :

1. **Détecte** tous les événements imposteur actifs
2. **Identifie** les missions impossibles (qui nécessitent Netricsa)
3. **Sauvegarde** les missions originales avec leur progression
4. **Remplace temporairement** par des alternatives compatibles Low Power
5. **Notifie** l'imposteur en DM avec les nouvelles missions
6. **Restaure automatiquement** les missions originales quand Netricsa sort du Low Power Mode

### **🔄 Restauration Automatique**

**NOUVEAU :** Quand Netricsa sort du Low Power Mode, les missions originales sont **automatiquement restaurées** !

---

## 🔧 Modifications Techniques

### **1. Nouveau Système de Sauvegarde/Restauration**

**Structure de Mission Améliorée :**

```typescript
interface MissionState {
    type: MissionType;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    goal: number;
    progress: number;
    completed: boolean;
    imposedData?: string;
    isLowPowerAlternative?: boolean;  // ✨ NOUVEAU
    originalMission?: MissionState;   // ✨ NOUVEAU - Sauvegarde
}
```

### **2. Fonction Centralisée pour Générer les Alternatives**

```typescript
async function generateLowPowerAlternative(difficulty: "easy" | "medium" | "hard"): Promise<MissionState> {
    // Génère une alternative selon la difficulté
    // ✅ Évite la duplication de code
    // ✅ Consistance garantie
}
```

### **3. Fonction de Transition vers Low Power**

```typescript
export async function handleLowPowerModeTransition(client: Client): Promise<void> {
    for (const mission of event.data.missions) {
        if (!mission.completed && isNetricsaDependentMission(mission.type)) {
            // Génère alternative
            const alternativeMission = await generateLowPowerAlternative(mission.difficulty);

            // ✨ Sauvegarde l'original
            alternativeMission.originalMission = {...mission};
            alternativeMission.isLowPowerAlternative = true;

            // Remplace temporairement
            event.data.missions[i] = alternativeMission;
        }
    }
}
```

### **4. Fonction de Restauration (NOUVEAU)**

```typescript
export async function handleLowPowerModeExit(client: Client): Promise<void> {
    for (const mission of event.data.missions) {
        // ✨ Si c'est une alternative avec original sauvegardé
        if (mission.isLowPowerAlternative && mission.originalMission) {
            // Restaure la mission originale
            event.data.missions[i] = mission.originalMission;

            // Notifie l'imposteur
            notifyMissionRestoration();
        }
    }
}
```

---

## 📊 Scénarios de Fonctionnement

### **Scénario 1 : Low Power Activé puis Désactivé**

```
1. Événement actif, missions normales
   - 🟢 Messages (5/5) ✅
   - 🟡 Générer 3 images (0/3)
   - 🔴 Créer 2 prompts (0/2)

2. Owner lance un jeu → Low Power activé
   
3. Système sauvegarde et remplace
   - 🟢 Messages (5/5) ✅ [Conservée]
   - 🟡 10 min vocal (0/10) 🔄 [Alternative]
      └─ Original sauvegardé: Générer 3 images (0/3)
   - 🔴 4 jeux différents (0/4) 🔄 [Alternative]
      └─ Original sauvegardé: Créer 2 prompts (0/2)

4. Notification DM "Missions temporairement modifiées"

5. Imposteur progresse sur les alternatives
   - 🟢 Messages (5/5) ✅
   - 🟡 10 min vocal (5/10) 🔄
   - 🔴 4 jeux (2/4) 🔄

6. Owner arrête son jeu → Low Power désactivé

7. Système restaure les missions originales
   - 🟢 Messages (5/5) ✅ [Restaurée]
   - 🟡 Générer 3 images (0/3) ✅ [Restaurée]
   - 🔴 Créer 2 prompts (0/2) ✅ [Restaurée]

8. Notification DM "Missions restaurées"
   ✨ L'imposteur peut maintenant compléter ses missions originales !
```

### **Scénario 2 : Mission Alternative Complétée**

```
1. Low Power activé, mission remplacée
   - 🔴 4 jeux différents (0/4) 🔄
      └─ Original: Créer 2 prompts (0/2)

2. Imposteur complète l'alternative
   - 🔴 4 jeux différents (4/4) ✅ 🔄

3. Low Power désactivé

4. Mission reste complétée (pas de restauration)
   - 🔴 4 jeux différents (4/4) ✅
   
✨ Mission alternative validée, pas besoin de restaurer !
```

### **Scénario 3 : Événement Commence en Low Power**

```
1. Netricsa déjà en Low Power

2. Événement démarre
   Missions assignées DIRECTEMENT compatibles:
   - 🟢 Utiliser 3 commandes fun
   - 🟡 Message 200+ caractères
   - 🔴 Symbole imposé

3. Aucune alternative/sauvegarde nécessaire
   (pas de flag isLowPowerAlternative)
```

---

## 🎨 Notifications DM

### **1. Passage en Low Power**

```
╔════════════════════════════════════╗
║  ⚠️ MISSIONS TEMPORAIREMENT        ║
║     MODIFIÉES                      ║
╚════════════════════════════════════╝

Netricsa est passée en Mode Low Power ! 🔋

Certaines missions nécessitant Netricsa ont
été temporairement remplacées par des
alternatives.

✨ Bonne nouvelle : Si Netricsa sort du Low
Power Mode, tes missions originales seront
restaurées avec ta progression !

Missions actuelles :
───────────────────────────────────────

🟢 Mission 1 - ✅
Envoyer 5 messages

🟡 Mission 2 🔄 - 0/10
Être seul dans un salon vocal

🔴 Mission 3 🔄 - 0/3
Utiliser les mots "café", "forêt", "lumière"
```

### **2. Sortie de Low Power (NOUVEAU)**

```
╔════════════════════════════════════╗
║  ✅ MISSIONS RESTAURÉES            ║
╚════════════════════════════════════╝

Netricsa est de retour en mode normal ! ⚡

Tes missions originales ont été restaurées !

Missions actuelles :
───────────────────────────────────────

🟢 Mission 1 - ✅
Envoyer 5 messages

🟡 Mission 2 - 0/3
Générer 3 images avec /imagine

🔴 Mission 3 - 0/2
Créer 2 prompts avec /prompt-maker
```

---

## 🎯 Avantages du Nouveau Système

### **Pour l'Imposteur**

- ✅ **Pas de perte de progression** sur missions originales
- ✅ **Restauration automatique** quand Netricsa revient
- ✅ **Flexibilité** : peut compléter l'alternative OU attendre la restauration
- ✅ **Notifications claires** à chaque transition

### **Pour le Système**

- ✅ **Zéro duplication de code** (fonction centralisée)
- ✅ **Réversible** (sauvegarde/restauration)
- ✅ **Transparent** (logs détaillés)
- ✅ **Robuste** (gère tous les cas)

### **Pour l'Expérience**

- ✅ **Pas de frustration** (missions toujours complétables)
- ✅ **Équitable** (pas pénalisé par le timing)
- ✅ **Prévisible** (comportement clair)
- ✅ **Indulgent** (plusieurs façons de réussir)

---

## 🔄 Workflow Complet

```
DÉMARRAGE ÉVÉNEMENT
        ↓
    [Normal Mode ?]
        ├─ Oui → Missions normales
        └─ Non → Missions Low Power
        
        ↓
    [Pendant l'événement]
        ↓
    [Low Power Activé ?]
        ├─ Non → Continue normalement
        └─ Oui → handleLowPowerModeTransition()
                  ├─ Sauvegarde originales
                  ├─ Génère alternatives
                  ├─ Notifie DM
                  └─ Continue avec alternatives
        ↓
    [Low Power Désactivé ?]
        ├─ Non → Continue avec alternatives
        └─ Oui → handleLowPowerModeExit()
                  ├─ Restaure originales
                  ├─ Notifie DM
                  └─ Continue avec originales
```

---

## 📝 Fichiers Modifiés

### **1. `impostorEvent.ts`**

- ✅ Interface `MissionState` augmentée (isLowPowerAlternative, originalMission)
- ✅ Fonction `generateLowPowerAlternative()` centralisée
- ✅ Fonction `handleLowPowerModeTransition()` avec sauvegarde
- ✅ **NOUVEAU :** Fonction `handleLowPowerModeExit()` pour restauration
- ✅ Suppression de code dupliqué

### **2. `botStateService.ts`**

- ✅ `enableLowPowerModeAuto()` appelle `handleLowPowerModeTransition()`
- ✅ **NOUVEAU :** `disableLowPowerModeAuto()` appelle `handleLowPowerModeExit()`

### **3. `activityMonitor.ts`**

- ✅ Passe le client à `enableLowPowerModeAuto()`
- ✅ **NOUVEAU :** Passe le client à `disableLowPowerModeAuto()`

---

## 🧪 Pour Tester

### **Test 1 : Cycle Complet Low Power**

```bash
# 1. Événement actif en mode normal
/test-event type:impostor
# Missions: Messages, Générer images, Créer prompts

# 2. Owner lance un jeu
# → Netricsa passe en Low Power
# → Vérifier notification DM "Missions modifiées"
# → Vérifier flag 🔄 sur missions alternatives

# 3. Compléter partiellement une alternative
# Ex: 2/4 jeux différents

# 4. Owner arrête son jeu
# → Netricsa sort du Low Power
# → Vérifier notification DM "Missions restaurées"
# → Vérifier que missions originales sont de retour
```

### **Test 2 : Alternative Complétée**

```bash
# 1. Low Power activé, alternative assignée
# Mission: 4 jeux différents (0/4)

# 2. Compléter l'alternative entièrement
# Mission: 4 jeux différents (4/4) ✅

# 3. Low Power désactivé
# → Mission reste complétée
# → Pas de restauration (déjà complétée)
```

### **Test 3 : Restauration Préserve Mission Complétée**

```bash
# 1. Événement avec 3 missions
# Mission 1: Complétée ✅
# Mission 2: Nécessite Netricsa
# Mission 3: Nécessite Netricsa

# 2. Low Power activé
# Mission 1: Conservée ✅
# Mission 2: Alternative 🔄
# Mission 3: Alternative 🔄

# 3. Low Power désactivé
# Mission 1: Toujours complétée ✅
# Mission 2: Restaurée
# Mission 3: Restaurée
```

---

## 🎉 Résultat

Le système d'événements imposteur est maintenant :

- ✅ **Totalement réversible** (sauvegarde + restauration)
- ✅ **Sans duplication de code** (fonction centralisée)
- ✅ **Intelligent** (conserve missions complétées)
- ✅ **Adaptatif** (change selon le mode)
- ✅ **Transparent** (notifications claires)
- ✅ **Robuste** (gère tous les cas edge)

**BONUS :** L'imposteur n'est plus pénalisé par le timing du Low Power Mode ! Les missions peuvent être complétées à tout moment. 🚀

---

## 🔧 Modifications Techniques

### **1. Nouveau Système de Missions Alternatives**

**Dans `impostorEvent.ts` :**

```typescript
// Missions moyennes NORMALES (avec Netricsa)
const mediumMissions = [
    CONVERSATION_AI,      // ❌ Nécessite Netricsa
    GENERATE_IMAGES,      // ❌ Nécessite Netricsa
    JOIN_VOCAL_SOLO,      // ✅ OK
    LONG_MESSAGE,         // ✅ OK
    AI_WEB_SEARCH,        // ❌ Nécessite Netricsa
    USE_DISCORD_FORMATTING // ✅ OK
];

// Missions moyennes LOW POWER (sans Netricsa)
const mediumMissionsLowPower = [
    JOIN_VOCAL_SOLO,      // ✅ 10 min en vocal seul
    LONG_MESSAGE,         // ✅ Message 200+ caractères
    USE_DISCORD_FORMATTING // ✅ Formatage Discord
];

// Missions difficiles NORMALES
const hardMissions = [
    PROMPT_AND_GENERATE,  // ❌ Nécessite Netricsa
    USE_SYMBOL,           // ✅ OK
    USE_IMPOSED_WORDS,    // ✅ OK
    PLAY_DIFFERENT_GAMES  // ✅ OK
];

// Missions difficiles LOW POWER
const hardMissionsLowPower = [
    USE_SYMBOL,           // ✅ Symbole imposé
    USE_IMPOSED_WORDS,    // ✅ Mots imposés
    PLAY_DIFFERENT_GAMES  // ✅ 4 jeux différents
];

// Sélection selon le mode
const availableMediumMissions = isLowPowerMode() ? mediumMissionsLowPower : mediumMissions;
const availableHardMissions = isLowPowerMode() ? hardMissionsLowPower : hardMissions;
```

### **2. Fonction de Détection des Missions Impossibles**

```typescript
function isNetricsaDependentMission(missionType: MissionType): boolean {
    const netricsaMissions = [
        MissionType.CONVERSATION_AI,
        MissionType.GENERATE_IMAGES,
        MissionType.PROMPT_AND_GENERATE,
        MissionType.AI_WEB_SEARCH
    ];
    return netricsaMissions.includes(missionType);
}
```

### **3. Fonction de Remplacement Automatique**

```typescript
export async function handleLowPowerModeTransition(client: Client): Promise<void> {
    // Trouve tous les événements imposteur actifs
    const activeImpostorEvents = eventsData.activeEvents.filter(
        e => e.type === EventType.IMPOSTOR && !e.data.completed
    );

    for (const event of activeImpostorEvents) {
        for (let i = 0; i < event.data.missions.length; i++) {
            const mission = event.data.missions[i];

            // Skip si déjà complétée
            if (mission.completed) continue;

            // Si mission nécessite Netricsa
            if (isNetricsaDependentMission(mission.type)) {
                // Génère une alternative selon la difficulté
                const alternativeMission = generateAlternativeMission(mission.difficulty);

                // Remplace la mission
                event.data.missions[i] = alternativeMission;

                // Notifie l'imposteur en DM
                await notifyMissionChange(impostorId, event.data.missions);
            }
        }
    }

    saveEventsData(eventsData);
}
```

### **4. Appel Automatique lors du Passage en Low Power**

**Dans `botStateService.ts` :**

```typescript
export function enableLowPowerModeAuto(client?: any): boolean {
    if (!botState.lowPowerMode) {
        botState.lowPowerMode = true;
        logger.info(`🔋 Low Power Mode ENABLED`);

        // Remplacer les missions impossibles
        if (client) {
            (async () => {
                const {handleLowPowerModeTransition} = require('./events/impostorEvent');
                await handleLowPowerModeTransition(client);
            })();
        }
    }
    return true;
}
```

**Dans `activityMonitor.ts` :**

```typescript
const enabled = enableLowPowerModeAuto(client); // Passe le client
```

---

## 📊 Scénarios de Fonctionnement

### **Scénario 1 : Événement Commence en Mode Normal**

```
1. Événement démarre
   Missions assignées:
   - 🟢 Envoyer 5 messages
   - 🟡 Générer 3 images
   - 🔴 Créer 2 prompts

2. Imposteur complète mission 1
   ✅ 🟢 Messages envoyés (5/5)
   ⏳ 🟡 Générer 3 images (0/3)
   ⏳ 🔴 Créer 2 prompts (0/2)

3. Owner lance un jeu → Netricsa passe en Low Power
   
4. Système détecte et remplace les missions impossibles
   ✅ 🟢 Messages envoyés (5/5) [Conservée]
   🆕 🟡 10 min vocal seul (0/10) [Remplacée]
   🆕 🔴 Jouer 4 jeux différents (0/4) [Remplacée]

5. Notification DM envoyée à l'imposteur
   "⚠️ MISSIONS MISES À JOUR
   Netricsa est en Low Power Mode !
   Nouvelles missions ci-dessous..."
```

### **Scénario 2 : Événement Commence Déjà en Low Power**

```
1. Netricsa déjà en Low Power Mode

2. Événement démarre
   Missions assignées DIRECTEMENT compatibles:
   - 🟢 Utiliser 3 commandes fun
   - 🟡 Message 200+ caractères
   - 🔴 Symbole imposé

3. Aucun remplacement nécessaire
```

### **Scénario 3 : Mission Déjà Complétée Avant Low Power**

```
1. Événement actif
   ✅ 🟢 Messages (5/5) complété
   ⏳ 🟡 Générer 3 images (2/3)
   ⏳ 🔴 Créer 2 prompts (0/2)

2. Netricsa passe en Low Power

3. Remplacement intelligent
   ✅ 🟢 Messages (5/5) [CONSERVÉE - déjà complétée]
   🆕 🟡 10 min vocal (0/10) [REMPLACÉE - en cours]
   🆕 🔴 Mots imposés (0/3) [REMPLACÉE - pas commencée]
```

---

## 🎨 Notification DM à l'Imposteur

```
╔════════════════════════════════════╗
║  ⚠️ MISSIONS MISES À JOUR          ║
╚════════════════════════════════════╝

Netricsa est passée en Mode Low Power ! 🔋

Certaines de tes missions ont été remplacées
par des alternatives qui ne nécessitent pas
Netricsa.

Consulte tes nouvelles missions ci-dessous :

───────────────────────────────────────

🟢 Mission 1 - ✅
Envoyer 5 messages (excluant le compteur...)

🟡 Mission 2 - 0/10
Être seul dans un salon vocal pour un total
de 10 minutes

🔴 Mission 3 - 0/3
Utiliser les mots "café", "forêt", "lumière"
dans tes messages

───────────────────────────────────────
Timestamp: [Date actuelle]
```

---

## 📋 Missions Alternatives par Difficulté

### **🟡 Moyennes (Alternatives Low Power)**

| Mission Originale            | Mission Alternative     |
|------------------------------|-------------------------|
| Conversation IA (3 messages) | 10 min vocal seul       |
| Générer 3 images             | Message 200+ caractères |
| Recherche web IA             | Formatage Discord       |

**Pool d'alternatives :** 3 missions sans Netricsa

### **🔴 Difficiles (Alternatives Low Power)**

| Mission Originale | Mission Alternative |
|-------------------|---------------------|
| Créer 2 prompts   | Symbole imposé      |
| Créer 2 prompts   | Mots imposés (3)    |
| Créer 2 prompts   | 4 jeux différents   |

**Pool d'alternatives :** 3 missions sans Netricsa

---

## 🔍 Détection Intelligente

### **Missions Nécessitant Netricsa**

```typescript
[
    CONVERSATION_AI,      // Parler avec Netricsa
    GENERATE_IMAGES,      // /imagine ou /reimagine
    PROMPT_AND_GENERATE,  // /prompt-maker
    AI_WEB_SEARCH         // Recherche web avec IA
]
```

### **Missions OK en Low Power**

```typescript
[
    SEND_MESSAGES,           // Messages normaux
    ADD_REACTIONS_ONLINE,    // Réactions
    USE_EMOJIS,              // Emojis
    MENTION_USERS,           // Mentions
    USE_FUN_COMMANDS,        // /8ball, /ship, etc.
    JOIN_VOCAL_SOLO,         // Vocal seul
    LONG_MESSAGE,            // Message long
    USE_DISCORD_FORMATTING,  // Formatage
    USE_SYMBOL,              // Symbole imposé
    USE_IMPOSED_WORDS,       // Mots imposés
    PLAY_DIFFERENT_GAMES     // Jeux
]
```

---

## 🎯 Avantages

### **Pour l'Imposteur**

- ✅ Missions toujours complétables
- ✅ Pas pénalisé par le Low Power Mode
- ✅ Notifié instantanément des changements
- ✅ Progression conservée pour missions complétées

### **Pour le Système**

- ✅ Événements restent jouables 24/7
- ✅ Pas de missions impossibles bloquées
- ✅ Transition transparente
- ✅ Équitable pour tous les joueurs

### **Pour l'Expérience**

- ✅ Pas de frustration
- ✅ Événement toujours actif
- ✅ Alternatives équivalentes en difficulté
- ✅ Communication claire

---

## 📝 Fichiers Modifiés

### **1. `impostorEvent.ts`**

- ✅ Ajout de `isLowPowerMode()` import
- ✅ Création de listes de missions alternatives
- ✅ Sélection selon le mode à la création
- ✅ Fonction `isNetricsaDependentMission()`
- ✅ Fonction `handleLowPowerModeTransition()`

### **2. `botStateService.ts`**

- ✅ `enableLowPowerModeAuto()` accepte le client
- ✅ Appelle `handleLowPowerModeTransition()` automatiquement

### **3. `activityMonitor.ts`**

- ✅ Passe le client à `enableLowPowerModeAuto()`

---

## 🧪 Pour Tester

### **Test 1 : Événement Démarre en Mode Normal**

```bash
# 1. S'assurer que Netricsa est en mode normal
# 2. Lancer un événement test
/test-event type:impostor
# 3. Vérifier les missions (peuvent inclure IA/images)
# 4. Owner lance un jeu → Low Power activé
# 5. Vérifier que les missions changent
# 6. Vérifier la notification DM
```

### **Test 2 : Événement Démarre en Low Power**

```bash
# 1. Owner joue déjà à un jeu (Low Power actif)
# 2. Lancer un événement test
/test-event type:impostor
# 3. Vérifier que les missions sont compatibles Low Power
# 4. Aucune mission IA/images assignée
```

### **Test 3 : Remplacement en Cours d'Événement**

```bash
# 1. Événement actif, mode normal
# 2. Compléter 1 mission sur 3
# 3. Owner lance un jeu
# 4. Vérifier que seules les missions non complétées changent
# 5. Mission complétée reste intacte
```

---

## 🎉 Résultat

Le système d'événements imposteur est maintenant :

- ✅ **Toujours jouable** (même en Low Power)
- ✅ **Adaptatif** (change selon le mode)
- ✅ **Intelligent** (conserve les missions complétées)
- ✅ **Transparent** (notification claire)
- ✅ **Équitable** (alternatives équivalentes)

Les événements peuvent maintenant se dérouler **24/7** sans interruption, que Netricsa soit en mode normal ou Low Power ! 🚀
