const express = require('express');
const router = express.Router();
const {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  getCitySectors,
  createSector,
  updateSector,
  deleteSector
} = require('../../controllers/admin/adminCityController');
const { protectAdmin } = require('../../middlewares/adminAuthMiddleware');

// City endpoints
router.get('/', protectAdmin, getCities);
router.post('/', protectAdmin, createCity);
router.get('/:id', protectAdmin, getCityById);
router.put('/:id', protectAdmin, updateCity);
router.delete('/:id', protectAdmin, deleteCity);

// Sector endpoints
router.get('/:cityId/sectors', protectAdmin, getCitySectors);
router.post('/:cityId/sectors', protectAdmin, createSector);
router.put('/sectors/:id', protectAdmin, updateSector);
router.delete('/sectors/:id', protectAdmin, deleteSector);

module.exports = router;
