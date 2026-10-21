const City = require('../../models/City');
const Sector = require('../../models/Sector');
const Business = require('../../models/Business');
const User = require('../../models/User');
const { sendSuccess, sendError } = require('../../utils/responseHelper');
const {
  escapeRegex,
  getCityBusinessCounts,
  getSectorCountsForCity
} = require('../../utils/businessCountHelper');
const { findStateName } = require('../../utils/location');
const {
  cityFilter,
  sectorFilter,
  withScope,
  canSeeCity,
  canManageCity,
  managesState,
  statesOfCity,
  nameRegex,
  sendOutOfScope,
  removeFromAdmins
} = require('../../utils/access');

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const hasText = (list, value) => list.some((v) => sameText(v, value));

/**
 * The states sent for a city: `state` (main state) and `otherStates` (border states, an array or a
 * comma-separated string of names or ids). Each must be a known state. The main state is dropped
 * from otherStates. Values not sent keep the city's current ones.
 * Returns { state, otherStates } or { error, field }.
 */
const readCityStates = async (body, current = null) => {
  const mainInput = body.state !== undefined ? body.state : current ? current.state : '';
  if (!String(mainInput || '').trim()) return { field: 'state', error: 'State is required' };
  const state = await findStateName(mainInput);
  if (!state) return { field: 'state', error: `State "${String(mainInput).trim()}" was not found` };

  let others = body.otherStates !== undefined ? body.otherStates : current ? current.otherStates || [] : [];
  if (typeof others === 'string') others = others.split(',');
  if (!Array.isArray(others)) return { field: 'otherStates', error: 'otherStates must be a list of states' };

  const otherStates = [];
  for (const raw of others.map((v) => String(v || '').trim()).filter(Boolean)) {
    const name = await findStateName(raw);
    if (!name) return { field: 'otherStates', error: `State "${raw}" was not found` };
    if (!sameText(name, state) && !hasText(otherStates, name)) otherStates.push(name);
  }
  return { state, otherStates };
};

/**
 * Which state changes an admin may make on a city. Global admins: any. State admins: the main state
 * must be one of theirs when they set or change it, they can add border states (sharing the city with
 * that state's admins) but only remove states they manage, and the city must stay in one of their
 * states. City and sector admins can't change a city's states. Returns an error message or null.
 */
const stateChangeProblem = (access, before, after) => {
  if (access.isGlobal) return null;
  if (access.level !== 'state') return "Only state admins and global admins can change a city's states";

  if ((!before || !sameText(before.state, after.state)) && !managesState(access, after.state)) {
    return `${after.state} is not one of your states. Choose one of your states as the main state, and add others as border states.`;
  }
  if (before) {
    const afterAll = [after.state, ...after.otherStates];
    const removed = statesOfCity(before).filter((s) => !hasText(afterAll, s));
    const notMine = removed.filter((s) => !managesState(access, s));
    if (notMine.length) return `Only admins of ${notMine.join(', ')} can remove it from this city`;
    if (!afterAll.some((s) => managesState(access, s))) return 'The city must stay in at least one of your states';
  }
  return null;
};

/** The city a sector belongs to (sectors store their city's id; very old ones may store its name). */
const cityOfSector = (sector) =>
  City.findOne({
    $or: [{ id: String(sector.cityId || '').toLowerCase() }, { name: nameRegex(sector.cityId) }]
  });

/**
 * @desc    Get All Cities with Actual Business Counts. `state` matches the main state and border states.
 *          Scoped admins only get the cities in their area; canManage says whether they can edit one.
 * @route   GET /api/v1/admin/cities
 * @access  Private (Admin)
 */
