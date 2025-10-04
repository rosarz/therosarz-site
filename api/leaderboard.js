// Simple in-memory cache
const platformCache = {
  rain: { data: null, timestamp: null },
  clash: { data: null, timestamp: null },
  csgobig: { data: null, timestamp: null }
};

const fs = require('fs');
const path = require('path');

const CACHE_TTL = 20 * 60 * 1000; // 20 minut
const CSGOBIG_RATE_LIMIT = 15 * 60 * 1000; // 15 minut - limit API CSGOBig

// Ścieżka do pliku z danymi CSGOBig
const csgobigFilePath = path.join(process.cwd(), 'data', 'csgobig-data.json');

// Funkcja do zapisywania danych CSGOBig do pliku
function saveCsgobigDataToFile(data) {
  try {
    // Upewnij się, że katalog data istnieje
    if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
      fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
    }

    // Zapisz dane wraz z timestampem
    const saveData = {
      data: data,
      timestamp: Date.now()
    };
    fs.writeFileSync(csgobigFilePath, JSON.stringify(saveData, null, 2));
    console.log('✅ CSGOBig data saved to file');
  } catch (e) {
    console.error('❌ Error saving CSGOBig data to file:', e.message);
  }
}

// Funkcja do odczytu danych CSGOBig z pliku
function loadCsgobigDataFromFile() {
  try {
    if (fs.existsSync(csgobigFilePath)) {
      const fileData = JSON.parse(fs.readFileSync(csgobigFilePath, 'utf8'));
      
      // Sprawdź czy dane nie są zbyt stare (starsze niż 24h)
      const maxAge = 24 * 60 * 60 * 1000; // 24 godziny
      if (fileData && fileData.timestamp && (Date.now() - fileData.timestamp) < maxAge) {
        console.log(`📂 Loaded CSGOBig data from file (age: ${Math.floor((Date.now() - fileData.timestamp) / 1000 / 60)} minutes)`);
        return fileData.data;
      }
    }
    return null;
  } catch (e) {
    console.error('❌ Error loading CSGOBig data from file:', e.message);
    return null;
  }
}

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
      const response = await fetch('https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api', {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NTE1ODQzLCJpYXQiOjE3NTUwODU5NjUsImV4cCI6MTkxMjg3Mzk2NX0.oUwuZuACZfow58Pfr__MDfCJTqT1zLsROpyklFdZDIc',
          'Accept': 'application/json'
        }
      });
      
      const clashData = await response.json();
      let leaderboards = Array.isArray(clashData.data) ? clashData.data : (Array.isArray(clashData) ? clashData : [clashData]);
      let targetLeaderboard = leaderboards.find(lb => lb.id === 841) || leaderboards[0];
      const topPlayers = targetLeaderboard?.topPlayers || [];
      
      const results = topPlayers.map(user => ({
        username: (user.username || user.name || '').slice(0, 2) + '*'.repeat(6),
        wagered: parseFloat(user.wagered || 0) / 100,
        avatar: user.avatar || user.avatarUrl || '../bot.png'
      })).sort((a, b) => b.wagered - a.wagered);
      
      const responseData = { results, prize_pool: "500$" };
      platformCache[site] = { data: responseData, timestamp: Date.now() };
      console.log(`✅ ${site} cached (${results.length} users)`);
      return res.status(200).json(responseData);
    }
    
    // CSGOBig
    if (site === 'csgobig') {
      const fromEpoch = new Date(start_date).getTime();
      const toEpoch = new Date(end_date).getTime();
      
      try {
        const response = await fetch(`https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`);
        const csgobigData = await response.json();
        
        // Sprawdź czy nie otrzymaliśmy błędu o limicie zapytań
        if (!csgobigData.success && csgobigData.error && csgobigData.error.includes('Rate limit exceeded')) {
          console.log('⚠️ CSGOBig rate limit exceeded. Trying to load from file...');
          
          // Próbuj wczytać dane z pliku
          const fileData = loadCsgobigDataFromFile();
          if (fileData) {
            platformCache[site] = { data: fileData, timestamp: Date.now() };
            return res.status(200).json(fileData);
          } else {
            throw new Error('Rate limit exceeded and no cached data available');
          }
        }
        
        // Przetwórz dane, jeśli zapytanie się powiodło
        if (csgobigData.success && Array.isArray(csgobigData.results)) {
          const results = csgobigData.results.map(user => ({
            username: (user.name || '').slice(0, 2) + '*'.repeat(6),
            wagered: parseFloat(user.wagerTotal || 0),
            avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
          })).sort((a, b) => b.wagered - a.wagered);
          
          const responseData = { results, prize_pool: "750$" };
          
          // Zapisz w cache
          platformCache[site] = { data: responseData, timestamp: Date.now() };
          
          // Zapisz do pliku na dysku
          saveCsgobigDataToFile(responseData);
          
          console.log(`✅ ${site} cached (${results.length} users)`);
          return res.status(200).json(responseData);
        } else {
          console.error('❌ Invalid CSGOBig data format:', csgobigData);
          throw new Error('Invalid data format from CSGOBig API');
        }
      } catch (error) {
        console.error(`❌ CSGOBig error:`, error.message);
        
        // Próbuj wczytać dane z pliku w przypadku jakiegokolwiek błędu
        const fileData = loadCsgobigDataFromFile();
        if (fileData) {
          platformCache[site] = { data: fileData, timestamp: Date.now() };
          return res.status(200).json(fileData);
        }
        
        throw error; // Re-throw jeśli nie ma danych w pliku
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
    
    // Fallback to old cache if available
    if (cacheEntry && cacheEntry.data) {
      console.log(`⚠️ Using old ${site} cache as fallback`);
      return res.status(200).json(cacheEntry.data);
    }
    
    res.status(500).json({ error: "Failed", details: e.toString() });
  }
};