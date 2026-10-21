const Business = require('../../models/Business');
const { sendSuccess, sendPaginated, sendError } = require('../../utils/responseHelper');
const { generateInitials } = require('../../utils/idGenerator');
const User = require('../../models/User');
const { normalizeEmail, ownerFields } = require('../../utils/ownership');
const { ownerLocation, findStateName } = require('../../utils/location');
const { escapeRegex } = require('../../utils/businessCountHelper');
const { placeFilter, withScope, coversPlace, sendOutOfScope } = require('../../utils/access');

/** A business is placed where its owner is, so the owner must be inside the admin's area. */
const ownerOutsideArea = (res, user) => {
  const message = `${user.name || user.email} is outside the area you manage`;
  return sendError(res, message, 403, 'OUT_OF_SCOPE', { ownerEmail: message });
};

/**
 * Resolve the ownerEmail sent by the admin panel to a registered user.
 * '' / null unassigns the business. Returns { user } or { error }.
 */
const resolveOwner = async (ownerEmail) => {
  const email = normalizeEmail(ownerEmail);
  if (!email) return { user: null };
  const user = await User.findOne({ email });
  if (!user) return { error: `No user is registered with ${email}. Add the user first.` };
  return { user };
};

const ownerLocationMissing = (user) =>
  `${user.name || user.email} has no state, city and sector yet. Set them in Users first.`;

/**
 * @desc    Get All Businesses with full Admin filters & pagination
 * @route   GET /api/v1/admin/businesses
 * @access  Private (Admin)
 */
