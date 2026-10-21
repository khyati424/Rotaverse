const express = require('express');
const router = express.Router();
const {
  login,
  getProfile,
  updateProfile,
  listAdmins,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin
} = require('../../controllers/admin/adminAuthController');
const { protectAdmin } = require('../../middlewares/adminAuthMiddleware');
const { assignableRoles } = require('../../utils/access');
const { sendError } = require('../../utils/responseHelper');

/** Super admins, admins, state admins and city admins manage the admins below them. */
const requireAdminManager = (req, res, next) => {
  if (!assignableRoles(req.access).length) {
    return sendError(res, 'Your role cannot manage admin accounts', 403, 'FORBIDDEN');
  }
  next();
};

router.post('/login', login);
router.get('/profile', protectAdmin, getProfile);
router.put('/profile', protectAdmin, updateProfile);

// Admin team: each admin manages lower roles inside their own area
router.get('/admins', protectAdmin, requireAdminManager, listAdmins);
router.post('/admins', protectAdmin, requireAdminManager, createAdmin);
router.put('/admins/:id', protectAdmin, requireAdminManager, updateAdmin);
router.patch('/admins/:id/status', protectAdmin, requireAdminManager, toggleAdminStatus);
router.delete('/admins/:id', protectAdmin, requireAdminManager, deleteAdmin);

module.exports = router;
