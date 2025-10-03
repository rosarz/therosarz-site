export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { start_date, end_date, code, site, type, skip_type } = req.query;

  try {
    console.log('🔵 Vercel Function called with params:', { start_date, end_date, code, site, type, skip_type });

    if (site === 'csgobig') {
      console.log('🟠 CSGOBig request detected - NOT sending type parameter');
      
      // CSGOBig API endpoint - używamy prawdziwego endpoint-a
      const csgobigUrl = `https://csgobig.com/api/partners/getRefDetails/${code}`;
      
      console.log('📡 Calling CSGOBig API:', csgobigUrl);
      console.log('📋 With code:', code);
      
      const csgobigResponse = await fetch(csgobigUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log('📥 CSGOBig response status:', csgobigResponse.status);
      
      const csgobigData = await csgobigResponse.json();
      console.log('📦 CSGOBig data:', JSON.stringify(csgobigData).substring(0, 200));

      return res.status(200).json(csgobigData);
      
    } else if (site === 'rain' || !site) {
      console.log('🟢 Rain.gg request - sending type parameter');
      
      // Rain.gg API
      const rainUrl = `https://rain.gg/api/affiliates/leaderboard`;
      const params = new URLSearchParams({
        start_date,
        end_date,
        code,
        type: type || 'wagered'
      });

      console.log('📡 Calling Rain.gg API:', `${rainUrl}?${params.toString()}`);

      const rainResponse = await fetch(`${rainUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const rainData = await rainResponse.json();
      console.log('📦 Rain.gg data received');

      return res.status(200).json(rainData);
      
    } else {
      console.log('⚠️ Unknown site:', site);
      return res.status(400).json({ 
        error: 'Unknown site', 
        message: `Site "${site}" is not supported. Use "rain" or "csgobig"` 
      });
    }

  } catch (error) {
    console.error('❌ Vercel Function error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}