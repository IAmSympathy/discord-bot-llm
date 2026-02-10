import {createLogger} from "../utils/logger";

const logger = createLogger("WeatherService");

interface WeatherData {
    temperature: number;
    condition: string;
    emoji: string;
}

/**
 * Détermine si c'est le jour ou la nuit à Sherbrooke
 * Utilise l'heure locale de Sherbrooke (UTC-5 ou UTC-4 selon l'heure d'été)
 */
function isDaytime(): boolean {
    // Obtenir l'heure actuelle en UTC
    const now = new Date();

    // Sherbrooke est à UTC-5 (hiver) ou UTC-4 (été)
    // Pour simplifier, on utilise UTC-5 (heure standard de l'Est)
    const sherbrookeOffset = -5;
    const utcHours = now.getUTCHours();
    const sherbrookeHours = (utcHours + sherbrookeOffset + 24) % 24;

    // Jour entre 6h et 20h (6 AM à 8 PM)
    return sherbrookeHours >= 6 && sherbrookeHours < 18;
}

/**
 * Calcule la phase de la lune actuelle et retourne l'emoji approprié
 * Basé sur le cycle lunaire de 29.53 jours
 */
function getMoonPhaseEmoji(): string {
    const now = new Date();

    // Nouvelle lune connue : 2000-01-06 18:14 UTC
    const knownNewMoon = new Date('2000-01-06T18:14:00Z');
    const daysSinceKnownNewMoon = (now.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);

    // Cycle lunaire de 29.53 jours
    const lunarCycle = 29.53;
    const phase = (daysSinceKnownNewMoon % lunarCycle) / lunarCycle;

    // Déterminer la phase
    if (phase < 0.0625) return '🌑'; // Nouvelle lune
    if (phase < 0.1875) return '🌒'; // Premier croissant
    if (phase < 0.3125) return '🌓'; // Premier quartier
    if (phase < 0.4375) return '🌔'; // Lune gibbeuse croissante
    if (phase < 0.5625) return '🌕'; // Pleine lune
    if (phase < 0.6875) return '🌖'; // Lune gibbeuse décroissante
    if (phase < 0.8125) return '🌗'; // Dernier quartier
    if (phase < 0.9375) return '🌘'; // Dernier croissant
    return '🌑'; // Nouvelle lune
}

/**
 * Trouve l'emoji approprié pour une condition météo (la description est déjà en français grâce à lang=fr)
 */
function getWeatherEmoji(condition: string): string {
    const conditionLower = condition.toLowerCase();
    const isDay = isDaytime();
    const moonEmoji = getMoonPhaseEmoji(); // Obtenir la phase de lune actuelle

    // Chercher l'emoji qui correspond (ordre important : vérifier "peu nuageux" avant "nuageux")
    if (conditionLower.includes('peu nuageux') || conditionLower.includes('few')) {
        return isDay ? '🌤️' : moonEmoji;
    }

    // Map simplifiée : chercher des mots-clés et retourner l'emoji approprié
    const emojiMap: Record<string, { day: string; night: string }> = {
        // Ciel dégagé
        'dégagé': {day: '☀️', night: moonEmoji},
        'clear': {day: '☀️', night: moonEmoji},
        'ensoleillé': {day: '☀️', night: moonEmoji},

        // Nuages épars / partiellement
        'épars': {day: '⛅', night: moonEmoji},
        'scattered': {day: '⛅', night: moonEmoji},
        'partiellement': {day: '⛅', night: moonEmoji},

        // Couvert / très nuageux (pas de changement jour/nuit)
        'couvert': {day: '☁️', night: '☁️'},
        'overcast': {day: '☁️', night: '☁️'},
        'broken': {day: '☁️', night: '☁️'},

        // Nuageux (par défaut pour clouds)
        'nuageux': {day: '☁️', night: '☁️'},
        'nuages': {day: '☁️', night: '☁️'},
        'clouds': {day: '☁️', night: '☁️'},

        // Pluie (pas de changement)
        'pluie': {day: '🌧️', night: '🌧️'},
        'rain': {day: '🌧️', night: '🌧️'},

        // Bruine / averses légères
        'bruine': {day: '🌦️', night: '🌧️'},
        'drizzle': {day: '🌦️', night: '🌧️'},
        'averse': {day: '🌦️', night: '🌧️'},
        'shower': {day: '🌦️', night: '🌧️'},

        // Neige (pas de changement)
        'neige': {day: '❄️', night: '❄️'},
        'snow': {day: '❄️', night: '❄️'},

        // Grésil / neige légère (pas de changement)
        'grésil': {day: '🌨️', night: '🌨️'},
        'sleet': {day: '🌨️', night: '🌨️'},

        // Orage (pas de changement)
        'orage': {day: '⛈️', night: '⛈️'},
        'thunder': {day: '⛈️', night: '⛈️'},
        'tempête': {day: '⛈️', night: '⛈️'},
        'storm': {day: '⛈️', night: '⛈️'},

        // Brouillard (pas de changement)
        'brouillard': {day: '🌫️', night: '🌫️'},
        'fog': {day: '🌫️', night: '🌫️'},
        'brume': {day: '🌫️', night: '🌫️'},
        'mist': {day: '🌫️', night: '🌫️'},
        'fumée': {day: '🌫️', night: '🌫️'},
        'smoke': {day: '🌫️', night: '🌫️'},

        // Vent (pas de changement)
        'vent': {day: '💨', night: '💨'},
        'wind': {day: '💨', night: '💨'},
        'rafales': {day: '💨', night: '💨'},

        // Autres (pas de changement)
        'tornade': {day: '🌪️', night: '🌪️'},
        'tornado': {day: '🌪️', night: '🌪️'},
    };

    for (const [key, emojis] of Object.entries(emojiMap)) {
        if (conditionLower.includes(key)) {
            return isDay ? emojis.day : emojis.night;
        }
    }

    // Par défaut
    return '🌡️';
}

