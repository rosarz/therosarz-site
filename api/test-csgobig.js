// // Prosty endpoint testowy dla CSGOBig - używa bezpośrednio timestampów

// const fetch = require('node-fetch');

// module.exports = async function handler(req, res) {
//   try {
//     // Używamy dokładnie tych samych wartości jak w działającym linku
//     const code = "ROSARZ8374JSDBJK384784983HDJSADBJHER";
//     const fromEpoch = 1759453200000; // 2025-10-03T01:00:00.00Z
//     const toEpoch = 1760662800000;   // 2025-10-17T01:00:00.00Z
    
//     // Bezpośrednie użycie URL z timestampami
//     const apiUrl = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
    
//     console.log('Testing direct CSGOBig API URL:', apiUrl);
    
//     // Wykonaj zapytanie bezpośrednio
//     const response = await fetch(apiUrl);
//     const status = response.status;
    
//     console.log('Response status:', status);
    
//     // Pobierz surową odpowiedź
//     const rawResponse = await response.text();
    
//     try {
//       // Spróbuj sparsować jako JSON
//       const data = JSON.parse(rawResponse);
      
//       // Zwróć diagnostykę i wynik
//       return res.status(200).json({
//         success: true,
//         request: {
//           url: apiUrl,
//           fromEpoch,
//           toEpoch
//         },
//         response: {
//           status,
//           success: data.success || false,
//           results_count: data.results?.length || 0
//         },
//         data: data
//       });
//     } catch (e) {
//       // Jeśli parsowanie nie powiodło się, zwróć surową odpowiedź
//       return res.status(200).json({
//         success: false,
//         request: { url: apiUrl },
//         response: { status },
//         raw_response: rawResponse.substring(0, 1000)
//       });
//     }
//   } catch (e) {
//     return res.status(500).json({
//       success: false,
//       error: e.message,
//       stack: process.env.NODE_ENV === 'production' ? null : e.stack
//     });
//   }
// };

