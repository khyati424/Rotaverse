const Admin = require('../models/Admin');
const State = require('../models/State');
const City = require('../models/City');
const Sector = require('../models/Sector');
const { escapeRegex } = require('./businessCountHelper');
const { sendError } = require('./responseHelper');

/**
 * Role-based access for admin panel accounts.
 *
 *   superadmin, admin  every state, city and sector (moderator is an old name for admin)
 *   state_admin        the states in Admin.states, including border cities that are also under them
 *   city_admin         the cities in Admin.cities and every sector inside them
 *   sector_admin       the sectors in Admin.sectors only
 *
 * Many admins can share the same state, city or sector. People (users) and businesses belong to the
 * area of their city and sector, so a border city is managed by the admins of every state it is under.
 * `rank` decides who can manage whom: an admin only manages accounts with a lower rank inside their area.
 */
const ROLES = {
  superadmin: { level: 'all', rank: 5, label: 'Super Admin' },
  admin: { level: 'all', rank: 4, label: 'Admin' },
  moderator: { level: 'all', rank: 4, label: 'Admin' },
  state_admin: { level: 'state', rank: 3, label: 'State Admin' },
  city_admin: { level: 'city', rank: 2, label: 'City Admin' },
  sector_admin: { level: 'sector', rank: 1, label: 'Sector Admin' }
};
// Unknown roles see nothing.
const NO_ROLE = { level: 'sector', rank: 0, label: 'No access' };
const roleInfo = (role) => ROLES[role] || NO_ROLE;

/** The Admin field that holds the assigned area for a scoped role. */
const SCOPE_FIELD = { state: 'states', city: 'cities', sector: 'sectors' };

const lower = (v) => String(v || '').trim().toLowerCase();
const nameRegex = (v) => new RegExp(`^\\s*${escapeRegex(String(v || '').trim())}\\s*$`, 'i');

/** Every state a city is under: its main state plus border states. */
const statesOfCity = (city) => [city.state, ...(city.otherStates || [])].filter((s) => String(s || '').trim());

/** Cities under any of the given state names (main state or border state). */
const citiesInStatesFilter = (stateNames) => {
  const res = stateNames.map(nameRegex);
  return { $or: [{ state: { $in: res } }, { otherStates: { $in: res } }] };
};

// Matches no document.
const NOTHING = { _id: { $in: [] } };

/**
 * Resolve an admin's role and assignments into the records they may see and manage.
 * Stored on req.access by protectAdmin.
 */
const loadAccess = async (admin) => {
  const { level, rank } = roleInfo(admin.role);
  const access = {
    adminId: admin.id,
    role: admin.role,
    level,
    rank,
    isGlobal: level === 'all',
    states: [],
    cities: [],
    sectors: []
  };

  if (!access.isGlobal) {
    if (level === 'state') {
      access.states = await State.find({ id: { $in: admin.states || [] } }).sort({ name: 1 });
      access.cities = access.states.length
        ? await City.find(citiesInStatesFilter(access.states.map((s) => s.name))).sort({ name: 1 })
        : [];
    } else if (level === 'city') {
      access.cities = await City.find({ id: { $in: admin.cities || [] } }).sort({ name: 1 });
    } else {
      access.sectors = await Sector.find({ id: { $in: admin.sectors || [] } }).sort({ name: 1 });
      const cityIds = [...new Set(access.sectors.map((s) => s.cityId))];
      access.cities = cityIds.length ? await City.find({ id: { $in: cityIds } }).sort({ name: 1 }) : [];
    }
  }

  access.cityIds = new Set(access.cities.map((c) => c.id));
  access.cityNames = new Set(access.cities.map((c) => lower(c.name)));
  access.cityNameById = new Map(access.cities.map((c) => [c.id, c.name]));
  // Sector admins can open their sectors' cities but not change them.
  access.manageCityIds = level === 'sector' ? new Set() : access.cityIds;
  access.sectorIds = new Set(access.sectors.map((s) => s.id));
  // States this admin manages (state admins), and states they can see (any state their cities are under).
  access.ownStateNames = new Set(access.states.map((s) => lower(s.name)));
  access.visibleStateNames = new Set(
    level === 'state' ? access.ownStateNames : access.cities.flatMap(statesOfCity).map(lower)
  );
  return access;
};

