// Plik pomocniczy do testowania połączenia z CSGOBig API

const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  try {
    console.log('=== TEST CSGOBIG API ===');
    
    const code = "ROSARZ8374JSDBJK384784983HDJSADBJHER";
    const startDate = "2025-10-03T01:00:00.00Z";
    const endDate = "2025-10-17T01:00:00.00Z";
    
    // Konwersja dat na timestampy
    const fromEpoch = new Date(startDate).getTime();
    const toEpoch = new Date(endDate).getTime();
    
    console.log('Request parameters:', {
      code,
      startDate,
      endDate,
      fromEpoch,
      toEpoch
    });
    
    // Tworzymy URL do API CSGOBig
    const apiUrl = `https://csgobig.com/api/partners/getRefDetails/${code}?from=${fromEpoch}&to=${toEpoch}`;
    console.log('CSGOBig API URL:', apiUrl);
    
    // Wykonujemy zapytanie
    const response = await fetch(apiUrl);
    const status = response.status;
    const headers = Object.fromEntries(response.headers.entries());
    
    console.log('Response status:', status);
    console.log('Response headers:', headers);
    
    // Pobieramy treść odpowiedzi
    const responseText = await response.text();
    console.log('Raw response preview:', responseText.substring(0, 200) + '...');
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Response parsed successfully');
      console.log('Success flag:', data.success);
      console.log('Results count:', data.results?.length || 0);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
    }
    
    // Zwróć szczegółowe informacje diagnostyczne
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      test_parameters: {
        code,
        start_date: startDate,
        end_date: endDate,
        from_epoch: fromEpoch,
        to_epoch: toEpoch,
        api_url: apiUrl
      },
      response: {
        status,
        content_type: headers['content-type'],
        success: data?.success || false,
        results_count: data?.results?.length || 0,
        sample_users: data?.results?.slice(0, 3) || []
      },
      full_response: data || responseText.substring(0, 1000)
    });
  } catch (e) {
    console.error('❌ Test failed:', e);
    return res.status(500).json({
      error: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};
      stack: e.stack
    });
  }
};
