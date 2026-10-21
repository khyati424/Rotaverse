const express = require('express');
const router = express.Router();
const {
  getBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  updateBusinessStatus,
  deleteBusiness
} = require('../../controllers/admin/adminBusinessController');
const { protectAdmin } = require('../../middlewares/adminAuthMiddleware');
const { uploadBusinessImage } = require('../../middlewares/uploadMiddleware');

router.get('/', protectAdmin, getBusinesses);
router.post('/', protectAdmin, uploadBusinessImage.single('image'), createBusiness);
router.get('/:id', protectAdmin, getBusinessById);
router.put('/:id', protectAdmin, uploadBusinessImage.single('image'), updateBusiness);
router.patch('/:id/status', protectAdmin, updateBusinessStatus);
router.delete('/:id', protectAdmin, deleteBusiness);

module.exports = router;
