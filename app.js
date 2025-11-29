// ============================================================================
// WEATHER APP - MAIN APPLICATION
// ============================================================================

// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://api.open-meteo.com/v1',
    GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1',
    UNITS: 'metric', // 'metric' (°C, km/h) sau 'imperial' (°F, mph)
    LANG: 'ro', // Limba pentru descrieri
    FORECAST_DAYS: 7 // Prognoză pe 7 zile
};

// ============================================================================
// UNITS CONVERSION UTILITY - Conversii între metric și imperial
// ============================================================================

class UnitsConverter {
    constructor(units = 'metric') {
        this.units = units;
    }

    setUnits(units) {
        this.units = units;
    }

    // Conversie temperatură
    temperature(celsius) {
        if (this.units === 'imperial') {
            return Math.round((celsius * 9/5) + 32);
        }
        return Math.round(celsius);
    }

    // Conversie vânt (m/s → km/h sau mph)
    windSpeed(mps) {
        if (this.units === 'imperial') {
            return (mps * 2.237).toFixed(1); // m/s to mph
        }
        return (mps * 3.6).toFixed(1); // m/s to km/h
    }

    // Simbol unitate de temperatură
    tempUnit() {
        return this.units === 'imperial' ? '°F' : '°C';
    }

    // Simbol unitate de vânt
    windUnit() {
        return this.units === 'imperial' ? 'mph' : 'km/h';
    }

    // Simbol unitate de presiune
    pressureUnit() {
        return 'hPa';
    }
}

class CacheManager {
    constructor(maxSize = 10, ttl = 3600000) { // TTL: 1 oră în ms
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.loadFromStorage();
    }

    // Stocare în cache cu timestamp
    set(key, value) {
        const cacheEntry = {
            value,
            timestamp: Date.now()
        };

        // Elimina intrarea cea mai veche dacă am ajuns la maxSize
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, cacheEntry);
        this.saveToStorage();
    }

    // Preluare din cache cu verificare TTL
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) return null;

        // Verifică dacă data a expirat
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.saveToStorage();
            return null;
        }

        return entry.value;
    }

    // Verifică dacă există în cache
    has(key) {
        return this.cache.has(key) && this.get(key) !== null;
    }

    // Gol cache
    clear() {
        this.cache.clear();
        localStorage.removeItem('weatherAppCache');
    }

    // Salvează cache în localStorage
    saveToStorage() {
        const data = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key,
            value: entry.value,
            timestamp: entry.timestamp
        }));
        localStorage.setItem('weatherAppCache', JSON.stringify(data));
    }

    // Încarcă cache din localStorage
    loadFromStorage() {
        const stored = localStorage.getItem('weatherAppCache');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                data.forEach(({ key, value, timestamp }) => {
                    // Verifică TTL la încărcare
                    if (Date.now() - timestamp <= this.ttl) {
                        this.cache.set(key, { value, timestamp });
                    }
                });
            } catch (e) {
                console.error('Eroare la încărcarea cache-ului:', e);
                this.clear();
            }
        }
    }
}

// ============================================================================
// DEBOUNCE UTILITY - Pentru a evita apeluri API inutile
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
// API SERVICE - Gestionarea apelurilor API
// ============================================================================

class WeatherAPIService {
    constructor() {
        this.cache = new CacheManager();
    }

