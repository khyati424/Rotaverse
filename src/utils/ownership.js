const Business = require('../models/Business');
const User = require('../models/User');

/**
 * Businesses belong to an app user's email (Business.ownerEmail).
 * ownerId is still written for older clients, but ownership checks use the email.
 */

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => EMAIL_REGEX.test(normalizeEmail(email));

/** Mongo filter for every business owned by the given user. */
const ownedBy = (user) => ({ ownerEmail: normalizeEmail(user.email) });

/** True when the business belongs to the given user. Unowned businesses belong to nobody. */
const isOwner = (business, user) =>
  !!business.ownerEmail && !!user && business.ownerEmail === normalizeEmail(user.email);

/** Fields to set on a business so it belongs to `user`. */
const ownerFields = (user) => ({
  ownerId: user ? user.id : null,
  ownerEmail: user ? normalizeEmail(user.email) : ''
});

/** Number of businesses per owner email, for a list of users. */
const countByOwner = async (users) => {
  const emails = users.map((u) => normalizeEmail(u.email));
  if (!emails.length) return new Map();
  const rows = await Business.aggregate([
    { $match: { ownerEmail: { $in: emails } } },
    { $group: { _id: '$ownerEmail', count: { $sum: 1 } } }
  ]);
  return new Map(rows.map((r) => [r._id, r.count]));
};

/**
 * One-time migration: businesses created before ownerEmail existed only have ownerId.
 * Copy the owner's email onto them. Safe to run on every start.
 */
const backfillOwnerEmails = async () => {
  const missing = { $or: [{ ownerEmail: { $exists: false } }, { ownerEmail: '' }, { ownerEmail: null }] };
  const ownerIds = await Business.distinct('ownerId', { ...missing, ownerId: { $nin: [null, ''] } });
  if (!ownerIds.length) return 0;

  const users = await User.find({ id: { $in: ownerIds } }).select('id email').lean();
  let updated = 0;
  for (const u of users) {
    const res = await Business.updateMany({ ...missing, ownerId: u.id }, { $set: { ownerEmail: normalizeEmail(u.email) } });
    updated += res.modifiedCount || 0;
  }
  if (updated) console.log(`[MIGRATION] Linked ${updated} existing business(es) to their owner's email`);
  return updated;
};

module.exports = {
  normalizeEmail,
  isValidEmail,
  ownedBy,
  isOwner,
  ownerFields,
  countByOwner,
  backfillOwnerEmails
};
