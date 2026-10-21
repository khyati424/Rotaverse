const express = require('express');
const router = express.Router();
const { getTermsAndPrivacy } = require('../controllers/legalController');

router.get('/terms-and-privacy', getTermsAndPrivacy);

module.exports = router;
