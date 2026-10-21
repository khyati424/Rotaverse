const State = require('../models/State');
const City = require('../models/City');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const {
  formatCityBusinessCount,
  getCityBusinessCounts
} = require('../utils/businessCountHelper');
const { findStateName } = require('../utils/location');
const { citiesInStatesFilter } = require('../utils/access');

/**
 * Live business count of a state (border cities included), formatted like a city's businessCount.
 * States don't store a business count; it is always counted from the businesses.
 */
const stateBusinessCount = async (stateName, cityCountMap) => {
  const cities = await City.find(citiesInStatesFilter([stateName])).select('name');
  const total = cities.reduce((n, c) => n + (cityCountMap.get(c.name.trim().toLowerCase()) || 0), 0);
  return { cityCount: cities.length, businessCount: formatCityBusinessCount(total) };
};

/**
 * @desc    Get all states (User API, just like /cities)
 * @route   GET /api/v1/states
 * @access  Public
 */
const getStates = async (req, res, next) => {
  try {
    const { search } = req.query;

    const filter = {};
    if (search && search.trim()) {
      filter.name = new RegExp(search.trim(), 'i');
    }

    let states = await State.find(filter).sort({ name: 1 });
    const cityCountMap = await getCityBusinessCounts();

    // Fallback if State collection is empty: generate from existing City collection dynamically
    if (states.length === 0) {
      const distinctStates = await City.distinct('state');
      const generated = await Promise.all(
        distinctStates.map(async (stName) => {
          const stId = stName.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const counts = await stateBusinessCount(stName, cityCountMap);

          return {
            id: stId,
            name: stName,
            country: 'India',
            imageUrl: 'https://images.unsplash.com/photo-1545645648-524cba4655f4?w=600&auto=format&fit=crop&q=80',
            cityCount: `${counts.cityCount}+`,
            businessCount: counts.businessCount
          };
        })
      );

      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        return sendSuccess(res, generated.filter((s) => regex.test(s.name)), 'States retrieved successfully');
      }

      return sendSuccess(res, generated, 'States retrieved successfully');
    }

    // Dynamic enrichment of real-time city and business counts
    const enriched = await Promise.all(
      states.map(async (st) => {
        // Border cities count in every state they are under.
        const counts = await stateBusinessCount(st.name, cityCountMap);
        const obj = st.toJSON();
        if (counts.cityCount > 0) {
          obj.cityCount = `${counts.cityCount}+`;
        }
        obj.businessCount = counts.businessCount;
        return obj;
      })
    );

    return sendSuccess(res, enriched, 'States retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get State details by ID
 * @route   GET /api/v1/states/:id
 * @access  Public
 */
const getStateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let state = await State.findOne({ id: id.toLowerCase() });

    if (!state) {
      // Check if matches a state name in City collection
      const matchedCity = await City.findOne({
        state: new RegExp(`^${id.replace(/_/g, ' ')}$`, 'i')
      });

      if (matchedCity) {
        const stateName = matchedCity.state;
        const counts = await stateBusinessCount(stateName, await getCityBusinessCounts());
        return sendSuccess(
          res,
          {
            id: id.toLowerCase(),
            name: stateName,
            country: 'India',
            imageUrl: 'https://images.unsplash.com/photo-1545645648-524cba4655f4?w=600&auto=format&fit=crop&q=80',
            cityCount: `${counts.cityCount}+`,
            businessCount: counts.businessCount
          },
          'State details retrieved'
        );
      }

      return sendError(res, 'State not found', 404, 'STATE_NOT_FOUND');
    }

    const obj = state.toJSON();
    obj.businessCount = (await stateBusinessCount(state.name, await getCityBusinessCounts())).businessCount;
    return sendSuccess(res, obj, 'State details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all cities belonging to a state (e.g. /states/gujarat/cities)
 * @route   GET /api/v1/states/:stateId/cities
 * @access  Public
 */
const getStateCities = async (req, res, next) => {
  try {
    const { stateId } = req.params;
    const { search } = req.query;

    const normalizedState = (await findStateName(stateId)) || stateId.replace(/_/g, ' ').trim();
    // Includes border cities that are also under this state (City.otherStates).
    const filter = citiesInStatesFilter([normalizedState]);

    if (search && search.trim()) {
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

    return sendSuccess(res, formatted, `Cities in ${normalizedState} retrieved successfully`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStates,
  getStateById,
  getStateCities
};
