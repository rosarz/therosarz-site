const fs = require('fs');
const path = require('path');

// Ścieżka do pliku z danymi CSGOBig
const csgobigFilePath = path.join(__dirname, 'data', 'csgobig-data.json');

async function refreshCSGOBigData() {
  try {
    console.log('🔄 Refreshing CSGOBig data...');

    // Daty dla bieżącego okresu
    const startDate = "2025-10-03T00:00:00.00Z";
    const endDate = "2025-10-17T23:59:59.99Z";
    const fromEpoch = new Date(startDate).getTime();
    const toEpoch = new Date(endDate).getTime();
    const code = "ROSARZ8374JSDBJK384784983HDJSADBJHER";
    
    const response = await fetch(`https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`);
    const csgobigData = await response.json();
    
    if (csgobigData.success && Array.isArray(csgobigData.results)) {
      // Przekształć dane do naszego formatu
      const results = csgobigData.results.map(user => ({
        username: (user.name || '').slice(0, 2) + '*'.repeat(6),
        wagered: parseFloat(user.wagerTotal || 0),
        avatar: user.img?.startsWith('http') ? user.img : `https://csgobig.com${user.img || '/assets/img/censored_avatar.png'}`
      })).sort((a, b) => b.wagered - a.wagered);
      
      const responseData = { results, prize_pool: "750$" };
      
      // Upewnij się, że katalog istnieje
      if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
      }
      
      // Zapisz dane z timestampem
      const saveData = {
        data: responseData,
        timestamp: Date.now()
      };
      
      fs.writeFileSync(csgobigFilePath, JSON.stringify(saveData, null, 2));
      console.log(`✅ Success! Saved ${results.length} users`);
    } else {
      console.error('❌ Invalid CSGOBig data:', csgobigData);
      if (!csgobigData.success && csgobigData.error) {
        console.error(`Error message: ${csgobigData.error}`);
      }
    }
  } catch (error) {
    console.error('❌ Error refreshing CSGOBig data:', error);
  }
}

// Uruchom odświeżanie
refreshCSGOBigData();

// Jeśli chcesz uruchamiać regularnie, możesz użyć:
// setInterval(refreshCSGOBigData, 16 * 60 * 1000); // Co 16 minut
