const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const BASE_URL = 'https://api.openweathermap.org';

// Weather endpoint
app.get('/api/weather/:endpoint', async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { q, lat, lon, cnt, units = 'metric', lang = 'ro' } = req.query;

        if (!API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        let url = `${BASE_URL}/data/2.5/${endpoint}?appid=${API_KEY}&units=${units}&lang=${lang}`;

        // Add location parameters
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (lat && lon) url += `&lat=${lat}&lon=${lon}`;
        if (cnt) url += `&cnt=${cnt}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Cache for 10 minutes
        res.set('Cache-Control', 'public, max-age=600');
        res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Geocoding endpoint
app.get('/api/geo/:endpoint', async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { q, limit = 5 } = req.query;

        if (!API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const url = `${BASE_URL}/geo/1.0/${endpoint}?q=${encodeURIComponent(q)}&limit=${limit}&appid=${API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Cache for 1 hour
        res.set('Cache-Control', 'public, max-age=3600');
        res.json(data);
    } catch (error) {
        console.error('Geo API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Serve static files
app.use(express.static('../'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Weather API server running on port ${PORT}`);
});
