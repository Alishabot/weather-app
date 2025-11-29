export default async function handler(req, res) {
    const { q, limit } = req.query;

    if (!q) {
        return res.status(400).json({ error: 'Missing city name parameter' });
    }

    const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
        url.searchParams.append('q', q);
        url.searchParams.append('limit', limit || '5');
        url.searchParams.append('appid', API_KEY);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