    // Get current weather by coordinates using Open-Meteo
    async getWeatherByCoords(lat, lon) {
        const cacheKey = `weather_${lat}_${lon}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('✓ Meteo curentă preluată din cache:', { lat, lon });
            return this.cache.get(cacheKey);
        }

        try {
            const url = new URL(`${API_CONFIG.BASE_URL}/forecast`, window.location.origin);
            url.href = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,weather_description,wind_speed_10m,pressure_msl&timezone=auto`;
            
            const response = await fetch(url.href);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            console.log('✓ Meteo curentă preluată din API');
            return data;
        } catch (error) {
            throw this.handleError(error, 'obținerea datelor meteo curente');
        }
    }

    // Get forecast by coordinates using Open-Meteo
    async getForecast5Days(lat, lon) {
        const cacheKey = `forecast5_${lat}_${lon}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('✓ Prognoză preluată din cache:', { lat, lon });
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            console.log('✓ Prognoză preluată din API');
            return data;
        } catch (error) {
            throw this.handleError(error, 'obținerea prognozei');
        }
    }

    // Alias for compatibility
    async getForecast7Days(lat, lon) {
        return this.getForecast5Days(lat, lon);
    }

    // Geocode city name to coordinates
    async getCoordinatesByCity(cityName) {
        const cacheKey = `coords_${cityName.toLowerCase()}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('✓ Coordonate preluate din cache:', cityName);
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                throw new Error(`Niciun rezultat găsit pentru "${cityName}"`);
            }

            this.cache.set(cacheKey, data.results);
            return data.results;
        } catch (error) {
            throw this.handleError(error, `căutarea orașului "${cityName}"`);
        }
    }

    // Error handling
    handleError(error, action) {
        let userMessage = `Eroare la ${action}`;
        let errorType = 'error';

        if (error instanceof TypeError) {
            userMessage = 'Eroare de conexiune. Verificați conexiunea la internet.';
        } else if (error.message.includes('404')) {
            userMessage = 'Orașul nu a fost găsit. Încercați cu alt nume.';
            errorType = 'warning';
        } else if (error.message.includes('Niciun rezultat')) {
            userMessage = error.message;
            errorType = 'warning';
        }

        const customError = new Error(userMessage);
        customError.type = errorType;
        console.error('API Error:', error);
        return customError;
    }
}

// ============================================================================
// DOM ELEMENT MAPPING - Mapare API la UI pentru claritate
// ============================================================================

const DOM_MAPPING = {
    // Search & Input Elements
    search: {
        input: document.getElementById('searchInput'),
        button: document.getElementById('searchBtn'),
        suggestions: document.getElementById('suggestions')
    },

    // Error & Loading
    errorMessage: document.getElementById('errorMessage'),
    loadingSpinner: document.getElementById('loadingSpinner'),

    // Current Weather Elements
    currentWeather: {
        container: document.getElementById('currentWeather'),
        cityName: document.getElementById('cityName'),
        date: document.getElementById('weatherDate'),
        temperature: document.getElementById('temperature'),
        description: document.getElementById('weatherDescription'),
        icon: document.getElementById('weatherIcon'),
        
        // Weather Details
        details: {
            windSpeed: document.getElementById('windSpeed'),
            humidity: document.getElementById('humidity'),
            feelsLike: document.getElementById('feelsLike'),
            pressure: document.getElementById('pressure')
        }
    },

    // Forecast Elements
    forecast: {
        container: document.getElementById('forecastContainer'),
        section: document.querySelector('.forecast-section')
    },

    // Recent Searches
    recentSearches: {
        container: document.getElementById('recentSearches')
    }
};

