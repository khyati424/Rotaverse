const User = require('../models/User');
const Favorite = require('../models/Favorite');
const Business = require('../models/Business');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { ownedBy } = require('../utils/ownership');
const { phoneDigits } = require('../utils/phone');
const { enrichBusiness } = require('./businessController');
const { favoriteOwnerEmailsOf } = require('../utils/favorites');

/** Businesses owned by the user (newest first), with isFavorite/distance like the public list. */
const findOwnedBusinesses = async (user, query = {}) => {
  const filter = ownedBy(user);
  if (query.status && query.status.toLowerCase() !== 'all') {
    filter.status = query.status.trim().toLowerCase();
  }
  const [businesses, favoriteOwners] = await Promise.all([
    Business.find(filter).sort({ createdAt: -1 }),
    favoriteOwnerEmailsOf(user)
  ]);
  return businesses.map((b) => enrichBusiness(b, favoriteOwners, query.latitude ?? null, query.longitude ?? null));
};

/** Profile response: the user plus every business they own. */
const profilePayload = async (user) => {
  const businesses = await findOwnedBusinesses(user);
  return { ...user.toJSON(), businessCount: businesses.length, businesses };
};

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/user/profile
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
    }
    return sendSuccess(res, await profilePayload(user), 'User profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update current user profile and/or avatar
 * @route   PUT /api/v1/user/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
    }

    const { name, phoneNumber } = req.body;

    // The mobile number is the login, so only an admin can change it. Re-sending the same number is fine.
    if (phoneNumber && phoneDigits(phoneNumber) !== phoneDigits(user.phoneNumber)) {
      return sendError(
        res,
        'Your mobile number is used to log in and can only be changed by the admin.',
        400,
        'PHONE_CHANGE_NOT_ALLOWED',
        { phoneNumber: 'Contact the admin to change your mobile number' }
      );
    }

    if (name) {
      user.name = name.trim();
    }

    if (req.file) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      user.avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    return sendSuccess(res, await profilePayload(user), 'User profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all businesses owned by the logged-in user
 * @route   GET /api/v1/user/businesses?status=active|pending|rejected|inactive
 * @access  Private
 */
const getMyBusinesses = async (req, res, next) => {
  try {
    const businesses = await findOwnedBusinesses(req.user, req.query);
    return sendSuccess(res, businesses, 'Your businesses retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete user account and personal data
 * @route   DELETE /api/v1/user/account
 * @access  Private
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const owned = ownedBy(req.user);

    // Delete user
    await User.deleteOne({ id: userId });

    // Clean up related records (their saved people, and anyone who saved them)
    await Favorite.deleteMany({ $or: [{ userId }, { personId: userId }] });
    await DeviceToken.deleteMany({ userId });
    await Notification.deleteMany({ userId });
    await Business.deleteMany(owned);

    return sendSuccess(res, null, 'User account permanently deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getMyBusinesses,
  deleteAccount
};
