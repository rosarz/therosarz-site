import path from 'path';

// In-memory cache (resetuje się przy każdym cold start, ale działa)
const memoryCache = {
  csgobig: { data: null, timestamp: null },
  clash: { data: null, timestamp: null }
};

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Check if cache is valid
function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.timestamp) return false;
  return (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

export default async function handler(req, res) {
  const { start_date, end_date, type, code, site } = req.query;
  
  try {
    // Clash.gg handling with memory cache
    if (site === 'clash') {
      const cacheEntry = memoryCache.clash;
      
      // Return cached data if valid
      if (isCacheValid(cacheEntry)) {
        console.log('Serving Clash.gg data from memory cache');
        return res.status(200).json(cacheEntry.data);
      }
      
      // Try to fetch fresh data
      try {
        console.log('Fetching fresh Clash.gg data');
        
        const response = await fetch('https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api', {
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NTE1ODQzLCJpYXQiOjE3NTUwODU5NjUsImV4cCI6MTkxMjg3Mzk2NX0.oUwuZuACZfow58Pfr__MDfCJTqT1zLsROpyklFdZDIc',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Clash.gg API returned ${response.status}`);
        }
        
        const clashData = await response.json();
        
        // Transform data
        let leaderboards = Array.isArray(clashData) ? clashData : [clashData];
        let targetLeaderboard = leaderboards.find(lb => lb.id === 841) || leaderboards[0];
        const topPlayers = targetLeaderboard?.topPlayers || [];
        
        const results = topPlayers.map(user => {
          const username = user.username || user.name || '';
          const visiblePart = username.slice(0, 2);
          const stars = '*'.repeat(Math.max(0, Math.min(6, username.length - 2)));
          const anonymized = (visiblePart + stars).slice(0, 8);
          
          return {
            username: anonymized,
            wagered: parseFloat(user.wagered || 0) / 100,
            avatar: user.avatar || user.avatarUrl || '../bot.png'
          };
        });
        
        results.sort((a, b) => b.wagered - a.wagered);
        
        const responseData = {
          results: results,
          prize_pool: "500$"
        };
        
        // Save to memory cache
        memoryCache.clash = {
          data: responseData,
          timestamp: Date.now()
        };
        
        console.log('Clash.gg data cached in memory');
        
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        console.error('Clash.gg API fetch failed:', fetchError.message);
        
        // Return old cache data if available (even if expired)
        if (cacheEntry && cacheEntry.data) {
          console.log('Using expired Clash.gg cache as fallback');
          return res.status(200).json({
            ...cacheEntry.data,
            _fallback: true,
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        throw new Error(`Clash.gg API error and no cache available: ${fetchError.message}`);
      }
    }
    
    // CSGOBig handling with memory cache
    if (site === 'csgobig') {
      const cacheEntry = memoryCache.csgobig;
      
      // Return cached data if valid
      if (isCacheValid(cacheEntry)) {
        console.log('Serving CSGOBig data from memory cache');
        return res.status(200).json(cacheEntry.data);
      }
      
      // Try to fetch fresh data
      try {
        // Convert ISO dates to epoch milliseconds (CSGOBig format)
        const fromEpoch = new Date(start_date).getTime();
        const toEpoch = new Date(end_date).getTime();
        
        const url = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
        console.log('Fetching fresh CSGOBig data from:', url);
        console.log('CSGOBig epoch times - from:', fromEpoch, 'to:', toEpoch);
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('CSGOBig API error response:', errorText);
          throw new Error(`CSGOBig API returned ${response.status}: ${errorText}`);
        }
        
        const csgobigData = await response.json();
        console.log('CSGOBig API success, results count:', csgobigData.results?.length || 0);
        
        // Transform data
        const results = (csgobigData.results || []).map(user => {
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
        
        results.sort((a, b) => b.wagered - a.wagered);
        
        const responseData = {
          results: results,
          prize_pool: "750$"
        };
        
        // Save to memory cache
        memoryCache.csgobig = {
          data: responseData,
          timestamp: Date.now()
        };
        
        console.log('CSGOBig data cached in memory');
        
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        console.error('CSGOBig API fetch failed:', fetchError.message);
        
        // Return old cache data if available (even if expired)
        if (cacheEntry && cacheEntry.data) {
          console.log('Using expired CSGOBig cache as fallback');
          return res.status(200).json({
            ...cacheEntry.data,
            _fallback: true,
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        throw new Error(`CSGOBig API error and no cache available: ${fetchError.message}`);
      }
    }
    
    // Rain.gg handling (default)
    if (!start_date || !end_date || !type || !code) {
      return res.status(400).json({ 
        error: "Missing required parameters",
        required: ["start_date", "end_date", "type", "code"]
      });
    }
    
    const API_KEY = process.env.RAIN_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ 
        error: "Server configuration error",
        details: "Missing RAIN_API_KEY"
      });
    }
    
    const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
    
    const response = await fetch(url, {
      headers: { "x-api-key": API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Rain.gg API returned ${response.status}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (e) {
    console.error('API Proxy Error:', e);
    res.status(500).json({ 
      error: "Proxy error", 
      details: e.message || e.toString(),
      site: req.query.site 
    });
  }
}