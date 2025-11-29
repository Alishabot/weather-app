// ============================================================================
// OPENWEATHERMAP API - INTEGRATION EXAMPLES
// ============================================================================
// Acest fișier arată exemple de API calls și response structures
// pentru a înțelege mai bine cum funcționează integrarea

// ============================================================================
// 1. CURRENT WEATHER
// ============================================================================

/*
ENDPOINT: /data/2.5/weather

URL EXAMPLE:
https://api.openweathermap.org/data/2.5/weather?q=Bucharest&appid=YOUR_KEY&units=metric&lang=ro

RESPONSE EXAMPLE:
{
    "coord": {
        "lon": 26.1025,
        "lat": 44.4268
    },
    "weather": [
        {
            "id": 800,
            "main": "Clear",
            "description": "cer senin",
            "icon": "01d"
        }
    ],
    "main": {
        "temp": 22.5,              // ← TEMPERATURĂ CURENTĂ
        "feels_like": 21.8,        // ← SENZAȚIE TERMICĂ
        "temp_min": 20.1,
        "temp_max": 24.3,
        "pressure": 1013,          // ← PRESIUNE
        "humidity": 65             // ← UMIDITATE
    },
    "visibility": 10000,
    "wind": {
        "speed": 3.5               // ← VITEZA VÂNT (m/s)
    },
    "clouds": {
        "all": 0
    },
    "dt": 1701273600,              // ← TIMESTAMP
    "sys": {
        "type": 2,
        "id": 2001249,
        "country": "RO",
        "sunrise": 1701249300,
        "sunset": 1701285900
    },
    "timezone": 7200,
    "id": 683506,
    "name": "București",            // ← NUME ORAȘ
    "cod": 200
}

MAPPING ÎN APLICAȚIE:
data.name                    → DOM_MAPPING.currentWeather.cityName
data.main.temp              → DOM_MAPPING.currentWeather.temperature
data.main.feels_like        → DOM_MAPPING.currentWeather.details.feelsLike
data.main.humidity          → DOM_MAPPING.currentWeather.details.humidity
data.main.pressure          → DOM_MAPPING.currentWeather.details.pressure
data.wind.speed             → DOM_MAPPING.currentWeather.details.windSpeed
data.weather[0].description → DOM_MAPPING.currentWeather.description
data.weather[0].icon        → DOM_MAPPING.currentWeather.icon
data.dt                     → DOM_MAPPING.currentWeather.date
*/

// EXEMPLU DE UTILIZARE:
/*
const data = {
    "main": { "temp": 22.5, "feels_like": 21.8, "humidity": 65, "pressure": 1013 },
    "wind": { "speed": 3.5 },
    "weather": [{ "description": "cer senin", "icon": "01d" }],
    "name": "București",
    "dt": 1701273600
};

// Mapare la UI cu conversii unități
const temp = units.temperature(data.main.temp);           // 22°C sau 72°F
const feelsLike = units.temperature(data.main.feels_like); // 21°C sau 71°F
const windSpeed = units.windSpeed(data.wind.speed);        // 12.6 km/h sau 7.8 mph
*/

// ============================================================================
// 2. 5-DAY FORECAST (3-HOURLY)
// ============================================================================

/*
ENDPOINT: /data/2.5/forecast

URL EXAMPLE:
https://api.openweathermap.org/data/2.5/forecast?q=Bucharest&appid=YOUR_KEY&units=metric&lang=ro

RESPONSE STRUCTURE:
{
    "cod": "200",
    "message": 0,
    "cnt": 40,
    "list": [
        {
            "dt": 1701280800,
            "main": {
                "temp": 20.5,
                "feels_like": 19.8,
                "temp_min": 19.5,
                "temp_max": 20.5,
                "pressure": 1015,
                "humidity": 70
            },
            "weather": [
                {
                    "id": 800,
                    "main": "Clear",
                    "description": "cer senin",
                    "icon": "01d"
                }
            ],
            "clouds": { "all": 0 },
            "wind": { "speed": 4.2 },
            "visibility": 10000,
            "pop": 0,
            "sys": { "pod": "d" },
            "dt_txt": "2023-11-30 00:00:00"
        },
        // ... 39 mai multe intrări (fiecare la 3 ore)
    ],
    "city": {
        "id": 683506,
        "name": "București",
        "coord": { "lat": 44.4268, "lon": 26.1025 },
        "country": "RO",
        "population": 1830000,
        "timezone": 7200,
        "sunrise": 1701249300,
        "sunset": 1701285900
    }
}

PROCESARE ÎN APLICAȚIE:
- list conține 40 intrări = 5 zile × 8 (3 ore fiecare)
- Grupez după zi (dayKey = date.toLocaleDateString('ro-RO'))
- Selectez forecast-ul cel mai apropiat de 12:00 pentru fiecare zi
- Afișez max 5 zile în forecast-grid
*/

