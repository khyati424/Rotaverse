const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/responseHelper');

const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Access token is required. Please log in.', 401, 'UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_bizfinder_2026_dev');
    const user = await User.findOne({ id: decoded.id });

    if (!user) {
      return sendError(res, 'User associated with this token no longer exists.', 401, 'USER_NOT_FOUND');
    }

    if (user.status !== 'active') {
      return sendError(res, `Your account has been ${user.status}. Please contact the admin.`, 403, 'ACCOUNT_BLOCKED');
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired access token.', 401, 'INVALID_TOKEN');
  }
};

const optionalAuth = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_bizfinder_2026_dev');
    const user = await User.findOne({ id: decoded.id });
    req.user = user && user.status === 'active' ? user : null;
  } catch (error) {
    req.user = null;
  }

  next();
};

module.exports = {
  protect,
  optionalAuth
};
