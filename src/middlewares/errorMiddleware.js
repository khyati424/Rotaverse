const { sendError } = require('../utils/responseHelper');

const notFound = (req, res, next) => {
  return sendError(
    res,
    `Route not found - ${req.method} ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );
};

const errorHandler = (err, req, res, next) => {
  console.error('[Error caught by global handler]:', err);

  // Multer error handling
  if (err.name === 'MulterError') {
    return sendError(res, `Upload error: ${err.message}`, 400, 'UPLOAD_ERROR');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = {};
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(
      res,
      `Duplicate field value: ${field}. Please use another value.`,
      400,
      'DUPLICATE_KEY_ERROR',
      { [field]: `Duplicate value for ${field}` }
    );
  }

  // Default server error
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  return sendError(
    res,
    err.message || 'An unexpected error occurred on the server',
    statusCode,
    'SERVER_ERROR'
  );
};

module.exports = {
  notFound,
  errorHandler
};
