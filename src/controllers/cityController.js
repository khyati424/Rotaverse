const City = require('../models/City');
const Sector = require('../models/Sector');
const { sendSuccess } = require('../utils/responseHelper');
const { citiesInStatesFilter } = require('../utils/access');
const {
  formatCityBusinessCount,
  formatSectorBusinessCount,
  getCityBusinessCounts,
  getSectorCountsForCity
} = require('../utils/businessCountHelper');

/**
 * @desc    Get all administrative cities with live business count label
 * @route   GET /api/v1/cities
 * @access  Public
 */
const getCities = async (req, res, next) => {
  try {
    const { search, state } = req.query;

    const filter = {};
    if (state) {
      // Includes border cities that are also under this state (City.otherStates).
      Object.assign(filter, citiesInStatesFilter([state]));
    }
    if (search) {
      filter.name = new RegExp(search.trim(), 'i');
    }

    const cities = await City.find(filter).sort({ name: 1 });
    const cityCountMap = await getCityBusinessCounts();

    const formatted = cities.map((c) => {
      const obj = c.toJSON();
      const count = cityCountMap.get(c.name.trim().toLowerCase()) || 0;
      obj.businessCount = formatCityBusinessCount(count);
      return obj;
    });

    return sendSuccess(res, formatted, 'Cities retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get sectors within a city with live business count label
 * @route   GET /api/v1/cities/:cityId/sectors
 * @access  Public
 */
const getCitySectors = async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const { search } = req.query;

    const filter = { cityId: cityId.toLowerCase() };
    if (search) {
      filter.name = new RegExp(search.trim(), 'i');
    }

    const sectors = await Sector.find(filter).sort({ name: 1 });
    const city = await City.findOne({ id: cityId.toLowerCase() });
    const cityName = city ? city.name : cityId;
    const sectorCountMap = await getSectorCountsForCity(cityName);

    const formatted = sectors.map((s) => {
      const obj = s.toJSON();
      const count = sectorCountMap.get(s.name.trim().toLowerCase()) || 0;
      obj.businessCount = formatSectorBusinessCount(count);
      return obj;
    });

    return sendSuccess(res, formatted, 'Sectors retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCities,
  getCitySectors
};
