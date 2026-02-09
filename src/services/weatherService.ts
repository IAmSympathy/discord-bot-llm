import {createLogger} from "../utils/logger";

const logger = createLogger("WeatherService");

interface WeatherData {
    temperature: number;
    condition: string;
    emoji: string;
}

/**
 * Trouve l'emoji approprié pour une condition météo (la description est déjà en français grâce à lang=fr)
 */
function getWeatherEmoji(condition: string): string {
    const conditionLower = condition.toLowerCase();

    // Chercher l'emoji qui correspond (ordre important : vérifier "peu nuageux" avant "nuageux")
    if (conditionLower.includes('peu nuageux') || conditionLower.includes('few')) {
        return '🌤️';
    }

    // Map simplifiée : chercher des mots-clés et retourner l'emoji approprié
    const emojiMap: Record<string, string> = {
        // Ciel dégagé
        'dégagé': '☀️',
        'clear': '☀️',
        'ensoleillé': '☀️',

        // Nuages épars / partiellement
        'épars': '⛅',
        'scattered': '⛅',
        'partiellement': '⛅',

        // Couvert / très nuageux
        'couvert': '☁️',
        'overcast': '☁️',
        'broken': '☁️',

        // Nuageux (par défaut pour clouds)
        'nuageux': '☁️',
        'nuages': '☁️',
        'clouds': '☁️',

        // Pluie
        'pluie': '🌧️',
        'rain': '🌧️',

        // Bruine / averses légères
        'bruine': '🌦️',
        'drizzle': '🌦️',
        'averse': '🌦️',
        'shower': '🌦️',

        // Neige
        'neige': '❄️',
        'snow': '❄️',

        // Grésil / neige légère
        'grésil': '🌨️',
        'sleet': '🌨️',

        // Orage
        'orage': '⛈️',
        'thunder': '⛈️',
        'tempête': '⛈️',
        'storm': '⛈️',

        // Brouillard
        'brouillard': '🌫️',
        'fog': '🌫️',
        'brume': '🌫️',
        'mist': '🌫️',
        'fumée': '🌫️',
        'smoke': '🌫️',

        // Vent
        'vent': '💨',
        'wind': '💨',
        'rafales': '💨',

        // Autres
        'tornade': '🌪️',
        'tornado': '🌪️',
    };

    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (conditionLower.includes(key)) {
            return emoji;
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
        {condition: "Nuageux", emoji: "☁️", tempRange: [-5, 15]},
        {condition: "Ensoleillé", emoji: "☀️", tempRange: [5, 25]},
        {condition: "Pluie légère", emoji: "🌦️", tempRange: [0, 18]},
        {condition: "Neige", emoji: "❄️", tempRange: [-15, -2]},
        {condition: "Partiellement nuageux", emoji: "⛅", tempRange: [-2, 20]},
    ];

    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const [minTemp, maxTemp] = randomCondition.tempRange;
    const temperature = Math.round(minTemp + Math.random() * (maxTemp - minTemp));

    return {
        temperature,
        condition: randomCondition.condition,
        emoji: randomCondition.emoji
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

