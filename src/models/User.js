const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      default: ''
    },
    avatarUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80'
    },
    role: {
      type: String,
      enum: ['user', 'vendor', 'admin'],
      default: 'user'
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'suspended'],
      default: 'active'
    },
    // Set on every successful OTP login; null until the user signs in for the first time.
    lastLoginAt: {
      type: Date,
      default: null
    },
    // Where the user is based, chosen by the admin (official State/City/Sector names, '' when not set).
    state: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    sector: {
      type: String,
      trim: true,
      default: ''
    },
    // Admin who added this email to the allow-list (null for older accounts).
    addedBy: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('User', userSchema);
