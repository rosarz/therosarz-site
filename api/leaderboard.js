import path from 'path';
import fs from 'fs';

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

export default async function handler(req, res) {
  const { start_date, end_date, type, code, site = 'rain' } = req.query;
  
  try {
    const cacheEntry = platformCache[site];
    
    // Return cached data if valid
    if (isCacheValid(cacheEntry)) {
      console.log(`✅ Cache hit for ${site}`);
      return res.status(200).json(cacheEntry.data);
    }
    
    console.log(`🔄 Fetching ${site} data...`);
    
    // Clash.gg
    if (site === 'clash') {
      const response = await fetch('https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api', {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NTE1ODQzLCJpYXQiOjE3NTUwODU5NjUsImV4cCI6MTkxMjg3Mzk2NX0.oUwuZuACZfow58Pfr__MDfCJTqT1zLsROpyklFdZDIc',
          'Accept': 'application/json'
        }
      });
      
      const clashData = await response.json();
      let leaderboards = Array.isArray(clashData) ? clashData : [clashData];
      let targetLeaderboard = leaderboards.find(lb => lb.id === 841) || leaderboards[0];
      const topPlayers = targetLeaderboard?.topPlayers || [];
      
      const results = topPlayers.map(user => ({
        username: (user.username || '').slice(0, 2) + '*'.repeat(6),
        wagered: parseFloat(user.wagered || 0) / 100,
        avatar: user.avatar || user.avatarUrl || '../bot.png'
      })).sort((a, b) => b.wagered - a.wagered);
      
      const responseData = { results, prize_pool: "500$" };
      platformCache[site] = { data: responseData, timestamp: Date.now() };
      return res.status(200).json(responseData);
    }
    
    // CSGOBig
    if (site === 'csgobig') {
      const fromEpoch = new Date(start_date).getTime();
      const toEpoch = new Date(end_date).getTime();
      
      const response = await fetch(`https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`);
      const csgobigData = await response.json();
      
      const results = (csgobigData.results || []).map(user => ({
        username: (user.name || '').slice(0, 2) + '*'.repeat(6),
        wagered: parseFloat(user.wagerTotal || 0),
        avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
      })).sort((a, b) => b.wagered - a.wagered);
      
      const responseData = { results, prize_pool: "750$" };
      platformCache[site] = { data: responseData, timestamp: Date.now() };
      return res.status(200).json(responseData);
    }
    
    // Rain.gg
    const API_KEY = process.env.RAIN_API_KEY;
    const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
    
    const response = await fetch(url, { headers: { "x-api-key": API_KEY } });
    const data = await response.json();
    
    platformCache[site] = { data, timestamp: Date.now() };
    return res.status(200).json(data);
    
  } catch (e) {
    console.error('Error:', e);
    
    // Fallback to old cache if available
    if (cacheEntry && cacheEntry.data) {
      console.log(`⚠️ Using old ${site} cache`);
      return res.status(200).json(cacheEntry.data);
    }
    
    res.status(500).json({ error: "Failed", details: e.toString() });
  }
}