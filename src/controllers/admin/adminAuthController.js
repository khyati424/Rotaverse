const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../../models/Admin');
const { sendSuccess, sendError } = require('../../utils/responseHelper');
const { isValidEmail, normalizeEmail } = require('../../utils/ownership');
const { isMailConfigured, sendAdminInviteEmail } = require('../../utils/mailer');
const {
  ROLES,
  loadAccess,
  assignableRoles,
  checkAssignment,
  canManageAdmin,
  describeAdmins,
  describeSelf
} = require('../../utils/access');

/** Same rules as the admin panel: 8–64 characters, no spaces, at least one letter and one number. */
const passwordProblem = (password) => {
  const p = String(password || '');
  if (p.length < 8 || p.length > 64) return 'Password must be 8 to 64 characters';
  if (/\s/.test(p)) return "Password can't contain spaces";
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return 'Password needs at least one letter and one number';
  return null;
};

const scopeIds = (body) => ({ states: body.states, cities: body.cities, sectors: body.sectors });
const roleLabel = (role) => (ROLES[role] || { label: role }).label;
const NOT_YOURS = 'You can only manage admins below your role inside your area';

const generateAdminToken = (adminId) => {
  return jwt.sign(
    { id: adminId, isAdmin: true },
    process.env.JWT_SECRET || 'super_secret_jwt_key_bizfinder_2026_dev',
    { expiresIn: '7d' }
  );
};

/**
 * @desc    Admin Login
 * @route   POST /api/v1/admin/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400, 'VALIDATION_ERROR', {
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    if (!admin) {
      return sendError(res, 'Invalid admin email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!admin.isActive) {
      return sendError(res, 'Your admin account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid admin email or password', 401, 'INVALID_CREDENTIALS');
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateAdminToken(admin.id);

    return sendSuccess(
      res,
      {
        token,
        admin: await describeSelf(admin, await loadAccess(admin))
      },
      'Admin logged in successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Current Admin Profile
 * @route   GET /api/v1/admin/auth/profile
 * @access  Private (Admin)
 */
