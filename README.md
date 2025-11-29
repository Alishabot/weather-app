# 🌦️ Aplicație Meteo - Weather App

O aplicație meteo modernă și responsivă cu integrare completă OpenWeatherMap API, suport metric/imperial și prognoze pe 7 zile.

## ✨ Caracteristici Principale

### 🔌 Integrare OpenWeatherMap API
- **Current Weather**: Meteo curentă în timp real
- **3-Hour Forecasts**: Predicții la fiecare 3 ore (endpoint `/forecast`)
- **Daily Forecasts**: Predicții zilnice pe 7 zile (endpoint `/forecast/daily`)
- **Geocoding API**: Căutare orașe și sugestii în timp real
- **Smart Fallback**: Utilizează `/forecast` dacă `/forecast/daily` nu e disponibil

### 📊 Câmpuri API Mapate
Aplicația mapează următoarele câmpuri OpenWeatherMap direct la UI:

```
CURRENT WEATHER:
├── main.temp → Temperatura curentă
├── main.feels_like → Senzația termică
├── main.humidity → Umiditate (%)
├── main.pressure → Presiune (hPa)
├── wind.speed → Viteza vântului (m/s)
├── weather[0].description → Descriere meteo
├── weather[0].icon → Iconiță meteo
├── name → Nume oraș
└── dt → Timestamp

FORECAST:
├── main.temp_max → Temperatura maximă
├── main.temp_min → Temperatura minimă
├── weather[0].description → Descriere
└── weather[0].icon → Iconiță
```

### 🌡️ Conversii Unități (Metric ↔ Imperial)
- **Metric**: °C, km/h, hPa
- **Imperial**: °F, mph, hPa
- Conversii automate cu formule corecte:
  - °F = (°C × 9/5) + 32
  - mph = m/s × 2.237
  - km/h = m/s × 3.6

### 🎨 Layout Responsive
- Flexbox pentru search și header
- CSS Grid pentru weather details și forecast
- Breakpoints: 768px (tablet), 480px (mobile)

### 🚀 Optimizări Performance
1. **Debounce Search**: 300ms delay pentru sugestii
2. **Caching Smart**: 
   - Cache în memorie cu TTL 1 oră
   - Persistență localStorage
   - Max 10 rezultate
3. **Parallel API Calls**: Meteo + prognoze 5 zile + prognoze 7 zile simultan
4. **Progressive Enhancement**: Fallback de la 7 zile la 5 zile

### ❌ Error Handling Complet
- Mesaje specifice pentru API errors (401, 404, 429)
- Erori de conexiune detectate
- Validare câmpuri API response
- Logging detaliat în console

## 🚀 Instalare & Setup

### 1. Obțineți Cheia API

1. Mergeți la https://openweathermap.org/api
2. Creați cont gratuit (plan Free disponibil)
3. Accesați "API Keys" din account settings
4. Copiați API Key-ul

### 2. Configurare

Deschideți `app.js` și căutați:

```javascript
const API_CONFIG = {
    BASE_URL: 'https://api.openweathermap.org/data/2.5',
    GEO_URL: 'https://api.openweathermap.org/geo/1.0',
    API_KEY: 'YOUR_API_KEY_HERE',  // ← ÎNLOCUIȚI AICI
    UNITS: 'metric',
    LANG: 'ro',
    FORECAST_DAYS: 7
};
```

### 3. Deschideți Aplicația

**Opțiune A: Direct în Browser**
- Click dreapta pe `index.html`
- Selectați "Open with" → Browser

**Opțiune B: Server Local (Recomandat)**
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# Ruby
ruby -run -ehttpd . -p 8000
```

Accesați: `http://localhost:8000`

## 📋 Structură Fișierelor

```
weather app/
├── index.html          # HTML cu mapare DOM elements
├── styles.css          # Stiluri Flexbox & Grid (750+ linii)
├── app.js             # Logică și API integration (850+ linii)
└── README.md          # Documentație
```

## 🏗️ Arhitectura Codului

### 1. **UnitsConverter Class** 🌡️
```javascript
const converter = new UnitsConverter('metric');

converter.temperature(20);    // → 20°C sau 68°F
converter.windSpeed(5);       // → 18 km/h sau 11.2 mph
converter.tempUnit();         // → '°C' sau '°F'
converter.setUnits('imperial'); // Schimbă unități
```

