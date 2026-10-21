const Business = require('../models/Business');
const { sendSuccess, sendPaginated, sendError } = require('../utils/responseHelper');
const { calculateDistance } = require('../utils/distanceCalculator');
const { ownerLocation, findStateName } = require('../utils/location');
const { escapeRegex } = require('../utils/businessCountHelper');
const { ownerFields } = require('../utils/ownership');
const { favoriteOwnerEmailsOf } = require('../utils/favorites');

/**
 * Helper to enrich business document with `isFavorite` and `distance`.
 * Favorites are people, so a business is a favorite when its owner is one of the people the user saved
 * (`favoriteOwnerEmails`, from favoriteOwnerEmailsOf).
 */
const enrichBusiness = (businessDoc, favoriteOwnerEmails = null, userLat = null, userLon = null) => {
  const b = businessDoc.toJSON ? businessDoc.toJSON() : { ...businessDoc };

  b.isFavorite = favoriteOwnerEmails ? !!b.ownerEmail && favoriteOwnerEmails.has(b.ownerEmail) : false;

  if (userLat !== null && userLon !== null && b.latitude && b.longitude) {
    b.distance = calculateDistance(userLat, userLon, b.latitude, b.longitude) || b.distance || 'N/A';
  } else if (!b.distance) {
    b.distance = 'N/A';
  }

  return b;
};

/**
 * @desc    Get businesses with filters, pagination, search, distance
 * @route   GET /api/v1/businesses
 * @access  Public / Optional Auth
 */
const getBusinesses = async (req, res, next) => {
  try {
    const {
      query,
      category,
      state,
      city,
      sector,
      minRating,
      openOnly,
      latitude,
      longitude,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (query && query.trim()) {
      const q = query.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { name: regex },
        { specialty: regex },
        { description: regex },
        { address: regex },
        { category: regex }
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

    if (minRating) {
      const parsedRating = parseFloat(minRating);
      if (!isNaN(parsedRating)) {
        filter.rating = { $gte: parsedRating };
      }
    }

    if (openOnly === 'true' || openOnly === true) {
      filter.isOpen = true;
    }

    const total = await Business.countDocuments(filter);
    const businesses = await Business.find(filter)
      .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Owners the user saved as favorites (empty for guests)
    const favoriteOwners = await favoriteOwnerEmailsOf(req.user);

    const enriched = businesses.map((b) =>
      enrichBusiness(b, favoriteOwners, latitude, longitude)
    );

    const totalPages = Math.ceil(total / limitNum) || 1;

    return sendPaginated(
      res,
      enriched,
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      },
      'Businesses retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single business by ID
 * @route   GET /api/v1/businesses/:id
 * @access  Public / Optional Auth
 */
const getBusinessById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.query;

    const business = await Business.findOne({ id });
    if (!business) {
      return sendError(res, 'Business not found', 404, 'BUSINESS_NOT_FOUND');
    }

    const favoriteOwners = await favoriteOwnerEmailsOf(req.user);

    const enriched = enrichBusiness(business, favoriteOwners, latitude, longitude);
    return sendSuccess(res, enriched, 'Business details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get top rated businesses for home screen
 * @route   GET /api/v1/businesses/top-rated
 * @access  Public / Optional Auth
 */
const getTopRatedBusinesses = async (req, res, next) => {
  try {
    const { city, limit = 10, latitude, longitude } = req.query;
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    const filter = {};
    if (city && city.toLowerCase() !== 'all') {
      filter.city = new RegExp(`^${city.trim()}$`, 'i');
    }

    const businesses = await Business.find(filter)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(limitNum);

    const favoriteOwners = await favoriteOwnerEmailsOf(req.user);

    const enriched = businesses.map((b) =>
      enrichBusiness(b, favoriteOwners, latitude, longitude)
    );

    return sendSuccess(res, enriched, 'Top-rated businesses retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to generate 2-letter avatar initials
 */
const generateInitials = (name) => {
  if (!name) return 'BI';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

/**
 * @desc    Create a new business (User Side)
 * @route   POST /api/v1/businesses or POST /api/v1/user/businesses
 * @access  Private (logged-in user; the business is owned by the user's email)
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
      isOpen = true,
      imageUrl: customImageUrl
    } = req.body;

    // Required fields validation
    const errors = {};
    if (!name || typeof name !== 'string' || !name.trim()) errors.name = 'Business name is required';
    if (!category || typeof category !== 'string' || !category.trim()) errors.category = 'Category is required';
    if (!address || typeof address !== 'string' || !address.trim()) errors.address = 'Address is required';
    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';

    if (Object.keys(errors).length > 0) {
      return sendError(res, 'Please provide all required fields', 400, 'VALIDATION_ERROR', errors);
    }

    // The business is placed where its owner is (state/city/sector set by the admin on the user).
    const place = ownerLocation(req.user);
    if (!place) {
      return sendError(
        res,
        'Your state, city and sector are not set yet. Please contact the admin.',
        400,
        'LOCATION_NOT_SET'
      );
    }

    // Process specializations
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

    // Process image
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    let imageUrl = customImageUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&auto=format&fit=crop&q=80';
    if (req.file) {
      imageUrl = `${baseUrl}/uploads/businesses/${req.file.filename}`;
    }

    const businessId = `biz_${Date.now().toString().slice(-6)}`;
    const avatarInitials = generateInitials(name);

    // Fallback latitude/longitude to defaults if not provided
    const lat = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : 21.1702;
    const lon = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : 72.8311;

    const userEmail = req.user.email;

    const business = await Business.create({
      id: businessId,
      name: name.trim(),
      category: category.trim(),
      specialty: specialty.trim(),
      description: description.trim(),
      imageUrl,
      phoneNumber: phoneNumber.trim(),
      whatsappNumber: whatsappNumber.trim() || phoneNumber.trim(),
      email: email.trim() || userEmail,
      rating: 5.0,
      reviewCount: 0,
      state: place.state,
      city: place.city,
      sector: place.sector,
      address: address.trim(),
      latitude: isNaN(lat) ? 21.1702 : lat,
      longitude: isNaN(lon) ? 72.8311 : lon,
      openingTime: openingTime.trim(),
      closingTime: closingTime.trim(),
      isOpen: isOpen === 'true' || isOpen === true,
      avatarInitials,
      specializations: parsedSpecializations,
      businessName: businessName.trim() || name.trim(),
      personalPhone: personalPhone.trim() || phoneNumber.trim(),
      personalEmail: personalEmail.trim() || email.trim() || userEmail,
      businessPhone: businessPhone.trim() || phoneNumber.trim(),
      businessEmail: businessEmail.trim() || email.trim(),
      ...ownerFields(req.user)
    });

    return res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: business.toJSON()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBusinesses,
  getBusinessById,
  getTopRatedBusinesses,
  createBusiness,
  enrichBusiness
};
