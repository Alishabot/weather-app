// ============================================================================
// WEATHER APP - Complete Responsive Weather Application
// ============================================================================

const API_CONFIG = {
    BASE_URL: 'https://api.open-meteo.com/v1',
    GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1',
    UNITS: 'metric',
    LANG: 'ro',
    FORECAST_DAYS: 7
};

// ============================================================================
// UNITS CONVERTER
// ============================================================================

class UnitsConverter {
    constructor(units = 'metric') {
        this.units = units;
    }

    setUnits(units) {
        this.units = units;
    }

    temperature(celsius) {
        return this.units === 'imperial' ? Math.round((celsius * 9/5) + 32) : Math.round(celsius);
    }

    windSpeed(mps) {
        return this.units === 'imperial' ? (mps * 2.237).toFixed(1) : (mps * 3.6).toFixed(1);
    }

    tempUnit() {
        return this.units === 'imperial' ? '°F' : '°C';
    }

    windUnit() {
        return this.units === 'imperial' ? 'mph' : 'km/h';
    }
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

class CacheManager {
    constructor(ttlMinutes = 60) {
        this.cache = new Map();
        this.ttl = ttlMinutes * 60 * 1000;
        this.loadFromStorage();
    }

    set(key, value) {
        this.cache.set(key, { value, timestamp: Date.now() });
        this.saveToStorage();
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.cache.clear();
        localStorage.removeItem('weatherAppCache');
    }

    saveToStorage() {
        const data = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key, value: entry.value, timestamp: entry.timestamp
        }));
        localStorage.setItem('weatherAppCache', JSON.stringify(data));
    }

    loadFromStorage() {
        const stored = localStorage.getItem('weatherAppCache');
        if (stored) {
            try {
                JSON.parse(stored).forEach(({ key, value, timestamp }) => {
                    if (Date.now() - timestamp <= this.ttl) {
                        this.cache.set(key, { value, timestamp });
                    }
                });
            } catch (e) {
                console.error('Cache load error:', e);
            }
        }
    }
}

// ============================================================================
// DEBOUNCE UTILITY
// ============================================================================

function debounce(func, wait = 500) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// API SERVICE
// ============================================================================

class WeatherAPIService {
    constructor() {
        this.cache = new CacheManager();
    }

