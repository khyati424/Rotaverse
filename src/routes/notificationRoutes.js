const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markRead,
  registerDeviceToken
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getNotifications);
router.patch('/mark-read', protect, markRead);
router.post('/device-token', protect, registerDeviceToken);

module.exports = router;