// EXEMPLU DE PROCESARE:
/*
const dailyForecasts = {};

data.list.forEach(forecast => {
    const date = new Date(forecast.dt * 1000);
    const dayKey = date.toLocaleDateString('ro-RO');

    if (!dailyForecasts[dayKey]) {
        dailyForecasts[dayKey] = forecast;
    } else {
        // Iau forecast-ul cel mai apropiat de 12:00
        const currentHour = date.getHours();
        const existingHour = new Date(dailyForecasts[dayKey].dt * 1000).getHours();
        
        if (Math.abs(currentHour - 12) < Math.abs(existingHour - 12)) {
            dailyForecasts[dayKey] = forecast;
        }
    }
});

// Acum dailyForecasts conține un forecast per zi
Object.values(dailyForecasts).slice(0, 7).forEach(forecast => {
    const tempMax = units.temperature(forecast.main.temp_max);
    const tempMin = units.temperature(forecast.main.temp_min);
    // ... afișare
});
*/

// ============================================================================
// 3. 7-DAY DAILY FORECAST (ENDPOINT /forecast/daily)
// ============================================================================

/*
ENDPOINT: /data/2.5/forecast/daily

URL EXAMPLE:
https://api.openweathermap.org/data/2.5/forecast/daily?lat=44.4268&lon=26.1025&cnt=7&appid=YOUR_KEY&units=metric&lang=ro

⚠️ NOTĂ: Endpoint-ul /forecast/daily nu este disponibil pe Free tier!
Aplicația folosește fallback la /forecast (3-hourly) și grupează după zi.

RESPONSE STRUCTURE (dacă ar fi disponibil):
{
    "cod": "200",
    "message": 0,
    "cnt": 7,
    "list": [
        {
            "dt": 1701280800,
            "main": {
                "temp": 20.5,
                "temp_min": 15.2,
                "temp_max": 25.8,
                "pressure": 1015,
                "humidity": 70
            },
            "weather": [
                {
                    "id": 800,
                    "main": "Clear",
                    "description": "cer senin",
                    "icon": "01d"
                }
            ],
            "clouds": 0,
            "wind": { "speed": 4.2 }
        },
        // ... 6 mai multe zile
    ],
    "city": { ... }
}
*/

// ============================================================================
// 4. GEOCODING API (FORWARD GEOCODING)
// ============================================================================

/*
ENDPOINT: /geo/1.0/direct

URL EXAMPLE:
https://api.openweathermap.org/geo/1.0/direct?q=Bucharest&limit=5&appid=YOUR_KEY

RESPONSE EXAMPLE:
[
    {
        "name": "Bucharest",
        "lat": 44.4268,
        "lon": 26.1025,
        "country": "RO",
        "state": null
    },
    {
        "name": "Bucharest",
        "lat": 44.427,
        "lon": 26.09,
        "country": "RO",
        "state": "Bucharest"
    }
]

UTILIZARE:
- Obțin coordonatele din search input
- Afișez în suggestions list
- La click, selectez și fetch meteo
*/

// EXEMPLU:
/*
const results = await api.getCoordinatesByCity('Bucu');

results.forEach(result => {
    const displayName = `${result.name}${result.state ? ', ' + result.state : ''}, ${result.country}`;
    // "Bucharest, RO"
    
    // La click
    this.currentCoordinates = {
        lat: result.lat,
        lon: result.lon,
        name: result.name
    };
});
*/

// ============================================================================
// 5. UNITATI ȘI CONVERSII
// ============================================================================

