const express = require('express');
const router = express.Router();
const {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq
} = require('../../controllers/admin/adminFaqController');
const { protectAdmin, requireGlobalAdmin } = require('../../middlewares/adminAuthMiddleware');

// FAQs apply to every location, so only global admins manage them.
router.use(protectAdmin, requireGlobalAdmin);

router.get('/', getFaqs);
router.post('/', createFaq);
router.put('/:id', updateFaq);
router.delete('/:id', deleteFaq);

module.exports = router;
