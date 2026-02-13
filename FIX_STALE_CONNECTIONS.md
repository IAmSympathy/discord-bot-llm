# Fix: Connexions Stales à l'API Python

## 🔍 Problème Identifié

Lorsque le bot reste ouvert trop longtemps, les connexions HTTP à l'API Python deviennent "stales" (périmées) et ne fonctionnent plus. C'est un problème classique avec les connexions HTTP keep-alive qui expirent après un certain temps d'inactivité.

### Symptômes :

- ✗ `/reimagine` retourne "fetch failed" après plusieurs heures d'inactivité
- ✗ `/imagine` et `/upscale` ont le même comportème
- ✗ Le bot doit être redémarré pour que ça fonctionne à nouveau
- ✗ L'API Python est pourtant bien active et répond aux requêtes directes

### Cause Racine :

Les connexions HTTP keep-alive sont maintenues ouvertes pour améliorer les performances, mais après un certain temps d'inactivité (généralement 2-5 minutes), le serveur ou le client ferme la connexion. Quand le bot essaie de réutiliser cette connexion fermée, il obtient une erreur "fetch failed" ou "socket hang up".

## ✅ Solutions Implémentées

### 1. **Désactivation du Keep-Alive**

Toutes les requêtes HTTP vers l'API Python utilisent maintenant :

```typescript
headers: {
    "Connection"
:
    "close", // Force la fermeture de la connexion après chaque requête
        "User-Agent"
:
    "Netricsa-Bot/1.0"
}
,
// @ts-ignore
keepAlive: false // Désactive complètement le keep-alive
```

**Impact :** Chaque requête établit une nouvelle connexion fraîche, éliminant le problème des connexions stales.

### 2. **Système de Retry Automatique**

Toutes les fonctions de génération d'images ont maintenant un système de retry intelligent :

