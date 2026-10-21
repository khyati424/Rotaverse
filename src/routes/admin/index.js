const express = require('express');
const router = express.Router();

const adminAuthRoutes = require('./adminAuthRoutes');
const adminDashboardRoutes = require('./adminDashboardRoutes');
const adminBusinessRoutes = require('./adminBusinessRoutes');
const adminCategoryRoutes = require('./adminCategoryRoutes');
const adminCityRoutes = require('./adminCityRoutes');
const adminStateRoutes = require('./adminStateRoutes');
const adminUserRoutes = require('./adminUserRoutes');
const adminSupportRoutes = require('./adminSupportRoutes');
const adminFaqRoutes = require('./adminFaqRoutes');
const adminNotificationRoutes = require('./adminNotificationRoutes');
const adminLegalRoutes = require('./adminLegalRoutes');
const adminSectorRoutes = require('./adminSectorRoutes');

// Mount Admin sub-routes
router.use('/auth', adminAuthRoutes);
router.use('/dashboard', adminDashboardRoutes);
router.use('/businesses', adminBusinessRoutes);
router.use('/categories', adminCategoryRoutes);
router.use('/cities', adminCityRoutes);
router.use('/sectors', adminSectorRoutes);
router.use('/states', adminStateRoutes);
router.use('/users', adminUserRoutes);
router.use('/support', adminSupportRoutes);
router.use('/faqs', adminFaqRoutes);
router.use('/notifications', adminNotificationRoutes);
router.use('/legal', adminLegalRoutes);

// Admin health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BizFinder Admin API is running smoothly',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
