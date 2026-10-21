const express = require('express');
const router = express.Router();
const { getCities, getCitySectors } = require('../controllers/cityController');
const { getStates } = require('../controllers/stateController');

router.get('/', getCities);
router.get('/states', getStates);
router.get('/:cityId/sectors', getCitySectors);

module.exports = router;
