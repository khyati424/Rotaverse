const User = require('../models/User');

/**
 * Indian mobile numbers. Users log in with theirs, so the number is stored as +91XXXXXXXXXX and every
 * lookup compares the 10 local digits, whatever format an older record was saved in.
 */

const COUNTRY_CODE = '+91';

/** The 10 local digits of an Indian number in any saved format (+91…, 91…, 0…, with spaces). */
const phoneDigits = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};

/** True for a 10-digit Indian mobile number (starts with 6, 7, 8 or 9). */
const isValidMobile = (raw) => /^[6-9]\d{9}$/.test(phoneDigits(raw));

/** "+919876543210" for a valid number, "" for an empty one. */
const toStoredPhone = (raw) => {
  const d = phoneDigits(raw);
  return d ? `${COUNTRY_CODE}${d}` : '';
};

/** "+91 ******3210": shown in responses so a typed number can be confirmed without exposing it. */
const maskPhone = (raw) => `${COUNTRY_CODE} ******${phoneDigits(raw).slice(-4)}`;

/** Every user whose saved number has these 10 digits (more than one means the number is shared). */
const findUsersByPhone = async (raw, extraFilter = {}) => {
  const digits = phoneDigits(raw);
  if (!digits) return [];
  const candidates = await User.find({ ...extraFilter, phoneNumber: { $regex: `${digits.slice(-4)}$` } });
  return candidates.filter((u) => phoneDigits(u.phoneNumber) === digits);
};

/**
 * Admin-side check for a user's mobile number. Returns { phone } (normalized) or { error } with a
 * field message. `exceptId` skips the user being edited when checking that the number is free.
 */
const checkUserPhone = async (raw, { exceptId } = {}) => {
  if (!String(raw || '').trim()) {
    return { error: 'Mobile number is required. Users log in to the app with it.', code: 'VALIDATION_ERROR', status: 400 };
  }
  if (!isValidMobile(raw)) {
    return { error: 'Enter a valid 10-digit Indian mobile number', code: 'VALIDATION_ERROR', status: 400 };
  }
  const taken = (await findUsersByPhone(raw)).some((u) => u.id !== exceptId);
  if (taken) {
    return { error: 'Another user already uses this mobile number', code: 'PHONE_EXISTS', status: 409 };
  }
  return { phone: toStoredPhone(raw) };
};

module.exports = {
  COUNTRY_CODE,
  phoneDigits,
  isValidMobile,
  toStoredPhone,
  maskPhone,
  findUsersByPhone,
  checkUserPhone
};