const getBusinesses = async (req, res, next) => {
  try {
    const {
      search,
      category,
      state,
      city,
      sector,
      status,
      isVerified,
      isFeatured,
      isOpen,
      ownerEmail,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { name: regex },
        { specialty: regex },
        { email: regex },
        { phoneNumber: regex },
        { address: regex },
        { businessName: regex }
      ];
    }

    if (category && category.toLowerCase() !== 'all') {
      filter.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    if (city && city.toLowerCase() !== 'all') {
      filter.city = new RegExp(`^${city.trim()}$`, 'i');
    }

    if (sector && sector.toLowerCase() !== 'all') {
      filter.sector = new RegExp(`^${sector.trim()}$`, 'i');
    }

    if (state && state.toLowerCase() !== 'all') {
      const stateName = await findStateName(state);
      filter.state = new RegExp(`^${escapeRegex(stateName || state.trim())}$`, 'i');
    }

    if (status && status.toLowerCase() !== 'all') {
      filter.status = status.trim().toLowerCase();
    }

    if (isVerified !== undefined) {
      filter.isVerified = isVerified === 'true' || isVerified === true;
    }

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === 'true' || isFeatured === true;
    }

    if (isOpen !== undefined) {
      filter.isOpen = isOpen === 'true' || isOpen === true;
    }

    if (ownerEmail !== undefined && ownerEmail !== '') {
      filter.ownerEmail = ownerEmail === 'none' ? '' : normalizeEmail(ownerEmail);
    }

    // State, city and sector admins only see the businesses in their area.
    const scoped = withScope(filter, placeFilter(req.access));
    const total = await Business.countDocuments(scoped);
    const businesses = await Business.find(scoped)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return sendPaginated(
      res,
      businesses,
      { total, page: pageNum, limit: limitNum, totalPages },
      'Businesses retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Business Details by ID
 * @route   GET /api/v1/admin/businesses/:id
 * @access  Private (Admin)
 */
const getBusinessById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const business = await Business.findOne({ id });

    if (!business) {
      return sendError(res, 'Business not found', 404, 'BUSINESS_NOT_FOUND');
    }
    if (!coversPlace(req.access, business)) {
      return sendOutOfScope(res, 'This business');
    }

    // The app user (by email) who owns this business, if any
    const obj = business.toJSON();
    const owner = business.ownerEmail ? await User.findOne({ email: business.ownerEmail }) : null;
    obj.ownerAccount = owner
      ? { id: owner.id, name: owner.name, email: owner.email, status: owner.status }
      : null;

    return sendSuccess(res, obj, 'Business details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a New Business by Admin
 * @route   POST /api/v1/admin/businesses
 * @access  Private (Admin)
 */
const createBusiness = async (req, res, next) => {
  try {
    const {
      name,
      category,
      specialty = '',
      description = '',
      address,
      latitude,
      longitude,
      phoneNumber,
      whatsappNumber = '',
      email = '',
      openingTime = '09:00 AM',
      closingTime = '08:00 PM',
      specializations,
      businessName = '',
      personalPhone = '',
      personalEmail = '',
      businessPhone = '',
      businessEmail = '',
      ownerEmail = '',
      isVerified = true,
      isFeatured = false,
      status = 'active'
    } = req.body;

    if (!name || !category || !address || !phoneNumber) {
      return sendError(res, 'Name, category, address, and phoneNumber are required', 400, 'VALIDATION_ERROR');
    }

    // Every business belongs to a user and is placed in that user's state/city/sector.
    if (!normalizeEmail(ownerEmail)) {
      return sendError(res, 'Choose the user who owns this business', 400, 'OWNER_REQUIRED', {
        ownerEmail: 'Choose the owner'
      });
    }
    const owner = await resolveOwner(ownerEmail);
    if (owner.error) {
      return sendError(res, owner.error, 400, 'OWNER_NOT_FOUND', { ownerEmail: owner.error });
    }
    const place = ownerLocation(owner.user);
    if (!place) {
      const message = ownerLocationMissing(owner.user);
      return sendError(res, message, 400, 'OWNER_LOCATION_MISSING', { ownerEmail: message });
    }
    if (!coversPlace(req.access, place)) {
      return ownerOutsideArea(res, owner.user);
    }

    let parsedSpecializations = [];
    if (specializations) {
      if (Array.isArray(specializations)) {
        parsedSpecializations = specializations;
      } else if (typeof specializations === 'string') {
        try {
          parsedSpecializations = JSON.parse(specializations);
        } catch (e) {
          parsedSpecializations = specializations.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    let imageUrl = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&auto=format&fit=crop&q=80';
    if (req.file) {
      imageUrl = `${baseUrl}/uploads/businesses/${req.file.filename}`;
    }

    const businessId = `biz_${Date.now().toString().slice(-6)}`;
    const avatarInitials = generateInitials(name);

    const business = await Business.create({
      id: businessId,
      name: name.trim(),
      category: category.trim(),
      specialty: specialty.trim(),
      description: description.trim(),
      imageUrl,
      phoneNumber: phoneNumber.trim(),
      whatsappNumber: whatsappNumber.trim() || phoneNumber.trim(),
      email: email.trim(),
      rating: 5.0,
      reviewCount: 0,
      state: place.state,
      city: place.city,
      sector: place.sector,
      address: address.trim(),
      latitude: latitude ? parseFloat(latitude) : 21.1702,
      longitude: longitude ? parseFloat(longitude) : 72.8311,
      openingTime: openingTime.trim(),
      closingTime: closingTime.trim(),
      isOpen: true,
      avatarInitials,
      specializations: parsedSpecializations,
      businessName: businessName.trim() || name.trim(),
      personalPhone: personalPhone.trim() || phoneNumber.trim(),
      personalEmail: personalEmail.trim() || email.trim(),
      businessPhone: businessPhone.trim() || phoneNumber.trim(),
      businessEmail: businessEmail.trim() || email.trim(),
      ...ownerFields(owner.user),
      isVerified: isVerified === 'true' || isVerified === true,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      status: status.toLowerCase()
    });

    return res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: business
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Existing Business by Admin
 * @route   PUT /api/v1/admin/businesses/:id
 * @access  Private (Admin)
 */
const updateBusiness = async (req, res, next) => {
  try {
    const { id } = req.params;
    const business = await Business.findOne({ id });

    if (!business) {
      return sendError(res, 'Business not found', 404, 'BUSINESS_NOT_FOUND');
    }
    if (!coversPlace(req.access, business)) {
      return sendOutOfScope(res, 'This business');
    }

    // State, city and sector come from the owner and can't be edited here.
    const fields = [
      'name',
      'category',
      'specialty',
      'description',
      'address',
      'phoneNumber',
      'whatsappNumber',
      'email',
      'openingTime',
      'closingTime',
      'businessName',
      'personalPhone',
      'personalEmail',
      'businessPhone',
      'businessEmail',
      'status'
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        business[field] = req.body[field];
      }
    });

    // Only re-check the owner when it changes, so businesses of a removed user can still be edited.
    if (req.body.ownerEmail !== undefined && normalizeEmail(req.body.ownerEmail) !== (business.ownerEmail || '')) {
      const owner = await resolveOwner(req.body.ownerEmail);
      if (owner.error) {
        return sendError(res, owner.error, 400, 'OWNER_NOT_FOUND', { ownerEmail: owner.error });
      }
      // A new owner moves the business to their location; unassigning keeps the current location.
      if (owner.user) {
        const place = ownerLocation(owner.user);
        if (!place) {
          const message = ownerLocationMissing(owner.user);
          return sendError(res, message, 400, 'OWNER_LOCATION_MISSING', { ownerEmail: message });
        }
        if (!coversPlace(req.access, place)) {
          return ownerOutsideArea(res, owner.user);
        }
        Object.assign(business, place);
      }
      Object.assign(business, ownerFields(owner.user));
    }

    if (req.body.name) {
      business.avatarInitials = generateInitials(req.body.name);
    }
    if (req.body.latitude !== undefined) {
      business.latitude = parseFloat(req.body.latitude);
    }
    if (req.body.longitude !== undefined) {
      business.longitude = parseFloat(req.body.longitude);
    }
    if (req.body.rating !== undefined) {
      business.rating = parseFloat(req.body.rating);
    }
    if (req.body.reviewCount !== undefined) {
      business.reviewCount = parseInt(req.body.reviewCount, 10);
    }
    if (req.body.isOpen !== undefined) {
      business.isOpen = req.body.isOpen === 'true' || req.body.isOpen === true;
    }
    if (req.body.isVerified !== undefined) {
      business.isVerified = req.body.isVerified === 'true' || req.body.isVerified === true;
    }
    if (req.body.isFeatured !== undefined) {
      business.isFeatured = req.body.isFeatured === 'true' || req.body.isFeatured === true;
    }

    if (req.body.specializations) {
      if (Array.isArray(req.body.specializations)) {
        business.specializations = req.body.specializations;
      } else if (typeof req.body.specializations === 'string') {
        try {
          business.specializations = JSON.parse(req.body.specializations);
        } catch (e) {
          business.specializations = req.body.specializations.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    if (req.file) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      business.imageUrl = `${baseUrl}/uploads/businesses/${req.file.filename}`;
    }

    await business.save();
    return sendSuccess(res, business, 'Business updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Quick Update of Business Status (Verify, Feature, Open/Close, Active/Inactive)
 * @route   PATCH /api/v1/admin/businesses/:id/status
 * @access  Private (Admin)
 */
const updateBusinessStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, isVerified, isFeatured, isOpen } = req.body;

    const business = await Business.findOne({ id });
    if (!business) {
      return sendError(res, 'Business not found', 404, 'BUSINESS_NOT_FOUND');
    }
    if (!coversPlace(req.access, business)) {
      return sendOutOfScope(res, 'This business');
    }

    if (status !== undefined) business.status = status.toLowerCase();
    if (isVerified !== undefined) business.isVerified = Boolean(isVerified);
    if (isFeatured !== undefined) business.isFeatured = Boolean(isFeatured);
    if (isOpen !== undefined) business.isOpen = Boolean(isOpen);

    await business.save();
    return sendSuccess(res, business, 'Business status updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a Business by Admin
 * @route   DELETE /api/v1/admin/businesses/:id
 * @access  Private (Admin)
 */
const deleteBusiness = async (req, res, next) => {
  try {
    const { id } = req.params;
    const business = await Business.findOne({ id });

    if (!business) {
      return sendError(res, 'Business not found', 404, 'BUSINESS_NOT_FOUND');
    }
    if (!coversPlace(req.access, business)) {
      return sendOutOfScope(res, 'This business');
    }

    await Business.deleteOne({ id });

    return sendSuccess(res, null, 'Business deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  updateBusinessStatus,
  deleteBusiness
};
