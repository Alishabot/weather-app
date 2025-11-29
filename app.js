// ============================================================================
// WEATHER APP - MAIN APPLICATION
// ============================================================================

// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://api.openweathermap.org/data/2.5',
    GEO_URL: 'https://api.openweathermap.org/geo/1.0',
    PROXY_URL: 'https://cors-anywhere.herokuapp.com/',
    API_KEY: '42e6e8424170dc2c2a166bac7f1fa180',
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

    // Construiește URL-ul complet pentru apel API
    buildUrl(endpoint, params) {
        const url = new URL(endpoint, API_CONFIG.BASE_URL);
        url.searchParams.append('appid', API_CONFIG.API_KEY);
        url.searchParams.append('units', API_CONFIG.UNITS);
        url.searchParams.append('lang', API_CONFIG.LANG);
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, value);
            }
        });
        
        // Use CORS proxy
        return API_CONFIG.PROXY_URL + url.toString();
    }

    // Preluare date meteo CURENTE după coordonate (endpoint /weather)
    async getWeatherByCoords(lat, lon) {
        const cacheKey = `weather_${lat}_${lon}`;
        
        // Verifică cache
        if (this.cache.has(cacheKey)) {
            console.log('✓ Meteo curentă preluată din cache:', { lat, lon });
            return this.cache.get(cacheKey);
        }

        try {
            const url = this.buildUrl('/weather', { lat, lon });
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Validare câmpuri importante
            this.validateWeatherData(data);
            
            // Salvează în cache
            this.cache.set(cacheKey, data);
            
            console.log('✓ Meteo curentă preluată din API:', {
                city: data.name,
                temp: data.main.temp,
                icon: data.weather[0].icon
            });
            
            return data;
        } catch (error) {
            throw this.handleError(error, 'obținerea datelor meteo curente');
        }
    }

    // Preluare PROGNOZE pe 5 zile (3h interval - endpoint /forecast)
    async getForecast5Days(lat, lon) {
        const cacheKey = `forecast5_${lat}_${lon}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('✓ Prognoză 5 zile preluată din cache:', { lat, lon });
            return this.cache.get(cacheKey);
        }

        try {
            const url = this.buildUrl('/forecast', { lat, lon });
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            console.log('✓ Prognoză 5 zile preluată din API:', {
                total_forecasts: data.list.length,
                days_covered: Math.ceil(data.list.length / 8)
            });
            
            return data;
        } catch (error) {
            throw this.handleError(error, 'obținerea prognozei pe 5 zile');
        }
    }

    // Preluare PROGNOZE pe 7 zile (daily - endpoint /forecast/daily)
    async getForecast7Days(lat, lon) {
        const cacheKey = `forecast7_${lat}_${lon}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('✓ Prognoză 7 zile preluată din cache:', { lat, lon });
            return this.cache.get(cacheKey);
        }

        try {
            // Construiți URL manual pentru daily forecast
            const url = new URL('/forecast/daily', API_CONFIG.BASE_URL);
            url.searchParams.append('lat', lat);
            url.searchParams.append('lon', lon);
            url.searchParams.append('cnt', '7'); // 7 zile
            url.searchParams.append('appid', API_CONFIG.API_KEY);
            url.searchParams.append('units', API_CONFIG.UNITS);
            url.searchParams.append('lang', API_CONFIG.LANG);
            
            // Use CORS proxy
            const proxiedUrl = API_CONFIG.PROXY_URL + url.toString();
            const response = await fetch(proxiedUrl);
            
            if (!response.ok) {
                // Fallback: Dacă daily nu este disponibil, folosim /forecast
                console.warn('Endpoint /forecast/daily nu disponibil, folosind /forecast');
                return await this.getForecast5Days(lat, lon);
            }

            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            console.log('✓ Prognoză 7 zile preluată din API:', {
                days: data.list.length
            });
            
            return data;
        } catch (error) {
            // Fallback la 5-day forecast
            console.warn('Eroare la prognoța 7 zile, folosind 5 zile:', error);
            return await this.getForecast5Days(lat, lon);
        }
    }

    // Validare câmpuri esențiale din API response
    validateWeatherData(data) {
        const requiredFields = [
            'main.temp',
            'main.feels_like',
            'main.humidity',
            'main.pressure',
            'wind.speed',
            'weather[0].description',
            'weather[0].icon',
            'name',
            'dt'
        ];

        requiredFields.forEach(field => {
            const value = this.getNestedValue(data, field);
            if (value === undefined || value === null) {
                console.warn(`⚠️ Câmp lipsă din API response: ${field}`);
            }
        });
    }

    // Utilitar pentru a accesa nested object properties
    getNestedValue(obj, path) {
        return path.split(/[\.\[\]]/).filter(Boolean).reduce((current, key) => 
            current?.[key], obj);
    }

    // Geocodificare (caut coordonate după nume oraș)
    async getCoordinatesByCity(cityName) {
        const cacheKey = `coords_${cityName.toLowerCase()}`;
        
        if (this.cache.has(cacheKey)) {
            console.log('Coordonate preluate din cache pentru:', cityName);
            return this.cache.get(cacheKey);
        }

        try {
            const url = new URL('/direct', API_CONFIG.GEO_URL);
            url.searchParams.append('q', cityName);
            url.searchParams.append('limit', '5');
            url.searchParams.append('appid', API_CONFIG.API_KEY);
            
            // Use CORS proxy for geocoding
            const proxiedUrl = API_CONFIG.PROXY_URL + url.toString();
            const response = await fetch(proxiedUrl);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.length === 0) {
                throw new Error(`Niciun rezultat găsit pentru "${cityName}"`);
            }

            this.cache.set(cacheKey, data);
            
            return data;
        } catch (error) {
            throw this.handleError(error, `căutarea orașului "${cityName}"`);
        }
    }

    // Gestionare erori API
    handleError(error, action) {
        let userMessage = `Eroare la ${action}`;
        let errorType = 'error';

        if (error instanceof TypeError) {
            userMessage = 'Eroare de conexiune. Verificați conexiunea la internet.';
            errorType = 'error';
        } else if (error.message.includes('API Error: 401')) {
            userMessage = 'Cheie API invalidă. Configurați cheia în app.js';
            errorType = 'error';
        } else if (error.message.includes('API Error: 404')) {
            userMessage = 'Orașul nu a fost găsit. Încercați cu alt nume.';
            errorType = 'warning';
        } else if (error.message.includes('API Error: 429')) {
            userMessage = 'Prea multe cereri. Așteptați câteva secunde și încercați din nou.';
            errorType = 'warning';
        } else if (error.message.includes('Niciun rezultat')) {
            userMessage = error.message;
            errorType = 'warning';
        }

        const customError = new Error(userMessage);
        customError.type = errorType;
        customError.originalError = error;

        console.error('API Error Details:', error);

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
        
        this.initializeEventListeners();
        this.displayRecentSearches();
        this.initializeUnitsSelector();
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
            const displayName = `${result.name}${result.state ? ', ' + result.state : ''}, ${result.country}`;
            
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = displayName;
            item.dataset.lat = result.lat;
            item.dataset.lon = result.lon;
            item.dataset.name = result.name;
            
            item.addEventListener('click', () => {
                this.selectSuggestion(result);
            });

            suggestions.appendChild(item);
        });

        suggestions.classList.add('active');
    }

    hideSuggestions() {
        DOM_MAPPING.search.suggestions.classList.remove('active');
        DOM_MAPPING.search.suggestions.innerHTML = '';
    }

    selectSuggestion(result) {
        DOM_MAPPING.search.input.value = result.name;
        this.hideSuggestions();
        this.currentCoordinates = { lat: result.lat, lon: result.lon, name: result.name };
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

            // Obține coordonate dacă nu sunt setate
            if (!this.currentCoordinates && cityName) {
                const results = await this.api.getCoordinatesByCity(cityName);
                const result = results[0];
                this.currentCoordinates = { 
                    lat: result.lat, 
                    lon: result.lon, 
                    name: result.name 
                };
            }

            if (!this.currentCoordinates) {
                throw new Error('Coordonate indisponibile');
            }

            // Paralel: fetch weather, 5-day forecast și 7-day forecast
            const [weatherData, forecastData5, forecastData7] = await Promise.all([
                this.api.getWeatherByCoords(
                    this.currentCoordinates.lat, 
                    this.currentCoordinates.lon
                ),
                this.api.getForecast5Days(
                    this.currentCoordinates.lat, 
                    this.currentCoordinates.lon
                ),
                this.api.getForecast7Days(
                    this.currentCoordinates.lat, 
                    this.currentCoordinates.lon
                )
            ]);

            // Afișează datele cu unitățile alese
            this.displayCurrentWeather(weatherData);
            this.displayForecast(forecastData7 || forecastData5);

            // Adaugă în recent searches
            this.addToRecentSearches(this.currentCoordinates.name);

            // Succes
            this.showLoading(false);

        } catch (error) {
            this.showLoading(false);
            this.showError(error.message, error.type || 'error');
            console.error('Error fetching weather:', error);
        }
    }

    // ========================================================================
    // DISPLAY CURRENT WEATHER
    // ========================================================================

    displayCurrentWeather(data) {
        // Mapează câmpurile API direct la variabile locale
        // main.temp → temperatura curentă
        // main.feels_like → feels-like temperature
        // main.humidity → umiditate
        // main.pressure → presiune
        // wind.speed → viteza vântului (m/s - trebuie convertite)
        // weather[0].description → descriere meteo
        // weather[0].icon → icon meteo
        // dt → timestamp
        
        const city = data.name;
        const tempCelsius = data.main.temp;
        const feelsLikeCelsius = data.main.feels_like;
        const humidity = data.main.humidity;
        const pressure = data.main.pressure;
        const windSpeedMs = data.wind.speed;
        const description = data.weather[0].description;
        const icon = this.getWeatherIcon(data.weather[0].icon);
        const date = this.formatDate(new Date(data.dt * 1000));

        // Conversii unități
        const temp = this.units.temperature(tempCelsius);
        const feelsLike = this.units.temperature(feelsLikeCelsius);
        const windSpeed = this.units.windSpeed(windSpeedMs);
        const tempUnit = this.units.tempUnit();
        const windUnit = this.units.windUnit();

        // Actualizează DOM cu valorile mapate și convertite
        DOM_MAPPING.currentWeather.cityName.textContent = city;
        DOM_MAPPING.currentWeather.temperature.textContent = `${temp}${tempUnit}`;
        DOM_MAPPING.currentWeather.description.textContent = description;
        DOM_MAPPING.currentWeather.icon.src = icon;
        DOM_MAPPING.currentWeather.icon.alt = description;
        DOM_MAPPING.currentWeather.date.textContent = date;

        // Actualizează detalii cu unitățile corecte
        DOM_MAPPING.currentWeather.details.windSpeed.textContent = `${windSpeed} ${windUnit}`;
        DOM_MAPPING.currentWeather.details.humidity.textContent = `${humidity}%`;
        DOM_MAPPING.currentWeather.details.feelsLike.textContent = `${feelsLike}${tempUnit}`;
        DOM_MAPPING.currentWeather.details.pressure.textContent = `${pressure} ${this.units.pressureUnit()}`;

        // Log date mapate pentru debug
        console.log('📊 Meteo curentă afișată:', {
            city,
            temperature: `${temp}${tempUnit}`,
            feelsLike: `${feelsLike}${tempUnit}`,
            humidity: `${humidity}%`,
            pressure: `${pressure}hPa`,
            windSpeed: `${windSpeed}${windUnit}`,
            description
        });

        // Afișează container
        DOM_MAPPING.currentWeather.container.classList.add('show');
    }

    // ========================================================================
    // DISPLAY FORECAST
    // ========================================================================

    displayForecast(data) {
        const container = DOM_MAPPING.forecast.container;
        container.innerHTML = '';

        // Determină tipul de date: daily sau 3-hourly
        const isDailyForecast = data.list && data.list[0] && data.list[0].main && !data.list[0].dt_txt;
        
        if (isDailyForecast) {
            // Daily forecast (endpoint /forecast/daily)
            this.displayDailyForecast(data.list, container);
        } else {
            // 3-hourly forecast (endpoint /forecast) - grupează după zi
            this.display3HourlyForecast(data.list, container);
        }

        DOM_MAPPING.forecast.section.classList.add('show');
    }

    // Afișare prognoze zilnice (din endpoint /forecast/daily dacă disponibil)
    displayDailyForecast(dailyForecasts, container) {
        const forecastDays = dailyForecasts.slice(0, 7); // Maxim 7 zile

        forecastDays.forEach(forecast => {
            const card = document.createElement('div');
            card.className = 'forecast-card';

            const date = new Date(forecast.dt * 1000);
            const dateStr = date.toLocaleDateString('ro-RO', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });

            // Conversii unități pentru temperaturi
            const tempMax = this.units.temperature(forecast.main.temp_max);
            const tempMin = this.units.temperature(forecast.main.temp_min);
            const tempUnit = this.units.tempUnit();
            const description = forecast.weather[0].description;
            const icon = this.getWeatherIcon(forecast.weather[0].icon);

            card.innerHTML = `
                <div class="forecast-date">${dateStr}</div>
                <img class="forecast-icon" src="${icon}" alt="${description}">
                <div class="forecast-temp">
                    <span class="forecast-temp-max">${tempMax}${tempUnit}</span>
                    <span class="forecast-temp-min">${tempMin}${tempUnit}</span>
                </div>
                <div class="forecast-description">${description}</div>
            `;

            container.appendChild(card);
        });

        console.log(`✓ Prognozeă ${forecastDays.length} zile afișate (daily forecast)`);
    }

    // Afișare prognoze din date 3-hourly (endpoint /forecast)
    display3HourlyForecast(forecastList, container) {
        // Grupează date după zi și iau primele datelor pentru fiecare zi (ideal la 12:00)
        const dailyForecasts = {};
        
        forecastList.forEach(forecast => {
            const date = new Date(forecast.dt * 1000);
            const dayKey = date.toLocaleDateString('ro-RO');

            // Iau doar forecast-ul cel mai apropiat de 12:00 pentru fiecare zi
            if (!dailyForecasts[dayKey]) {
                dailyForecasts[dayKey] = forecast;
            } else {
                const currentHour = date.getHours();
                const existingHour = new Date(dailyForecasts[dayKey].dt * 1000).getHours();
                
                // Dacă noul forecast este mai apropiat de 12:00, înlocuiește
                if (Math.abs(currentHour - 12) < Math.abs(existingHour - 12)) {
                    dailyForecasts[dayKey] = forecast;
                }
            }
        });

        const forecastDays = Object.values(dailyForecasts).slice(0, 7);

        forecastDays.forEach(forecast => {
            const card = document.createElement('div');
            card.className = 'forecast-card';

            const date = new Date(forecast.dt * 1000);
            const dateStr = date.toLocaleDateString('ro-RO', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });

            // Conversii unități
            const tempMax = this.units.temperature(forecast.main.temp_max);
            const tempMin = this.units.temperature(forecast.main.temp_min);
            const tempUnit = this.units.tempUnit();
            const description = forecast.weather[0].description;
            const icon = this.getWeatherIcon(forecast.weather[0].icon);

            card.innerHTML = `
                <div class="forecast-date">${dateStr}</div>
                <img class="forecast-icon" src="${icon}" alt="${description}">
                <div class="forecast-temp">
                    <span class="forecast-temp-max">${tempMax}${tempUnit}</span>
                    <span class="forecast-temp-min">${tempMin}${tempUnit}</span>
                </div>
                <div class="forecast-description">${description}</div>
            `;

            container.appendChild(card);
        });

        console.log(`✓ Prognoză ${forecastDays.length} zile afișate (3-hourly forecast)`);
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
        const errorEl = DOM_MAPPING.errorMessage;
        errorEl.textContent = message;
        errorEl.className = `error-message show ${type}`;
        
        // Auto-ascunde după 5 secunde
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        DOM_MAPPING.errorMessage.classList.remove('show');
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
