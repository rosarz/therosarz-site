// Simple in-memory cache
const platformCache = {
  rain: { data: null, timestamp: null, status: 'init' },
  clash: { data: null, timestamp: null, status: 'init' },
  csgobig: { data: null, timestamp: null, status: 'init' }
};

const fs = require('fs');
const path = require('path');

// Stałe czasowe dla cache
const CACHE_TTL = 20 * 60 * 1000; // 20 minut
const CSGOBIG_RATE_LIMIT = 15 * 60 * 1000; // 15 minut - limit API CSGOBig
const STALE_TTL = 60 * 60 * 1000; // 1 godzina - czas, przez który stare dane są akceptowalne

// Stałe timestampy dla CSGOBIG (zamiast konwersji dat)
const CSGOBIG_TIMESTAMPS = {
  current: {
    from: 1759453200000, // 2025-10-03T01:00:00.00Z w milisekundach
    to: 1760662800000    // 2025-10-17T01:00:00.00Z w milisekundach
  },
  previous: {
    from: 1758243600000, // 2025-09-19T00:00:00.00Z w milisekundach
    to: 1759471200000    // 2025-10-03T02:00:00.00Z w milisekundach
  }
};

// Ścieżki do plików cache
const DATA_DIR = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data');
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

    // Zapisz dane wraz z timestampem i formatem wersji
    const saveData = {
      data: data,
      timestamp: Date.now(),
      version: '1.1' // Dodanie wersji dla łatwiejszej migracji danych w przyszłości
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
        
        // Dodaj status do odczytanych danych
        if (fileData.data && !fileData.data.status) {
          fileData.data.status = 'from_file';
          fileData.data.cached_at = fileData.timestamp;
        }
        
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

// Nowa funkcja - sprawdzanie czy cache jest przestarzały, ale nadal używalny
function isCacheStale(cacheEntry) {
  if (!cacheEntry || !cacheEntry.timestamp) return false;
  const age = Date.now() - cacheEntry.timestamp;
  return age >= CACHE_TTL && age < STALE_TTL;
}

// Funkcja do ustalania nagłówków cache dla odpowiedzi
function setCacheHeaders(res, cacheEntry, site) {
  // Ustal czas wygaśnięcia cache
  const maxAge = CACHE_TTL / 1000; // konwersja na sekundy
  const staleWhileRevalidate = (STALE_TTL - CACHE_TTL) / 1000; // dodatkowy czas w sekundach

  // Ustaw nagłówki cache
  res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  
  // Dodaj ETag na podstawie timestampa dla konkretnego zasobu
  const etag = cacheEntry?.timestamp ? `"${site}-${cacheEntry.timestamp}"` : `"${site}-${Date.now()}"`;
  res.setHeader('ETag', etag);
  
  // Dodaj Last-Modified
  res.setHeader('Last-Modified', new Date(cacheEntry?.timestamp || Date.now()).toUTCString());
  
  return res;
}

/**
 * Ujednolicony format danych dla wszystkich platform
 * @param {Array} rawUsers - Surowe dane użytkowników z API
 * @param {string} platform - Nazwa platformy ('rain', 'clash', 'csgobig')
 * @returns {Array} Sformatowana lista użytkowników
 */
function formatUsers(rawUsers, platform) {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
    console.log(`❌ No users to format for ${platform}`);
    return [];
  }

  console.log(`⚙️ Formatting ${rawUsers.length} users for ${platform}`);

  return rawUsers.map((user, index) => {
    try {
      // Podstawowe dane
      let username = '', wagered = 0, avatar = '../bot.png';
      
      // Mapowanie specyficzne dla platformy
      if (platform === 'rain') {
        username = user.username || `User${index}`;
        wagered = parseFloat(user.wagered || 0);
        avatar = user.avatar || '../bot.png';
      } 
      else if (platform === 'clash') {
        username = user.username || user.name || `User${index}`;
        wagered = parseFloat(user.wagered || 0) / 100; // Convert from gem cents to gems
        avatar = user.avatar || user.avatarUrl || '../bot.png';
      } 
      else if (platform === 'csgobig') {
        username = user.name || `User${index}`;
        wagered = parseFloat(user.wagerTotal || 0);
        avatar = user.img || '../bot.png';
        
        // Fix relative paths in CSGOBig avatars
        if (avatar && !avatar.startsWith('http') && avatar.startsWith('/')) {
          avatar = `https://csgobig.com${avatar}`;
        }
      }

      // Anonimizacja nazw użytkowników
      if (username && username.length > 2) {
        username = username.slice(0, 2) + '*'.repeat(Math.min(6, username.length - 2));
      }

      return {
        username,
        wagered,
        avatar
      };
    } catch (error) {
      console.error(`❌ Error formatting user ${index}:`, error);
      return {
        username: `User${index}`,
        wagered: 0,
        avatar: '../bot.png'
      };
    }
  }).filter(Boolean).sort((a, b) => b.wagered - a.wagered);
}

