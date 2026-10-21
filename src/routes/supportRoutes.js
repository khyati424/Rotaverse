const express = require('express');
const router = express.Router();
const { getFaqs, submitInquiry } = require('../controllers/supportController');
const { optionalAuth } = require('../middlewares/authMiddleware');

router.get('/faqs', getFaqs);
router.post('/inquiry', optionalAuth, submitInquiry);

module.exports = router;
