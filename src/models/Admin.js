const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
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
    password: {
      type: String,
      required: true
    },
    // superadmin / admin: every location. state_admin, city_admin, sector_admin: only the
    // states, cities or sectors listed below (see utils/access.js). moderator is kept for old accounts.
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'moderator', 'state_admin', 'city_admin', 'sector_admin'],
      default: 'admin'
    },
    // Assigned area, by id. Only the list that matches the role is used; the others stay empty.
    states: {
      type: [String],
      default: []
    },
    cities: {
      type: [String],
      default: []
    },
    sectors: {
      type: [String],
      default: []
    },
    // Admin who created this account (null for the first super admin and older accounts).
    createdBy: {
      type: String,
      default: null
    },
    avatarUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Method to verify password
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