/**
 * Główny handler dla API leaderboard
 */
module.exports = async function handler(req, res) {
  const { start_date, end_date, type, code, site = 'rain', period = 'current' } = req.query;
  
  // Konfiguracja nagłówków dla CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  try {
    const cacheEntry = platformCache[site];
    
    // Obsługa conditional requests i cache
    const ifNoneMatch = req.headers['if-none-match'];
    const etag = cacheEntry?.timestamp ? `"${site}-${cacheEntry.timestamp}"` : null;
    
    if (etag && ifNoneMatch === etag && isCacheValid(cacheEntry)) {
      console.log(`✅ 304 Not Modified for ${site}`);
      res.status(304).end();
      return;
    }
    
    // Return cached data if valid
    if (isCacheValid(cacheEntry)) {
      console.log(`✅ Cache hit for ${site} (age: ${Math.floor((Date.now() - cacheEntry.timestamp) / 1000)}s)`);
      setCacheHeaders(res, cacheEntry, site);
      return res.status(200).json(cacheEntry.data);
    }
    
    // Check if we have stale data we can use while fetching new data
    const isStale = isCacheStale(cacheEntry);
    if (isStale) {
      console.log(`⚠️ Stale cache hit for ${site} (age: ${Math.floor((Date.now() - cacheEntry.timestamp) / 1000 / 60)}m)`);
      // We'll return stale data at the end of the function if the fetch fails
    }
    
    console.log(`🔄 Fetching fresh ${site} data...`);
    
    // Standardowy format odpowiedzi dla wszystkich platform
    let responseData = {
      results: [],
      prize_pool: site === 'csgobig' ? "750$" : (site === 'clash' ? "500$" : "600$"),
      timestamp: Date.now(),
      status: 'fresh'
    };

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
      
      // Formatuj dane w jednolity sposób
      responseData.results = formatUsers(topPlayers, 'clash');
      responseData.prize_pool = "500$";
      
      platformCache[site] = { 
        data: responseData, 
        timestamp: Date.now(),
        status: 'fresh'
      };
      
      console.log(`✅ ${site} cached (${responseData.results.length} users)`);
      setCacheHeaders(res, platformCache[site], site);
      return res.status(200).json(responseData);
    }
    
    // CSGOBig - uproszczone użycie bezpośrednio timestampów
    if (site === 'csgobig') {
      // Użyj bezpośrednio stałych timestampów zamiast konwersji
      const { from: fromEpoch, to: toEpoch } = CSGOBIG_TIMESTAMPS[period === 'previous' ? 'previous' : 'current'];
      
      console.log('CSGOBig direct API call with timestamps:', {
        fromEpoch,
        toEpoch,
        code,
        period
      });
      
      // Sprawdź limit zapytań
      if (!canMakeCSGOBigRequest()) {
        // Obsługa pobierania danych z pliku jeśli rate limit
        console.log('🕒 CSGOBig rate limit in effect. Loading data from file...');
        const fileData = loadCsgobigDataFromFile();
        
        if (fileData) {
          // Dodaj metadane o źródle i czasie cache
          fileData.source = 'file_cache';
          fileData.cache_time = Date.now();
          
          // Zaktualizuj cache w pamięci
          platformCache[site] = { 
            data: fileData, 
            timestamp: Date.now(),
            status: 'from_file'
          };
          
          setCacheHeaders(res, platformCache[site], site);
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
          
          platformCache[site] = { data: emptyData, timestamp: Date.now(), status: 'error' };
          
          setCacheHeaders(res, platformCache[site], site);
          return res.status(200).json(emptyData);
        }
      }
      
      // Jeśli możemy wykonać żądanie, zapisz czas żądania
      saveLastRequestTime();
      
      try {
        // Bezpośrednie użycie timestampów w URL
        const apiUrl = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
        console.log('Using direct CSGOBig API URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        console.log('CSGOBig API response status:', response.status);
        
        // Parsowanie odpowiedzi
        const responseText = await response.text();
        console.log('CSGOBig API raw response preview:', responseText.substring(0, 100) + '...');
        
        let csgobigData;
        try {
          csgobigData = JSON.parse(responseText);
        } catch (jsonError) {
          console.error('Failed to parse CSGOBig API response as JSON:', jsonError);
          throw new Error('Invalid JSON response from CSGOBig API');
        }
        
        // Sprawdź czy API zwróciło success=true i ma tablicę results
        if (csgobigData.success && Array.isArray(csgobigData.results)) {
          console.log(`✅ CSGOBig API returned ${csgobigData.results.length} users`);
          
          // Formatuj dane
          responseData.results = formatUsers(csgobigData.results, 'csgobig');
          responseData.timestamp = Date.now();
          responseData.source = 'direct_api';
          
          // Zapisz w cache
          platformCache[site] = { 
            data: responseData, 
            timestamp: Date.now(),
            status: 'fresh'
          };
          
          // Zapisz kopię do pliku
          saveCsgobigDataToFile(responseData);
          
          console.log(`✅ ${site} cached (${responseData.results.length} users)`);
          setCacheHeaders(res, platformCache[site], site);
          return res.status(200).json(responseData);
        } else {
          console.error('❌ Invalid CSGOBig data format:', csgobigData);
          throw new Error('Invalid data format from CSGOBig API');
        }
      } catch (error) {
        // Obsługa błędów i fallbacki
        console.error(`❌ CSGOBig error:`, error.message);
        
        // Próbuj wczytać dane z pliku w przypadku jakiegokolwiek błędu
        const fileData = loadCsgobigDataFromFile();
        if (fileData) {
          // Dodaj metadane o źródle i czasie cache
          fileData.source = 'file_cache_after_error';
          fileData.cache_time = Date.now();
          
          platformCache[site] = { 
            data: fileData, 
            timestamp: Date.now(),
            status: 'from_file_after_error'
          };
          
          setCacheHeaders(res, platformCache[site], site);
          return res.status(200).json(fileData);
        }
        
        // Jeśli mamy stare dane w pamięci, użyjmy ich jako fallback
        if (isStale) {
          console.log(`⚠️ Using stale ${site} cache as fallback after API error`);
          cacheEntry.data.stale = true;
          cacheEntry.data.error = error.message;
          
          setCacheHeaders(res, { timestamp: cacheEntry.timestamp }, site);
          return res.status(200).json(cacheEntry.data);
        }
        
        // Zwróć pusty leaderboard jako ostateczny fallback
        const emptyData = { 
          results: [], 
          prize_pool: "750$",
          timestamp: Date.now(),
          status: "api_error_no_file_no_cache",
          error: error.message
        };
        
        platformCache[site] = { data: emptyData, timestamp: Date.now(), status: 'error' };
        
        setCacheHeaders(res, platformCache[site], site);
        return res.status(200).json(emptyData);
      }
    }
    
    // Rain.gg - domyślna opcja
    const API_KEY = process.env.RAIN_API_KEY;
    const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
    
    const response = await fetch(url, { headers: { "x-api-key": API_KEY } });
    const data = await response.json();
    
    // Rain.gg już zwraca dane w odpowiednim formacie
    platformCache[site] = { data, timestamp: Date.now(), status: 'fresh' };
    console.log(`✅ ${site} cached`);
    setCacheHeaders(res, platformCache[site], site);
    return res.status(200).json(data);
    
  } catch (e) {
    console.error(`❌ ${site} error:`, e.message);
    
    // Sprawdź czy mamy dane w cache
    const currentCache = platformCache[site];
    
    // Fallback to old cache if available
    if (currentCache && currentCache.data) {
      console.log(`⚠️ Using old ${site} cache as fallback`);
      currentCache.data.stale = true;
      currentCache.data.error = e.message;
      
      setCacheHeaders(res, { timestamp: currentCache.timestamp }, site);
      return res.status(200).json(currentCache.data);
    }
    
    // Jeśli to CSGOBig, spróbuj wczytać z pliku
    if (site === 'csgobig') {
      const fileData = loadCsgobigDataFromFile();
      if (fileData) {
        // Dodaj metadane o źródle i czasie cache
        fileData.source = 'file_cache_after_global_error';
        fileData.cache_time = Date.now();
        fileData.error = e.message;
        
        platformCache[site] = { 
          data: fileData, 
          timestamp: Date.now(),
          status: 'from_file_after_global_error'
        };
        
        setCacheHeaders(res, platformCache[site], site);
        return res.status(200).json(fileData);
      }
    }
    
    // Ostateczny fallback - pusta odpowiedź
    const fallbackData = { 
      error: "Failed", 
      details: e.toString(),
      results: [],
      prize_pool: site === 'csgobig' ? "750$" : (site === 'clash' ? "500$" : "600$"),
      status: 'global_error'
    };
    
    res.status(500).json(fallbackData);
  }
};