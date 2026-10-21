const express = require('express');
const router = express.Router();
const {
  updateSector,
  deleteSector
} = require('../../controllers/admin/adminCityController');
const { protectAdmin } = require('../../middlewares/adminAuthMiddleware');

// Sector management endpoints
router.put('/:sectorId', protectAdmin, updateSector);
router.delete('/:sectorId', protectAdmin, deleteSector);

module.exports = router;
