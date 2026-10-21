const express = require('express');
const router = express.Router();
const {
  getStates,
  getStateOptions,
  getStateById,
  createState,
  updateState,
  deleteState
} = require('../../controllers/admin/adminStateController');
const { protectAdmin, requireGlobalAdmin } = require('../../middlewares/adminAuthMiddleware');

// Every admin sees the states of their area; only global admins add, edit or delete states.
router.get('/', protectAdmin, getStates);
router.get('/options', protectAdmin, getStateOptions);
router.post('/', protectAdmin, requireGlobalAdmin, createState);
router.get('/:id', protectAdmin, getStateById);
router.put('/:id', protectAdmin, requireGlobalAdmin, updateState);
router.delete('/:id', protectAdmin, requireGlobalAdmin, deleteState);

module.exports = router;
