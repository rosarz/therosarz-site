/**
 * API endpoint for refreshing leaderboard data periodically
 * This is used by Vercel's cron job scheduler
 */

const { formatUsers } = require('./utils/helpers');

module.exports = async function handler(req, res) {
  // Only allow Vercel cron jobs to trigger this endpoint
  const isCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isCron && process.env.NODE_ENV === 'production') {
    return res.status(401).json({
      error: 'Unauthorized. This endpoint is only for Vercel cron jobs.'
    });
  }

  try {
    console.log('🔄 Refreshing leaderboard cache...');
    
    // Refresh CSGOBig data
    const csgoCode = "ROSARZ8374JSDBJK384784983HDJSADBJHER";
    const fromEpoch = 1759453200000;
    const toEpoch = 1760662800000;

    const csgoUrl = `https://csgobig.com/api/partners/getRefDetails/${csgoCode}?from=${fromEpoch}&to=${toEpoch}`;
    const csgoResponse = await fetch(csgoUrl);
    const csgoData = await csgoResponse.json();
    
    // Log status but don't store data here - the normal API endpoint will handle caching

    return res.status(200).json({
      success: true,
      message: 'Leaderboard cache refreshed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error refreshing cache:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
