const Business = require('../models/Business');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateInitials } = require('../utils/idGenerator');
const { ownedBy, isOwner, ownerFields } = require('../utils/ownership');
const { ownerLocation } = require('../utils/location');

/**
 * @desc    Get all listings owned by logged-in vendor
 * @route   GET /api/v1/vendor/listings
 * @access  Private
 */
const getMyListings = async (req, res, next) => {
  try {
    const listings = await Business.find(ownedBy(req.user)).sort({ createdAt: -1 });
    return sendSuccess(res, listings, 'Vendor listings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new business listing
 * @route   POST /api/v1/vendor/listings
 * @access  Private
 */
const createListing = async (req, res, next) => {
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
      businessEmail = ''
    } = req.body;

    // Required fields check
    const errors = {};
    if (!name) errors.name = 'Business name is required';
    if (!category) errors.category = 'Category is required';
    if (!address) errors.address = 'Address is required';
    if (latitude === undefined || latitude === '') errors.latitude = 'Latitude is required';
    if (longitude === undefined || longitude === '') errors.longitude = 'Longitude is required';
    if (!phoneNumber) errors.phoneNumber = 'Phone number is required';

    if (Object.keys(errors).length > 0) {
      return sendError(res, 'Please provide all required fields', 400, 'VALIDATION_ERROR', errors);
    }

    // The listing is placed where its owner is (state/city/sector set by the admin on the user).
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
      email: email.trim() || req.user.email,
      rating: 5.0,
      reviewCount: 0,
      state: place.state,
      city: place.city,
      sector: place.sector,
      address: address.trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      openingTime: openingTime.trim(),
      closingTime: closingTime.trim(),
      isOpen: true,
      avatarInitials,
      specializations: parsedSpecializations,
      businessName: businessName.trim() || name.trim(),
      personalPhone: personalPhone.trim() || phoneNumber.trim(),
      personalEmail: personalEmail.trim() || email.trim() || req.user.email,
      businessPhone: businessPhone.trim() || phoneNumber.trim(),
      businessEmail: businessEmail.trim() || email.trim(),
      ...ownerFields(req.user)
    });

    return res.status(201).json({
      success: true,
      message: 'Business listing created successfully',
      data: business.toJSON()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update existing listing
 * @route   PUT /api/v1/vendor/listings/:id
 * @access  Private
 */
const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;

    const business = await Business.findOne({ id });
    if (!business) {
      return sendError(res, 'Listing not found', 404, 'NOT_FOUND');
    }

    if (!isOwner(business, req.user)) {
      return sendError(res, 'You do not have permission to modify this listing', 403, 'FORBIDDEN');
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
      'businessEmail'
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        business[field] = req.body[field];
      }
    });

    if (req.body.name) {
      business.avatarInitials = generateInitials(req.body.name);
    }

    if (req.body.latitude !== undefined) {
      business.latitude = parseFloat(req.body.latitude);
    }
    if (req.body.longitude !== undefined) {
      business.longitude = parseFloat(req.body.longitude);
    }
    if (req.body.isOpen !== undefined) {
      business.isOpen = req.body.isOpen === 'true' || req.body.isOpen === true;
    }

    if (req.body.specializations) {
      if (Array.isArray(req.body.specializations)) {
        business.specializations = req.body.specializations;
      } else if (typeof req.body.specializations === 'string') {
        try {
          business.specializations = JSON.parse(req.body.specializations);
        } catch (e) {
          business.specializations = req.body.specializations
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    if (req.file) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      business.imageUrl = `${baseUrl}/uploads/businesses/${req.file.filename}`;
    }

    await business.save();

    return sendSuccess(res, business.toJSON(), 'Business listing updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a business listing
 * @route   DELETE /api/v1/vendor/listings/:id
 * @access  Private
 */
const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;

    const business = await Business.findOne({ id });
    if (!business) {
      return sendError(res, 'Listing not found', 404, 'NOT_FOUND');
    }

    if (!isOwner(business, req.user)) {
      return sendError(res, 'You do not have permission to delete this listing', 403, 'FORBIDDEN');
    }

    await Business.deleteOne({ id });

    return sendSuccess(res, null, 'Listing deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyListings,
  createListing,
  updateListing,
  deleteListing
};
