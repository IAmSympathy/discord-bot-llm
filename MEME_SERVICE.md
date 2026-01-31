# Service de Memes Automatiques

## Description

Netricsa peut maintenant publier automatiquement des memes de r/shitposting dans un salon dédié. Le système garantit qu'aucun meme ne sera publié deux fois.

## Fonctionnalités

### 📅 Publication Automatique

- **Fréquence** : 3 fois par semaine (Lundi, Mercredi, Vendredi)
- **Heure** : 14h00
- **Source** : r/shitposting
- **Salon** : Configuré via `MEME_CHANNEL_ID`

### 🎭 Commande `/findmeme`

Permet à n'importe quel utilisateur de demander à Netricsa de poster un meme immédiatement.

## Configuration

### Variables d'environnement

Ajouter dans `.env` :

```env
MEME_CHANNEL_ID=829520141112836158
```

### Fichiers de données

Le système crée automatiquement :

- `data/posted_memes.json` : Historique des memes postés (évite les doublons)
- `data/meme_schedule.json` : Planification des posts automatiques

## Architecture

### Services

- **`memeService.ts`** : Récupère les memes depuis Reddit et gère l'historique
    - `getRandomMeme()` : Sélectionne un meme non publié
    - `postMeme()` : Publie un meme dans le salon
    - `cleanupMemeHistory()` : Nettoie l'historique (garde les 500 derniers)

- **`memeScheduler.ts`** : Planifie les publications automatiques
    - Vérifie toutes les 30 minutes si un post est dû
    - Calcule automatiquement la prochaine date de publication
    - Gère les échecs et réessaye après 1 heure

### Commandes

- **`/findmeme`** : Poste un meme sur demande

## Fonctionnement

### API Reddit

Le bot utilise l'API publique Reddit sans authentification :

- URL : `https://www.reddit.com/r/shitposting/hot.json?limit=100`
- Filtre : Images uniquement (pas de vidéos, pas de posts épinglés)
- User-Agent : `DiscordBot:Netricsa:v1.0.0`

### Gestion des doublons

- Chaque meme posté est enregistré avec son ID Reddit unique
- Avant de poster, le système vérifie que l'ID n'est pas dans l'historique
- L'historique est nettoyé périodiquement (garde 500 entrées max)

### Planification

Le système calcule la prochaine date de publication en fonction :

- Du jour de la semaine actuel
- De l'heure actuelle
- Des jours de publication configurés (Lundi, Mercredi, Vendredi)

Au démarrage, si un post aurait dû être fait pendant que le bot était hors ligne, il est posté dans les 5 premières secondes.

## Maintenance

### Nettoyer l'historique manuellement

L'historique est automatiquement nettoyé tous les jours, mais vous pouvez le faire manuellement :

```json
// Supprimer le contenu de data/posted_memes.json
[]
```

### Forcer un post immédiat

```json
// Modifier data/meme_schedule.json
{
  "lastPosted": 0,
  "nextScheduledPost": 0
}
```

### Changer les jours/heures de publication

Modifier dans `memeScheduler.ts` :

```typescript
const POSTING_DAYS = [1, 3, 5]; // Lundi, Mercredi, Vendredi
const POSTING_HOUR = 14; // 14h00
```

## Logs

Le système affiche dans la console :

- `[MemeService]` : Récupération et publication de memes
- `[MemeScheduler]` : Planification et événements automatiques

## Permissions Discord requises

- `SEND_MESSAGES` : Pour publier les memes
- `VIEW_CHANNEL` : Pour accéder au salon
- `EMBED_LINKS` : Pour formater les messages (optionnel)
