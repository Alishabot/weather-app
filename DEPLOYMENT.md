## 🚀 DEPLOYMENT & PRODUCTION SETUP

### Pasul 1: Pregătire API Key

#### Local Development (insecure)
```javascript
// ❌ NU FACEȚI ASTA ÎN PRODUCȚIE
const API_CONFIG = {
    API_KEY: 'your_public_key_here' // Expus în source code!
};
```

#### Production (secure)
```javascript
// ✅ BACKEND PROXY
// Backend (Node.js/Python) expune endpoint care apelează OpenWeatherMap
// Frontend apelează backend - nu expune API key

// Frontend
const API_CONFIG = {
    BASE_URL: '/api/weather', // Local backend
};

const response = await fetch('/api/weather/current?city=Bucharest');
const data = await response.json();

// Backend (Node.js express example)
app.get('/api/weather/current', async (req, res) => {
    const { city } = req.query;
    const apiKey = process.env.OPENWEATHERMAP_API_KEY; // Secret
    
    const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    );
    const data = await response.json();
    res.json(data);
});
```

### Pasul 2: Optimizare pentru Producție

#### 1. Minify JavaScript & CSS
```bash
# npx terser - pentru JS
npx terser app.js -o app.min.js -c -m

# npx cssnano - pentru CSS
npx cssnano styles.css -o styles.min.css

# HTML
npx html-minifier --input-dir . --output-dir dist --file-ext html
```

#### 2. Service Worker (Offline Support)
```javascript
// service-worker.js
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open('weather-app-v1').then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/styles.css',
                '/app.js'
            ]);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(() => caches.match('/'))
    );
});

// În app.js
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
}
```

#### 3. HTTPS (SSL Certificate)
```bash
# Let's Encrypt (gratuit)
certbot certonly --standalone -d yourdomain.com

# Auto-renew
certbot renew --dry-run
```

### Pasul 3: Deploy pe Hosting

#### Opțiunea A: Netlify (Gratuit)
```bash
# 1. Conectați repo GitHub
# 2. Build command: (lăsați gol - HTML static)
# 3. Publish directory: . (root)
# 4. Environment variables:
#    VITE_API_KEY=your_key

# Cu Node backend:
# Build: npm run build
# Functions: /netlify/functions/ (backend)
```

#### Opțiunea B: Vercel
```bash
# 1. Deploy static HTML
npm i -g vercel
vercel deploy

# 2. Set environment variables
vercel env add OPENWEATHERMAP_API_KEY

# vercel.json
{
    "buildCommand": "echo 'Static site'",
    "outputDirectory": ".",
    "env": {
        "OPENWEATHERMAP_API_KEY": "@openweathermap_api_key"
    }
}
```

#### Opțiunea C: GitHub Pages
```bash
# 1. Push la GitHub
# 2. Settings → Pages
# 3. Source: Deploy from branch
# 4. Branch: main, folder: root
# 5. Site disponibil la: username.github.io/repo-name

# Dacă vreți backend: folosiți GitHub Actions
```

#### Opțiunea D: Own Server (VPS)
```bash
# 1. Conectați SSH
ssh user@your-server.com

# 2. Clonați repo
git clone https://github.com/yourname/weather-app.git
cd weather-app

# 3. Instalați Node.js & npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Instalați backend dependencies
npm install

# 5. Setup environment
echo "OPENWEATHERMAP_API_KEY=your_key" > .env

# 6. Start server
npm start

# 7. Setup Nginx reverse proxy
sudo apt install nginx
# Configurați /etc/nginx/sites-available/default

# 8. SSL cu Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Nginx Config Example:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    root /home/user/weather-app;
    
    # Static files
    location ~* \.(css|js|png|jpg|gif|ico)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Index file
    location / {
        try_files $uri /index.html;
    }
}
```

### Pasul 4: Performance Optimization

#### 1. Image Optimization
```bash
# Compresare imagini
cwebp weather-icon.png -o weather-icon.webp
```