/* ---------- Mongo filters for list endpoints ---------- */

/** Users and businesses (both store their city and sector by name) inside the admin's area. */
const placeFilter = (access) => {
  if (access.isGlobal) return {};
  if (access.level === 'sector') {
    const pairs = access.sectors
      .filter((s) => access.cityNameById.has(s.cityId))
      .map((s) => ({ city: nameRegex(access.cityNameById.get(s.cityId)), sector: nameRegex(s.name) }));
    return pairs.length ? { $or: pairs } : NOTHING;
  }
  return access.cities.length ? { city: { $in: access.cities.map((c) => nameRegex(c.name)) } } : NOTHING;
};

const cityFilter = (access) => (access.isGlobal ? {} : { id: { $in: [...access.cityIds] } });

const sectorFilter = (access) => {
  if (access.isGlobal) return {};
  if (access.level === 'sector') return { id: { $in: [...access.sectorIds] } };
  return { cityId: { $in: [...access.manageCityIds] } };
};

const stateFilter = (access) =>
  access.isGlobal ? {} : { name: { $in: [...access.visibleStateNames].map(nameRegex) } };

/** Combine a list filter with a scope filter (either may be empty). */
const withScope = (filter, scope) => {
  if (!Object.keys(scope).length) return filter;
  if (!Object.keys(filter).length) return scope;
  return { $and: [filter, scope] };
};

/* ---------- Checks for single records ---------- */

const canSeeCity = (access, city) => access.isGlobal || access.cityIds.has(city.id);
const canManageCity = (access, city) => access.isGlobal || access.manageCityIds.has(city.id);
const canSeeSector = (access, sector) =>
  access.isGlobal || (access.level === 'sector' ? access.sectorIds.has(sector.id) : access.manageCityIds.has(sector.cityId));
const canSeeState = (access, stateName) => access.isGlobal || access.visibleStateNames.has(lower(stateName));
/** Global admins manage every state; state admins manage their own. */
const managesState = (access, stateName) => access.isGlobal || access.ownStateNames.has(lower(stateName));

/** True when a person or business at { city, sector } (names) is inside the admin's area. */
const coversPlace = (access, place) => {
  if (access.isGlobal) return true;
  if (!place || !String(place.city || '').trim()) return false;
  if (access.level === 'sector') {
    return access.sectors.some(
      (s) => lower(s.name) === lower(place.sector) && lower(access.cityNameById.get(s.cityId)) === lower(place.city)
    );
  }
  return access.cityNames.has(lower(place.city));
};

const sendOutOfScope = (res, what = 'This record') =>
  sendError(res, `${what} is outside the area you manage`, 403, 'OUT_OF_SCOPE');

/* ---------- Managing other admin accounts ---------- */

/** Roles this admin may give to the accounts they create or edit. */
const assignableRoles = (access) => {
  if (access.role === 'superadmin') return ['superadmin', 'admin', 'state_admin', 'city_admin', 'sector_admin'];
  return ['admin', 'state_admin', 'city_admin', 'sector_admin'].filter((r) => ROLES[r].rank < access.rank);
};

/**
 * Check the area sent for an admin account against the role and the acting admin's own area.
 * `ids` is { states, cities, sectors } (arrays of ids, any may be missing).
 * Returns { scope: { states, cities, sectors } } or { error, field }.
 */
const checkAssignment = async (access, role, ids = {}) => {
  const empty = { states: [], cities: [], sectors: [] };
  const { level } = roleInfo(role);
  if (level === 'all') return { scope: empty };

  const field = SCOPE_FIELD[level];
  const wanted = [...new Set((Array.isArray(ids[field]) ? ids[field] : []).map((v) => String(v).trim()).filter(Boolean))];
  const noun = { states: 'state', cities: 'city', sectors: 'sector' }[field];
  if (!wanted.length) return { field, error: `Choose at least one ${noun} for a ${ROLES[role].label}` };

  const Model = { states: State, cities: City, sectors: Sector }[field];
  const found = await Model.find({ id: { $in: wanted } });
  const missing = wanted.filter((id) => !found.some((d) => d.id === id));
  if (missing.length) return { field, error: `Unknown ${noun}: ${missing.join(', ')}` };

  const outside =
    field === 'states'
      ? found.filter(() => !access.isGlobal)
      : field === 'cities'
        ? found.filter((c) => !canManageCity(access, c))
        : found.filter((s) => !access.isGlobal && !access.manageCityIds.has(s.cityId));
  if (outside.length) {
    return { field, error: `${outside.map((d) => d.name).join(', ')} ${outside.length === 1 ? 'is' : 'are'} outside the area you manage` };
  }
  return { scope: { ...empty, [field]: wanted } };
};

