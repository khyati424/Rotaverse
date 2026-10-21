const Business = require('../models/Business');

/**
 * Escape regular expression special characters
 */
const escapeRegex = (string) => {
  return string ? string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
};

/**
 * Format app-facing sector businessCount
 * e.g. "1 Business", "0 Businesses", "4 Businesses"
 */
const formatSectorBusinessCount = (count) => {
  const n = Number(count) || 0;
  return n === 1 ? '1 Business' : `${n} Businesses`;
};

/**
 * Format app-facing city businessCount
 * e.g. "4", "0"
 */
const formatCityBusinessCount = (count) => {
  const n = Number(count) || 0;
  return String(n);
};

/**
 * Get live business count per city in a single aggregate query
 * Returns Map<trimmedLowercaseCityName, count>
 */
const getCityBusinessCounts = async () => {
  const results = await Business.aggregate([
    {
      $project: {
        cityTrimmed: { $toLower: { $trim: { input: { $ifNull: ['$city', ''] } } } }
      }
    },
    {
      $group: {
        _id: '$cityTrimmed',
        count: { $sum: 1 }
      }
    }
  ]);

  const map = new Map();
  for (const item of results) {
    if (item._id) {
      map.set(item._id, item.count);
    }
  }
  return map;
};

/**
 * Get live business count for sectors within a specific city
 * Matches city ignoring case and surrounding spaces
 * Returns Map<trimmedLowercaseSectorName, count>
 */
const getSectorCountsForCity = async (cityName) => {
  if (!cityName) return new Map();

  const cityRegex = new RegExp(`^\\s*${escapeRegex(cityName.trim())}\\s*$`, 'i');
  const results = await Business.aggregate([
    {
      $match: {
        city: cityRegex
      }
    },
    {
      $project: {
        sectorTrimmed: { $toLower: { $trim: { input: { $ifNull: ['$sector', ''] } } } }
      }
    },
    {
      $group: {
        _id: '$sectorTrimmed',
        count: { $sum: 1 }
      }
    }
  ]);

  const map = new Map();
  for (const item of results) {
    if (item._id) {
      map.set(item._id, item.count);
    }
  }
  return map;
};

module.exports = {
  escapeRegex,
  formatSectorBusinessCount,
  formatCityBusinessCount,
  getCityBusinessCounts,
  getSectorCountsForCity
};