const getProfile = async (req, res, next) => {
  try {
    return sendSuccess(res, await describeSelf(req.admin, req.access), 'Admin profile retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Admin Profile or Password
 * @route   PUT /api/v1/admin/auth/profile
 * @access  Private (Admin)
 */
const updateProfile = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ id: req.admin.id });
    const { name, avatarUrl, currentPassword, newPassword } = req.body;

    if (name) admin.name = name.trim();
    if (avatarUrl) admin.avatarUrl = avatarUrl.trim();

    if (newPassword) {
      if (!currentPassword) {
        return sendError(res, 'Current password is required to set new password', 400, 'PASSWORD_REQUIRED');
      }
      const isMatch = await admin.matchPassword(currentPassword);
      if (!isMatch) {
        return sendError(res, 'Current password does not match', 400, 'INVALID_CURRENT_PASSWORD');
      }
      const problem = passwordProblem(newPassword);
      if (problem) {
        return sendError(res, problem, 400, 'VALIDATION_ERROR', { newPassword: problem });
      }
      admin.password = await bcrypt.hash(newPassword, 10);
    }

    await admin.save();
    return sendSuccess(res, await describeSelf(admin, req.access), 'Admin profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List admin accounts. Super admins and admins see every account; state and city admins see the
 *          accounts they can manage (lower roles inside their area). Each row has canManage and its area.
 * @route   GET /api/v1/admin/auth/admins
 * @access  Private (admins who can manage other admins)
 */
const listAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });
    const rows = [];
    for (const a of admins) {
      const canManage = await canManageAdmin(req.access, a);
      if (req.access.isGlobal || canManage) rows.push({ admin: a, canManage });
    }
    const described = await describeAdmins(rows.map((r) => r.admin));
    described.forEach((d, i) => {
      d.canManage = rows[i].canManage;
    });
    return sendSuccess(res, described, 'Admin accounts retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create an admin account. state_admin needs states, city_admin cities, sector_admin sectors
 *          (ids, each inside the creator's own area). The role must be below the creator's, except that
 *          super admins can create any role.
 * @route   POST /api/v1/admin/auth/admins
 * @access  Private (admins who can manage other admins)
 */
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role = 'admin' } = req.body;

    if (!name || !String(name).trim() || !email || !password) {
      return sendError(res, 'Name, email and password are required', 400, 'VALIDATION_ERROR', {
        name: !name || !String(name).trim() ? 'Name is required' : undefined,
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined
      });
    }
    if (!isValidEmail(email)) {
      return sendError(res, 'Enter a valid email address', 400, 'VALIDATION_ERROR', { email: 'Enter a valid email address' });
    }
    const problem = passwordProblem(password);
    if (problem) {
      return sendError(res, problem, 400, 'VALIDATION_ERROR', { password: problem });
    }

    const roleValue = String(role).trim().toLowerCase();
    if (!assignableRoles(req.access).includes(roleValue)) {
      return sendError(res, `You can't create a ${roleLabel(roleValue)} account`, 403, 'ROLE_NOT_ALLOWED', {
        role: 'Choose one of the roles you can give'
      });
    }

    const assignment = await checkAssignment(req.access, roleValue, scopeIds(req.body));
    if (assignment.error) {
      return sendError(res, assignment.error, 400, 'INVALID_SCOPE', { [assignment.field]: assignment.error });
    }

    const normalized = normalizeEmail(email);
    if (await Admin.exists({ email: normalized })) {
      return sendError(res, 'Admin with this email already exists', 400, 'DUPLICATE_EMAIL', { email: 'This email is already an admin' });
    }

    const newAdmin = await Admin.create({
      id: `adm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name: String(name).trim(),
      email: normalized,
      password: await bcrypt.hash(password, 10),
      role: roleValue,
      ...assignment.scope,
      createdBy: req.admin.id
    });

    const [data] = await describeAdmins([newAdmin]);
    data.canManage = true;

    // Invite the new admin by email with their role and sign-in details. The account already exists,
    // so a mail failure must not fail the request.
    let inviteEmailSent = false;
    if (isMailConfigured()) {
      try {
        await sendAdminInviteEmail({
          email: normalized,
          name: newAdmin.name,
          roleLabel: roleLabel(roleValue),
          password,
          invitedBy: req.admin.name
        });
        inviteEmailSent = true;
      } catch (mailError) {
        console.error(`[ADMIN] Could not send admin invitation to ${normalized}:`, mailError.message);
      }
    }
    data.inviteEmailSent = inviteEmailSent;

    return sendSuccess(
      res,
      data,
      inviteEmailSent
        ? 'Admin account created and invitation email sent'
        : 'Admin account created, but the invitation email could not be sent',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit an admin account: name, email, role, area, and optionally a new password.
 *          Area fields: states / cities / sectors (ids), whichever matches the role.
 * @route   PUT /api/v1/admin/auth/admins/:id
 * @access  Private (admins who can manage the target account)
 */
const updateAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ id: req.params.id });
    if (!admin) {
      return sendError(res, 'Admin account not found', 404, 'ADMIN_NOT_FOUND');
    }
    if (admin.id === req.admin.id) {
      return sendError(res, 'Use My profile to change your own account', 400, 'INVALID_ACTION');
    }
    if (!(await canManageAdmin(req.access, admin))) {
      return sendError(res, NOT_YOURS, 403, 'FORBIDDEN');
    }

    const { name, email, password } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) {
        return sendError(res, 'Name is required', 400, 'VALIDATION_ERROR', { name: 'Name is required' });
      }
      admin.name = String(name).trim();
    }

    if (email !== undefined && normalizeEmail(email) !== admin.email) {
      if (!isValidEmail(email)) {
        return sendError(res, 'Enter a valid email address', 400, 'VALIDATION_ERROR', { email: 'Enter a valid email address' });
      }
      if (await Admin.exists({ email: normalizeEmail(email), id: { $ne: admin.id } })) {
        return sendError(res, 'Admin with this email already exists', 400, 'DUPLICATE_EMAIL', { email: 'This email is already an admin' });
      }
      admin.email = normalizeEmail(email);
    }

    if (password) {
      const problem = passwordProblem(password);
      if (problem) {
        return sendError(res, problem, 400, 'VALIDATION_ERROR', { password: problem });
      }
      admin.password = await bcrypt.hash(password, 10);
    }

    // Role and area are checked together: the area must match the (new) role and sit inside the editor's area.
    const roleValue = req.body.role !== undefined ? String(req.body.role).trim().toLowerCase() : admin.role;
    const areaSent = ['states', 'cities', 'sectors'].some((k) => req.body[k] !== undefined);
    if (roleValue !== admin.role || areaSent) {
      if (!assignableRoles(req.access).includes(roleValue)) {
        return sendError(res, `You can't give the ${roleLabel(roleValue)} role`, 403, 'ROLE_NOT_ALLOWED', {
          role: 'Choose one of the roles you can give'
        });
      }
      const ids = areaSent ? scopeIds(req.body) : { states: admin.states, cities: admin.cities, sectors: admin.sectors };
      const assignment = await checkAssignment(req.access, roleValue, ids);
      if (assignment.error) {
        return sendError(res, assignment.error, 400, 'INVALID_SCOPE', { [assignment.field]: assignment.error });
      }
      admin.role = roleValue;
      Object.assign(admin, assignment.scope);
    }

    await admin.save();
    const [data] = await describeAdmins([admin]);
    data.canManage = true;
    return sendSuccess(res, data, 'Admin account updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle Admin Active Status
 * @route   PATCH /api/v1/admin/auth/admins/:id/status
 * @access  Private (admins who can manage the target account)
 */
const toggleAdminStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const admin = await Admin.findOne({ id });
    if (!admin) {
      return sendError(res, 'Admin account not found', 404, 'ADMIN_NOT_FOUND');
    }

    if (admin.id === req.admin.id) {
      return sendError(res, 'You cannot deactivate your own account', 400, 'INVALID_ACTION');
    }
    if (!(await canManageAdmin(req.access, admin))) {
      return sendError(res, NOT_YOURS, 403, 'FORBIDDEN');
    }

    admin.isActive = isActive !== undefined ? Boolean(isActive) : !admin.isActive;
    await admin.save();

    const [data] = await describeAdmins([admin]);
    data.canManage = true;
    return sendSuccess(res, data, `Admin account ${admin.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove an admin account. They are signed out on their next request.
 * @route   DELETE /api/v1/admin/auth/admins/:id
 * @access  Private (admins who can manage the target account)
 */
const deleteAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ id: req.params.id });
    if (!admin) {
      return sendError(res, 'Admin account not found', 404, 'ADMIN_NOT_FOUND');
    }
    if (admin.id === req.admin.id) {
      return sendError(res, 'You cannot remove your own account', 400, 'INVALID_ACTION');
    }
    if (!(await canManageAdmin(req.access, admin))) {
      return sendError(res, NOT_YOURS, 403, 'FORBIDDEN');
    }

    await Admin.deleteOne({ id: admin.id });
    return sendSuccess(res, { id: admin.id }, 'Admin account removed');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getProfile,
  updateProfile,
  listAdmins,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin
};