    async getWeatherByCoords(lat, lon) {
        const cacheKey = `weather_${lat}_${lon}`;
        if (this.cache.has(cacheKey)) {
            console.log('✓ Current weather from cache');
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,pressure_msl&timezone=auto`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            this.cache.set(cacheKey, data);
            console.log('✓ Current weather from API');
            return data;
        } catch (error) {
            console.error('Current weather fetch error:', error);
            throw new Error('Unable to fetch current weather. Please try again.');
        }
    }

    async getForecast7Days(lat, lon) {
        const cacheKey = `forecast_${lat}_${lon}`;
        if (this.cache.has(cacheKey)) {
            console.log('✓ Forecast from cache');
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            this.cache.set(cacheKey, data);
            console.log('✓ Forecast from API');
            return data;
        } catch (error) {
            console.error('Forecast fetch error:', error);
            throw new Error('Unable to fetch forecast data. Please try again.');
        }
    }

    async getCoordinatesByCity(cityName) {
        const cacheKey = `coords_${cityName.toLowerCase()}`;
        if (this.cache.has(cacheKey)) {
            console.log('✓ Coordinates from cache:', cityName);
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                throw new Error(`No results found for "${cityName}"`);
            }
            
            this.cache.set(cacheKey, data.results);
            console.log('✓ Coordinates from API');
            return data.results;
        } catch (error) {
            console.error('Geocoding fetch error:', error);
            throw new Error(`City not found: "${cityName}". Please try another search.`);
        }
    }
}

// ============================================================================
// DOM MAPPING
// ============================================================================

const DOM_MAPPING = {
    search: {
        input: document.getElementById('searchInput'),
        button: document.getElementById('searchBtn'),
        suggestions: document.getElementById('suggestions')
    },
    errorMessage: document.getElementById('errorMessage'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    currentWeather: {
        container: document.getElementById('currentWeather'),
        cityName: document.getElementById('cityName'),
        date: document.getElementById('weatherDate'),
        temperature: document.getElementById('temperature'),
        description: document.getElementById('weatherDescription'),
        icon: document.getElementById('weatherIcon'),
        details: {
            windSpeed: document.getElementById('windSpeed'),
            humidity: document.getElementById('humidity'),
            feelsLike: document.getElementById('feelsLike'),
            pressure: document.getElementById('pressure')
        }
    },
    forecast: {
        container: document.getElementById('forecastContainer'),
        section: document.querySelector('.forecast-section')
    },
    recentSearches: {
        container: document.getElementById('recentSearches')
    }
};

// ============================================================================
// WEATHER APP CONTROLLER
// ============================================================================

class WeatherApp {
    constructor() {
        this.api = new WeatherAPIService();
        this.units = new UnitsConverter(API_CONFIG.UNITS);
        this.recentSearches = this.loadRecentSearches();
        this.currentCoordinates = null;
        this.lastCity = null;

        this.initializeEventListeners();
        this.displayRecentSearches();
        this.initializeUnitsSelector();
        this.hideError();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    initializeUnitsSelector() {
        const unitsBtn = document.getElementById('unitsToggle');
        if (!unitsBtn) return;

        this.updateUnitsButton();
        unitsBtn.addEventListener('click', () => {
            const newUnits = this.units.units === 'metric' ? 'imperial' : 'metric';
            this.units.setUnits(newUnits);
            API_CONFIG.UNITS = newUnits;
            this.updateUnitsButton();
            if (this.currentCoordinates) {
                this.fetchWeatherData();
            }
        });
    }

    updateUnitsButton() {
        const unitsBtn = document.getElementById('unitsToggle');
        if (unitsBtn) {
            const unit = this.units.units === 'metric' ? '°C / km/h' : '°F / mph';
            unitsBtn.querySelector('span').textContent = unit;
        }
    }

    initializeEventListeners() {
        const debouncedSearch = debounce(() => this.handleSearch(), 300);
        
        DOM_MAPPING.search.input.addEventListener('input', debouncedSearch);
        DOM_MAPPING.search.button.addEventListener('click', () => this.handleSearch());
        DOM_MAPPING.search.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        document.addEventListener('click', (e) => {
            if (!DOM_MAPPING.search.suggestions.contains(e.target) && 
                e.target !== DOM_MAPPING.search.input) {
                this.hideSuggestions();
            }
        });
    }

    // ========================================================================
    // SEARCH & SUGGESTIONS
    // ========================================================================

    async handleSearch() {
        const query = DOM_MAPPING.search.input.value.trim();
        if (!query) {
            this.showError('Please enter a city name', 'warning');
            return;
        }

        this.currentCoordinates = null;
        await this.fetchWeatherData(query);
    }

    async searchCities(query) {
        if (!query || query.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const results = await this.api.getCoordinatesByCity(query);
            this.displaySuggestions(results);
        } catch (error) {
            console.error('Search error:', error);
            this.hideSuggestions();
        }
    }

    displaySuggestions(results) {
        const suggestions = DOM_MAPPING.search.suggestions;
        suggestions.innerHTML = '';

        results.forEach(result => {
            const displayName = `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}, ${result.country}`;
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = displayName;

            item.addEventListener('click', () => {
                this.selectSuggestion(result);
            });

            suggestions.appendChild(item);
        });

        suggestions.classList.add('active');
    }

    selectSuggestion(result) {
        DOM_MAPPING.search.input.value = result.name;
        this.hideSuggestions();
        this.currentCoordinates = {
            lat: result.latitude,
            lon: result.longitude,
            name: result.name
        };
        this.lastCity = result.name;
        this.fetchWeatherData();
    }

    hideSuggestions() {
        DOM_MAPPING.search.suggestions.classList.remove('active');
        DOM_MAPPING.search.suggestions.innerHTML = '';
    }

    // ========================================================================
    // WEATHER DATA FETCHING
    // ========================================================================

    async fetchWeatherData(cityName = null) {
        try {
            this.showLoading(true);
            this.hideError();

            // Get coordinates if needed
            if (!this.currentCoordinates && cityName) {
                const results = await this.api.getCoordinatesByCity(cityName);
                const result = results[0];
                this.currentCoordinates = {
                    lat: result.latitude,
                    lon: result.longitude,
                    name: result.name
                };
                this.lastCity = result.name;
            }

            if (!this.currentCoordinates) {
                throw new Error('Coordinates unavailable');
            }

            // Fetch current weather and 7-day forecast in parallel
            const [currentData, forecastData] = await Promise.all([
                this.api.getWeatherByCoords(this.currentCoordinates.lat, this.currentCoordinates.lon),
                this.api.getForecast7Days(this.currentCoordinates.lat, this.currentCoordinates.lon)
            ]);

            // Display data
            this.displayCurrentWeather(currentData);
            this.displayForecast(forecastData);

            // Save to recent searches
            this.addToRecentSearches(this.currentCoordinates.name);

            console.log('✓ Weather data loaded successfully');
        } catch (error) {
            console.error('Fetch error:', error);
            this.showError(error.message || 'Failed to load weather data');
        } finally {
            this.showLoading(false);
        }
    }

    // ========================================================================
    // DISPLAY CURRENT WEATHER
    // ========================================================================

    displayCurrentWeather(data) {
        const current = data.current;
        const temp = this.units.temperature(current.temperature_2m);
        const humidity = current.relative_humidity_2m;
        const windSpeedMs = current.wind_speed_10m;
        const windSpeed = this.units.windSpeed(windSpeedMs);
        const pressure = current.pressure_msl;
        const weatherCode = current.weather_code;
        const description = this.getWeatherDescription(weatherCode);
        const date = new Date().toLocaleDateString('ro-RO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const tempUnit = this.units.tempUnit();
        const windUnit = this.units.windUnit();

        DOM_MAPPING.currentWeather.cityName.textContent = this.lastCity || 'Weather';
        DOM_MAPPING.currentWeather.temperature.textContent = `${temp}${tempUnit}`;
        DOM_MAPPING.currentWeather.description.textContent = description;
        DOM_MAPPING.currentWeather.date.textContent = date;
        DOM_MAPPING.currentWeather.icon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="30" r="20" fill="%23FFD700"/><path d="M20 50 Q20 65 35 70 Q50 75 50 75 Q50 75 65 70 Q80 65 80 50" fill="%2387CEEB"/></svg>';
        DOM_MAPPING.currentWeather.details.windSpeed.textContent = `${windSpeed} ${windUnit}`;
        DOM_MAPPING.currentWeather.details.humidity.textContent = `${humidity}%`;
        DOM_MAPPING.currentWeather.details.feelsLike.textContent = `${temp}${tempUnit}`;
        DOM_MAPPING.currentWeather.details.pressure.textContent = `${Math.round(pressure)} hPa`;

        DOM_MAPPING.currentWeather.container.classList.add('show');
        console.log('📊 Current weather displayed');
    }

    // ========================================================================
    // DISPLAY FORECAST
    // ========================================================================

    displayForecast(data) {
        const container = DOM_MAPPING.forecast.container;
        container.innerHTML = '';

        const daily = data.daily;
        if (!daily || !daily.time || daily.time.length === 0) {
            console.warn('No forecast data available');
            return;
        }

        console.log('📊 Forecast data:', daily);

        for (let i = 0; i < Math.min(7, daily.time.length); i++) {
            const card = document.createElement('div');
            card.className = 'forecast-card';

            const date = new Date(daily.time[i]);
            const dateStr = date.toLocaleDateString('ro-RO', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

            const tempMax = this.units.temperature(daily.temperature_2m_max[i]);
            const tempMin = this.units.temperature(daily.temperature_2m_min[i]);
            const tempUnit = this.units.tempUnit();
            const weatherCode = daily.weather_code[i];
            const description = this.getWeatherDescription(weatherCode);

            card.innerHTML = `
                <div class="forecast-date">${dateStr}</div>
                <div class="forecast-icon">⛅</div>
                <div class="forecast-temp">
                    <span class="forecast-temp-max">${tempMax}${tempUnit}</span>
                    <span class="forecast-temp-min">${tempMin}${tempUnit}</span>
                </div>
                <div class="forecast-description">${description}</div>
            `;

            container.appendChild(card);
        }

        console.log(`✓ 7-day forecast displayed`);
        DOM_MAPPING.forecast.section.classList.add('show');
    }

    // ========================================================================
    // WEATHER DESCRIPTION
    // ========================================================================

    getWeatherDescription(code) {
        const descriptions = {
            0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Foggy', 48: 'Foggy', 51: 'Light drizzle', 53: 'Moderate drizzle',
            55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
            80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
            85: 'Snow showers', 86: 'Heavy snow', 95: 'Thunderstorm',
            96: 'Thunderstorm', 99: 'Thunderstorm'
        };
        return descriptions[code] || 'Unknown';
    }

    // ========================================================================
    // RECENT SEARCHES
    // ========================================================================

    addToRecentSearches(cityName) {
        if (!cityName) return;
        this.recentSearches = this.recentSearches.filter(c => c !== cityName);
        this.recentSearches.unshift(cityName);
        this.recentSearches = this.recentSearches.slice(0, 5);
        this.saveRecentSearches();
        this.displayRecentSearches();
    }

    displayRecentSearches() {
        const container = DOM_MAPPING.recentSearches.container;
        container.innerHTML = '';

        if (this.recentSearches.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">No recent searches</p>';
            return;
        }

        this.recentSearches.forEach(cityName => {
            const tag = document.createElement('button');
            tag.className = 'recent-search-tag';
            tag.textContent = cityName;

            tag.addEventListener('click', () => {
                DOM_MAPPING.search.input.value = cityName;
                this.currentCoordinates = null;
                this.fetchWeatherData(cityName);
            });

            const removeBtn = document.createElement('i');
            removeBtn.className = 'fas fa-times';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.recentSearches = this.recentSearches.filter(c => c !== cityName);
                this.saveRecentSearches();
                this.displayRecentSearches();
            });

            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    }

    saveRecentSearches() {
        localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
    }

    loadRecentSearches() {
        const stored = localStorage.getItem('recentSearches');
        return stored ? JSON.parse(stored) : [];
    }

    // ========================================================================
    // ERROR & LOADING HANDLING
    // ========================================================================

    showError(message, type = 'error') {
        if (!message || message.trim() === '') {
            this.hideError();
            return;
        }
        const errorEl = DOM_MAPPING.errorMessage;
        errorEl.textContent = message;
        errorEl.className = `error-message show ${type}`;
        console.error(`[${type.toUpperCase()}] ${message}`);
        
        // Auto-hide all errors after 8 seconds
        setTimeout(() => this.hideError(), 8000);
    }

    hideError() {
        const errorEl = DOM_MAPPING.errorMessage;
        errorEl.classList.remove('show');
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }

    showLoading(show) {
        DOM_MAPPING.loadingSpinner.classList.toggle('show', show);
    }
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new WeatherApp();
    
    const debouncedSearch = debounce(() => {
        app.searchCities(DOM_MAPPING.search.input.value.trim());
    }, 300);
    
    DOM_MAPPING.search.input.addEventListener('input', debouncedSearch);
});
