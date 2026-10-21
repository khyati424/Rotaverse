const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// One search box: people by name, mobile number, business or specialization keywords
router.get('/', optionalAuth, globalSearch);

module.exports = router;
