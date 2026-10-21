const express = require('express');
const router = express.Router();
const {
  getInquiries,
  getInquiryById,
  updateInquiryStatus,
  deleteInquiry
} = require('../../controllers/admin/adminSupportController');
const { protectAdmin, requireGlobalAdmin } = require('../../middlewares/adminAuthMiddleware');

// Support tickets aren't tied to a location, so only global admins handle them.
router.use(protectAdmin, requireGlobalAdmin);

router.get('/inquiries', getInquiries);
router.get('/inquiries/:ticketId', getInquiryById);
router.patch('/inquiries/:ticketId/status', updateInquiryStatus);
router.delete('/inquiries/:ticketId', deleteInquiry);

module.exports = router;
