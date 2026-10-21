const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const cityRoutes = require('./cityRoutes');
const stateRoutes = require('./stateRoutes');
const categoryRoutes = require('./categoryRoutes');
const businessRoutes = require('./businessRoutes');
const peopleRoutes = require('./peopleRoutes');
const searchRoutes = require('./searchRoutes');
const vendorRoutes = require('./vendorRoutes');
const notificationRoutes = require('./notificationRoutes');
const supportRoutes = require('./supportRoutes');
const legalRoutes = require('./legalRoutes');
const adminSectorRoutes = require('./admin/adminSectorRoutes');
const adminRoutes = require('./admin');

// Mount routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/cities', cityRoutes);
router.use('/states', stateRoutes);
router.use('/categories', categoryRoutes);
router.use('/businesses', businessRoutes);
router.use('/people', peopleRoutes);
router.use('/search', searchRoutes);
router.use('/vendor', vendorRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', supportRoutes);
router.use('/legal', legalRoutes);
router.use('/admin/sectors', adminSectorRoutes);
router.use('/admin', adminRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BizFinder API is running smoothly',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
