const express = require('express');
const router = express.Router();
const { getStats } = require('../../controllers/admin/adminDashboardController');
const { protectAdmin } = require('../../middlewares/adminAuthMiddleware');

router.get('/stats', protectAdmin, getStats);

module.exports = router;
