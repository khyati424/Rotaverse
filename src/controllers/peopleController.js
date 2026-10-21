const Business = require('../models/Business');
const User = require('../models/User');
const { sendSuccess, sendPaginated, sendError } = require('../utils/responseHelper');
const { generateInitials } = require('../utils/idGenerator');
const { escapeRegex } = require('../utils/businessCountHelper');
const { findStateName } = require('../utils/location');
const { normalizeEmail } = require('../utils/ownership');
const { favoritePeopleOf } = require('../utils/favorites');
const { enrichBusiness } = require('./businessController');

/**
 * "People" are the app users added by the admin (only active ones are shown). Each person is listed
 * with their businesses (linked by Business.ownerEmail), so one owner with an Advocates and a Retail
 * business appears once, whichever of the two a search matched. People without businesses are listed
 * too. Only live (status "active") businesses are shown publicly.
 */
const LIVE = { status: 'active' };
const BUSINESS_SORT = { rating: -1, reviewCount: -1, createdAt: -1 };
const SEARCHED_FIELDS = ['name', 'businessName', 'category', 'specialty', 'specializations', 'description', 'address', 'sector', 'city'];

const exact = (value) => new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');
const isAll = (value) => !value || String(value).trim().toLowerCase() === 'all';

/** True when any searched field of the business matches the keyword. */
const businessMatches = (business, regex) =>
  SEARCHED_FIELDS.some((field) => {
    const value = business[field];
    return Array.isArray(value) ? value.some((v) => regex.test(String(v))) : regex.test(String(value || ''));
  });

/** Public profile of a person. Contact details stay on the businesses. */
const personOf = (user, fallback) => {
  const source = user || fallback || {};
  const name = (user && user.name) || (fallback && fallback.name) || 'Business owner';
  return {
    id: user ? user.id : null,
    name,
    avatarUrl: (user && user.avatarUrl) || '',
    avatarInitials: generateInitials(name),
    state: source.state || '',
    city: source.city || '',
    sector: source.sector || ''
  };
};

/**
 * Person + their businesses (matched ones first), shaped for the app.
 * `favoriteIds` are the people the viewer saved; a saved person's businesses are marked isFavorite too.
 */
const buildPerson = (user, businesses, matchedIds, favoriteIds, lat, lon) => {
  const sorted = [...businesses].sort((a, b) => Number(matchedIds.has(b.id)) - Number(matchedIds.has(a.id)));
  const isFavorite = !!user && favoriteIds.has(user.id);
  return {
    ...personOf(user, sorted[0]),
    isFavorite,
    businessCount: sorted.length,
    matchCount: sorted.filter((b) => matchedIds.has(b.id)).length,
    categories: [...new Set(sorted.map((b) => b.category).filter(Boolean))],
    businesses: sorted.map((b) => ({
      ...enrichBusiness(b, null, lat ?? null, lon ?? null),
      isFavorite,
      isMatch: matchedIds.has(b.id)
    }))
  };
};

/**
 * @desc    Search people; each result lists the person's businesses
 * @route   GET /api/v1/people
 * @access  Public / Optional Auth
 *
 * - Only state/city/sector (or nothing): every active person there, with or without businesses.
 * - With `query` and/or `category`: people with a matching business, or (for `query`) whose name matches.
 */
