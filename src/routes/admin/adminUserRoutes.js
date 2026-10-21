const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUserStatus,
  updateUser,
  deleteUser
} = require('../../controllers/admin/adminUserController');
const { protectAdmin } = require('../../middlewares/adminAuthMiddleware');

router.get('/', protectAdmin, getUsers);
router.post('/', protectAdmin, createUser);
router.get('/:id', protectAdmin, getUserById);
router.patch('/:id/status', protectAdmin, updateUserStatus);
router.put('/:id', protectAdmin, updateUser);
router.delete('/:id', protectAdmin, deleteUser);

module.exports = router;
