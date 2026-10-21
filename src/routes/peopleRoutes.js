const express = require('express');
const router = express.Router();
const { searchPeople, getPersonById } = require('../controllers/peopleController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Business owners with their businesses (search shows the person first, businesses under them)
router.get('/', optionalAuth, searchPeople);
router.get('/:id', optionalAuth, getPersonById);

module.exports = router;
