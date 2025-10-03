export default async function handler(req, res) {
  const { start_date, end_date, code, site, type, skip_type } = req.query;
  const API_KEY = process.env.RAIN_API_KEY;
  
  try {
    if (site === 'csgobig') {
      console.log('🔵 CSGOBig API request detected');
      console.log('Parameters received:', { start_date, end_date, code, site, skip_type });
      
      // CSGOBig API call - NIE wysyłaj parametru 'type'
      const csgobigParams = new URLSearchParams();
      
      // Dodaj tylko parametry które CSGOBig potrzebuje
      if (start_date) csgobigParams.append('start_date', start_date);
      if (end_date) csgobigParams.append('end_date', end_date);
      if (code) csgobigParams.append('code', code);
      
      // ❌ NIGDY nie dodawaj 'type' dla CSGOBig
      // ❌ if (type) csgobigParams.append('type', type);
      
      const csgobigUrl = `https://csgobig.com/api/partners/leaderboard?${csgobigParams.toString()}`;
      console.log('Calling CSGOBig API:', csgobigUrl);
      console.log('Parameters being sent:', csgobigParams.toString());
      
      const csgobigResponse = await fetch(csgobigUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const csgobigData = await csgobigResponse.json();
      console.log('CSGOBig API response:', csgobigData);
      
      return res.json(csgobigData);
    } else {
      // Rain.gg lub inne - WYSYŁAJ parametr 'type'
      const params = new URLSearchParams();
      if (start_date) params.append('start_date', start_date);
      if (end_date) params.append('end_date', end_date);
      if (code) params.append('code', code);
      params.append('type', type || 'wagered'); // Domyślnie 'wagered'
      
      const response = await fetch(`https://rain.gg/api/leaderboard?${params.toString()}`);
      const data = await response.json();
      
      return res.json(data);
    }
  } catch (error) {
    console.error('Backend API error:', error);
    res.status(500).json({ error: error.message });
  }
}