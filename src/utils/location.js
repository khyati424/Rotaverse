const Business = require('../models/Business');
const City = require('../models/City');
const Sector = require('../models/Sector');
const State = require('../models/State');
const User = require('../models/User');
const { escapeRegex } = require('./businessCountHelper');
const { normalizeEmail } = require('./ownership');

const exactName = (value) => new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * Find a state by id ("gujarat", "tamil_nadu") or name ("Tamil Nadu"), any case.
 * Cities store their state by name, so a state that only exists on cities is accepted too.
 * Returns the state's official name, or null.
 */
const findStateName = async (value) => {
  const v = String(value || '').trim();
  if (!v) return null;
  const state = await State.findOne({ $or: [{ id: v.toLowerCase() }, { name: exactName(v) }, { name: exactName(v.replace(/_/g, ' ')) }] });
  if (state) return state.name;
  const name = exactName(v.replace(/_/g, ' '));
  const city = await City.findOne({ $or: [{ state: name }, { otherStates: name }] });
  return city ? [city.state, ...(city.otherStates || [])].find((s) => name.test(s)) || null : null;
};

/**
 * Users (and through them their businesses) reference their state, city and sector by name, and every
 * count/filter matches those names. Resolve the submitted values (name or id, any case) to the stored
 * State/City/Sector so they are saved with the official names. Free text that matches nothing is rejected.
 * When no state is sent it is taken from the city.
 * Returns { state, city, sector } (official names) or { error, field }.
 */
const resolveLocation = async ({ state: stateInput, city: cityInput, sector: sectorInput }) => {
  const stateValue = String(stateInput || '').trim();
  const cityValue = String(cityInput || '').trim();
  const sectorValue = String(sectorInput || '').trim();

  let stateName = null;
  if (stateValue) {
    stateName = await findStateName(stateValue);
    if (!stateName) {
      return { field: 'state', error: `State "${stateValue}" was not found. Choose one of the listed states.` };
    }
  }

  const city = await City.findOne({ $or: [{ id: cityValue.toLowerCase() }, { name: exactName(cityValue) }] });
  if (!city) {
    return { field: 'city', error: `City "${cityValue}" was not found. Choose one of the listed cities.` };
  }
  // A border city is under its main state and its otherStates, and can be chosen under any of them.
  if (stateName && ![city.state, ...(city.otherStates || [])].some((s) => sameText(s, stateName))) {
    return { field: 'city', error: `City "${city.name}" is not in ${stateName}. Choose one of the cities listed for this state.` };
  }

  const sector = await Sector.findOne({
    cityId: city.id,
    $or: [{ id: sectorValue }, { name: exactName(sectorValue) }]
  });
  if (!sector) {
    return {
      field: 'sector',
      error: `Sector "${sectorValue}" was not found in ${city.name}. Choose one of the sectors listed for this city.`
    };
  }

  return { state: stateName || city.state || '', city: city.name, sector: sector.name };
};

/**
 * A business is placed where its owner is: the state, city and sector the admin set on the user.
 * Returns { state, city, sector }, or null when the user has no location yet.
 */
const ownerLocation = (user) =>
  user && user.city && user.sector ? { state: user.state || '', city: user.city, sector: user.sector } : null;

/** Move every business owned by `email` to `location` (used when the admin changes a user's location). */
const moveOwnerBusinesses = (email, location) =>
  Business.updateMany({ ownerEmail: normalizeEmail(email) }, { $set: location });

/** One-time startup migration: give businesses created before the state field the state of their city. */
const backfillBusinessStates = async () => {
  const missing = await Business.find({ $or: [{ state: { $exists: false } }, { state: '' }] }).select('id city');
  if (!missing.length) return;

  const cities = await City.find({}).select('name state');
  const stateOfCity = new Map(cities.map((c) => [c.name.trim().toLowerCase(), c.state]));

  const ops = missing
    .map((b) => ({ id: b.id, state: stateOfCity.get(String(b.city || '').trim().toLowerCase()) }))
    .filter((b) => b.state)
    .map((b) => ({ updateOne: { filter: { id: b.id }, update: { $set: { state: b.state } } } }));

  if (ops.length) {
    await Business.bulkWrite(ops);
    console.log(`[MIGRATION] Set the state on ${ops.length} existing business(es) from their city`);
  }
};

/**
 * One-time startup migration: users added before the location became required get the location of
 * their most recent business, so they can keep creating businesses. Users without businesses stay
 * empty until the admin sets their location.
 */
const backfillUserLocations = async () => {
  const users = await User.find({ $or: [{ city: { $in: ['', null] } }, { sector: { $in: ['', null] } }] });
  let updated = 0;
  for (const user of users) {
    const latest = await Business.findOne({
      ownerEmail: normalizeEmail(user.email),
      city: { $nin: ['', null] },
      sector: { $nin: ['', null] }
    }).sort({ createdAt: -1 });
    if (!latest) continue;
    user.state = latest.state || '';
    user.city = latest.city;
    user.sector = latest.sector;
    await user.save();
    updated++;
  }
  if (updated) {
    console.log(`[MIGRATION] Set the location of ${updated} user(s) from their latest business`);
  }
};

module.exports = {
  resolveLocation,
  findStateName,
  ownerLocation,
  moveOwnerBusinesses,
  backfillBusinessStates,
  backfillUserLocations
};
