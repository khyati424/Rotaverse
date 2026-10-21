const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getMyBusinesses,
  deleteAccount
} = require('../controllers/userController');
const {
  getFavorites,
  addFavorite,
  removeFavorite
} = require('../controllers/favoriteController');
const { createBusiness } = require('../controllers/businessController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadAvatar, uploadBusinessImage } = require('../middlewares/uploadMiddleware');

// User profile endpoints
router.get('/profile', protect, getProfile);
router.put('/profile', protect, uploadAvatar.single('avatar'), updateProfile);
router.delete('/account', protect, deleteAccount);

// Businesses owned by the logged-in user (linked by email)
router.get('/businesses', protect, getMyBusinesses);
router.post('/businesses', protect, uploadBusinessImage.single('image'), createBusiness);

// Favorite people (per specification §3.5): :personId is the person's id from GET /people
router.get('/favorites', protect, getFavorites);
router.post('/favorites', protect, addFavorite);
router.delete('/favorites', protect, removeFavorite);
router.post('/favorites/:personId', protect, addFavorite);
router.delete('/favorites/:personId', protect, removeFavorite);

module.exports = router;