/*
METRICE (METRIC):
- Temperatură: °C (Celsius)
- Vânt: m/s (metri pe secundă)
- Presiune: hPa (hectopascali)

IMPERIALE (IMPERIAL):
- Temperatură: °F (Fahrenheit)
- Vânt: mph (mile pe oră)
- Presiune: hPa (hectopascali - la fel)

CONVERSII:
°F = (°C × 9/5) + 32
mph = m/s × 2.237
km/h = m/s × 3.6

EXEMPLU:
22°C = (22 × 9/5) + 32 = 71.6°F
3.5 m/s = 3.5 × 2.237 = 7.83 mph
3.5 m/s = 3.5 × 3.6 = 12.6 km/h
*/

// ============================================================================
// 6. WEATHER ICONS
// ============================================================================

/*
Icon codes din OpenWeatherMap:

01d = clear sky day        🌞
01n = clear sky night      🌙
02d = few clouds day       ⛅
02n = few clouds night     ⛅
03d = scattered clouds     ☁️
03n = scattered clouds     ☁️
04d = broken clouds        ☁️
04n = broken clouds        ☁️
09d = shower rain          🌧️
09n = shower rain          🌧️
10d = rain day             🌧️
10n = rain night           🌧️
11d = thunderstorm day     ⛈️
11n = thunderstorm night   ⛈️
13d = snow                 ❄️
13n = snow                 ❄️
50d = mist                 🌫️
50n = mist                 🌫️

URL IMAGINE:
https://openweathermap.org/img/wn/{icon}@4x.png

EXEMPLU:
https://openweathermap.org/img/wn/01d@4x.png
*/

// ============================================================================
// 7. ERROR CODES API
// ============================================================================

/*
400 = Bad Request (parametri greșiți)
401 = Unauthorized (API key invalid)
403 = Forbidden (accesare interzisă)
404 = Not Found (oraș nu există)
429 = Too Many Requests (prea multe apeluri)
500 = Internal Server Error
502 = Bad Gateway
503 = Service Unavailable

HANDLING ÎN APLICAȚIE:
- 401 → "Cheie API invalidă"
- 404 → "Orașul nu a fost găsit"
- 429 → "Prea multe cereri. Așteptați..."
- alții → "Eroare la conectare"
*/

// ============================================================================
// 8. TEST REQUESTS CU CURL
// ============================================================================

/*
# Current Weather - București
curl "https://api.openweathermap.org/data/2.5/weather?q=Bucharest&appid=YOUR_KEY&units=metric&lang=ro" | jq .

# Forecast 5 zile
curl "https://api.openweathermap.org/data/2.5/forecast?q=Bucharest&appid=YOUR_KEY&units=metric&lang=ro" | jq '.list[0]'

# Geocoding
curl "https://api.openweathermap.org/geo/1.0/direct?q=Bucharest&limit=5&appid=YOUR_KEY" | jq .

# Verificare API key
curl "https://api.openweathermap.org/data/2.5/weather?q=Bucharest&appid=WRONG_KEY" | jq .
# Rezultat: {"cod":"401", "message": "Invalid API key"}
*/

// ============================================================================
// 9. RATE LIMITS
// ============================================================================

/*
FREE TIER:
- 60 apeluri/minut
- 1000 apeluri/zi
- History: 5 zile

PROFESSIONAL:
- 600 apeluri/minut
- Unlimited/zi
- History: 30 zile

APLICAȚIA FOLOSEȘTE:
- Cache cu TTL 1 oră → reduce apeluri
- Debounce 300ms pe search → reduce apeluri
- Parallel API calls → mai eficient
- Recent searches → reutilizare date

REZULTAT: ~5-10 apeluri/oră per utilizator
*/

// ============================================================================
// 10. DEBUGGING
// ============================================================================

/*
AFIȘARE CONSOLE:
✓ Meteo curentă preluată din API
✓ Prognoză 5 zile preluată din cache
📊 Meteo curentă afișată: { city, temperature, ... }
⚠️ Endpoint /forecast/daily nu disponibil

VERIFICARE NETWORK:
1. Deschideți DevTools (F12)
2. Mergeți la Network tab
3. Căutați un oraș
4. Vedeți requesturile API
5. Verificați response JSON

VERIFICARE CACHE:
localStorage.getItem('weatherAppCache')
localStorage.getItem('recentSearches')
*/

console.log('📚 OpenWeatherMap API Integration Documentation');
console.log('Consultați commenturile din acest fișier pentru exemple complete');
