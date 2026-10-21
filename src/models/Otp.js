const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    // The email address the code was sent to.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    otp: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '10m' } // TTL automatically deletes expired OTP after 10m
    },
    // Wrong guesses against this code; the code is discarded after too many.
    attempts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Otp', otpSchema);
