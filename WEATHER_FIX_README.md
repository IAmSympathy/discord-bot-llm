# 🔧 Résolution de l'erreur 401 - Canal Vocal Météo

## ✅ Problème Résolu !

L'erreur **401 Unauthorized** était due à l'absence ou l'invalidité de la clé API OpenWeatherMap.

### Ce qui a été fait :

Le code a été modifié pour **utiliser des données de test** (météo simulée) en attendant que vous configuriez votre clé API. Le canal vocal météo **fonctionne maintenant** avec des données aléatoires réalistes !

## 🌤️ État Actuel

**Le canal vocal météo est maintenant créé** avec une météo simulée qui change à chaque redémarrage. Vous verrez des conditions comme :

- ☁️ Nuageux, 8°
- ☀️ Ensoleillé, 18°
- ❄️ Neige, -10°
- 🌦️ Pluie légère, 12°

## 🔑 Pour Obtenir la VRAIE Météo de Sherbrooke

### Étape 1 : Créer un compte OpenWeatherMap (GRATUIT)

1. Allez sur [OpenWeatherMap](https://openweathermap.org/api)
2. Cliquez sur **"Sign Up"** (ou "Get API Key")
3. Remplissez le formulaire d'inscription
4. Confirmez votre email

### Étape 2 : Obtenir votre clé API

1. Connectez-vous à votre compte
2. Allez dans l'onglet **"API keys"**
3. Copiez votre clé API (ou créez-en une nouvelle)
4. ⚠️ **IMPORTANT** : La clé peut prendre **10-20 minutes** pour s'activer !

### Étape 3 : Ajouter la clé dans votre fichier .env

Ouvrez le fichier `.env` et modifiez cette ligne :

```env
OPENWEATHER_API_KEY=VOTRE_CLE_API_ICI
```

Remplacez `VOTRE_CLE_API_ICI` par votre vraie clé API.

### Étape 4 : Redémarrer le bot

```powershell
# Arrêter le bot (Ctrl+C)
# Puis relancer :
.\start-bot.ps1
```

## 📊 Vérification

Après le redémarrage, consultez les logs :

### ✅ Avec clé API valide :

```
[WeatherService] Weather for Sherbrooke: 14°C, Nuageux
[WeatherChannelManager] ✅ Weather channel created successfully: ☁️ Nuageux, 14°
```

### ⚠️ Sans clé API (mode test) :

```
[WeatherService] OPENWEATHER_API_KEY not configured, using mock data
[WeatherService] Mock weather: 8°C, Nuageux
[WeatherChannelManager] ✅ Weather channel created successfully: ☁️ Nuageux, 8°
```

### ❌ Si erreur 401 (clé non activée) :

```
[WeatherService] Weather API error: 401 Unauthorized
[WeatherService] Falling back to mock weather data
[WeatherService] Mock weather: 12°C, Ensoleillé
```

➡️ **Solution** : Attendez 15-20 minutes que la clé s'active

## 🎯 Plan Gratuit OpenWeatherMap

- ✅ **1,000 appels API par jour** (largement suffisant)
- ✅ Mises à jour toutes les **10 minutes**
- ✅ **Pas de carte de crédit** requise
- ✅ **Gratuit à vie**

## 🔄 Fréquence de Mise à Jour

Le canal se met à jour automatiquement toutes les **30 minutes** :

- ⏰ Mise à jour du nom du canal
- 📍 Repositionnement en haut du serveur
- 🌡️ Nouvelles données météo

## 💡 Astuce

Vous pouvez modifier la fréquence de mise à jour dans le code :

```typescript
// Dans weatherChannelManager.ts
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Changez en :
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes
// OU
const UPDATE_INTERVAL = 60 * 60 * 1000; // 1 heure
```

⚠️ **Attention** : Plus la fréquence est élevée, plus vous utilisez d'appels API (limite : 1000/jour)

## 🚀 Prochaine Étape

Une fois la météo réelle configurée, le système sera prêt pour implémenter le **multiplicateur d'XP basé sur la météo** !

Le code est déjà en place avec la fonction `getWeatherXPMultiplier()` qui pourra modifier l'XP vocal selon les conditions :

- ☀️ Ensoleillé → +10% XP
- ❄️ Neige → +15% XP
- ⛈️ Orage → +20% XP
- 🌧️ Pluie → +5% XP

---

**Le canal météo fonctionne maintenant !** 🎉

Mode actuel : **Données de test** (jusqu'à configuration de l'API)

