const express = require('express');
const router = express.Router();
const {
  getMyListings,
  createListing,
  updateListing,
  deleteListing
} = require('../controllers/vendorController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadBusinessImage } = require('../middlewares/uploadMiddleware');

router.get('/listings', protect, getMyListings);
router.post('/listings', protect, uploadBusinessImage.single('image'), createListing);
router.put('/listings/:id', protect, uploadBusinessImage.single('image'), updateListing);
router.delete('/listings/:id', protect, deleteListing);

module.exports = router;
