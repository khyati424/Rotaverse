const express = require('express');
const router = express.Router();
const {
  getNotifications,
  broadcastNotification,
  deleteNotification
} = require('../../controllers/admin/adminNotificationController');
const { protectAdmin, requireGlobalAdmin } = require('../../middlewares/adminAuthMiddleware');

// Broadcasts reach every app user, so only global admins send them.
router.use(protectAdmin, requireGlobalAdmin);

router.get('/', getNotifications);
router.post('/broadcast', broadcastNotification);
router.delete('/:id', deleteNotification);

module.exports = router;