/** True when the acting admin may edit, switch off or remove the target admin account. */
const canManageAdmin = async (access, target) => {
  if (target.id === access.adminId) return false;
  if (access.role === 'superadmin') return true;
  if (roleInfo(target.role).rank >= access.rank) return false;
  if (access.isGlobal) return true;

  const { level } = roleInfo(target.role);
  const ids = target[SCOPE_FIELD[level]] || [];
  // An account whose whole area was deleted stays with the admin who created it.
  if (!ids.length) return target.createdBy === access.adminId;
  if (level === 'city') return ids.every((id) => access.manageCityIds.has(id));
  if (level === 'sector') {
    const sectors = await Sector.find({ id: { $in: ids } }).select('id cityId');
    return sectors.length > 0 && sectors.every((s) => access.manageCityIds.has(s.cityId));
  }
  return false;
};

/**
 * Names for the area assigned to each admin, for display:
 * scope: { states: [{ id, name, code }], cities: [{ id, name, state }], sectors: [{ id, name, cityId, city }] }.
 */
const describeAdmins = async (admins) => {
  const ids = (key) => [...new Set(admins.flatMap((a) => a[key] || []))];
  const [states, cities, sectors] = await Promise.all([
    State.find({ id: { $in: ids('states') } }).select('id name code'),
    City.find({ id: { $in: ids('cities') } }).select('id name state otherStates'),
    Sector.find({ id: { $in: ids('sectors') } }).select('id name cityId')
  ]);
  const sectorCities = await City.find({ id: { $in: [...new Set(sectors.map((s) => s.cityId))] } }).select('id name');
  const pick = (list, wanted, shape) => wanted.map((id) => list.find((d) => d.id === id)).filter(Boolean).map(shape);

  return admins.map((a) => {
    const obj = typeof a.toJSON === 'function' ? a.toJSON() : { ...a };
    const { level, label } = roleInfo(a.role);
    obj.level = level;
    obj.roleLabel = label;
    obj.scope = {
      states: pick(states, a.states || [], (s) => ({ id: s.id, name: s.name, code: s.code || '' })),
      cities: pick(cities, a.cities || [], (c) => ({ id: c.id, name: c.name, state: c.state, otherStates: c.otherStates || [] })),
      sectors: pick(sectors, a.sectors || [], (s) => ({
        id: s.id,
        name: s.name,
        cityId: s.cityId,
        city: (sectorCities.find((c) => c.id === s.cityId) || {}).name || s.cityId
      }))
    };
    return obj;
  });
};

/** The signed-in admin with their area and what they may do, for the panel. */
const describeSelf = async (admin, access) => {
  const [obj] = await describeAdmins([admin]);
  const roles = assignableRoles(access);
  obj.access = {
    level: access.level,
    isGlobal: access.isGlobal,
    assignableRoles: roles,
    canManageAdmins: roles.length > 0,
    cityCount: access.isGlobal ? null : access.cities.length
  };
  return obj;
};

/** Drop deleted states, cities or sectors (field: 'states' | 'cities' | 'sectors') from every admin's area. */
const removeFromAdmins = async (field, ids) => {
  if (ids.length) await Admin.updateMany({ [field]: { $in: ids } }, { $pull: { [field]: { $in: ids } } });
};

module.exports = {
  ROLES,
  roleInfo,
  statesOfCity,
  citiesInStatesFilter,
  nameRegex,
  loadAccess,
  placeFilter,
  cityFilter,
  sectorFilter,
  stateFilter,
  withScope,
  canSeeCity,
  canManageCity,
  canSeeSector,
  canSeeState,
  managesState,
  coversPlace,
  sendOutOfScope,
  assignableRoles,
  checkAssignment,
  canManageAdmin,
  describeAdmins,
  describeSelf,
  removeFromAdmins
};
