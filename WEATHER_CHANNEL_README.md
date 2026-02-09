# Configuration du Canal Vocal Météo

Ce système crée un canal vocal non-accessible en haut du serveur Discord qui affiche la météo actuelle à Sherbrooke.

## Fonctionnalités

- 🌡️ Affichage en temps réel de la température et conditions météo à Sherbrooke
- 🔒 Canal vocal visible mais non-accessible (personne ne peut s'y connecter)
- 🔄 Mise à jour automatique toutes les 30 minutes
- 📍 Positionné automatiquement en haut du serveur

## Configuration

### 1. Obtenir une clé API OpenWeatherMap (Gratuit)

1. Créer un compte sur [OpenWeatherMap](https://openweathermap.org/)
2. Aller dans la section API Keys de votre compte
3. Copier votre clé API

### 2. Ajouter la clé dans le fichier .env

Ajouter cette ligne dans votre fichier `.env` :

```env
OPENWEATHER_API_KEY=votre_clé_api_ici
```

### 3. S'assurer que le GUILD_ID est configuré

Le fichier `.env` doit contenir :

```env
GUILD_ID=827364829567647774
```

## Format du Canal

Le canal affichera le format suivant :

```
🌡️ Nuageux, 14°
☀️ Ensoleillé, 22°
🌧️ Pluie, 8°
❄️ Neige, -5°
⛈️ Orage, 18°
```

## Conditions Météo Supportées

| Emoji | Condition              |
|-------|------------------------|
| ☀️    | Dégagé / Ensoleillé    |
| ☁️    | Nuageux / Couvert      |
| ⛅     | Partiellement nuageux  |
| 🌤️   | Quelques nuages        |
| 🌧️   | Pluie                  |
| 🌦️   | Pluie légère / Averses |
| ❄️    | Neige                  |
| 🌨️   | Neige légère           |
| ⛈️    | Orage / Tempête        |
| 🌫️   | Brouillard / Brume     |
| 💨    | Venteux                |

## Utilisation Future

Le service météo inclut une fonction `getWeatherXPMultiplier()` qui sera utilisée pour modifier le multiplicateur d'XP en fonction des conditions météo :

```typescript
// Exemples de logique future:
// - Temps ensoleillé: +10% XP
// - Neige: +15% XP
// - Orage: +20% XP
// - Pluie: +5% XP
```

## Mode Développement

Si aucune clé API n'est configurée, le système utilisera des données de test aléatoires pour permettre le développement et les tests.

## Logs

Le système génère des logs détaillés :

- Création du canal
- Mises à jour de la météo
- Erreurs éventuelles

Consultez les logs avec le tag `[WeatherChannelManager]` et `[WeatherService]`.

## Permissions Requises

Le bot a besoin des permissions suivantes :

- `ManageChannels` - Pour créer et modifier le canal
- `ViewChannel` - Pour voir les canaux

## Troubleshooting

### Le canal n'apparaît pas

- Vérifier que `GUILD_ID` est correctement configuré dans `.env`
- Vérifier que le bot a la permission `ManageChannels`
- Consulter les logs pour voir les erreurs

### La météo ne se met pas à jour

- Vérifier que `OPENWEATHER_API_KEY` est valide
- Vérifier votre connexion internet
- Les mises à jour se font toutes les 30 minutes

### Le canal n'est pas en haut

Le système positionne automatiquement le canal à la position 0 (tout en haut). Si d'autres canaux sont créés après, le canal météo restera à sa position jusqu'à la prochaine mise à jour.

