export default async function handler(req, res) {
  const { start_date, end_date, type, code, site } = req.query;
  
  try {
    // CSGOBig handling
    if (site === 'csgobig') {
      // Convert ISO dates to epoch milliseconds
      const fromEpoch = new Date(start_date).getTime();
      const toEpoch = new Date(end_date).getTime();
      
      const url = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`CSGOBig API returned ${response.status}`);
      }
      
      const csgobigData = await response.json();
      
      // Transform CSGOBig response to match Rain.gg format
      const results = (csgobigData.results || []).map(user => {
        // Anonymize username (first 2 chars + stars)
        const username = user.name || '';
        const visiblePart = username.slice(0, 2);
        const stars = '*'.repeat(Math.max(0, Math.min(6, username.length - 2)));
        const anonymized = (visiblePart + stars).slice(0, 8);
        
        return {
          username: anonymized,
          wagered: parseFloat(user.wagerTotal || 0),
          avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
        };
      });
      
      // Sort by wagered amount descending
      results.sort((a, b) => b.wagered - a.wagered);
      
      return res.status(200).json({
        results: results,
        prize_pool: "750$" // CSGOBig prize pool
      });
    }
    
    // Rain.gg handling (existing code)
    const API_KEY = process.env.RAIN_API_KEY;
    const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
    
    const response = await fetch(url, {
      headers: { "x-api-key": API_KEY }
    });
    
    const data = await response.json();
    res.status(200).json(data);
    
  } catch (e) {
    console.error('API Proxy Error:', e);
    res.status(500).json({ 
      error: "Proxy error", 
      details: e.toString(),
      site: req.query.site 
    });
  }
}