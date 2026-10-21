const express = require('express');
const router = express.Router();
const {
  getBusinesses,
  getBusinessById,
  getTopRatedBusinesses,
  createBusiness
} = require('../controllers/businessController');
const { optionalAuth, protect } = require('../middlewares/authMiddleware');
const { uploadBusinessImage } = require('../middlewares/uploadMiddleware');

router.get('/', optionalAuth, getBusinesses);
router.get('/top-rated', optionalAuth, getTopRatedBusinesses);
router.get('/:id', optionalAuth, getBusinessById);
// Only logged-in users can add a business; it is stored under their email.
router.post('/', protect, uploadBusinessImage.single('image'), createBusiness);

module.exports = router;
