const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { sendError } = require('../utils/responseHelper');
const { loadAccess } = require('../utils/access');

const protectAdmin = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Admin authentication token is required', 401, 'UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secret_jwt_key_bizfinder_2026_dev'
    );

    const admin = await Admin.findOne({ id: decoded.id });

    if (!admin) {
      return sendError(res, 'Admin account not found or access revoked', 401, 'ADMIN_NOT_FOUND');
    }

    if (!admin.isActive) {
      return sendError(res, 'This admin account has been deactivated', 403, 'ADMIN_DEACTIVATED');
    }

    req.admin = admin;
  } catch (error) {
    return sendError(res, 'Invalid or expired admin access token', 401, 'INVALID_TOKEN');
  }

  try {
    // The states, cities and sectors this admin may see and manage (see utils/access.js).
    req.access = await loadAccess(req.admin);
    next();
  } catch (error) {
    next(error);
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return sendError(res, 'Superadmin privilege required for this action', 403, 'FORBIDDEN');
  }
  next();
};

/** Content and settings shared by every location (categories, FAQs, legal, broadcasts, support). */
const requireGlobalAdmin = (req, res, next) => {
  if (!req.access || !req.access.isGlobal) {
    return sendError(res, 'Only admins who manage every location can do this', 403, 'FORBIDDEN');
  }
  next();
};

module.exports = {
  protectAdmin,
  requireSuperAdmin,
  requireGlobalAdmin
};
