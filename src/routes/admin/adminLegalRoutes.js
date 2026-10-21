const express = require('express');
const router = express.Router();
const {
  getLegalPolicies,
  updateLegalPolicy
} = require('../../controllers/admin/adminLegalController');
const { protectAdmin, requireGlobalAdmin } = require('../../middlewares/adminAuthMiddleware');

// Legal policies apply to every location, so only global admins manage them.
router.use(protectAdmin, requireGlobalAdmin);

router.get('/', getLegalPolicies);
router.put('/:type', updateLegalPolicy);

module.exports = router;
