const User = require('../../models/User');
const Business = require('../../models/Business');
const Favorite = require('../../models/Favorite');
const DeviceToken = require('../../models/DeviceToken');
const Otp = require('../../models/Otp');
const { sendSuccess, sendPaginated, sendError } = require('../../utils/responseHelper');
const { normalizeEmail, isValidEmail, ownedBy, countByOwner } = require('../../utils/ownership');
const { resolveLocation, moveOwnerBusinesses } = require('../../utils/location');
const { escapeRegex } = require('../../utils/businessCountHelper');
const { isMailConfigured, sendInviteEmail } = require('../../utils/mailer');
const { phoneDigits, isValidMobile, toStoredPhone, checkUserPhone } = require('../../utils/phone');
const { placeFilter, withScope, coversPlace, sendOutOfScope } = require('../../utils/access');

/** Error for a location outside the admin's area, shown under the sector/city fields. */
const outsideArea = (res) =>
  sendError(res, 'This location is outside the area you manage', 403, 'OUT_OF_SCOPE', {
    sector: 'Choose a sector inside the area you manage'
  });

const USER_ROLES = ['user', 'vendor', 'admin'];
const USER_STATUSES = ['active', 'blocked', 'suspended'];
const LOCATION_KEYS = ['state', 'city', 'sector'];

/**
 * The user's state/city/sector from the request body, checked against the database. A user's
 * businesses are placed at this location, so all three are required when adding a user. On update
 * the location is optional, but when any part is sent all three are needed.
 * Returns { location } (null when nothing was sent on update) or { error, errors }.
 */
const locationFromBody = async (body, { required }) => {
  const value = (k) => String(body[k] ?? '').trim();
  if (!required && !LOCATION_KEYS.some(value)) return { location: null };

  const errors = {};
  for (const k of LOCATION_KEYS) {
    if (!value(k)) errors[k] = `${k.charAt(0).toUpperCase()}${k.slice(1)} is required`;
  }
  if (Object.keys(errors).length) return { error: 'State, city and sector are required', errors };

  const place = await resolveLocation({ state: value('state'), city: value('city'), sector: value('sector') });
  return place.error ? { error: place.error, errors: { [place.field]: place.error } } : { location: place };
};

const sameLocation = (a, b) => LOCATION_KEYS.every((k) => String(a[k] || '') === String(b[k] || ''));

