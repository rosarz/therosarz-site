import { put } from '@vercel/blob';

export default async function handler(req, res) {
  const SECRET = process.env.UPDATE_SECRET || 'your-secret-key';
  
  // Simple auth
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const results = {};
  
  // Update Rain.gg
  try {
    const API_KEY = process.env.RAIN_API_KEY;
    const response = await fetch(`https://api.rain.gg/v1/affiliates/leaderboard?start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&type=wagered&code=therosarz`, {
      headers: { "x-api-key": API_KEY }
    });
    const data = await response.json();
    
    await put('rain-leaderboard.json', JSON.stringify({ ...data, _updated: new Date().toISOString() }), {
      access: 'public',
      contentType: 'application/json'
    });
    
    results.rain = 'OK';
  } catch (e) {
    results.rain = 'FAILED: ' + e.message;
  }
  
  // Update Clash.gg
  try {
    const response = await fetch('https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NTE1ODQzLCJpYXQiOjE3NTUwODU5NjUsImV4cCI6MTkxMjg3Mzk2NX0.oUwuZuACZfow58Pfr__MDfCJTqT1zLsROpyklFdZDIc',
        'Accept': 'application/json'
      }
    });
    
    const clashData = await response.json();
    let leaderboards = Array.isArray(clashData.data) ? clashData.data : [clashData];
    let targetLeaderboard = leaderboards.find(lb => lb.id === 841) || leaderboards[0];
    const topPlayers = targetLeaderboard?.topPlayers || [];
    
    const results_clash = topPlayers.map(user => ({
      username: (user.username || user.name || '').slice(0, 2) + '*'.repeat(6),
      wagered: parseFloat(user.wagered || 0) / 100,
      avatar: user.avatar || user.avatarUrl || '../bot.png'
    })).sort((a, b) => b.wagered - a.wagered);
    
    await put('clash-leaderboard.json', JSON.stringify({ 
      results: results_clash, 
      prize_pool: "500$",
      _updated: new Date().toISOString()
    }), {
      access: 'public',
      contentType: 'application/json'
    });
    
    results.clash = 'OK';
  } catch (e) {
    results.clash = 'FAILED: ' + e.message;
  }
  
  // Update CSGOBig
  try {
    const fromEpoch = new Date('2025-10-03T00:00:00.00Z').getTime();
    const toEpoch = new Date('2025-10-17T23:59:59.99Z').getTime();
    
    const response = await fetch(`https://csgobig.com/api/partners/getRefDetails/ROSARZ8374JSDBJK384784983HDJSADBJHER?from=${fromEpoch}&to=${toEpoch}`);
    const csgobigData = await response.json();
    
    const results_csgobig = (csgobigData.results || []).map(user => ({
      username: (user.name || '').slice(0, 2) + '*'.repeat(6),
      wagered: parseFloat(user.wagerTotal || 0),
      avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
    })).sort((a, b) => b.wagered - a.wagered);
    
    await put('csgobig-leaderboard.json', JSON.stringify({ 
      results: results_csgobig, 
      prize_pool: "750$",
      _updated: new Date().toISOString()
    }), {
      access: 'public',
      contentType: 'application/json'
    });
    
    results.csgobig = 'OK';
  } catch (e) {
    results.csgobig = 'FAILED: ' + e.message;
  }
  
  res.status(200).json({
    message: 'Cache updated',
    results,
    timestamp: new Date().toISOString()
  });
}
