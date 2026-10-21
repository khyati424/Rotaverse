const Legal = require('../../models/Legal');
const { sendSuccess, sendError } = require('../../utils/responseHelper');

/**
 * @desc    Get All Legal Policies
 * @route   GET /api/v1/admin/legal
 * @access  Private (Admin)
 */
const getLegalPolicies = async (req, res, next) => {
  try {
    const policies = await Legal.find().sort({ type: 1 });
    return sendSuccess(res, policies, 'Legal policies retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Legal Policy (Terms or Privacy)
 * @route   PUT /api/v1/admin/legal/:type
 * @access  Private (Admin)
 */
const updateLegalPolicy = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { title, content, lastUpdated } = req.body;

    const normalizedType = type.toLowerCase() === 'privacy' ? 'privacy' : 'terms';

    if (!content) {
      return sendError(res, 'Policy content is required', 400, 'VALIDATION_ERROR');
    }

    const policy = await Legal.findOneAndUpdate(
      { type: normalizedType },
      {
        title: title || (normalizedType === 'privacy' ? 'Privacy Policy' : 'Terms of Service'),
        content,
        lastUpdated: lastUpdated || new Date().toISOString().split('T')[0]
      },
      { upsert: true, returnDocument: 'after' }
    );

    return sendSuccess(res, policy, `${policy.title} updated successfully`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLegalPolicies,
  updateLegalPolicy
};