const newUserId = () => `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Default display name from the email, e.g. "rahul.shah@x.com" -> "Rahul Shah". */
const nameFromEmail = (email) =>
  email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || email;

/**
 * @desc    Get All Users with Filters & Pagination
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin)
 */
const getUsers = async (req, res, next) => {
  try {
    const { search, role, status, state, city, sector, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { phoneNumber: regex },
        { id: regex },
        { city: regex },
        { sector: regex }
      ];
    }

    if (role && role.toLowerCase() !== 'all') {
      filter.role = role.trim().toLowerCase();
    }

    // Location filters (exact names, any case)
    for (const [key, value] of Object.entries({ state, city, sector })) {
      if (value && value.trim() && value.toLowerCase() !== 'all') {
        filter[key] = new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
      }
    }

    if (status && status.toLowerCase() !== 'all') {
      filter.status = status.trim().toLowerCase();
    }

    // State, city and sector admins only see the people in their area.
    const scoped = withScope(filter, placeFilter(req.access));
    const total = await User.countDocuments(scoped);
    const users = await User.find(scoped)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Enrich with business (by owner email) and favourite counts
    const [businessCounts, favCounts] = await Promise.all([
      countByOwner(users),
      Favorite.aggregate([
        { $match: { userId: { $in: users.map((u) => u.id) } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
      ])
    ]);
    const favMap = new Map(favCounts.map((f) => [f._id, f.count]));

    const enrichedUsers = users.map((u) => {
      const obj = u.toJSON();
      obj.listingsCount = businessCounts.get(u.email) || 0;
      obj.favoritesCount = favMap.get(u.id) || 0;
      return obj;
    });

    const totalPages = Math.ceil(total / limitNum) || 1;

    return sendPaginated(
      res,
      enrichedUsers,
      { total, page: pageNum, limit: limitNum, totalPages },
      'Users retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get User Details by ID (with every business owned by the user's email)
 * @route   GET /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ id });

    if (!user) {
      return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
    }
    if (!coversPlace(req.access, user)) {
      return sendOutOfScope(res, 'This user');
    }

    const [userBusinesses, userFavorites, deviceTokens] = await Promise.all([
      Business.find(ownedBy(user)).sort({ createdAt: -1 }),
      Favorite.find({ userId: user.id }),
      DeviceToken.find({ userId: user.id })
    ]);

    const obj = user.toJSON();
    obj.listings = userBusinesses;
    obj.listingsCount = userBusinesses.length;
    obj.favoritesCount = userFavorites.length;
    obj.devicesCount = deviceTokens.length;

    return sendSuccess(res, obj, 'User details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a user so they can log in to the app with their mobile number and an SMS OTP.
 *          The email is still required: their businesses are saved under it.
 * @route   POST /api/v1/admin/users
 * @access  Private (Admin)
 */
const createUser = async (req, res, next) => {
  try {
    const { email, name, phoneNumber, role = 'user', status = 'active' } = req.body;

    if (!email || !isValidEmail(email)) {
      return sendError(res, 'A valid email address is required', 400, 'VALIDATION_ERROR', {
        email: 'Enter a valid email address'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const roleValue = String(role).trim().toLowerCase();
    const statusValue = String(status).trim().toLowerCase();

    if (!USER_ROLES.includes(roleValue)) {
      return sendError(res, `Role must be one of: ${USER_ROLES.join(', ')}`, 400, 'VALIDATION_ERROR', { role: 'Invalid role' });
    }
    if (!USER_STATUSES.includes(statusValue)) {
      return sendError(res, `Status must be one of: ${USER_STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR', { status: 'Invalid status' });
    }

    const place = await locationFromBody(req.body, { required: true });
    if (place.error) {
      return sendError(res, place.error, 400, 'VALIDATION_ERROR', place.errors);
    }
    if (!coversPlace(req.access, place.location)) {
      return outsideArea(res);
    }

    // The mobile number is how the user logs in, so it is required and can belong to one user only.
    const phone = await checkUserPhone(phoneNumber);
    if (phone.error) {
      return sendError(res, phone.error, phone.status, phone.code, { phoneNumber: phone.error });
    }

    if (await User.exists({ email: normalizedEmail })) {
      return sendError(res, 'A user with this email already exists', 409, 'EMAIL_EXISTS', {
        email: 'This email is already added'
      });
    }

    const user = await User.create({
      id: newUserId(),
      name: (name && String(name).trim()) || nameFromEmail(normalizedEmail),
      email: normalizedEmail,
      phoneNumber: phone.phone,
      role: roleValue,
      status: statusValue,
      ...place.location,
      addedBy: req.admin ? req.admin.id : null
    });

    // Businesses already registered under this email (e.g. the user was removed and re-added) reconnect
    // automatically and move to the user's location.
    await moveOwnerBusinesses(normalizedEmail, place.location);
    const obj = user.toJSON();
    obj.listingsCount = await Business.countDocuments(ownedBy(user));
    obj.favoritesCount = 0;

    // Invite the user by email. The account is already created, so a mail failure must not fail the request.
    let inviteEmailSent = false;
    if (isMailConfigured()) {
      try {
        await sendInviteEmail(normalizedEmail, user.name);
        inviteEmailSent = true;
      } catch (mailError) {
        console.error(`[ADMIN] Could not send invitation to ${normalizedEmail}:`, mailError.message);
      }
    }
    obj.inviteEmailSent = inviteEmailSent;

    return sendSuccess(
      res,
      obj,
      inviteEmailSent
        ? 'User added and invitation email sent. They can now log in to the app with this email.'
        : 'User added, but the invitation email could not be sent. They can still log in to the app with this email.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update User Status or Role
 * @route   PATCH /api/v1/admin/users/:id/status
 * @access  Private (Admin)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, role } = req.body;

    const user = await User.findOne({ id });
    if (!user) {
      return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
    }
    if (!coversPlace(req.access, user)) {
      return sendOutOfScope(res, 'This user');
    }

    if (status !== undefined) user.status = status.toLowerCase();
    if (role !== undefined) user.role = role.toLowerCase();

    await user.save();
    return sendSuccess(res, user.toJSON(), `User status updated to ${user.status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update User Info. Changing the email moves the user's businesses to the new email; changing
 *          the mobile number changes the number they log in with.
 * @route   PUT /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phoneNumber, avatarUrl, role, status } = req.body;

    const user = await User.findOne({ id });
    if (!user) {
      return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
    }
    if (!coversPlace(req.access, user)) {
      return sendOutOfScope(res, 'This user');
    }

    const oldEmail = user.email;
    let newEmail = oldEmail;

    if (email !== undefined && email !== '') {
      if (!isValidEmail(email)) {
        return sendError(res, 'Enter a valid email address', 400, 'VALIDATION_ERROR', { email: 'Enter a valid email address' });
      }
      newEmail = normalizeEmail(email);
      if (newEmail !== oldEmail && (await User.exists({ email: newEmail }))) {
        return sendError(res, 'Another user already uses this email', 409, 'EMAIL_EXISTS', {
          email: 'This email is already added'
        });
      }
    }

    // A new mobile number must be valid and free; the current one may be re-sent as is.
    const oldPhone = phoneDigits(user.phoneNumber);
    let newPhone = user.phoneNumber;
    if (phoneNumber !== undefined) {
      if (phoneDigits(phoneNumber) === oldPhone && isValidMobile(phoneNumber)) {
        newPhone = toStoredPhone(phoneNumber);
      } else {
        const phone = await checkUserPhone(phoneNumber, { exceptId: user.id });
        if (phone.error) {
          return sendError(res, phone.error, phone.status, phone.code, { phoneNumber: phone.error });
        }
        newPhone = phone.phone;
      }
    }

    const place = await locationFromBody(req.body, { required: false });
    if (place.error) {
      return sendError(res, place.error, 400, 'VALIDATION_ERROR', place.errors);
    }
    // A user can only be moved to another place inside the admin's area.
    if (place.location && !coversPlace(req.access, place.location)) {
      return outsideArea(res);
    }
    const locationChanged = !!place.location && !sameLocation(place.location, user);
    if (place.location) Object.assign(user, place.location);

    if (name) user.name = name.trim();
    user.email = newEmail;
    user.phoneNumber = newPhone;
    if (avatarUrl) user.avatarUrl = avatarUrl.trim();
    if (role) user.role = role.trim().toLowerCase();
    if (status) user.status = status.trim().toLowerCase();

    await user.save();

    if (newEmail !== oldEmail) {
      await Business.updateMany({ ownerEmail: oldEmail }, { $set: { ownerEmail: newEmail, ownerId: user.id } });
    }
    // A code sent to the old email can no longer be used.
    if (newEmail !== oldEmail) {
      await Otp.deleteMany({ email: oldEmail });
    }

    // The user's businesses are placed where the user is, so a new location moves them too.
    if (locationChanged) {
      await moveOwnerBusinesses(newEmail, place.location);
    }

    return sendSuccess(res, user.toJSON(), 'User details updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove a user. They can no longer log in. Their businesses stay listed under
 *          their email and reconnect if the same email is added again.
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Private (Admin)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ id });

    if (!user) {
      return sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
    }
    if (!coversPlace(req.access, user)) {
      return sendOutOfScope(res, 'This user');
    }

    await User.deleteOne({ id });
    await Favorite.deleteMany({ $or: [{ userId: id }, { personId: id }] });
    await DeviceToken.deleteMany({ userId: id });
    await Otp.deleteMany({ email: user.email });

    return sendSuccess(res, null, 'User and associated data deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUserStatus,
  updateUser,
  deleteUser
};
