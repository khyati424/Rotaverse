const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateRandomNumberString } = require('../utils/idGenerator');
const { phoneDigits, isValidMobile, findUsersByPhone } = require('../utils/phone');
const { isMailConfigured, sendOtpEmail } = require('../utils/mailer');

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_OTP_ATTEMPTS = 5;
/** a***@example.com */
const maskEmail = (email = '') => {
  const [name, domain] = String(email).split('@');
  if (!domain) return '';
  return `${name.slice(0, 1)}***@${domain}`;
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'super_secret_jwt_key_bizfinder_2026_dev',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'super_refresh_jwt_key_bizfinder_2026_dev',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

/** The email from the request body, lower-cased. */
const emailFromBody = (body = {}) => String(body.email ?? '').trim().toLowerCase();

/** The mobile number from the request body (`phoneNumber`, or `phone` / `mobile`). */
const phoneFromBody = (body = {}) => String(body.phoneNumber ?? body.phone ?? body.mobile ?? '').trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Finds the registered, active user for the email in the request. Older app builds that
 * still send only a mobile number are matched by that number instead.
 * Returns { user }, or { response } when an error was already sent.
 */
const findLoginUser = async (req, res) => {
  const email = emailFromBody(req.body);
  const rawPhone = phoneFromBody(req.body);
  let user;

  if (email) {
    if (!EMAIL_RE.test(email)) {
      return {
        response: sendError(res, 'Please enter a valid email address', 400, 'INVALID_EMAIL', {
          email: 'Enter a valid email address'
        })
      };
    }
    user = await User.findOne({ email });
    // Only emails added from the admin panel can sign in.
    if (!user) {
      return {
        response: sendError(
          res,
          'This email is not registered. Please contact the admin to get access.',
          403,
          'EMAIL_NOT_REGISTERED'
        )
      };
    }
  } else if (rawPhone) {
    if (!isValidMobile(rawPhone)) {
      return {
        response: sendError(res, 'Please enter a valid 10-digit mobile number', 400, 'INVALID_PHONE', {
          phoneNumber: 'Enter a valid 10-digit mobile number'
        })
      };
    }
    const users = await findUsersByPhone(phoneDigits(rawPhone));
    if (!users.length) {
      return {
        response: sendError(
          res,
          'This mobile number is not registered. Please contact the admin to get access.',
          403,
          'PHONE_NOT_REGISTERED'
        )
      };
    }
    if (users.length > 1) {
      return {
        response: sendError(
          res,
          'This mobile number is linked to more than one account. Please contact the admin.',
          409,
          'PHONE_NOT_UNIQUE'
        )
      };
    }
    user = users[0];
  } else {
    return {
      response: sendError(res, 'Email is required', 400, 'VALIDATION_ERROR', { email: 'Email is required' })
    };
  }

  if (user.status !== 'active') {
    return {
      response: sendError(res, `Your account has been ${user.status}. Please contact the admin.`, 403, 'ACCOUNT_BLOCKED')
    };
  }
  return { user };
};

/**
 * @desc    Send an OTP by email to the registered user (the email the app sends)
 * @route   POST /api/v1/auth/send-otp
 * @access  Public
 */
const sendOtp = async (req, res, next) => {
  try {
    const found = await findLoginUser(req, res);
    if (found.response) return found.response;
    const { user } = found;
    const email = user.email;

    // Throttle resends
    const existingOtp = await Otp.findOne({ email });
    if (existingOtp) {
      const waited = (Date.now() - new Date(existingOtp.updatedAt).getTime()) / 1000;
      if (waited < RESEND_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - waited);
        return sendError(res, `Please wait ${retryAfter} seconds before requesting a new code`, 429, 'OTP_TOO_SOON', {
          retryAfter
        });
      }
    }

    if (!isMailConfigured()) {
      console.error('[AUTH] SMTP is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS in .env');
      return sendError(res, 'Email service is not configured. Please contact the admin.', 503, 'EMAIL_NOT_CONFIGURED');
    }

    const otpCode = generateRandomNumberString(6);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, expiresAt, attempts: 0 },
      { upsert: true, returnDocument: 'after' }
    );

    try {
      await sendOtpEmail(email, otpCode, OTP_TTL_MINUTES);
    } catch (mailError) {
      console.error(`[AUTH] Could not email OTP to ${maskEmail(email)}:`, mailError.message);
      await Otp.deleteOne({ email });
      return sendError(res, 'Could not send the code. Please try again in a moment.', 502, 'EMAIL_SEND_FAILED');
    }

    return sendSuccess(
      res,
      {
        email: maskEmail(email),
        resendCountdown: RESEND_COOLDOWN_SECONDS,
        expiresInMinutes: OTP_TTL_MINUTES
      },
      `OTP has been sent to ${maskEmail(user.email)}`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend the OTP by email. Same rules as send-otp: the email must be registered,
 *          there is a 30s cooldown (429 OTP_TOO_SOON with retryAfter),
 *          and a fresh code replaces the previous one.
 * @route   POST /api/v1/auth/resend-otp
 * @access  Public
 */
const resendOtp = sendOtp;

/**
 * @desc    Verify the emailed OTP and log in a registered user
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
const verifyOtp = async (req, res, next) => {
  try {
    if (!req.body || !req.body.otp) {
      return sendError(res, 'Email and OTP are required', 400, 'VALIDATION_ERROR', {
        email: !emailFromBody(req.body) && !phoneFromBody(req.body) ? 'Email is required' : undefined,
        otp: 'OTP is required'
      });
    }

    const found = await findLoginUser(req, res);
    if (found.response) return found.response;
    const { user } = found;
    const code = String(req.body.otp).trim();

    const existingOtp = await Otp.findOne({ email: user.email });
    const notExpired = existingOtp && new Date(existingOtp.expiresAt).getTime() > Date.now();
    const isValid = notExpired && existingOtp.otp === code;

    if (!isValid) {
      if (existingOtp) {
        existingOtp.attempts = (existingOtp.attempts || 0) + 1;
        if (existingOtp.attempts >= MAX_OTP_ATTEMPTS || !notExpired) {
          await Otp.deleteOne({ _id: existingOtp._id });
          return sendError(
            res,
            notExpired ? 'Too many wrong attempts. Please request a new code.' : 'This code has expired. Please request a new code.',
            400,
            notExpired ? 'OTP_ATTEMPTS_EXCEEDED' : 'OTP_EXPIRED'
          );
        }
        await existingOtp.save();
      }
      return sendError(res, 'Invalid or expired OTP code', 400, 'INVALID_OTP');
    }

    if (existingOtp) {
      await Otp.deleteOne({ _id: existingOtp._id });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user.id);

    return sendSuccess(
      res,
      {
        accessToken,
        refreshToken,
        user: user.toJSON()
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Social sign-in is turned off: users log in with an admin-registered email and emailed OTP only.
 * The routes stay so older app builds get a clear message instead of a 404.
 */
const socialLoginDisabled = (req, res) =>
  sendError(
    res,
    'Please sign in with your registered email and OTP.',
    403,
    'LOGIN_METHOD_DISABLED'
  );

/**
 * @desc    Google Sign-in (disabled)
 * @route   POST /api/v1/auth/google
 * @access  Public
 */
const googleAuth = socialLoginDisabled;

/**
 * @desc    Apple Sign-in (disabled)
 * @route   POST /api/v1/auth/apple
 * @access  Public
 */
const appleAuth = socialLoginDisabled;

/**
 * @desc    Refresh Access Token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return sendError(res, 'Refresh token is required', 400, 'VALIDATION_ERROR', {
        refreshToken: 'refreshToken is required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || 'super_refresh_jwt_key_bizfinder_2026_dev'
      );
    } catch (err) {
      return sendError(res, 'Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findOne({ id: decoded.id });
    if (!user) {
      return sendError(res, 'User not found', 401, 'USER_NOT_FOUND');
    }
    if (user.status !== 'active') {
      return sendError(res, `Your account has been ${user.status}. Please contact the admin.`, 403, 'ACCOUNT_BLOCKED');
    }

    const tokens = generateTokens(user.id);

    return sendSuccess(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  resendOtp,
  verifyOtp,
  googleAuth,
  appleAuth,
  refreshToken
};
