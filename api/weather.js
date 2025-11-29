export default async function handler(req, res) {
    const { endpoint, ...params } = req.query;
    
    if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const baseUrl = endpoint.includes('geo') 
            ? 'https://api.openweathermap.org/geo/1.0'
            : 'https://api.openweathermap.org/data/2.5';

        const url = new URL(`${baseUrl}/${endpoint}`);
        url.searchParams.append('appid', API_KEY);
        
        // Add all other parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
