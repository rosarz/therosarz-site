import path from 'path';

// Use the same global cache as refresh endpoint
global.leaderboardCache = global.leaderboardCache || {
  rain: { data: null, timestamp: null },
  clash: { data: null, timestamp: null },
  csgobig: { data: null, timestamp: null }
};

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Endpoint tylko do odczytu dla użytkowników - serwuje statyczne pliki JSON
export default async function handler(req, res) {
  const { site = 'rain' } = req.query;
  
  try {
    const cacheEntry = global.leaderboardCache[site];
    
    // Check if cache exists and is fresh
    if (cacheEntry && cacheEntry.data && cacheEntry.timestamp) {
      const age = Date.now() - cacheEntry.timestamp;
      
      if (age < CACHE_TTL) {
        console.log(`✅ Serving ${site} from cache (${Math.floor(age / 1000)}s old)`);
        return res.status(200).json(cacheEntry.data);
      } else {
        console.log(`⚠️ ${site} cache expired (${Math.floor(age / 1000)}s old)`);
      }
    }
    
    // No cache or expired - return stale data if available, otherwise error
    if (cacheEntry && cacheEntry.data) {
      console.log(`⏰ Serving stale ${site} data - refresh needed`);
      return res.status(200).json({
        ...cacheEntry.data,
        _stale: true,
        _message: 'Data is outdated, refresh in progress'
      });
    }
    
    // No data at all
    return res.status(503).json({
      error: 'Service initializing',
      message: `No ${site} data available yet. Please wait for next refresh.`
    });
    
  } catch (e) {
    console.error('Leaderboard error:', e);
    res.status(500).json({ 
      error: "Internal error", 
      details: e.toString()
    });
  }
}