const Business = require('../models/Business');
const User = require('../models/User');
const { sendPaginated, sendError } = require('../utils/responseHelper');
const { escapeRegex } = require('../utils/businessCountHelper');
const { findStateName } = require('../utils/location');
const { normalizeEmail } = require('../utils/ownership');
const { favoritePeopleOf } = require('../utils/favorites');
const { buildPerson } = require('./peopleController');
const { phoneDigits } = require('../utils/phone');

/**
 * Global search: one box that finds people. A person matches on their own name or mobile number, or on
 * any of their live businesses: business name, the specialization keywords entered when the business was
 * created, category, specialty, description or business phone numbers.
 *
 * Every word of the query has to match something of the person (so "ramesh plumber" finds Ramesh who runs
 * a plumbing business). A query made only of digits (spaces, +, - allowed) is a mobile-number search:
 * "+91 98765 43210", "9876543210" and part of a number like "98765" all work, whatever format the number
 * was saved in.
 */
const LIVE = { status: 'active' };
const BUSINESS_SORT = { rating: -1, reviewCount: -1, createdAt: -1 };
const MIN_QUERY = 2;
const MIN_PHONE_DIGITS = 4;
const BUSINESS_PHONES = ['phoneNumber', 'whatsappNumber', 'personalPhone', 'businessPhone'];

// How much a match on each field counts towards the ranking (best match per word is used).
const WEIGHT = {
  nameExact: 100,
  namePrefix: 80,
  name: 60,
  mobile: 70,
  businessExact: 65,
  businessPrefix: 55,
  business: 45,
  keywordExact: 50,
  keyword: 40,
  category: 35,
  specialty: 30,
  description: 10
};

const exact = (value) => new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');
const isAll = (value) => !value || String(value).trim().toLowerCase() === 'all';
const lower = (value) => String(value || '').toLowerCase();

/** Best { field, score } for one word of the query against a text value, or null. */
const textMatch = (value, word, kind) => {
  const v = lower(value).trim();
  if (!v || !v.includes(word)) return null;
  if (kind === 'name') {
    if (v === word) return { field: 'name', score: WEIGHT.nameExact };
    const prefix = v.startsWith(word) || v.split(/\s+/).some((part) => part.startsWith(word));
    return { field: 'name', score: prefix ? WEIGHT.namePrefix : WEIGHT.name };
  }
  if (kind === 'business') {
    if (v === word) return { field: 'business', score: WEIGHT.businessExact };
    const prefix = v.startsWith(word) || v.split(/\s+/).some((part) => part.startsWith(word));
    return { field: 'business', score: prefix ? WEIGHT.businessPrefix : WEIGHT.business };
  }
  if (kind === 'keyword') return { field: 'keyword', score: v === word ? WEIGHT.keywordExact : WEIGHT.keyword };
  return { field: kind, score: WEIGHT[kind] };
};

const better = (a, b) => (!a ? b : !b ? a : b.score > a.score ? b : a);

/**
 * Matches of one word against a person and their businesses.
 * Returns { best, fields:Set, businessIds:Set } (best is null when the word matches nothing).
 */
const matchWord = (word, user, businesses) => {
  const fields = new Set();
  const businessIds = new Set();
  let best = null;
  const note = (m, businessId) => {
    if (!m) return;
    best = better(best, m);
    fields.add(m.field);
    if (businessId) businessIds.add(businessId);
  };

  const digits = /^\d+$/.test(word) && word.length >= MIN_PHONE_DIGITS ? phoneDigits(word) : '';
  if (user) {
    note(textMatch(user.name, word, 'name'));
    if (digits && phoneDigits(user.phoneNumber).includes(digits)) note({ field: 'mobile', score: WEIGHT.mobile });
  }
  for (const b of businesses) {
    note(textMatch(b.name, word, 'business'), b.id);
    if (b.businessName && b.businessName !== b.name) note(textMatch(b.businessName, word, 'business'), b.id);
    for (const k of b.specializations || []) note(textMatch(k, word, 'keyword'), b.id);
    note(textMatch(b.category, word, 'category'), b.id);
    note(textMatch(b.specialty, word, 'specialty'), b.id);
    note(textMatch(b.description, word, 'description'), b.id);
    if (digits && BUSINESS_PHONES.some((f) => phoneDigits(b[f]).includes(digits))) {
      note({ field: 'mobile', score: WEIGHT.mobile }, b.id);
    }
  }
  return { best, fields, businessIds };
};

