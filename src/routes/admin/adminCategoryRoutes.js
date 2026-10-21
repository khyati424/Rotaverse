const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../../controllers/admin/adminCategoryController');
const { protectAdmin, requireGlobalAdmin } = require('../../middlewares/adminAuthMiddleware');

// Every admin can read categories (business forms need them); only global admins change them.
router.get('/', protectAdmin, getCategories);
router.post('/', protectAdmin, requireGlobalAdmin, createCategory);
router.get('/:id', protectAdmin, getCategoryById);
router.put('/:id', protectAdmin, requireGlobalAdmin, updateCategory);
router.delete('/:id', protectAdmin, requireGlobalAdmin, deleteCategory);

module.exports = router;
