const State = require('../../models/State');
const City = require('../../models/City');
const Business = require('../../models/Business');
const User = require('../../models/User');
const { sendSuccess, sendError } = require('../../utils/responseHelper');
const { escapeRegex, getCityBusinessCounts } = require('../../utils/businessCountHelper');
const {
  stateFilter,
  cityFilter,
  withScope,
  canSeeState,
  statesOfCity,
  citiesInStatesFilter,
  nameRegex,
  removeFromAdmins
} = require('../../utils/access');

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** State code rules: 2 to 6 digits (e.g. 3010 = Gujarat), unique across states. Returns { code } or { error, status, errorCode }. */
const checkCode = async (value, exceptId = null) => {
  const code = String(value ?? '').trim();
  if (!code) return { error: 'State code is required, e.g. 3010', status: 400, errorCode: 'VALIDATION_ERROR' };
  if (!/^\d{2,6}$/.test(code)) {
    return { error: 'State code must be 2 to 6 digits, e.g. 3010', status: 400, errorCode: 'VALIDATION_ERROR' };
  }
  const taken = await State.findOne({ code, ...(exceptId ? { id: { $ne: exceptId } } : {}) });
  if (taken) return { error: `Code ${code} is already used by ${taken.name}`, status: 409, errorCode: 'DUPLICATE_CODE' };
  return { code };
};

/**
 * @desc    Get All States with Actual City & Business Counts (Admin). Border cities count in every state
 *          they are under (borderCityCount says how many of a state's cities are also under another state).
 *          State, city and sector admins only see the states their area is in, with counts for their area.
 * @route   GET /api/v1/admin/states
 * @access  Private (Admin)
 */