const searchPeople = async (req, res, next) => {
  try {
    const { query, category, state, city, sector, latitude, longitude, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // Location filters apply to people (and their businesses, which sit at the owner's location).
    const location = {};
    if (!isAll(state)) location.state = exact((await findStateName(state)) || state);
    if (!isAll(city)) location.city = exact(city);
    if (!isAll(sector)) location.sector = exact(sector);

    const keyword = query && query.trim() ? new RegExp(escapeRegex(query.trim()), 'i') : null;
    const categoryRegex = isAll(category) ? null : exact(category);
    const searching = !!(keyword || categoryRegex);
    // A business counts as a match when it passes the category and keyword filters.
    const isMatch = (b) => (!categoryRegex || categoryRegex.test(b.category || '')) && (!keyword || businessMatches(b, keyword));

    const people = await User.find({ status: 'active', ...location }).sort({ name: 1 });
    const emails = people.map((u) => normalizeEmail(u.email));
    const owned = await Business.find({ ...LIVE, ownerEmail: { $in: emails } }).sort(BUSINESS_SORT);

    const rank = new Map(owned.map((b, i) => [b.id, i]));
    const businessesOf = new Map();
    for (const b of owned) {
      if (!businessesOf.has(b.ownerEmail)) businessesOf.set(b.ownerEmail, []);
      businessesOf.get(b.ownerEmail).push(b);
    }

    const entries = [];
    for (const user of people) {
      const businesses = businessesOf.get(normalizeEmail(user.email)) || [];
      const matched = searching ? businesses.filter(isMatch) : [];
      const nameMatches = !!keyword && keyword.test(user.name || '');
      const hasCategory = !categoryRegex || businesses.some((b) => categoryRegex.test(b.category || ''));
      if (searching && !matched.length && !(nameMatches && hasCategory)) continue;
      entries.push({
        user,
        businesses,
        // A name match marks the person's businesses as matched too (they searched for this person).
        matchedIds: new Set((matched.length ? matched : nameMatches ? businesses : []).map((b) => b.id)),
        best: matched.length ? Math.min(...matched.map((b) => rank.get(b.id))) : Infinity
      });
    }

    // Businesses whose owner is no longer a user (or that never had one) stay listed as their own entries.
    const allEmails = (await User.distinct('email')).map(normalizeEmail);
    const orphanFilter = { ...LIVE, ...location, ownerEmail: { $nin: allEmails } };
    if (categoryRegex) orphanFilter.category = categoryRegex;
    if (keyword) orphanFilter.$or = SEARCHED_FIELDS.map((field) => ({ [field]: keyword }));
    const orphans = await Business.find(orphanFilter).sort(BUSINESS_SORT);
    const orphanGroups = new Map();
    orphans.forEach((b, i) => {
      const key = b.ownerEmail ? `owner:${b.ownerEmail}` : `business:${b.id}`;
      if (!orphanGroups.has(key)) orphanGroups.set(key, { user: null, businesses: [], best: i + 0.5 });
      orphanGroups.get(key).businesses.push(b);
    });
    for (const group of orphanGroups.values()) {
      entries.push({ ...group, matchedIds: new Set(searching ? group.businesses.map((b) => b.id) : []) });
    }

    // Best match first (same order as business search); people without a match after, by name.
    entries.sort((a, b) => a.best - b.best || String(personOf(a.user, a.businesses[0]).name).localeCompare(personOf(b.user, b.businesses[0]).name));

    const pageEntries = entries.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    const favoriteIds = await favoritePeopleOf(req.user);
    const data = pageEntries.map((e) => buildPerson(e.user, e.businesses, e.matchedIds, favoriteIds, latitude, longitude));

    return sendPaginated(
      res,
      data,
      { total: entries.length, page: pageNum, limit: limitNum, totalPages: Math.ceil(entries.length / limitNum) || 1 },
      'People retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    One person with all of their live businesses
 * @route   GET /api/v1/people/:id
 * @access  Public / Optional Auth
 */
const getPersonById = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;
    const user = await User.findOne({ id: req.params.id, status: 'active' });
    if (!user) {
      return sendError(res, 'Person not found', 404, 'PERSON_NOT_FOUND');
    }

    const [businesses, favoriteIds] = await Promise.all([
      Business.find({ ...LIVE, ownerEmail: normalizeEmail(user.email) }).sort(BUSINESS_SORT),
      favoritePeopleOf(req.user)
    ]);

    return sendSuccess(
      res,
      buildPerson(user, businesses, new Set(), favoriteIds, latitude, longitude),
      'Person retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/** People with their live businesses, in the given order, shaped like GET /people results. */
const peopleWithBusinesses = async (users, favoriteIds, lat, lon) => {
  const businesses = await Business.find({ ...LIVE, ownerEmail: { $in: users.map((u) => normalizeEmail(u.email)) } }).sort(BUSINESS_SORT);
  return users.map((user) => {
    const email = normalizeEmail(user.email);
    return buildPerson(user, businesses.filter((b) => b.ownerEmail === email), new Set(), favoriteIds, lat, lon);
  });
};

module.exports = { searchPeople, getPersonById, peopleWithBusinesses, buildPerson };
