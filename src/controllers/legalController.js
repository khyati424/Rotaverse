const Legal = require('../models/Legal');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * @desc    Get Terms of Service or Privacy Policy
 * @route   GET /api/v1/legal/terms-and-privacy
 * @access  Public
 */
const getTermsAndPrivacy = async (req, res, next) => {
  try {
    const { type = 'terms' } = req.query;

    const normalizedType = type.toLowerCase() === 'privacy' ? 'privacy' : 'terms';

    let legal = await Legal.findOne({ type: normalizedType });

    if (!legal) {
      // Fallback default
      legal = {
        title: normalizedType === 'privacy' ? 'Privacy Policy' : 'Terms of Service',
        lastUpdated: '2026-10-01',
        content:
          normalizedType === 'privacy'
            ? 'We respect your privacy. All user information is collected solely to enhance local business discovery and facilitate vendor contact. We never sell your personal contact info.'
            : 'Welcome to BizFinder. By using our application, you agree to comply with our local business directory guidelines, fair usage policies, and acceptable terms of service.'
      };
    }

    return sendSuccess(
      res,
      {
        title: legal.title,
        lastUpdated: legal.lastUpdated,
        content: legal.content
      },
      'Legal terms retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTermsAndPrivacy
};
