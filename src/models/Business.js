const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
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
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    specialty: {
      type: String,
      default: '',
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    imageUrl: {
      type: String,
      default: ''
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    state: {
      type: String,
      trim: true,
      index: true,
      default: ''
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    sector: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    openingTime: {
      type: String,
      default: '09:00 AM'
    },
    closingTime: {
      type: String,
      default: '08:00 PM'
    },
    isOpen: {
      type: Boolean,
      default: true
    },
    avatarInitials: {
      type: String,
      default: 'BI'
    },
    specializations: {
      type: [String],
      default: []
    },
    businessName: {
      type: String,
      default: ''
    },
    personalPhone: {
      type: String,
      default: ''
    },
    personalEmail: {
      type: String,
      default: ''
    },
    businessPhone: {
      type: String,
      default: ''
    },
    businessEmail: {
      type: String,
      default: ''
    },
    ownerId: {
      type: String,
      index: true,
      default: null
    },
    // Email of the app user who owns this listing. Businesses belong to the email,
    // so removing and re-adding a user's email reconnects their businesses.
    ownerEmail: {
      type: String,
      index: true,
      lowercase: true,
      trim: true,
      default: ''
    },
    isVerified: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'rejected', 'inactive'],
      default: 'active'
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

businessSchema.index({ name: 'text', specialty: 'text', description: 'text', address: 'text' });

module.exports = mongoose.model('Business', businessSchema);
