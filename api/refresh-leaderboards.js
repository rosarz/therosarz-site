export default async function handler(req, res) {
  const SECRET_KEY = process.env.REFRESH_SECRET || 'change-this-secret';
  
  // Simple auth - tylko z tym kluczem można odświeżyć
  if (req.query.secret !== SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const results = {};
  
  // 1. Refresh Rain.gg
  try {
    const API_KEY = process.env.RAIN_API_KEY;
    const response = await fetch(
      `https://api.rain.gg/v1/affiliates/leaderboard?start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&type=wagered&code=therosarz`,
      { headers: { "x-api-key": API_KEY } }
    );
    
    if (response.ok) {
      const data = await response.json();
      // Wywołaj endpoint leaderboard żeby zaktualizował cache
      await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/leaderboard?site=rain&start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&type=wagered&code=therosarz`);
      results.rain = `OK (${data.results?.length || 0} users)`;
    } else {
      results.rain = `FAILED: ${response.status}`;
    }
  } catch (e) {
    results.rain = `ERROR: ${e.message}`;
  }
  
  // 2. Refresh Clash.gg
  try {
    await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/leaderboard?site=clash`);
    results.clash = 'OK';
  } catch (e) {
    results.clash = `ERROR: ${e.message}`;
  }
  
  // 3. Refresh CSGOBig
  try {
    await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/leaderboard?site=csgobig&start_date=2025-10-03T00:00:00.00Z&end_date=2025-10-17T23:59:59.99Z&code=ROSARZ8374JSDBJK384784983HDJSADBJHER`);
    results.csgobig = 'OK';
  } catch (e) {
    results.csgobig = `ERROR: ${e.message}`;
  }
  
  res.status(200).json({
    message: 'Leaderboards refreshed',
    timestamp: new Date().toISOString(),
    results
  });
}
