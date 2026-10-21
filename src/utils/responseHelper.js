/**
 * Standard API Response Envelope Helpers
 * Conforms to BizFinder API Specification v1.0
 */

const sendSuccess = (res, data = {}, message = 'Operation completed successfully', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const sendPaginated = (res, data = [], meta = {}, message = 'Data retrieved successfully', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      total: meta.total || data.length,
      page: meta.page || 1,
      limit: meta.limit || 20,
      totalPages: meta.totalPages || 1
    }
  });
};

const sendError = (res, message = 'Internal Server Error', statusCode = 500, errorCode = 'SERVER_ERROR', errors = null) => {
  const payload = {
    success: false,
    message,
    errorCode
  };

  if (errors) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendPaginated,
  sendError
};
