// const fetch = require('node-fetch');

// // Funkcja do odświeżania cache dla danej platformy
// module.exports = async function handler(req, res) {
//   const { site = 'all' } = req.query;
  
//   try {
//     console.log(`🔄 Ręczne odświeżanie cache dla ${site}`);

//     // Konfiguracja parametrów dla różnych platform
//     const configs = {
//       rain: {
//         startDate: "2025-10-03T00:00:00.00Z",
//         endDate: "2025-10-17T23:59:59.99Z", 
//         code: "therosarz",
//         type: "wagered"
//       },
//       clash: {
//         startDate: "2025-10-06T01:00:00.00Z",
//         endDate: "2025-10-20T01:00:00.00Z", 
//         code: "THEROSARZ",
//         type: "wagered"
//       },
//       csgobig: {
//         startDate: "2025-10-03T00:00:00.00Z",
//         endDate: "2025-10-17T02:00:00.00Z",
//         code: "ROSARZ8374JSDBJK384784983HDJSADBJHER",
//         type: "wagered"
//       }
//     };

//     // Określ platformy do odświeżenia
//     const sitesToRefresh = site === 'all' ? Object.keys(configs) : [site];
//     const results = {};

//     // Wykonaj żądania dla każdej platformy
//     for (const currentSite of sitesToRefresh) {
//       if (configs[currentSite]) {
//         const config = configs[currentSite];
//         const url = `/api/leaderboard?start_date=${config.startDate}&end_date=${config.endDate}&type=${config.type}&code=${config.code}&site=${currentSite}&refresh=true`;
        
//         console.log(`Odświeżanie ${currentSite}: ${url}`);
        
//         const hostname = process.env.VERCEL_URL || 'localhost:3000';
//         const protocol = process.env.VERCEL_URL ? 'https' : 'http';
        
//         try {
//           const response = await fetch(`${protocol}://${hostname}${url}`, {
//             headers: {
//               'Cache-Control': 'no-cache',
//               'x-refresh-cache': 'true'
//             }
//           });
          
//           results[currentSite] = {
//             status: response.status,
//             ok: response.ok,
//             timestamp: new Date().toISOString()
//           };
          
//           console.log(`✅ Cache odświeżony dla ${currentSite}: ${response.status}`);
//         } catch (error) {
//           console.error(`❌ Błąd odświeżania ${currentSite}:`, error.message);
//           results[currentSite] = { error: error.message, timestamp: new Date().toISOString() };
//         }
//       }
//     }

//     res.status(200).json({
//       message: `Cache odświeżony dla ${sitesToRefresh.join(', ')}`,
//       results,
//       timestamp: new Date().toISOString()
//     });
//   } catch (e) {
//     console.error('❌ Błąd odświeżania cache:', e.message);
//     res.status(500).json({ error: e.message });
//   }
// };
