import path from 'path';
import fs from 'fs';

// In-memory cache for all platforms
const platformCache = {
  rain: { data: null, timestamp: null, lastSuccessfulData: null },
  clash: { data: null, timestamp: null, lastSuccessfulData: null },
  csgobig: { data: null, timestamp: null, lastSuccessfulData: null }
};

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds

// Path to public data directory
const PUBLIC_DATA_DIR = path.join(process.cwd(), 'public', 'data');
const CSGOBIG_DATA_FILE = path.join(PUBLIC_DATA_DIR, 'csgobig-leaderboard.json');

// Ensure public data directory exists
if (!fs.existsSync(PUBLIC_DATA_DIR)) {
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
}

// Helper to write data to public file
function saveToPublicFile(data) {
  try {
    fs.writeFileSync(CSGOBIG_DATA_FILE, JSON.stringify({
      ...data,
      _lastUpdate: new Date().toISOString()
    }, null, 2));
    console.log('✅ CSGOBig data saved to public file');
  } catch (error) {
    console.error('❌ Failed to save CSGOBig data to file:', error);
  }
}

// Check if cache is valid
function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.timestamp) return false;
  return (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

export default async function handler(req, res) {
  const { start_date, end_date, type, code, site = 'rain' } = req.query;
  
  try {
    const cacheEntry = platformCache[site];
    const cacheKey = `${site}_${start_date}_${end_date}_${code}`;
    
    // CSGOBig handling with file save
    if (site === 'csgobig') {
      // Return cached data if valid
      if (isCacheValid(cacheEntry) && cacheEntry.cacheKey === cacheKey) {
        console.log(`✅ Serving ${site} data from cache (age: ${Math.floor((Date.now() - cacheEntry.timestamp) / 1000)}s)`);
        return res.status(200).json(cacheEntry.data);
      }
      
      console.log(`🔄 Fetching fresh ${site} data...`);
      
      try {
        // Convert ISO dates to epoch MILLISECONDS (CSGOBig format)
        const fromEpoch = new Date(start_date).getTime();
        const toEpoch = new Date(end_date).getTime();
        
        const url = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
        console.log('CSGOBig API URL:', url);
        console.log('CSGOBig epoch times (milliseconds) - from:', fromEpoch, 'to:', toEpoch);
        
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
        
        // Update cache
        platformCache[site] = {
          data: responseData,
          timestamp: Date.now(),
          cacheKey: cacheKey,
          lastSuccessfulData: responseData
        };
        
        // Save to public file for frontend access
        saveToPublicFile(responseData);
        
        console.log(`✅ CSGOBig data cached (${results.length} users)`);
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        console.error('CSGOBig API error:', fetchError.message);
        
        if (cacheEntry && cacheEntry.lastSuccessfulData) {
          console.log('⚠️ Using CSGOBig fallback data');
          platformCache[site].timestamp = Date.now();
          platformCache[site].cacheKey = cacheKey;
          
          return res.status(200).json({
            ...cacheEntry.lastSuccessfulData,
            _fallback: true,
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        throw new Error(`CSGOBig API error: ${fetchError.message}`);
      }
    }
    
    // Return cached data if valid (for other sites)
    if (isCacheValid(cacheEntry) && cacheEntry.cacheKey === cacheKey) {
      console.log(`✅ Serving ${site} data from cache (age: ${Math.floor((Date.now() - cacheEntry.timestamp) / 1000)}s)`);
      return res.status(200).json(cacheEntry.data);
    }
    
    console.log(`🔄 Fetching fresh ${site} data...`);
    
    // Clash.gg handling
    if (site === 'clash') {
      try {
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
        
        // Update cache
        platformCache[site] = {
          data: responseData,
          timestamp: Date.now(),
          cacheKey: cacheKey,
          lastSuccessfulData: responseData
        };
        
        console.log(`✅ Clash.gg data cached (${results.length} users)`);
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        console.error('Clash.gg API error:', fetchError.message);
        
        if (cacheEntry && cacheEntry.lastSuccessfulData) {
          console.log('⚠️ Using Clash.gg fallback data');
          platformCache[site].timestamp = Date.now();
          platformCache[site].cacheKey = cacheKey;
          
          return res.status(200).json({
            ...cacheEntry.lastSuccessfulData,
            _fallback: true,
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        throw new Error(`Clash.gg API error: ${fetchError.message}`);
      }
    }
    
    // Rain.gg handling (default)
    try {
      const API_KEY = process.env.RAIN_API_KEY;
      const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
      
      const response = await fetch(url, {
        headers: { "x-api-key": API_KEY }
      });
      
      if (!response.ok) {
        throw new Error(`Rain.gg API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update cache
      platformCache[site] = {
        data: data,
        timestamp: Date.now(),
        cacheKey: cacheKey,
        lastSuccessfulData: data
      };
      
      console.log(`✅ Rain.gg data cached (${data.results?.length || 0} users)`);
      return res.status(200).json(data);
      
    } catch (fetchError) {
      console.error('Rain.gg API error:', fetchError.message);
      
      if (cacheEntry && cacheEntry.lastSuccessfulData) {
        console.log('⚠️ Using Rain.gg fallback data');
        platformCache[site].timestamp = Date.now();
        platformCache[site].cacheKey = cacheKey;
        
        return res.status(200).json({
          ...cacheEntry.lastSuccessfulData,
          _fallback: true,
          _message: 'Using cached data due to API unavailability'
        });
      }
      
      throw new Error(`Rain.gg API error: ${fetchError.message}`);
    }
    
    if (!response.ok) {
      throw new Error(`Rain.gg API returned ${response.status}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (e) {
    console.error('API Proxy Error:', e);
    res.status(500).json({ 
      error: "Proxy error", 
      details: e.toString(),
      site: req.query.site 
    });
  }
}