/**
 * Génère des données météo de test réalistes pour Sherbrooke
 */
function getMockWeatherData(): WeatherData {
    const conditions = [
        {condition: "Nuageux", tempRange: [-5, 15]},
        {condition: "Ensoleillé", tempRange: [5, 25]},
        {condition: "Pluie légère", tempRange: [0, 18]},
        {condition: "Neige", tempRange: [-15, -2]},
        {condition: "Partiellement nuageux", tempRange: [-2, 20]},
    ];

    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const [minTemp, maxTemp] = randomCondition.tempRange;
    const temperature = Math.round(minTemp + Math.random() * (maxTemp - minTemp));

    return {
        temperature,
        condition: randomCondition.condition,
        emoji: getWeatherEmoji(randomCondition.condition)
    };
}

/**
 * Récupère la météo de Sherbrooke via OpenWeatherMap API
 */
export async function getSherbrookeWeather(): Promise<WeatherData | null> {
    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;

        if (!apiKey || apiKey.trim() === '') {
            logger.warn("OPENWEATHER_API_KEY not configured, using mock data");
            const mockData = getMockWeatherData();
            logger.info(`Mock weather: ${mockData.temperature}°C, ${mockData.condition}`);
            return mockData;
        }

        // Coordonnées de Sherbrooke, QC
        const lat = 45.4042;
        const lon = -71.8929;

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;

        const response = await fetch(url);

        if (!response.ok) {
            logger.error(`Weather API error: ${response.status} ${response.statusText}`);
            logger.warn("Falling back to mock weather data");
            const mockData = getMockWeatherData();
            logger.info(`Mock weather: ${mockData.temperature}°C, ${mockData.condition}`);
            return mockData;
        }

        const data = await response.json();

        // Extraire les informations
        const temperature = Math.round(data.main.temp);
        const weatherCondition = data.weather[0].main;
        const weatherDescription = data.weather[0].description;

        // Log détaillé pour debug
        logger.info(`API Response - Main: "${weatherCondition}", Description: "${weatherDescription}"`);

        // Utiliser la description (déjà en français grâce à lang=fr)
        // Capitaliser la première lettre
        const condition = weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1);

        // Trouver l'emoji approprié
        const emoji = getWeatherEmoji(weatherDescription);

        logger.info(`Weather for Sherbrooke: ${temperature}°C, ${condition} (${emoji})`);

        return {
            temperature,
            condition,
            emoji
        };

    } catch (error) {
        logger.error("Error fetching weather:", error);
        logger.warn("Falling back to mock weather data");
        const mockData = getMockWeatherData();
        logger.info(`Mock weather: ${mockData.temperature}°C, ${mockData.condition}`);
        return mockData;
    }
}

/**
 * Formatte la météo pour le nom du canal vocal
 */
export function formatWeatherChannelName(weather: WeatherData): string {
    return `${weather.emoji} ${weather.condition}, ${weather.temperature}°`;
}

/**
 * Calcule le multiplicateur d'XP basé sur la météo
 * TODO: Implémenter la logique de multiplicateur basée sur les conditions météo
 */
export function getWeatherXPMultiplier(weather: WeatherData): number {
    // Pour l'instant, retourne 1.0 (pas de modification)
    // Cette fonction sera utilisée plus tard pour modifier l'XP selon la météo

    // Exemples de logique future:
    // - Temps ensoleillé: +10% XP
    // - Neige: +15% XP
    // - Orage: +20% XP
    // - Pluie: +5% XP

    return 1.0;
}