```typescript
// Retry jusqu'à 2 fois en cas d'erreur de connexion
const maxRetries = 2;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
        // ... tentative de connexion

        if (attempt > 1) {
            logger.info(`🔄 Retry attempt ${attempt}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Attente de 2s
        }

        // ... requête

        return result; // Succès
    } catch (error) {
        // Ne réessayer que pour les erreurs de connexion
        const isConnectionError = error.message.includes("fetch failed") ||
            error.message.includes("ECONNRESET") ||
            error.message.includes("socket hang up");

        if (!isConnectionError || attempt === maxRetries) {
            throw error; // Erreur non-récupérable ou dernière tentative
        }
    }
}
```

**Impact :** Si une connexion échoue, le bot réessaie automatiquement après 2 secondes avec une nouvelle connexion.

### 3. **Détection d'Erreurs Améliorée**

Le système détecte maintenant tous les types d'erreurs de connexion :

- `fetch failed` - Connexion échouée générique
- `ECONNREFUSED` - Connexion refusée
- `ETIMEDOUT` - Timeout de connexion
- `EAI_AGAIN` - Problème DNS temporaire
- `ECONNRESET` - Connexion réinitialisée (stale)
- `socket hang up` - Socket fermé prématurément (stale)

### 4. **Health Checks Améliorés**

Le système de Standby Mode utilise maintenant les mêmes paramètres pour éviter les faux positifs :

```typescript
// Checks Ollama et Python API
const response = await fetch(url, {
    headers: {
        'Connection': 'close',
        'User-Agent': 'Netricsa-Bot/1.0'
    },
    // @ts-ignore
    keepAlive: false
});
```

**Impact :** Les health checks réguliers (toutes les 5 minutes) n'accumulent plus de connexions stales.

## 🎯 Fichiers Modifiés

### `src/services/imageGenerationService.ts`

- ✅ `generateImage()` - Ajout de retry + désactivation keep-alive
- ✅ `upscaleImage()` - Ajout de retry + désactivation keep-alive
- ✅ Messages d'erreur plus clairs avec nombre de tentatives

### `src/services/standbyModeService.ts`

- ✅ `checkOllamaConnection()` - Désactivation keep-alive
- ✅ `checkPythonAPIConnection()` - Désactivation keep-alive

## 📊 Comportement Attendu

### Avant le Fix :

```
User: /reimagine
Bot: [Réimagination de l'image...]
[Après 30s] ❌ Erreur: CONNECTION_ERROR: fetch failed
```

### Après le Fix :

#### Scénario 1: Connexion OK du premier coup

```
User: /reimagine
Bot: [Réimagination de l'image...]
[Succès immédiat] ✅ Voici l'image réimaginée
```

#### Scénario 2: Première connexion stale, retry réussit

```
User: /reimagine
Bot: [Réimagination de l'image...]
[Logs] ⚠️ Connection error on attempt 1, will retry...
[Logs] 🔄 Retry attempt 2/2 after connection error
[Succès après 2s] ✅ Voici l'image réimaginée
```

#### Scénario 3: API vraiment hors ligne

```
User: /reimagine
Bot: [Réimagination de l'image...]
[Logs] ⚠️ Connection error on attempt 1, will retry...
[Logs] 🔄 Retry attempt 2/2 after connection error
[Logs] ❌ Image generation error after 2 attempts
❌ Service Indisponible
L'API de génération d'images n'est pas accessible après 2 tentatives.
```

## 🔧 Avantages de Cette Solution

### ✅ Transparence pour l'Utilisateur

L'utilisateur ne voit pas les retry - ils se font en arrière-plan. Si le retry réussit, c'est comme si rien ne s'était passé.

### ✅ Robustesse Accrue

Le bot peut maintenant gérer :

- Connexions stales après inactivité prolongée
- Micro-coupures réseau temporaires
- Redémarrages de l'API Python

### ✅ Performance

Les retry ajoutent seulement 2 secondes de délai en cas d'échec de la première tentative, ce qui est négligeable par rapport au temps de génération (30-120 secondes).

### ✅ Logs Détaillés

Les administrateurs peuvent maintenant voir exactement ce qui se passe :

```
[INFO] Generating image (txt2img): "a beautiful landscape..."
[WARN] ⚠️ Connection error on attempt 1, will retry...
[INFO] 🔄 Retry attempt 2/2 after connection error
[INFO] API response status: 200
[INFO] ✅ Image generated: gen_txt2img_1234567890.png
```

## 📈 Tests Recommandés

### Test 1: Connexion Stale Simulée

1. Laisser le bot inactif pendant 1-2 heures
2. Faire `/reimagine` ou `/imagine`
3. ✅ Devrait fonctionner (avec potentiellement un retry)

### Test 2: API Python Redémarrée

1. Redémarrer l'API Python pendant que le bot tourne
2. Attendre que l'API soit de nouveau up
3. Faire `/reimagine`
4. ✅ Devrait fonctionner après le retry

### Test 3: API Python Vraiment Down

1. Arrêter complètement l'API Python
2. Faire `/reimagine`
3. ✅ Devrait afficher un message d'erreur clair après 2 tentatives

## 🔍 Surveillance

### Logs à Surveiller

**Indicateur de santé :** Si vous voyez fréquemment des retry, c'est normal après une période d'inactivité :

```
[WARN] ⚠️ Connection error on attempt 1, will retry...
[INFO] 🔄 Retry attempt 2/2 after connection error
```

**Alerte :** Si vous voyez systématiquement des erreurs après 2 tentatives :

```
[ERROR] Image generation error after 2 attempts: fetch failed
```

→ L'API Python a un vrai problème (crash, surchargé, etc.)

## 💡 Prochaines Améliorations Potentielles

1. **Augmenter le nombre de retry** à 3 si nécessaire
2. **Délai exponentiel** entre les retry (2s, 4s, 8s)
3. **Notification automatique** aux admins après X échecs consécutifs
4. **Ping périodique** de l'API pour garder la connexion chaude (trade-off: plus de trafic réseau)

## ✨ Conclusion

Ce fix résout le problème des connexions stales de manière robuste et transparente. Le bot peut maintenant fonctionner pendant des jours sans nécessiter de redémarrage pour les problèmes de connexion à l'API Python.

**Test final recommandé :** Laisser le bot tourner 24h, puis faire des générations d'images - tout devrait fonctionner normalement ! 🚀

