const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

/**
 * Creates the first super admin when the database has no admin accounts at all (e.g. a new server),
 * so someone can log in to the admin panel. Never touches existing data.
 * Set SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD in .env; the dev defaults are admin@bizfinder.com / admin123.
 */
const ensureSuperAdmin = async () => {
  if (await Admin.exists({})) return;
  const email = (process.env.SUPERADMIN_EMAIL || 'admin@bizfinder.com').trim().toLowerCase();
  const password = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'admin123', 10);
  await Admin.create({ id: 'adm_super_1', name: 'Super Admin', email, password, role: 'superadmin' });
  console.log(`[BOOTSTRAP] No admins found, created super admin ${email}`);
};

module.exports = { ensureSuperAdmin };
