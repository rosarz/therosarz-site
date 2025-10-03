import fs from 'fs';
import path from 'path';

// Cache file paths
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CSGOBIG_CACHE = path.join(CACHE_DIR, 'csgobig.json');
const CLASH_CACHE = path.join(CACHE_DIR, 'clash.json');
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Helper to read cache file
function readCache(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    }
  } catch (e) {
    console.error('Error reading cache:', e);
  }
  return null;
}

// Helper to write cache file
function writeCache(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify({
      data,
      timestamp: Date.now()
    }, null, 2));
  } catch (e) {
    console.error('Error writing cache:', e);
  }
}

// Check if cache is valid
function isCacheValid(cache) {
  if (!cache || !cache.timestamp) return false;
  return (Date.now() - cache.timestamp) < CACHE_TTL;
}

export default async function handler(req, res) {
  const { start_date, end_date, type, code, site } = req.query;
  
  try {
    // CSGOBig handling with file-based cache
    if (site === 'csgobig') {
      const cache = readCache(CSGOBIG_CACHE);
      
      // Return cached data if valid
      if (isCacheValid(cache)) {
        console.log('Serving CSGOBig data from file cache');
        return res.status(200).json(cache.data);
      }
      
      // Try to fetch fresh data
      try {
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
          prize_pool: "500$"
        };
        
        // Save to cache file
        writeCache(CSGOBIG_CACHE, responseData);
        console.log('CSGOBig data saved to cache file');
        
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        console.error('CSGOBig API fetch failed:', fetchError.message);
        
        // Return old cache data if available (even if expired)
        if (cache && cache.data) {
          console.log('Using expired CSGOBig cache as fallback');
          return res.status(200).json({
            ...cache.data,
            _fallback: true,
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        throw new Error(`CSGOBig API error and no cache available: ${fetchError.message}`);
      }
    }
    
    // Clash.gg handling with file-based cache
    if (site === 'clash') {
      const cache = readCache(CLASH_CACHE);
      
      // Return cached data if valid
      if (isCacheValid(cache)) {
        console.log('Serving Clash.gg data from file cache');
        return res.status(200).json(cache.data);
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
        
        // Transform data (simplified - extract topPlayers)
        let leaderboards = Array.isArray(clashData) ? clashData : [clashData];
        let targetLeaderboard = leaderboards.find(lb => lb.id === 841) || leaderboards[0];
        const topPlayers = targetLeaderboard.topPlayers || [];
        
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
        
        // Save to cache file
        writeCache(CLASH_CACHE, responseData);
        console.log('Clash.gg data saved to cache file');
        
        return res.status(200).json(responseData);
        
      } catch (fetchError) {
        console.error('Clash.gg API fetch failed:', fetchError.message);
        
        // Return old cache data if available
        if (cache && cache.data) {
          console.log('Using expired Clash.gg cache as fallback');
          return res.status(200).json({
            ...cache.data,
            _fallback: true,
            _message: 'Using cached data due to API unavailability'
          });
        }
        
        throw new Error(`Clash.gg API error and no cache available: ${fetchError.message}`);
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