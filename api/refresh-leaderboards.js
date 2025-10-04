module.exports = async function handler(req, res) {
  const SECRET_KEY = process.env.REFRESH_SECRET || 'change-this-secret';
  
  // Simple auth - tylko z tym kluczem można odświeżyć
  if (req.query.secret !== SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const results = {};
  const baseURL = `https://${req.headers.host}`; // Dodaj https://
  
  // 1. Refresh Rain.gg
  try {
    await fetch(`${baseURL}/api/leaderboard?site=rain&start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&type=wagered&code=therosarz`);
    results.rain = 'OK';
  } catch (e) {
    results.rain = `ERROR: ${e.message}`;
  }
  
  // 2. Refresh Clash.gg
  try {
    await fetch(`${baseURL}/api/leaderboard?site=clash`);
    results.clash = 'OK';
  } catch (e) {
    results.clash = `ERROR: ${e.message}`;
  }
  
  // 3. Refresh CSGOBig
  try {
    await fetch(`${baseURL}/api/leaderboard?site=csgobig&start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&code=ROSARZ8374JSDBJK384784983HDJSADBJHER`);
    results.csgobig = 'OK';
  } catch (e) {
    results.csgobig = `ERROR: ${e.message}`;
  }
  
  res.status(200).json({
    message: 'Leaderboards refreshed',
    timestamp: new Date().toISOString(),
    results
  });
};
