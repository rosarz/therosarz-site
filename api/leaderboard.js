// Simple in-memory cache
const platformCache = {
  rain: { data: null, timestamp: null },
  clash: { data: null, timestamp: null },
  csgobig: { data: null, timestamp: null }
};

const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.timestamp) return false;
  return (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

module.exports = async function handler(req, res) {
  const { start_date, end_date, type, code, site = 'rain' } = req.query;
  
  try {
    const cacheEntry = platformCache[site];
    
    // Return cached data if valid
    if (isCacheValid(cacheEntry)) {
      console.log(`✅ Cache hit for ${site} (age: ${Math.floor((Date.now() - cacheEntry.timestamp) / 1000)}s)`);
      return res.status(200).json(cacheEntry.data);
    }
    
    console.log(`🔄 Fetching fresh ${site} data...`);
    
    // Clash.gg
    if (site === 'clash') {
      try {
        const response = await fetch('https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api', {
          headers: {
            'Authorization': 'Bearer TWOJ_NOWY_TOKEN_TUTAJ',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://clash.gg',
            'Referer': 'https://clash.gg/'
          }
        });
        
        // Log response details
        console.log('Clash.gg response status:', response.status);
        console.log('Clash.gg response headers:', [...response.headers.entries()]);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Clash.gg API error body:', errorText);
          
          // If we have old cache, use it as fallback
          if (cacheEntry && cacheEntry.data) {
            console.log('⚠️ Using old Clash.gg cache due to API error');
            return res.status(200).json({
              ...cacheEntry.data,
              _fallback: true,
              _message: `Using cached data - API returned ${response.status}`
            });
          }
          
          throw new Error(`Clash.gg API returned ${response.status}: ${errorText}`);
        }
        
        const clashData = await response.json();
        console.log('Clash.gg raw response:', JSON.stringify(clashData).substring(0, 500));
        
        // Handle different response structures safely
        let leaderboards = [];
        
        if (clashData && clashData.data && Array.isArray(clashData.data)) {
          leaderboards = clashData.data;
          console.log('✅ Found clashData.data array');
        } else if (Array.isArray(clashData)) {
          leaderboards = clashData;
          console.log('✅ clashData is array');
        } else if (clashData && typeof clashData === 'object') {
          leaderboards = [clashData];
          console.log('⚠️ Wrapped clashData in array');
        } else {
          console.error('❌ Unexpected Clash.gg response structure:', clashData);
          throw new Error('Invalid Clash.gg API response structure');
        }
        
        console.log('Clash.gg leaderboards count:', leaderboards.length);
        
        if (leaderboards.length === 0) {
          throw new Error('No leaderboards found in Clash.gg response');
        }
        
        let targetLeaderboard = leaderboards.find(lb => lb && (lb.id === 841 || lb.id === '841'));
        
        if (!targetLeaderboard) {
          console.log('⚠️ Leaderboard 841 not found, using first:', leaderboards[0]?.id);
          targetLeaderboard = leaderboards[0];
        }
        
        if (!targetLeaderboard) {
          throw new Error('No target leaderboard found');
        }
        
        console.log('Clash.gg target leaderboard ID:', targetLeaderboard.id);
        
        const topPlayers = targetLeaderboard.topPlayers || [];
        console.log('Clash.gg topPlayers count:', topPlayers.length);
        
        const results = topPlayers.map(user => ({
          username: (user.username || user.name || '').slice(0, 2) + '*'.repeat(6),
          wagered: parseFloat(user.wagered || 0) / 100,
          avatar: user.avatar || user.avatarUrl || '../bot.png'
        })).sort((a, b) => b.wagered - a.wagered);
        
        const responseData = { results, prize_pool: "500$" };
        platformCache[site] = { data: responseData, timestamp: Date.now() };
        console.log(`✅ Clash.gg cached (${results.length} users)`);
        return res.status(200).json(responseData);
        
      } catch (error) {
        console.error('❌ Clash.gg error details:', error.message);
        
        // Fallback to old cache if available
        if (cacheEntry && cacheEntry.data) {
          console.log(`⚠️ Using old Clash.gg cache as fallback`);
          return res.status(200).json({
            ...cacheEntry.data,
            _fallback: true,
            _message: 'Using cached data due to API error'
          });
        }
        
        throw error;
      }
    }
    
    // CSGOBig
    if (site === 'csgobig') {
      try {
        const fromEpoch = new Date(start_date).getTime();
        const toEpoch = new Date(end_date).getTime();
        
        const url = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
        console.log('CSGOBig API URL:', url);
        console.log('CSGOBig epoch times:', fromEpoch, 'to', toEpoch);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('CSGOBig API HTTP error:', response.status);
          throw new Error(`CSGOBig API returned ${response.status}`);
        }
        
        const csgobigData = await response.json();
        console.log('CSGOBig API response keys:', Object.keys(csgobigData));
        console.log('CSGOBig results count:', csgobigData.results?.length || 0);
        console.log('CSGOBig success:', csgobigData.success);
        
        if (!csgobigData.results || csgobigData.results.length === 0) {
          console.warn('⚠️ CSGOBig returned no results');
        }
        
        const results = (csgobigData.results || []).map(user => ({
          username: (user.name || '').slice(0, 2) + '*'.repeat(6),
          wagered: parseFloat(user.wagerTotal || 0),
          avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
        })).sort((a, b) => b.wagered - a.wagered);
        
        const responseData = { results, prize_pool: "750$" };
        platformCache[site] = { data: responseData, timestamp: Date.now() };
        console.log(`✅ CSGOBig cached (${results.length} users)`);
        return res.status(200).json(responseData);
        
      } catch (error) {
        console.error('❌ CSGOBig error details:', {
          message: error.message,
          stack: error.stack
        });
        throw error;
      }
    }
    
    // Rain.gg
    const API_KEY = process.env.RAIN_API_KEY;
    const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
    
    const response = await fetch(url, { headers: { "x-api-key": API_KEY } });
    const data = await response.json();
    
    platformCache[site] = { data, timestamp: Date.now() };
    console.log(`✅ ${site} cached`);
    return res.status(200).json(data);
    
  } catch (e) {
    console.error(`❌ ${site} error:`, e.message);
    
    // Get cacheEntry again (it's in scope here)
    const cacheEntry = platformCache[site];
    
    // Fallback to old cache if available
    if (cacheEntry && cacheEntry.data) {
      console.log(`⚠️ Using old ${site} cache as fallback`);
      return res.status(200).json({
        ...cacheEntry.data,
        _fallback: true,
        _message: 'Using cached data due to error'
      });
    }
    
    res.status(500).json({ error: "Failed", details: e.toString() });
  }
};