const getStates = async (req, res, next) => {
  try {
    const { search } = req.query;

    const filter = {};
    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: regex }, { code: regex }];
    }

    const states = await State.find(withScope(filter, stateFilter(req.access))).sort({ name: 1 });
    const cityCountMap = await getCityBusinessCounts();
    const cities = await City.find(cityFilter(req.access)).lean();

    const enriched = states.map((st) => {
      const stCities = cities.filter((c) => statesOfCity(c).some((s) => sameText(s, st.name)));
      let businessCount = 0;
      for (const c of stCities) {
        businessCount += cityCountMap.get((c.name || '').trim().toLowerCase()) || 0;
      }

      const obj = st.toJSON();
      obj.actualCityCount = stCities.length;
      obj.borderCityCount = stCities.filter((c) => statesOfCity(c).length > 1).length;
      obj.actualBusinessCount = businessCount;
      return obj;
    });

    return sendSuccess(res, enriched, 'Admin states retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Every state's id, name and code, for pickers (e.g. choosing the border states of a city,
 *          which may be states outside the admin's own area). No counts or cities.
 * @route   GET /api/v1/admin/states/options
 * @access  Private (Admin)
 */
const getStateOptions = async (req, res, next) => {
  try {
    const states = await State.find({}).select('id name code').sort({ name: 1 });
    return sendSuccess(
      res,
      states.map((s) => ({ id: s.id, name: s.name, code: s.code || '' })),
      'State options retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get State Details by ID (Admin), with its cities. Border cities are included with
 *          isBorder: true and allStates (every state they are under).
 * @route   GET /api/v1/admin/states/:id
 * @access  Private (Admin)
 */
const getStateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const state = await State.findOne({ id: id.toLowerCase() });

    if (!state) {
      return sendError(res, 'State not found', 404, 'STATE_NOT_FOUND');
    }
    if (!canSeeState(req.access, state.name)) {
      return sendError(res, 'This state is outside the area you manage', 403, 'OUT_OF_SCOPE');
    }

    const cities = await City.find(withScope(citiesInStatesFilter([state.name]), cityFilter(req.access))).sort({ name: 1 });
    const cityCountMap = await getCityBusinessCounts();

    let totalBusinesses = 0;
    const enrichedCities = cities.map((c) => {
      const cObj = c.toJSON();
      const count = cityCountMap.get(c.name.trim().toLowerCase()) || 0;
      cObj.actualBusinessCount = count;
      cObj.allStates = statesOfCity(c);
      cObj.isBorder = cObj.allStates.length > 1;
      totalBusinesses += count;
      return cObj;
    });

    const obj = state.toJSON();
    obj.cities = enrichedCities;
    obj.actualCityCount = cities.length;
    obj.borderCityCount = enrichedCities.filter((c) => c.isBorder).length;
    obj.actualBusinessCount = totalBusinesses;

    return sendSuccess(res, obj, 'State details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a New State (Admin). `code` is required (2 to 6 digits, unique), e.g. 3010.
 * @route   POST /api/v1/admin/states
 * @access  Private (global admins)
 */
const createState = async (req, res, next) => {
  try {
    const { name, code, country = 'India', imageUrl = '', cityCount = '0+', id } = req.body;

    if (!name || !String(name).trim()) {
      return sendError(res, 'State name is required', 400, 'VALIDATION_ERROR', { name: 'State name is required' });
    }
    const checked = await checkCode(code);
    if (checked.error) {
      return sendError(res, checked.error, checked.status, checked.errorCode, { code: checked.error });
    }

    const stateId = id ? id.toLowerCase().trim() : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

    const existing = await State.findOne({ $or: [{ id: stateId }, { name: nameRegex(name) }] });
    if (existing) {
      return sendError(res, 'State with this ID or name already exists', 400, 'DUPLICATE_STATE', { name: 'This state already exists' });
    }

    const state = await State.create({
      id: stateId,
      name: name.trim(),
      code: checked.code,
      country: country.trim(),
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1545645648-524cba4655f4?w=600&auto=format&fit=crop&q=80',
      cityCount: cityCount.trim()
    });

    return res.status(201).json({
      success: true,
      message: 'State created successfully',
      data: state
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Existing State (Admin). Renaming a state renames it on its cities (main and border),
 *          users and businesses, so they stay linked.
 * @route   PUT /api/v1/admin/states/:id
 * @access  Private (global admins)
 */
const updateState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const state = await State.findOne({ id: id.toLowerCase() });

    if (!state) {
      return sendError(res, 'State not found', 404, 'STATE_NOT_FOUND');
    }

    const { name, code, country, imageUrl, cityCount } = req.body;

    if (code !== undefined) {
      const checked = await checkCode(code, state.id);
      if (checked.error) {
        return sendError(res, checked.error, checked.status, checked.errorCode, { code: checked.error });
      }
      state.code = checked.code;
    }

    const oldName = state.name;
    if (name && name.trim() !== oldName) {
      if (await State.exists({ id: { $ne: state.id }, name: nameRegex(name) })) {
        return sendError(res, 'Another state already has this name', 400, 'DUPLICATE_STATE', { name: 'This state already exists' });
      }
      state.name = name.trim();
    }
    if (country) state.country = country.trim();
    if (imageUrl) state.imageUrl = imageUrl.trim();
    if (cityCount !== undefined) state.cityCount = cityCount;

    await state.save();

    // Cities, users and businesses reference the state by name.
    if (state.name !== oldName) {
      const old = nameRegex(oldName);
      await Promise.all([
        City.updateMany({ state: old }, { $set: { state: state.name } }),
        City.updateMany(
          { otherStates: old },
          { $set: { 'otherStates.$[s]': state.name } },
          { arrayFilters: [{ s: { $regex: old.source, $options: 'i' } }] }
        ),
        User.updateMany({ state: old }, { $set: { state: state.name } }),
        Business.updateMany({ state: old }, { $set: { state: state.name } })
      ]);
    }

    return sendSuccess(res, state, 'State updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete State (Admin). Its admins lose the state from their area, and border cities stop
 *          listing it as one of their states.
 * @route   DELETE /api/v1/admin/states/:id
 * @access  Private (global admins)
 */
const deleteState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const state = await State.findOne({ id: id.toLowerCase() });

    if (!state) {
      return sendError(res, 'State not found', 404, 'STATE_NOT_FOUND');
    }

    await State.deleteOne({ id: state.id });
    await City.updateMany({ otherStates: nameRegex(state.name) }, { $pull: { otherStates: nameRegex(state.name) } });
    await removeFromAdmins('states', [state.id]);
    return sendSuccess(res, null, 'State deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStates,
  getStateOptions,
  getStateById,
  createState,
  updateState,
  deleteState
};