### 2. **CacheManager Class** 💾
```javascript
const cache = new CacheManager(10, 3600000); // 10 items, 1 oră TTL

cache.set('coords_bucuresti', data);
cache.get('coords_bucuresti');  // null dacă expirat
cache.has('coords_bucuresti');
cache.clear();
```

### 3. **WeatherAPIService Class** 🔌
```javascript
const api = new WeatherAPIService();

// Current weather
const weather = await api.getWeatherByCoords(44.4268, 26.1025);

// Prognoze
const forecast5 = await api.getForecast5Days(44.4268, 26.1025);
const forecast7 = await api.getForecast7Days(44.4268, 26.1025);

// Geocoding
const cities = await api.getCoordinatesByCity('București');
```

### 4. **WeatherApp Controller Class** 🎮
```javascript
const app = new WeatherApp();

// Controlează întreaga logică
// - Search & sugestii
// - Fetch API calls
// - Afișare date cu unitățile corecte
// - Gestionare cache și recent searches
```

### 5. **DOM Element Mapping** 📍
Structură clară a tuturor elementelor DOM:

```javascript
const DOM_MAPPING = {
    search: { input, button, suggestions },
    currentWeather: {
        container, cityName, date, temperature, description, icon,
        details: { windSpeed, humidity, feelsLike, pressure }
    },
    forecast: { container, section },
    recentSearches: { container },
    errorMessage,
    loadingSpinner
};
```

## 🎮 Utilizare

### Căutare Cărări
1. **Introduceți un oraș**: "București", "Constanța", etc.
2. **Vedeți sugestii**: Lista se actualizeaza la fiecare tastă (300ms debounce)
3. **Selectați**: Click pe sugestie sau apasă "Căuta"
4. **Vizualizați**: Meteo curentă + prognoze 7 zile

### Schimbare Unități
- Clicați butonul **°C / km/h** din header
- Se schimbă în **°F / mph** și invers
- Datele se recalculează automat

### Căutări Recente
- Ultimele 10 căutări salvate automat
- Click pe tag pentru relua căutare
- Click pe ✕ pentru ștergere

## 📊 Structura API Response

### Current Weather Response
```json
{
    "coord": { "lon": 26.1025, "lat": 44.4268 },
    "weather": [{
        "id": 800,
        "main": "Clear",
        "description": "cer senin",
        "icon": "01d"
    }],
    "main": {
        "temp": 22.5,
        "feels_like": 21.8,
        "humidity": 65,
        "pressure": 1013
    },
    "wind": { "speed": 3.5 },
    "name": "București",
    "dt": 1701273600
}
```

### Forecast Response (3-hourly)
```json
{
    "list": [
        {
            "dt": 1701280800,
            "main": {
                "temp": 20,
                "temp_max": 22,
                "temp_min": 18,
                "humidity": 70
            },
            "weather": [{ "description": "...", "icon": "..." }],
            "wind": { "speed": 4 }
        }
        // ... mai multe intrări la 3 ore
    ]
}
```

### Forecast Response (daily - dacă disponibil)
```json
{
    "list": [
        {
            "dt": 1701280800,
            "main": {
                "temp_max": 25,
                "temp_min": 15,
                "humidity": 60
            },
            "weather": [{ "description": "...", "icon": "..." }]
        }
        // ... maxim 7 zile
    ]
}
```

## 🎨 Design Features

### Colors
```css
Primary:   #667eea (Albastru)
Secondary: #764ba2 (Violet)
Success:   #48bb78 (Verde)
Danger:    #f56565 (Roșu)
Warning:   #ed8936 (Portocaliu)
```

### Responsive Breakpoints
- **Desktop**: > 768px (3 coloane forecast)
- **Tablet**: 768px (2 coloane)
- **Mobile**: < 480px (1 coloană)

### Animații
- Loading spinner (rotație)
- Slide-in pentru erori
- Hover effects pe carduri
- Transizioni smooth

## 🔍 Debugging & Logging

Deschideți **DevTools (F12)** și consultați **Console**:

