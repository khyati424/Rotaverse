const Favorite = require('../models/Favorite');
const User = require('../models/User');
const { sendSuccess, sendPaginated, sendError } = require('../utils/responseHelper');
const { peopleWithBusinesses } = require('./peopleController');

/**
 * Favorites are people: the logged-in user saves other users (the `id` from GET /people).
 */

/** The person (user) id from the URL (/favorites/:personId) or the JSON body ({ "personId" } or { "userId" }). */
const personIdOf = (req) => {
  const body = req.body || {};
  return String(req.params.personId || body.personId || body.userId || '').trim();
};

const missingId = (res) => sendError(res, 'personId is required', 400, 'VALIDATION_ERROR');

/**
 * @desc    The people the user saved, newest first, each with their businesses (same shape as GET /people)
 * @route   GET /api/v1/user/favorites
 * @access  Private
 */
const getFavorites = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, latitude, longitude } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Only people who can still be seen (active users) are listed and counted.
    const favorites = await Favorite.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const favoriteIds = new Set(favorites.map((f) => f.personId));
    const people = await User.find({ id: { $in: [...favoriteIds] }, status: 'active' });
    const personMap = new Map(people.map((u) => [u.id, u]));
    const saved = favorites.map((f) => personMap.get(f.personId)).filter(Boolean);
    const total = saved.length;

    const data = await peopleWithBusinesses(saved.slice(skip, skip + limitNum), favoriteIds, latitude, longitude);

    return sendPaginated(
      res,
      data,
      { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
      'Favorite people retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save a person to favorites (saving one twice is not an error)
 * @route   POST /api/v1/user/favorites/:personId  (or POST /api/v1/user/favorites with { personId })
 * @access  Private
 */
const addFavorite = async (req, res, next) => {
  try {
    const personId = personIdOf(req);
    if (!personId) return missingId(res);

    const person = await User.findOne({ id: personId, status: 'active' });
    if (!person) {
      return sendError(
        res,
        `No person found with id "${personId}". Use the person "id" from GET /people (e.g. usr_123456).`,
        404,
        'PERSON_NOT_FOUND'
      );
    }

    await Favorite.updateOne(
      { userId: req.user.id, personId },
      { $setOnInsert: { userId: req.user.id, personId } },
      { upsert: true }
    );

    return sendSuccess(res, { personId, isFavorite: true }, 'Person added to favorites');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove a person from favorites (succeeds even if they weren't saved)
 * @route   DELETE /api/v1/user/favorites/:personId  (or DELETE /api/v1/user/favorites with { personId })
 * @access  Private
 */
const removeFavorite = async (req, res, next) => {
  try {
    const personId = personIdOf(req);
    if (!personId) return missingId(res);

    await Favorite.deleteOne({ userId: req.user.id, personId });

    return sendSuccess(res, { personId, isFavorite: false }, 'Person removed from favorites');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite
};
