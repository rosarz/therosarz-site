module.exports = async function handler(req, res) {
  const SECRET_KEY = process.env.REFRESH_SECRET || 'change-this-secret';
  
  if (req.query.secret !== SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const results = {};
  const baseURL = `https://${req.headers.host}`;
  
  // 1. Refresh Rain.gg
  try {
    const response = await fetch(`${baseURL}/api/leaderboard?site=rain&start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&type=wagered&code=therosarz`);
    results.rain = response.ok ? 'OK' : `Failed: ${response.status}`;
  } catch (e) {
    results.rain = `ERROR: ${e.message}`;
  }
  
  // 2. Refresh Clash.gg
  try {
    const response = await fetch(`${baseURL}/api/leaderboard?site=clash`);
    results.clash = response.ok ? 'OK' : `Failed: ${response.status}`;
  } catch (e) {
    results.clash = `ERROR: ${e.message}`;
  }
  
  // 3. Refresh CSGOBig
  try {
    const response = await fetch(`${baseURL}/api/leaderboard?site=csgobig&start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&code=ROSARZ8374JSDBJK384784983HDJSADBJHER`);
    results.csgobig = response.ok ? 'OK' : `Failed: ${response.status}`;
  } catch (e) {
    results.csgobig = `ERROR: ${e.message}`;
  }
  
  res.status(200).json({
    message: 'Leaderboards refreshed (memory cache updated)',
    timestamp: new Date().toISOString(),
    results
  });
};
};