// Mapare câmpuri API la elemente UI
const API_TO_UI_MAPPING = {
    // Current weather mapping
    'name': 'currentWeather.cityName',
    'main.temp': 'currentWeather.temperature',
    'main.feels_like': 'currentWeather.details.feelsLike',
    'main.humidity': 'currentWeather.details.humidity',
    'main.pressure': 'currentWeather.details.pressure',
    'wind.speed': 'currentWeather.details.windSpeed',
    'weather[0].description': 'currentWeather.description',
    'weather[0].icon': 'currentWeather.icon',
    'dt': 'currentWeather.date'
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
        
        // Hide any initial errors
        this.hideError();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    initializeUnitsSelector() {
        const unitsBtn = document.getElementById('unitsToggle');
        if (!unitsBtn) {
            console.warn('⚠️ Element unitsToggle nu găsit în HTML');
            return;
        }

        this.updateUnitsButton();

        unitsBtn.addEventListener('click', () => {
            const newUnits = this.units.units === 'metric' ? 'imperial' : 'metric';
            this.units.setUnits(newUnits);
            API_CONFIG.UNITS = newUnits;
            this.updateUnitsButton();
            
            // Reîncarcă datele meteo cu noile unități
            if (this.currentCoordinates) {
                this.fetchWeatherData();
            }
        });
    }

    updateUnitsButton() {
        const unitsBtn = document.getElementById('unitsToggle');
        if (unitsBtn) {
            const display = this.units.units === 'metric' ? '°C / km/h' : '°F / mph';
            unitsBtn.textContent = display;
            unitsBtn.setAttribute('data-units', this.units.units);
        }
    }

    initializeEventListeners() {
        // Search input cu debounce pentru sugestii
        const debouncedSearch = debounce(() => this.handleSearchSuggestions(), 300);
        DOM_MAPPING.search.input.addEventListener('input', debouncedSearch);

        // Search button click
        DOM_MAPPING.search.button.addEventListener('click', () => this.handleSearch());

        // Enter key în search input
        DOM_MAPPING.search.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Închidere sugestii la click afară
        document.addEventListener('click', (e) => {
            if (!DOM_MAPPING.search.suggestions.contains(e.target) && 
                e.target !== DOM_MAPPING.search.input) {
                this.hideSuggestions();
            }
        });
    }

    // ========================================================================
    // SEARCH FUNCTIONALITY
    // ========================================================================

    async handleSearchSuggestions() {
        const query = DOM_MAPPING.search.input.value.trim();
        
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const results = await this.api.getCoordinatesByCity(query);
            this.displaySuggestions(results);
        } catch (error) {
            // Nu afișa eroare pentru sugestii, doar ascunde lista
            this.hideSuggestions();
        }
    }

    displaySuggestions(results) {
        const suggestions = DOM_MAPPING.search.suggestions;
        suggestions.innerHTML = '';

        results.forEach(result => {
            // Open-Meteo format: name, admin1 (state/province), country
            const displayName = `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}, ${result.country}`;
            
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = displayName;
            item.dataset.lat = result.latitude;
            item.dataset.lon = result.longitude;
            item.dataset.name = result.name;
            
            item.addEventListener('click', () => {
                this.selectSuggestion(result);
            });

            suggestions.appendChild(item);
        });

        suggestions.classList.add('active');
    }

    selectSuggestion(result) {
        DOM_MAPPING.search.input.value = result.name;
        this.lastCity = result.name;
        this.hideSuggestions();
        this.currentCoordinates = { lat: result.latitude, lon: result.longitude, name: result.name };
        this.fetchWeatherData();
    }

    handleSearch() {
        const query = DOM_MAPPING.search.input.value.trim();
        
        if (!query) {
            this.showError('Vă rugăm să introduceți un oraș', 'warning');
            return;
        }

        // Resetează coordonatele curente pentru a forța noua căutare
        this.currentCoordinates = null;
        this.fetchWeatherData(query);
    }

    // ========================================================================
    // WEATHER DATA FETCHING
    // ========================================================================

    async fetchWeatherData(cityName = null) {
        try {
            this.showLoading(true);
            this.hideError();

            // Get coordinates if not set
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
                throw new Error('Coordonate indisponibile');
            }

            // Parallel fetch: weather and forecast
            const [weatherData, forecastData] = await Promise.all([
                this.api.getWeatherByCoords(
                    this.currentCoordinates.lat, 
                    this.currentCoordinates.lon
                ),
                this.api.getForecast5Days(
                    this.currentCoordinates.lat, 
                    this.currentCoordinates.lon
                )
            ]);

            // Display data
            this.displayCurrentWeather(weatherData);
            this.displayForecast(forecastData);

            // Add to recent searches
            this.addToRecentSearches(this.currentCoordinates.name);
            
            console.log('✓ Datele meteo au fost încărcate cu succes');
        } catch (error) {
            console.error('Fetch error:', error);
            this.showError(error.message || 'Eroare la încărcarea datelor', error.type || 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ========================================================================
    // DISPLAY CURRENT WEATHER
    // ========================================================================

    displayCurrentWeather(data) {
        // Open-Meteo current data structure
        const current = data.current;
        const tempCelsius = current.temperature_2m;
        const humidity = current.relative_humidity_2m;
        const pressure = current.pressure_msl;
        const windSpeedMs = current.wind_speed_10m;
        const description = current.weather_description || 'Clear';
        const date = this.formatDate(new Date());

        // Unit conversions
        const temp = this.units.temperature(tempCelsius);
        const windSpeed = this.units.windSpeed(windSpeedMs / 3.6); // Convert km/h to m/s
        const tempUnit = this.units.tempUnit();
        const windUnit = this.units.windUnit();

        // Update DOM
        DOM_MAPPING.currentWeather.cityName.textContent = this.lastCity || 'Weather';
        DOM_MAPPING.currentWeather.temperature.textContent = `${temp}${tempUnit}`;
        DOM_MAPPING.currentWeather.description.textContent = description;
        DOM_MAPPING.currentWeather.date.textContent = date;
        
        // Use a generic weather icon
        DOM_MAPPING.currentWeather.icon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="30" r="20" fill="%23FFD700"/><path d="M20 50 Q20 65 35 70 Q50 75 50 75 Q50 75 65 70 Q80 65 80 50" fill="%2387CEEB"/></svg>';
        DOM_MAPPING.currentWeather.icon.alt = description;

        DOM_MAPPING.currentWeather.details.windSpeed.textContent = `${windSpeed} ${windUnit}`;
        DOM_MAPPING.currentWeather.details.humidity.textContent = `${humidity}%`;
        DOM_MAPPING.currentWeather.details.feelsLike.textContent = `${temp}${tempUnit}`;
        DOM_MAPPING.currentWeather.details.pressure.textContent = `${Math.round(pressure)} hPa`;

        console.log('📊 Meteo curentă afișată:', {
            temperature: `${temp}${tempUnit}`,
            humidity: `${humidity}%`,
            pressure: `${pressure}hPa`,
            windSpeed: `${windSpeed}${windUnit}`
        });

        DOM_MAPPING.currentWeather.container.classList.add('show');
    }

    // ========================================================================
    // DISPLAY FORECAST
    // ========================================================================

    displayForecast(data) {
        const container = DOM_MAPPING.forecast.container;
        container.innerHTML = '';

        // Open-Meteo daily forecast
        const daily = data.daily;
        if (!daily || !daily.time) {
            console.warn('No forecast data available');
            return;
        }

        // Display up to 7 days
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

        console.log(`✓ Prognoză ${Math.min(7, daily.time.length)} zile afișate`);
        DOM_MAPPING.forecast.section.classList.add('show');
    }

    // Convert WMO weather code to description
    getWeatherDescription(code) {
        const descriptions = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Foggy',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            80: 'Slight showers',
            81: 'Moderate showers',
            82: 'Violent showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with hail',
            99: 'Thunderstorm with hail'
        };
        return descriptions[code] || 'Unknown';
    }

    // ========================================================================
    // RECENT SEARCHES
    // ========================================================================

    addToRecentSearches(cityName) {
        // Elimina duplicat dacă există
        this.recentSearches = this.recentSearches.filter(c => c !== cityName);
        
        // Adaugă la început
        this.recentSearches.unshift(cityName);
        
        // Ține maxim 10 cautari
        this.recentSearches = this.recentSearches.slice(0, 10);
        
        this.saveRecentSearches();
        this.displayRecentSearches();
    }

    displayRecentSearches() {
        const container = DOM_MAPPING.recentSearches.container;
        container.innerHTML = '';

        if (this.recentSearches.length === 0) {
            container.innerHTML = '<p class="empty-message">Nu aveți căutări recente</p>';
            return;
        }

        this.recentSearches.forEach(cityName => {
            const tag = document.createElement('div');
            tag.className = 'recent-search-tag';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = cityName;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove';
            removeBtn.textContent = '✕';

            tag.appendChild(nameSpan);
            tag.appendChild(removeBtn);

            // Click pe tag pentru a căuta
            nameSpan.addEventListener('click', () => {
                DOM_MAPPING.search.input.value = cityName;
                this.handleSearch();
            });

            // Click pe X pentru a șterge
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.recentSearches = this.recentSearches.filter(c => c !== cityName);
                this.saveRecentSearches();
                this.displayRecentSearches();
            });

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
        
        // Auto-hide after 5 seconds for warnings
        if (type === 'warning') {
            setTimeout(() => this.hideError(), 5000);
        }
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

    // ========================================================================
    // UTILITIES
    // ========================================================================

    getWeatherIcon(iconCode) {
        return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    }

    formatDate(date) {
        return date.toLocaleDateString('ro-RO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Pornește aplicația
    new WeatherApp();
});