#### 2. Gzip Compression
```nginx
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 1000;
```

#### 3. CDN Cache Headers
```javascript
// Backend
app.use((req, res, next) => {
    // Static assets - cache 30 zile
    if (req.path.match(/\.(js|css|png|jpg|gif|ico|webp)$/)) {
        res.set('Cache-Control', 'public, max-age=2592000');
    }
    
    // API responses - cache 1 oră
    if (req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'public, max-age=3600');
    }
    
    next();
});
```

#### 4. Monitoring & Analytics
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_ID');
</script>

<!-- Sentry Error Tracking -->
<script src="https://cdn.sentry.io/..."></script>
<script>
    Sentry.init({ dsn: 'your-sentry-dsn' });
</script>
```

### Pasul 5: Security

#### 1. CORS Configuration
```javascript
// Backend
const cors = require('cors');

app.use(cors({
    origin: ['https://yourdomain.com'],
    methods: ['GET'],
    credentials: true
}));
```

#### 2. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

#### 3. Security Headers
```nginx
# Nginx headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

#### 4. Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' api.openweathermap.org; 
               img-src 'self' openweathermap.org data:;">
```

### Pasul 6: Testing

#### Unit Tests
```javascript
// test/weather.test.js
const assert = require('assert');
const { UnitsConverter } = require('../app.js');

describe('UnitsConverter', () => {
    it('should convert 22°C to 72°F', () => {
        const converter = new UnitsConverter('imperial');
        assert.strictEqual(converter.temperature(22), 72);
    });

    it('should convert 3.6 m/s to 13 km/h', () => {
        const converter = new UnitsConverter('metric');
        assert.strictEqual(converter.windSpeed(3.6), '12.9');
    });
});
```

```bash
npm test
```

#### E2E Tests (Cypress)
```javascript
// cypress/e2e/weather.cy.js
describe('Weather App', () => {
    it('should search for a city and display weather', () => {
        cy.visit('http://localhost:3000');
        cy.get('#searchInput').type('Bucharest');
        cy.get('#searchBtn').click();
        cy.get('#cityName').should('contain', 'Bucharest');
        cy.get('#temperature').should('not.be.empty');
    });
});
```

### Pasul 7: Monitoring

#### Uptime Monitoring
```bash
# UptimeRobot (gratuit)
# 1. Sign up la uptimerobot.com
# 2. Add monitor pentru https://yourdomain.com
# 3. Alerts via email/SMS
```

#### Performance Monitoring
```bash
# New Relic APM
npm install newrelic

# Adăugați în server.js
require('newrelic');
```

#### Error Tracking
```bash
# Sentry
npm install @sentry/node

// server.js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: "your-sentry-dsn" });
```

### Pasul 8: Continuous Deployment

#### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm test
      
      - uses: actions/deploy-pages@v1
        with:
          folder: .
```

### Checklist Pre-Deploy

- [ ] API Key securizată (nu în source code)
- [ ] HTTPS certificat instalat
- [ ] Service Worker setup
- [ ] Cache headers configured
- [ ] Rate limiting active
- [ ] Security headers in place
- [ ] Error tracking enabled
- [ ] Monitoring setup
- [ ] DNS configured
- [ ] Email alerts configured
- [ ] Backup system in place
- [ ] Testing complete

### Troubleshooting Post-Deploy

**Problemă: CORS error**
```javascript
// Backend CORS headers
res.header('Access-Control-Allow-Origin', 'https://yourdomain.com');
res.header('Access-Control-Allow-Methods', 'GET');
res.header('Access-Control-Allow-Headers', 'Content-Type');
```

**Problemă: Cache stale**
```bash
# Clear CDN cache
curl -X POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache \
  -H "X-Auth-Key: {auth_key}" \
  -d '{"files":["https://yourdomain.com/app.js"]}'
```

**Problemă: Rate limit exceeded**
```javascript
// Implement exponential backoff
async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fetch(url);
        } catch (e) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
}
```

---

**Production Ready! 🚀**
