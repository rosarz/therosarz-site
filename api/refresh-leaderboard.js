/**
 * Simple endpoint for refreshing the leaderboard data
 * This is designed to be triggered by Vercel cron jobs (but currently disabled)
 */

module.exports = async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Simple response with timestamp
    return res.status(200).json({
      success: true,
      message: 'Refresh endpoint is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
    const csgoUrl = `https://csgobig.com/api/partners/getRefDetails/${csgoCode}?from=${fromEpoch}&to=${toEpoch}`;
    const csgoResponse = await fetch(csgoUrl);
    const csgoData = await csgoResponse.json();
    
    // Log status but don't store data here - the normal API endpoint will handle caching

    return res.status(200).json({
      success: true,
      message: 'Leaderboard cache refreshed',
      timestamp: new Date().toISOString()
    });