import { writeFile } from 'fs/promises';
import { join } from 'path';

const PLATFORMS = ['rain', 'clash', 'csgobig'];

// Konfiguracja platform
const platformConfigs = {
  rain: {
    startDate: "2025-10-03T00:00:00.00Z",
    endDate: "2025-10-17T23:59:59.99Z",
    code: "therosarz",
    name: "Rain.gg",
    prizePool: "600$",
    apiKey: process.env.RAIN_API_KEY
  },
  clash: {
    startDate: "2025-09-22T01:00:00.00Z",
    endDate: "2025-10-06T01:00:00.00Z",
    code: "THEROSARZ",
    name: "Clash.gg",
    prizePool: "500$",
    leaderboardId: 841,
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NTE1ODQzLCJpYXQiOjE3NTUwODU5NjUsImV4cCI6MTkxMjg3Mzk2NX0.oUwuZuACZfow58Pfr__MDfCJTqT1zLsROpyklFdZDIc'
  },
  csgobig: {
    startDate: "2025-10-03T00:00:00.00Z",
    endDate: "2025-10-17T23:59:59.99Z",
    code: "ROSARZ8374JSDBJK384784983HDJSADBJHER",
    name: "CSGOBig",
    prizePool: "750$"
  }
};

// In-memory cache shared across requests (works in warm instances)
global.leaderboardCache = global.leaderboardCache || {
  rain: { data: null, timestamp: null },
  clash: { data: null, timestamp: null },
  csgobig: { data: null, timestamp: null }
};

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function fetchRainData() {
  const API_KEY = process.env.RAIN_API_KEY;
  const response = await fetch(
    `https://api.rain.gg/v1/affiliates/leaderboard?start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&type=wagered&code=therosarz`,
    { headers: { "x-api-key": API_KEY } }
  );
  if (!response.ok) throw new Error(`Rain API: ${response.status}`);
  return await response.json();
}

async function fetchClashData() {
  const response = await fetch('https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api', {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NTE1ODQzLCJpYXQiOjE3NTUwODU5NjUsImV4cCI6MTkxMjg3Mzk2NX0.oUwuZuACZfow58Pfr__MDfCJTqT1zLsROpyklFdZDIc',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) throw new Error(`Clash API: ${response.status}`);
  const clashData = await response.json();
  
  let leaderboards = Array.isArray(clashData) ? clashData : [clashData];
  let targetLeaderboard = leaderboards.find(lb => lb.id === 841) || leaderboards[0];
  const topPlayers = targetLeaderboard?.topPlayers || [];
  
  const results = topPlayers.map(user => ({
    username: (() => {
      const username = user.username || user.name || '';
      const visible = username.slice(0, 2);
      const stars = '*'.repeat(Math.max(0, Math.min(6, username.length - 2)));
      return (visible + stars).slice(0, 8);
    })(),
    wagered: parseFloat(user.wagered || 0) / 100,
    avatar: user.avatar || user.avatarUrl || '../bot.png'
  })).sort((a, b) => b.wagered - a.wagered);
  
  return { results, prize_pool: "500$" };
}

async function fetchCSGOBigData() {
  const code = "ROSARZ8374JSDBJK384784983HDJSADBJHER";
  const fromEpoch = new Date("2025-10-03T00:00:00.00Z").getTime();
  const toEpoch = new Date("2025-10-17T23:59:59.99Z").getTime();
  
  const response = await fetch(
    `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`,
    { headers: { 'Accept': 'application/json' } }
  );
  
  if (!response.ok) throw new Error(`CSGOBig API: ${response.status}`);
  const csgobigData = await response.json();
  
  const results = (csgobigData.results || []).map(user => ({
    username: (() => {
      const username = user.name || '';
      const visible = username.slice(0, 2);
      const stars = '*'.repeat(Math.max(0, Math.min(6, username.length - 2)));
      return (visible + stars).slice(0, 8);
    })(),
    wagered: parseFloat(user.wagerTotal || 0),
    avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
  })).sort((a, b) => b.wagered - a.wagered);
  
  return { results, prize_pool: "750$" };
}

export default async function handler(req, res) {
  // Verify authorization
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'adwddqwdesdfasdfe';
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const results = { success: [], failed: [], timestamp: new Date().toISOString() };
  
  // Refresh Rain.gg
  try {
    const data = await fetchRainData();
    global.leaderboardCache.rain = { data, timestamp: Date.now() };
    results.success.push('rain');
    console.log('✅ Rain.gg data refreshed');
  } catch (error) {
    results.failed.push({ platform: 'rain', error: error.message });
    console.error('❌ Rain.gg refresh failed:', error);
  }
  
  // Refresh Clash.gg
  try {
    const data = await fetchClashData();
    global.leaderboardCache.clash = { data, timestamp: Date.now() };
    results.success.push('clash');
    console.log('✅ Clash.gg data refreshed');
  } catch (error) {
    results.failed.push({ platform: 'clash', error: error.message });
    console.error('❌ Clash.gg refresh failed:', error);
  }
  
  // Refresh CSGOBig
  try {
    const data = await fetchCSGOBigData();
    global.leaderboardCache.csgobig = { data, timestamp: Date.now() };
    results.success.push('csgobig');
    console.log('✅ CSGOBig data refreshed');
  } catch (error) {
    results.failed.push({ platform: 'csgobig', error: error.message });
    console.error('❌ CSGOBig refresh failed:', error);
  }
  
  res.status(200).json({
    message: 'Leaderboards refresh completed',
    ...results
  });
}