/** Splits the query into lowercase words; an all-digit query (+91 98765 43210) becomes one number. */
const wordsOf = (query) => {
  const q = query.trim().toLowerCase();
  if (/^\+?[\d\s-]+$/.test(q) && q.replace(/\D/g, '').length >= MIN_PHONE_DIGITS) return [phoneDigits(q)];
  return [...new Set(q.split(/\s+/).filter(Boolean))];
};

/**
 * @desc    Global search for people by name, mobile number, business or specialization keywords
 * @route   GET /api/v1/search?q=...
 * @access  Public / Optional Auth (signed-in users get isFavorite on each person)
 *
 * Query: q (required, at least 2 characters; `query` is accepted too), state, city, sector (optional
 * filters, "all" = no filter), latitude, longitude (adds distance to businesses), page, limit (max 50).
 */
const globalSearch = async (req, res, next) => {
  try {
    const { state, city, sector, latitude, longitude, page = 1, limit = 20 } = req.query;
    const query = String(req.query.q ?? req.query.query ?? '').trim();
    if (query.length < MIN_QUERY) {
      return sendError(res, `Enter at least ${MIN_QUERY} characters to search`, 400, 'VALIDATION_ERROR', {
        q: `Enter at least ${MIN_QUERY} characters`
      });
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    const location = {};
    if (!isAll(state)) location.state = exact((await findStateName(state)) || state);
    if (!isAll(city)) location.city = exact(city);
    if (!isAll(sector)) location.sector = exact(sector);

    const people = await User.find({ status: 'active', ...location });
    const owned = await Business.find({ ...LIVE, ownerEmail: { $in: people.map((u) => normalizeEmail(u.email)) } }).sort(
      BUSINESS_SORT
    );
    const businessesOf = new Map();
    for (const b of owned) {
      if (!businessesOf.has(b.ownerEmail)) businessesOf.set(b.ownerEmail, []);
      businessesOf.get(b.ownerEmail).push(b);
    }

    const words = wordsOf(query);
    const phrase = query.toLowerCase();
    const results = [];
    for (const user of people) {
      const businesses = businessesOf.get(normalizeEmail(user.email)) || [];
      let score = 0;
      const matchedOn = new Set();
      const matchedIds = new Set();
      let all = true;
      for (const word of words) {
        const m = matchWord(word, user, businesses);
        if (!m.best) {
          all = false;
          break;
        }
        score += m.best.score;
        m.fields.forEach((f) => matchedOn.add(f));
        m.businessIds.forEach((id) => matchedIds.add(id));
      }
      if (!all) continue;
      // The whole query appearing in the name ("ramesh patel") ranks above the words matching separately.
      if (words.length > 1 && lower(user.name).includes(phrase)) score += WEIGHT.nameExact;
      // A name or mobile match means they were looking for this person: show all their businesses as matches.
      if (!matchedIds.size && (matchedOn.has('name') || matchedOn.has('mobile'))) businesses.forEach((b) => matchedIds.add(b.id));
      results.push({ user, businesses, score, matchedOn: [...matchedOn], matchedIds });
    }

    results.sort((a, b) => b.score - a.score || String(a.user.name).localeCompare(String(b.user.name)));

    const favoriteIds = await favoritePeopleOf(req.user);
    const data = results.slice((pageNum - 1) * limitNum, pageNum * limitNum).map((r) => ({
      ...buildPerson(r.user, r.businesses, r.matchedIds, favoriteIds, latitude, longitude),
      matchedOn: r.matchedOn
    }));

    return sendPaginated(
      res,
      data,
      { total: results.length, page: pageNum, limit: limitNum, totalPages: Math.ceil(results.length / limitNum) || 1 },
      results.length ? 'Search results retrieved successfully' : 'No people found'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { globalSearch };
