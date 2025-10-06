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

// Używaj /tmp dla środowisk serverless, lub data dla lokalnego rozwoju
const DATA_DIR = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data');

// Ścieżki do plików
const csgobigFilePath = path.join(DATA_DIR, 'csgobig-data.json');
const csgobigLastRequestPath = path.join(DATA_DIR, 'csgobig-last-request.json');

// Funkcja do zapewnienia, że katalog istnieje
function ensureDirectoryExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`✅ Created directory: ${DATA_DIR}`);
    }
    return true;
  } catch (e) {
    console.error(`❌ Error creating directory ${DATA_DIR}:`, e.message);
    return false;
  }
}

// Funkcja do zapisywania danych CSGOBig do pliku
function saveCsgobigDataToFile(data) {
  try {
    if (!ensureDirectoryExists()) return false;

    // Zapisz dane wraz z timestampem
    const saveData = {
      data: data,
      timestamp: Date.now()
    };
    fs.writeFileSync(csgobigFilePath, JSON.stringify(saveData, null, 2));
    console.log(`✅ CSGOBig data saved to file: ${csgobigFilePath}`);
    return true;
  } catch (e) {
    console.error('❌ Error saving CSGOBig data to file:', e.message);
    return false;
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
      } else {
        console.log('⚠️ CSGOBig data file exists but data is too old');
      }
    } else {
      console.log(`⚠️ CSGOBig data file not found: ${csgobigFilePath}`);
    }
    return null;
  } catch (e) {
    console.error('❌ Error loading CSGOBig data from file:', e.message);
    return null;
  }
}

// Funkcja do zapisywania czasu ostatniego żądania API CSGOBig
function saveLastRequestTime() {
  try {
    if (!ensureDirectoryExists()) return false;
    
    fs.writeFileSync(csgobigLastRequestPath, JSON.stringify({ timestamp: Date.now() }, null, 2));
    console.log('✅ CSGOBig last request time updated');
    return true;
  } catch (e) {
    console.error('❌ Error saving CSGOBig last request time:', e.message);
    return false;
  }
}

// Funkcja do sprawdzania, czy możemy wywołać API CSGOBig (czy minęło 15 minut)
function canMakeCSGOBigRequest() {
  try {
    if (fs.existsSync(csgobigLastRequestPath)) {
      const lastRequest = JSON.parse(fs.readFileSync(csgobigLastRequestPath, 'utf8'));
      const elapsed = Date.now() - lastRequest.timestamp;
      
      // Sprawdź czy minęło wystarczająco czasu od ostatniego żądania
      if (elapsed < CSGOBIG_RATE_LIMIT) {
        console.log(`⏳ CSGOBig rate limit: ${Math.floor((CSGOBIG_RATE_LIMIT - elapsed) / 1000)} seconds remaining`);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('❌ Error checking CSGOBig rate limit:', e.message);
    return true; // W przypadku błędu, pozwól na próbę wykonania żądania
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
      let targetLeaderboard = leaderboards.find(lb => lb.id === 939) || leaderboards[0];
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
      
      // Sprawdź, czy możemy wykonać żądanie do API CSGOBig
      if (!canMakeCSGOBigRequest()) {
        // Jeśli nie możemy wykonać żądania (rate limit), wczytaj dane z pliku
        console.log('🕒 CSGOBig rate limit in effect. Loading data from file...');
        const fileData = loadCsgobigDataFromFile();
        
        if (fileData) {
          platformCache[site] = { data: fileData, timestamp: Date.now() };
          return res.status(200).json(fileData);
        } else {
          console.log('❌ No file data available for CSGOBig');
          
          // Zwróć pusty leaderboard jako fallback
          const emptyData = { 
            results: [], 
            prize_pool: "750$",
            timestamp: Date.now(),
            status: "rate_limited_no_file" 
          };
          
          platformCache[site] = { data: emptyData, timestamp: Date.now() };
          return res.status(200).json(emptyData);
        }
      }
      
      // Jeśli możemy wykonać żądanie, zapisz czas żądania
      saveLastRequestTime();
      
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
            console.log('❌ No file data available for CSGOBig after rate limit');
            
            // Zwróć pusty leaderboard jako fallback
            const emptyData = { 
              results: [], 
              prize_pool: "750$",
              timestamp: Date.now(),
              status: "rate_limited_no_file" 
            };
            
            platformCache[site] = { data: emptyData, timestamp: Date.now() };
            return res.status(200).json(emptyData);
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
        
        // Zwróć pusty leaderboard jako ostateczny fallback
        const emptyData = { 
          results: [], 
          prize_pool: "750$",
          timestamp: Date.now(),
          status: "api_error_no_file" 
        };
        
        platformCache[site] = { data: emptyData, timestamp: Date.now() };
        return res.status(200).json(emptyData);
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
    
    // Sprawdź czy mamy dane w cache
    const currentCache = platformCache[site];
    
    // Fallback to old cache if available
    if (currentCache && currentCache.data) {
      console.log(`⚠️ Using old ${site} cache as fallback`);
      return res.status(200).json(currentCache.data);
    }
    
    // Jeśli to CSGOBig, spróbuj wczytać z pliku
    if (site === 'csgobig') {
      const fileData = loadCsgobigDataFromFile();
      if (fileData) {
        return res.status(200).json(fileData);
      }
    }
    
    // Ostateczny fallback - pusta odpowiedź
    res.status(500).json({ 
      error: "Failed", 
      details: e.toString(),
      results: [],
      prize_pool: site === 'csgobig' ? "750$" : (site === 'clash' ? "500$" : "600$")
    });
  }
};