import {createLogger} from "../utils/logger";

const logger = createLogger("WeatherService");

interface WeatherData {
    temperature: number;
    condition: string;
    emoji: string;
}

/**
 * Traduit les conditions météo en français avec emoji
 */
function translateWeatherCondition(condition: string): { text: string; emoji: string } {
    const conditionLower = condition.toLowerCase();

    // Conditions principales avec émojis
    const weatherMap: { [key: string]: { text: string; emoji: string } } = {
        // Ciel dégagé
        'clear': {text: 'Dégagé', emoji: '☀️'},
        'sunny': {text: 'Ensoleillé', emoji: '☀️'},

        // Nuages
        'clouds': {text: 'Nuageux', emoji: '☁️'},
        'cloudy': {text: 'Nuageux', emoji: '☁️'},
        'overcast': {text: 'Couvert', emoji: '☁️'},
        'partly cloudy': {text: 'Partiellement nuageux', emoji: '⛅'},
        'few clouds': {text: 'Quelques nuages', emoji: '🌤️'},
        'scattered clouds': {text: 'Nuages épars', emoji: '⛅'},
        'broken clouds': {text: 'Nuageux', emoji: '☁️'},

        // Pluie
        'rain': {text: 'Pluie', emoji: '🌧️'},
        'light rain': {text: 'Pluie légère', emoji: '🌦️'},
        'moderate rain': {text: 'Pluie modérée', emoji: '🌧️'},
        'heavy rain': {text: 'Forte pluie', emoji: '🌧️'},
        'shower rain': {text: 'Averses', emoji: '🌦️'},
        'drizzle': {text: 'Bruine', emoji: '🌦️'},

        // Neige
        'snow': {text: 'Neige', emoji: '❄️'},
        'light snow': {text: 'Neige légère', emoji: '🌨️'},
        'heavy snow': {text: 'Forte neige', emoji: '❄️'},
        'sleet': {text: 'Grésil', emoji: '🌨️'},

        // Orage
        'thunderstorm': {text: 'Orage', emoji: '⛈️'},
        'storm': {text: 'Tempête', emoji: '⛈️'},

        // Brouillard
        'mist': {text: 'Brume', emoji: '🌫️'},
        'fog': {text: 'Brouillard', emoji: '🌫️'},
        'haze': {text: 'Brume', emoji: '🌫️'},

        // Vent
        'windy': {text: 'Venteux', emoji: '💨'},
    };

    // Rechercher une correspondance
    for (const [key, value] of Object.entries(weatherMap)) {
        if (conditionLower.includes(key)) {
            return value;
        }
    }

    // Par défaut
    return {text: condition, emoji: '🌡️'};
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

        // Utiliser la description détaillée si disponible, sinon la condition principale
        const translated = translateWeatherCondition(weatherDescription || weatherCondition);

        logger.info(`Weather for Sherbrooke: ${temperature}°C, ${translated.text}`);

        return {
            temperature,
            condition: translated.text,
            emoji: translated.emoji
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