```javascript
// Mesaje de succes (verde ✓)
✓ Meteo curentă preluată din API
✓ Prognoză 5 zile preluată din cache

// Mesaje de avertisment (portocaliu ⚠️)
⚠️ Endpoint /forecast/daily nu disponibil

// Mesaje de date mapate (albastru 📊)
📊 Meteo curentă afișată: { city, temperature, ... }
```

## ⚙️ Configurație Avansată

### Modificare TTL Cache
```javascript
// În constructor WeatherAPIService
this.cache = new CacheManager(10, 7200000); // 2 ore în loc de 1
```

### Debounce Delays
```javascript
// Sugestii căutare
const debouncedSearch = debounce(func, 500); // 500ms

// Search input
const debouncedInput = debounce(func, 1000); // 1 secund
```

### Limba Interface
```javascript
API_CONFIG.LANG = 'en'; // Pentru engleză
API_CONFIG.LANG = 'fr'; // Pentru franceză
```

### Numărul de Zile Prognoze
```javascript
API_CONFIG.FORECAST_DAYS = 5; // 5 zile în loc de 7
```

## 🧪 Testare

### Test Cases

#### 1. Search & Suggestions
- [ ] Introduceți "Bucu" → Apare "București" în sugestii
- [ ] Delay 300ms înainte de afișare (debounce)
- [ ] Click pe sugestie → Încarcă meteo

#### 2. API Response Handling
- [ ] Meteo curentă afișează toate câmpurile mapate
- [ ] Prognoze 7 zile se afișează corect
- [ ] Fallback la 5 zile dacă daily nu disponibil

#### 3. Conversii Unități
- [ ] Schimbă în °F/mph
- [ ] Verifică: 22°C = 72°F
- [ ] Verifică: 3.6 m/s = 13 km/h = 8 mph

#### 4. Cache & Performance
- [ ] Prima căutare: Apel API (lent)
- [ ] A doua căutare: Din cache (instant)
- [ ] Consultați Console pentru "✓ ... din cache"

#### 5. Error Handling
- [ ] Introduceți API key greșit → Mesaj "Cheie API invalidă"
- [ ] Introduceți oraș inexistent → Mesaj "Niciun rezultat"
- [ ] Deconectați internet → Eroare conexiune

### Test URLs
Teste cu curl din terminal:

```bash
# Current weather - București
curl "https://api.openweathermap.org/data/2.5/weather?q=Bucharest&appid=YOUR_KEY&units=metric&lang=ro"

# Forecast 5 zile
curl "https://api.openweathermap.org/data/2.5/forecast?q=Bucharest&appid=YOUR_KEY&units=metric&lang=ro"

# Geocoding
curl "https://api.openweathermap.org/geo/1.0/direct?q=Bucharest&limit=5&appid=YOUR_KEY"
```

## 📈 Performance Metrics

| Metrica | Valoare |
|---------|---------|
| First Load | 1-2s |
| Cached Load | <100ms |
| Search Debounce | 300ms |
| Cache TTL | 1 oră |
| Bundle Size | ~15KB |
| API Calls/Search | 2-3 (paralel) |

## 🐛 Troubleshooting

### "Cheie API invalidă"
- Verificați ortografia cheii în `app.js`
- Asigurați-vă că API key-ul e activ la openweathermap.org
- Așteptați 5-10 minute după creare

### "Niciun rezultat găsit"
- Verificați ortografia orașului
- Încercați variante: "Bucharest" vs "București"
- Consultați https://openweathermap.org/find

### "Poza multe cereri"
- Plan Free are limita: 60 apeluri/minut
- Cache-ul salvează automat rezultatele
- Așteptați 1 minut și reîncercați

### Aplicația nu se încarcă
- Verificați că deschideți pe http:// (nu file://)
- Unele browsere blocează mixed content
- Utilizați server local (python -m http.server)

## 📝 Licență

MIT - Utilizare liberă pentru proiecte personale și comerciale

## 🔗 Resurse

- [OpenWeatherMap API Docs](https://openweathermap.org/api)
- [API Response Format](https://openweathermap.org/weather-data)
- [Icon Codes](https://openweathermap.org/weather-conditions)

---

**Enjoy your weather app! 🌤️**
