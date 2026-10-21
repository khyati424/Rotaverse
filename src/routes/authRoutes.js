const express = require('express');
const router = express.Router();
const {
  sendOtp,
  resendOtp,
  verifyOtp,
  googleAuth,
  appleAuth,
  refreshToken
} = require('../controllers/authController');

router.post('/send-otp', sendOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google', googleAuth);
router.post('/apple', appleAuth);
router.post('/refresh-token', refreshToken);

module.exports = router;
