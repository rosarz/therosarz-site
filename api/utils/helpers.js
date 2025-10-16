/**
 * Shared helper functions for API endpoints
 */

/**
 * Formats user data consistently across different platforms
 */
function formatUsers(rawUsers, platform) {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
    return [];
  }

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
      return {
        username: `User${index}`,
        wagered: 0,
        avatar: '../bot.png'
      };
    }
  }).filter(Boolean).sort((a, b) => b.wagered - a.wagered);
}

/**
 * CSGOBig timestamps for different periods
 */
const CSGOBIG_TIMESTAMPS = {
  current: {
    from: 1759453200000, // 2025-10-03T01:00:00.00Z in milliseconds
    to: 1760662800000    // 2025-10-17T01:00:00.00Z in milliseconds
  },
  previous: {
    from: 1758243600000, // 2025-09-19T00:00:00.00Z in milliseconds
    to: 1759471200000    // 2025-10-03T02:00:00.00Z in milliseconds
  }
};

module.exports = {
  formatUsers,
  CSGOBIG_TIMESTAMPS
};
module.exports = {
  formatUsers,
  CSGOBIG_TIMESTAMPS
};
