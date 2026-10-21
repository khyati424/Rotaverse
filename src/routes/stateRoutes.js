const express = require('express');
const router = express.Router();
const {
  getStates,
  getStateById,
  getStateCities
} = require('../controllers/stateController');

router.get('/', getStates);
router.get('/:id', getStateById);
router.get('/:stateId/cities', getStateCities);

module.exports = router;