const getCities = async (req, res, next) => {
  try {
    const { state, search } = req.query;
    const filter = {};
    if (state && state.trim()) {
      const re = nameRegex(state);
      filter.$or = [{ state: re }, { otherStates: re }];
    }
    if (search) filter.name = new RegExp(escapeRegex(search.trim()), 'i');

    const cities = await City.find(withScope(filter, cityFilter(req.access))).sort({ name: 1 });
    const cityCountMap = await getCityBusinessCounts();
    const sectorCounts = await Sector.aggregate([
      { $match: sectorFilter(req.access) },
      { $group: { _id: '$cityId', count: { $sum: 1 } } }
    ]);
    const sectorCountMap = new Map();
    for (const sc of sectorCounts) {
      if (sc._id) sectorCountMap.set(sc._id, sc.count);
    }

    const enriched = cities.map((c) => {
      const obj = c.toJSON();
      obj.actualBusinessCount = cityCountMap.get(c.name.trim().toLowerCase()) || 0;
      obj.sectorCount = sectorCountMap.get(c.id) || 0;
      obj.isBorder = statesOfCity(c).length > 1;
      obj.canManage = canManageCity(req.access, c);
      return obj;
    });

    return sendSuccess(res, enriched, 'Cities retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get City Details by ID (sector admins only get their own sectors)
 * @route   GET /api/v1/admin/cities/:id
 * @access  Private (Admin)
 */
const getCityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const city = await City.findOne({ id: id.toLowerCase() });

    if (!city) {
      return sendError(res, 'City not found', 404, 'CITY_NOT_FOUND');
    }
    if (!canSeeCity(req.access, city)) {
      return sendOutOfScope(res, 'This city');
    }

    const cityCountMap = await getCityBusinessCounts();
    const sectors = await Sector.find(withScope({ cityId: city.id }, sectorFilter(req.access))).sort({ name: 1 });
    const sectorCountMap = await getSectorCountsForCity(city.name);

    const enrichedSectors = sectors.map((s) => {
      const sObj = s.toJSON();
      sObj.actualBusinessCount = sectorCountMap.get(s.name.trim().toLowerCase()) || 0;
      return sObj;
    });

    const obj = city.toJSON();
    obj.actualBusinessCount = cityCountMap.get(city.name.trim().toLowerCase()) || 0;
    obj.sectors = enrichedSectors;
    obj.isBorder = statesOfCity(city).length > 1;
    obj.canManage = canManageCity(req.access, city);

    return sendSuccess(res, obj, 'City details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a New City. `state` is the main state; `otherStates` lists border states the city is
 *          also managed under. State admins can only create cities whose main state is theirs.
 * @route   POST /api/v1/admin/cities
 * @access  Private (global and state admins)
 */
const createCity = async (req, res, next) => {
  try {
    const { name, imageUrl = '', id } = req.body;

    if (!req.access.isGlobal && req.access.level !== 'state') {
      return sendError(res, 'Only state admins and global admins can add cities', 403, 'FORBIDDEN');
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return sendError(res, 'City name is required', 400, 'VALIDATION_ERROR', { name: 'City name is required' });
    }

    const states = await readCityStates({ state: 'Gujarat', ...req.body });
    if (states.error) {
      return sendError(res, states.error, 400, 'VALIDATION_ERROR', { [states.field]: states.error });
    }
    const problem = stateChangeProblem(req.access, null, states);
    if (problem) {
      return sendError(res, problem, 403, 'OUT_OF_SCOPE', { state: problem });
    }

    const cityId = id ? id.toLowerCase().trim() : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

    const existing = await City.findOne({ id: cityId });
    if (existing) {
      return sendError(res, 'City already exists with this ID or name', 400, 'DUPLICATE_CITY', { name: 'This city already exists' });
    }

    const city = await City.create({
      id: cityId,
      name: name.trim(),
      state: states.state,
      otherStates: states.otherStates,
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1545645648-524cba4655f4?w=600&auto=format&fit=crop&q=80',
      businessCount: '0'
    });

    return res.status(201).json({
      success: true,
      message: 'City created successfully',
      data: city
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update City (name, image, main state, border states). Renaming moves its users and
 *          businesses to the new name. When the city leaves a state, its people and businesses that
 *          were filed under that state move to the city's main state.
 * @route   PUT /api/v1/admin/cities/:id
 * @access  Private (global admins, and state/city admins of this city)
 */
const updateCity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const city = await City.findOne({ id: id.toLowerCase() });

    if (!city) {
      return sendError(res, 'City not found', 404, 'CITY_NOT_FOUND');
    }
    if (!canManageCity(req.access, city)) {
      return sendOutOfScope(res, 'This city');
    }

    const { name, imageUrl } = req.body;

    let states = null;
    if (req.body.state !== undefined || req.body.otherStates !== undefined) {
      states = await readCityStates(req.body, city);
      if (states.error) {
        return sendError(res, states.error, 400, 'VALIDATION_ERROR', { [states.field]: states.error });
      }
      const before = statesOfCity(city);
      const after = [states.state, ...states.otherStates];
      const changed = !sameText(city.state, states.state) || before.length !== after.length || before.some((s) => !hasText(after, s));
      if (!changed) {
        states = null;
      } else {
        const problem = stateChangeProblem(req.access, city, states);
        if (problem) {
          return sendError(res, problem, 403, 'OUT_OF_SCOPE', { state: problem });
        }
      }
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return sendError(res, 'City name cannot be empty', 400, 'VALIDATION_ERROR', { name: 'City name is required' });
      }
      const oldCityName = city.name;
      const newCityName = name.trim();

      if (oldCityName !== newCityName) {
        // Users and businesses link to the city by name
        const oldCityRegex = nameRegex(oldCityName);
        await Business.updateMany({ city: oldCityRegex }, { $set: { city: newCityName } });
        await User.updateMany({ city: oldCityRegex }, { $set: { city: newCityName } });
      }
      city.name = newCityName;
    }

    if (states) {
      city.state = states.state;
      city.otherStates = states.otherStates;
    }
    if (imageUrl) city.imageUrl = imageUrl.trim();

    await city.save();

    if (states) {
      // People and businesses must be filed under one of the city's states.
      const outside = { city: nameRegex(city.name), state: { $nin: statesOfCity(city).map(nameRegex) } };
      await User.updateMany(outside, { $set: { state: city.state } });
      await Business.updateMany(outside, { $set: { state: city.state } });
    }

    return sendSuccess(res, city, 'City updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete City and its sectors. They are removed from every admin's area.
 * @route   DELETE /api/v1/admin/cities/:id
 * @access  Private (global admins, and state admins of this city)
 */
const deleteCity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const city = await City.findOne({ id: id.toLowerCase() });

    if (!city) {
      return sendError(res, 'City not found', 404, 'CITY_NOT_FOUND');
    }
    if (!req.access.isGlobal) {
      if (req.access.level !== 'state') {
        return sendError(res, 'Only state admins and global admins can delete cities', 403, 'FORBIDDEN');
      }
      // A border city is shared, so a state admin can only delete it when every state it is under is theirs.
      const notMine = statesOfCity(city).filter((s) => !managesState(req.access, s));
      if (!canManageCity(req.access, city) || notMine.length) {
        return sendError(
          res,
          notMine.length && canManageCity(req.access, city)
            ? `${city.name} is also under ${notMine.join(', ')}. Only an admin of every state it is under can delete it.`
            : 'This city is outside the area you manage',
          403,
          'OUT_OF_SCOPE'
        );
      }
    }

    const sectorIds = (await Sector.find({ cityId: city.id }).select('id')).map((s) => s.id);
    await City.deleteOne({ id: city.id });
    await Sector.deleteMany({ cityId: city.id });
    await removeFromAdmins('cities', [city.id]);
    await removeFromAdmins('sectors', sectorIds);

    return sendSuccess(res, null, 'City and its sectors deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Sectors for a City (sector admins only get their own sectors)
 * @route   GET /api/v1/admin/cities/:cityId/sectors
 * @access  Private (Admin)
 */
const getCitySectors = async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const city = await City.findOne({ id: cityId.toLowerCase() });
    if (city && !canSeeCity(req.access, city)) {
      return sendOutOfScope(res, 'This city');
    }
    if (!city && !req.access.isGlobal) {
      return sendError(res, 'City not found', 404, 'CITY_NOT_FOUND');
    }

    const sectors = await Sector.find(withScope({ cityId: cityId.toLowerCase() }, sectorFilter(req.access))).sort({ name: 1 });
    const cityName = city ? city.name : cityId;
    const sectorCountMap = await getSectorCountsForCity(cityName);

    const enriched = sectors.map((s) => {
      const obj = s.toJSON();
      obj.actualBusinessCount = sectorCountMap.get(s.name.trim().toLowerCase()) || 0;
      return obj;
    });

    return sendSuccess(res, enriched, 'Sectors retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a Sector in a City
 * @route   POST /api/v1/admin/cities/:cityId/sectors
 * @access  Private (global admins, and state/city admins of this city)
 */
const createSector = async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const { name, id } = req.body;

    const city = await City.findOne({ id: cityId.toLowerCase().trim() });
    if (!city) {
      return sendError(res, 'City not found', 404, 'CITY_NOT_FOUND');
    }
    if (!canManageCity(req.access, city)) {
      return sendOutOfScope(res, 'This city');
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return sendError(res, 'Sector name is required', 400, 'VALIDATION_ERROR', { name: 'Sector name is required' });
    }

    const sectorId = id ? id.toLowerCase().trim() : `sec_${Date.now().toString().slice(-5)}`;

    const sector = await Sector.create({
      id: sectorId,
      name: name.trim(),
      cityId: city.id,
      businessCount: '0 Businesses'
    });

    return res.status(201).json({
      success: true,
      message: 'Sector created successfully',
      data: sector
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a Sector. Renaming moves its users and businesses to the new name.
 * @route   PUT /api/v1/admin/sectors/:sectorId
 * @access  Private (global admins, and state/city admins of its city)
 */
const updateSector = async (req, res, next) => {
  try {
    const sectorId = req.params.sectorId || req.params.id;
    const sector = await Sector.findOne({ id: sectorId });

    if (!sector) {
      return sendError(res, 'Sector not found', 404, 'SECTOR_NOT_FOUND');
    }

    const city = await cityOfSector(sector);
    if (!req.access.isGlobal && (!city || !canManageCity(req.access, city))) {
      return sendOutOfScope(res, 'This sector');
    }

    const { name, cityId } = req.body;

    // Moving the sector to another city needs access to that city too.
    if (cityId !== undefined && cityId.toLowerCase().trim() !== sector.cityId) {
      const target = await City.findOne({ id: cityId.toLowerCase().trim() });
      if (!target) {
        return sendError(res, 'City not found', 404, 'CITY_NOT_FOUND');
      }
      if (!canManageCity(req.access, target)) {
        return sendOutOfScope(res, 'That city');
      }
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return sendError(res, 'Sector name cannot be empty', 400, 'VALIDATION_ERROR', { name: 'Sector name is required' });
      }
      const oldSectorName = sector.name;
      const newSectorName = name.trim();

      if (oldSectorName !== newSectorName) {
        // Users and businesses link to the sector by city and sector name
        const inSector = { city: nameRegex(city ? city.name : sector.cityId), sector: nameRegex(oldSectorName) };
        await Business.updateMany(inSector, { $set: { sector: newSectorName } });
        await User.updateMany(inSector, { $set: { sector: newSectorName } });
      }
      sector.name = newSectorName;
    }

    if (cityId !== undefined) {
      sector.cityId = cityId.toLowerCase().trim();
    }

    sector.updatedAt = new Date();
    await sector.save();
    return sendSuccess(res, sector, 'Sector updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a Sector. It is removed from every sector admin's area.
 * @route   DELETE /api/v1/admin/sectors/:sectorId
 * @access  Private (global admins, and state/city admins of its city)
 */
const deleteSector = async (req, res, next) => {
  try {
    const sectorId = req.params.sectorId || req.params.id;
    const sector = await Sector.findOne({ id: sectorId });

    if (!sector) {
      return sendError(res, 'Sector not found', 404, 'SECTOR_NOT_FOUND');
    }

    const city = await cityOfSector(sector);
    if (!req.access.isGlobal && (!city || !canManageCity(req.access, city))) {
      return sendOutOfScope(res, 'This sector');
    }

    await Sector.deleteOne({ id: sector.id });
    await removeFromAdmins('sectors', [sector.id]);
    return sendSuccess(res, { id: sector.id }, 'Sector deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  getCitySectors,
  createSector,
  updateSector,
  deleteSector
};
