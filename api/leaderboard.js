// In-memory cache for CSGOBig data with fallback mechanism
const csgobigCache = {
  data: null,
  timestamp: null,
  ttl: 15 * 60 * 1000, // 15 minutes in milliseconds
  lastSuccessfulData: null // Fallback data jeśli API zawiedzie
};

// In-memory cache for Clash.gg data with fallback mechanism
const clashCache = {
  data: null,
  timestamp: null,
  ttl: 15 * 60 * 1000, // 15 minutes in milliseconds
  lastSuccessfulData: null // Fallback data jeśli API zawiedzie
};

export default async function handler(req, res) {
  const { start_date, end_date, type, code, site } = req.query;
  
  try {
    // Clash.gg handling with cache and fallback
    if (site === 'clash') {
      // Create cache key based on request parameters
      const cacheKey = `${code}_${start_date}_${end_date}`;
      const now = Date.now();
      
      // Check if we have valid cached data (< 15 min old)
      if (clashCache.data && 
          clashCache.timestamp && 
          clashCache.cacheKey === cacheKey &&
          (now - clashCache.timestamp) < clashCache.ttl) {
        console.log('Returning cached Clash.gg data');
        return res.status(200).json(clashCache.data);
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
        console.log('Clash.gg raw data:', clashData);
        
        // Transform Clash.gg response to match Rain.gg format
        // Extract leaderboard data
        let leaderboards = clashData;
        if (!Array.isArray(leaderboards)) {
          leaderboards = [leaderboards];
        }
        
        // Find target leaderboard (ID 841 or most recent)
        let targetLeaderboard = leaderboards[0];
        if (leaderboards.length > 1) {
          const found = leaderboards.find(lb => lb.id === 841 || lb.id === '841');
          if (found) {
            targetLeaderboard = found;
          } else {
            targetLeaderboard = leaderboards.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
          }
        }
        
        const topPlayers = targetLeaderboard.topPlayers || [];
        
        const results = topPlayers.map(user => {
          // Anonymize username (first 2 chars + stars)
          const username = user.username || user.name || '';
          const visiblePart = username.slice(0, 2);
          const stars = '*'.repeat(Math.max(0, Math.min(6, username.length - 2)));
          const anonymized = (visiblePart + stars).slice(0, 8);
          
          return {
            username: anonymized,
            wagered: parseFloat(user.wagered || user.wager || 0) / 100, // Convert from gem cents to gems
            avatar: user.avatar || user.avatarUrl || '../bot.png'
          };
        });
        
        // Sort by wagered amount descending
        results.sort((a, b) => b.wagered - a.wagered);
        
        const responseData = {
          results: results,
          prize_pool: "500$" // Clash.gg prize pool
        };
        
        // Update cache AND save as last successful data
        clashCache.data = responseData;
        clashCache.timestamp = now;
        clashCache.cacheKey = cacheKey;
        clashCache.lastSuccessfulData = responseData; // Save as fallback
        
        console.log('Clash.gg data cached for 15 minutes + saved as fallback');
        
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        // If fetch fails but we have old successful data, use it as fallback
        console.error('Clash.gg API fetch failed:', fetchError.message);
        
        if (clashCache.lastSuccessfulData) {
          console.log('Using last successful Clash.gg data as fallback');
          
          // Update timestamp to retry in 15 minutes
          clashCache.timestamp = now;
          clashCache.cacheKey = cacheKey;
          
          return res.status(200).json({
            ...clashCache.lastSuccessfulData,
            _fallback: true, // Flag indicating this is fallback data
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        // If no fallback data exists, throw error
        throw new Error(`Clash.gg API error and no fallback data available: ${fetchError.message}`);
      }
    }
    
    // CSGOBig handling
    if (site === 'csgobig') {
      // Create cache key based on request parameters
      const cacheKey = `${code}_${start_date}_${end_date}`;
      const now = Date.now();
      
      // Check if we have valid cached data (< 15 min old)
      if (csgobigCache.data && 
          csgobigCache.timestamp && 
          csgobigCache.cacheKey === cacheKey &&
          (now - csgobigCache.timestamp) < csgobigCache.ttl) {
        console.log('Returning cached CSGOBig data');
        return res.status(200).json(csgobigCache.data);
      }
      
      // Try to fetch fresh data
      try {
        // Convert ISO dates to epoch milliseconds
        const fromEpoch = new Date(start_date).getTime();
        const toEpoch = new Date(end_date).getTime();
        
        const url = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
        
        console.log('Fetching fresh CSGOBig data from:', url);
        
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
        
        const responseData = {
          results: results,
          prize_pool: "500$" // CSGOBig prize pool
        };
        
        // Update cache AND save as last successful data
        csgobigCache.data = responseData;
        csgobigCache.timestamp = now;
        csgobigCache.cacheKey = cacheKey;
        csgobigCache.lastSuccessfulData = responseData; // Save as fallback
        
        console.log('CSGOBig data cached for 15 minutes + saved as fallback');
        
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        // If fetch fails but we have old successful data, use it as fallback
        console.error('CSGOBig API fetch failed:', fetchError.message);
        
        if (csgobigCache.lastSuccessfulData) {
          console.log('Using last successful CSGOBig data as fallback');
          
          // Update timestamp to retry in 15 minutes
          csgobigCache.timestamp = now;
          csgobigCache.cacheKey = cacheKey;
          
          return res.status(200).json({
            ...csgobigCache.lastSuccessfulData,
            _fallback: true, // Flag indicating this is fallback data
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        // If no fallback data exists, throw error
        throw new Error(`CSGOBig API error and no fallback data available: ${fetchError.message}`);
      }
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