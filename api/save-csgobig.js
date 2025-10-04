const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  const SECRET_KEY = process.env.REFRESH_SECRET || 'change-this-secret';
  
  // Simple auth
  if (req.query.secret !== SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // CSGOBig dates
    const fromEpoch = new Date('2025-10-03T00:00:00.00Z').getTime();
    const toEpoch = new Date('2025-10-17T23:59:59.99Z').getTime();
    const code = 'ROSARZ8374JSDBJK384784983HDJSADBJHER';
    
    const url = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
    
    console.log('Fetching CSGOBig data from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`CSGOBig API returned ${response.status}`);
    }
    
    const csgobigData = await response.json();
    
    // Transform data
    const results = (csgobigData.results || []).map(user => ({
      username: (user.name || '').slice(0, 2) + '*'.repeat(6),
      wagered: parseFloat(user.wagerTotal || 0),
      avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
    })).sort((a, b) => b.wagered - a.wagered);
    
    const output = {
      results,
      prize_pool: "750$",
      _lastUpdate: new Date().toISOString(),
      _nextUpdate: new Date(Date.now() + 20 * 60 * 1000).toISOString()
    };
    
    // Save to public folder
    const publicDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const filePath = path.join(publicDir, 'csgobig-leaderboard.json');
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    
    console.log(`✅ CSGOBig data saved to ${filePath}`);
    
    res.status(200).json({
      message: 'CSGOBig data saved successfully',
      count: results.length,
      lastUpdate: output._lastUpdate,
      nextUpdate: output._nextUpdate
    });
    
  } catch (e) {
    console.error('Error saving CSGOBig data:', e);
    res.status(500).json({ 
      error: 'Failed to save CSGOBig data', 
      details: e.message 
    });
  }
};
