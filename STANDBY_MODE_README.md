# 🌙 Mode Standby (Veille)

## Vue d'ensemble

Le **Mode Standby** est un système automatique qui détecte quand les services locaux (Ollama et l'API Python) sont inaccessibles et met le bot en veille jusqu'à ce qu'ils redeviennent disponibles.

## Fonctionnement

### Détection automatique

Le bot détecte automatiquement les erreurs de connexion de **deux façons** :

#### 1. Détection réactive (lors d'une requête)

- Lors d'une requête LLM vers Ollama
- Lors d'une génération d'image vers l'API Python
- Lors d'un upscaling d'image

#### 2. Détection proactive (vérifications périodiques)

- **Toutes les 5 minutes en mode normal** : Le bot vérifie la connectivité même sans requête
- **Toutes les 2 minutes en mode Standby** : Vérifications plus fréquentes pour détecter le retour des services

Quand une erreur de connexion (`CONNECTION_ERROR`) est détectée, le bot :

1. Active automatiquement le mode Standby
2. Change son statut Discord en **"Absent"** (idle)
3. Affiche le message : `🌙 Mode veille - Services inaccessibles`
4. Passe en vérifications fréquentes (2 minutes)

### Vérifications périodiques

Le bot effectue des vérifications **en permanence**, même quand tout fonctionne :

| Mode             | Intervalle de vérification | Raison                                  |
|------------------|----------------------------|-----------------------------------------|
| **Mode Normal**  | Toutes les **5 minutes**   | Détection proactive des pannes          |
| **Mode Standby** | Toutes les **2 minutes**   | Détection rapide du retour des services |

Les vérifications :

- ✅ Testent simultanément Ollama et l'API Python
- ✅ Ont un timeout de 10 secondes
- ✅ N'affectent pas les performances du bot
- ✅ Permettent de détecter les pannes avant qu'un utilisateur n'envoie une requête
- ✅ Passent automatiquement en mode Standby si les services deviennent inaccessibles

### Comportement en mode Standby

Quand le bot est en mode veille :

- ❌ Il ne traite **aucune requête** LLM ou génération d'image
- ✅ Il répond aux mentions et messages dans le canal surveillé avec :
  > 🌙 Je suis en **mode veille** car je ne peux pas me connecter aux services locaux (Ollama/API Python).
  >
  > Je vérifie régulièrement leur disponibilité (toutes les 2 minutes) et reviendrai automatiquement en mode normal dès qu'ils seront accessibles.

#### Gestion des événements Imposteur

Tout comme le Low Power Mode, le mode Standby **adapte automatiquement** les missions des événements Imposteur en cours :

- 🔄 Les missions nécessitant Netricsa sont **temporairement remplacées** par des alternatives
- 💾 Les missions originales sont **sauvegardées** avec leur progression
- ✅ Quand le mode Standby se désactive, les missions originales sont **restaurées**
- 📩 L'imposteur est **notifié** des changements et restaurations par DM

**Exemple :** Une mission "Fais une génération d'image" sera remplacée par "Parle dans 3 salons différents" pendant le mode Standby.

## Commandes

### `/standby-status`

Affiche l'état actuel du mode Standby et force une vérification immédiate.

**Informations affichées :**

- État actuel (Veille ou Normal)
- État des services (Ollama, API Python)
- Dernière vérification
- Nombre de vérifications échouées
- Intervalle de vérification

## Architecture technique

### Services vérifiés

1. **Ollama** (port 11434)
    - Endpoint testé : `/api/tags`
    - Timeout : 10 secondes

2. **API Python** (port 8000)
    - Endpoint testé : `/`
    - Timeout : 10 secondes

### Fichiers impliqués

- `src/services/standbyModeService.ts` : Service principal
- `src/services/statusService.ts` : Gestion du statut Discord (ajout de `setStandbyStatus`)
- `src/services/ollamaService.ts` : Détection des erreurs de connexion Ollama
- `src/services/imageGenerationService.ts` : Détection des erreurs de connexion API Python
- `src/services/events/impostorEvent.ts` : Adaptation des missions Imposteur (ajout de `handleStandbyModeTransition` et `handleStandbyModeExit`)
- `src/queue/queue.ts` : Activation du mode Standby lors d'erreurs
- `src/watchChannel.ts` : Blocage des requêtes en mode Standby
- `src/bot.ts` : Initialisation au démarrage
- `src/commands/standby-status/standby-status.ts` : Commande de vérification

## Différence avec Low Power Mode

| Caractéristique        | Mode Standby                       | Low Power Mode                                  |
|------------------------|------------------------------------|-------------------------------------------------|
| **Déclenchement**      | Automatique (erreur de connexion)  | Manuel ou automatique (détection de jeu)        |
| **Statut Discord**     | 🌙 Absent (idle)                   | 🔋 Ne pas déranger (dnd)                        |
| **Raison**             | Services inaccessibles             | Économie de ressources                          |
| **Vérifications**      | Toutes les 2 minutes               | Aucune (jusqu'à désactivation manuelle)         |
| **Retour automatique** | ✅ Oui (quand services disponibles) | ✅ Oui (quand arrêt du jeu) ou ❌ Non (si manuel) |
| **Message**            | "Services inaccessibles"           | "Mode économie d'énergie"                       |

## Scénarios d'utilisation

### Scénario 1 : Bot sur Oracle Cloud, services sur PC local

Si votre PC est éteint ou déconnecté :

1. Le bot détecte la perte de connexion (proactivement ou lors d'une requête)
2. Active le mode Standby
3. Vérifie toutes les 2 minutes si votre PC est de retour
4. Reprend automatiquement quand votre PC est rallumé

**💡 Avantage de la détection proactive** : Le bot détectera la panne dans les 5 minutes, même si personne n'envoie de requête !

### Scénario 2 : Maintenance des services

Pendant une mise à jour d'Ollama ou de l'API Python :

1. Le bot passe en mode Standby (détection proactive)
2. Continue de vérifier toutes les 2 minutes
3. Reprend automatiquement à la fin de la maintenance

### Scénario 3 : Problème réseau temporaire

En cas de coupure internet sur votre PC :

1. Mode Standby activé automatiquement (max 5 min de délai)
2. Vérifications continues toutes les 2 minutes
3. Retour automatique quand le réseau est rétabli

## Logs

Le mode Standby génère des logs détaillés :

```
[StandbyMode] Initializing Standby Mode service...
[StandbyMode] Initial connectivity check - Ollama: ✅, Python API: ✅
[StandbyMode] ✅ Services available, operating in normal mode
[StandbyMode] 🔄 Starting periodic connectivity checks in Normal mode (every 300s)
[StandbyMode] 🔍 Connectivity check - Ollama: ✅, Python API: ✅
[StandbyMode] 🔍 Connectivity check - Ollama: ❌, Python API: ❌
[StandbyMode] ⚠️ Proactive check detected services are down - entering Standby Mode
[StandbyMode] 🌙 Entering STANDBY MODE (failed checks: 1)
[StandbyMode] 🔄 Starting periodic connectivity checks in Standby mode (every 120s)
[StandbyMode] 🔍 Connectivity check - Ollama: ❌, Python API: ❌
[StandbyMode] 🔍 Connectivity check - Ollama: ✅, Python API: ✅
[StandbyMode] ✅ Exiting STANDBY MODE - Services reconnected
[StandbyMode] 🔄 Starting periodic connectivity checks in Normal mode (every 300s)
```

## Configuration

### Variables d'environnement

Les URLs des services sont configurées dans `.env` :

```bash
# URL d'Ollama (local ou distant)
OLLAMA_API_URL=http://localhost:11434

# URL de l'API Python (local ou distant)
IMAGE_API_URL=http://localhost:8000
```

### Paramètres modifiables

Dans `src/services/standbyModeService.ts` :

```typescript
const CHECK_INTERVAL_STANDBY = 2 * 60 * 1000; // Vérifications en mode Standby (2 min)
const CHECK_INTERVAL_NORMAL = 5 * 60 * 1000; // Vérifications en mode Normal (5 min)
const TIMEOUT_MS = 10000; // Timeout des requêtes de vérification (10s)
```

## Dépannage

### Le bot reste bloqué en mode Standby

**Causes possibles :**

- Services réellement inaccessibles
- Pare-feu bloque les ports
- URLs incorrectes dans `.env`
- Timeout trop court

**Solutions :**

1. Vérifiez que les services tournent :
   ```bash
   curl http://localhost:11434/api/tags
   curl http://localhost:8000/
   ```

2. Vérifiez les URLs dans `.env`

3. Utilisez `/standby-status` pour forcer une vérification

### Le bot ne détecte pas le retour des services

**Cause :** Les vérifications peuvent prendre jusqu'à 2 minutes

**Solution :** Utilisez `/standby-status` pour forcer une vérification immédiate

### Faux positifs (mode Standby activé par erreur)

**Cause :** Timeout trop court ou services lents

**Solution :** Augmentez `TIMEOUT_MS` dans `standbyModeService.ts`

## Développement futur

Améliorations possibles :

- [ ] Notifications Discord privées à l'owner lors du passage en mode Standby
- [ ] Statistiques de disponibilité des services
- [ ] Webhook pour être notifié quand le bot passe en Standby
- [ ] Backoff exponentiel pour les vérifications (2min → 5min → 10min)
- [ ] Tentative de reconnexion avant activation du mode Standby
- [ ] Dashboard web pour monitorer l'état des services

## Contribution

Pour contribuer au mode Standby :

1. Testez différents scénarios de panne
2. Ajoutez des logs détaillés
3. Optimisez les timeouts
4. Ajoutez de nouveaux endpoints de vérification si nécessaire

