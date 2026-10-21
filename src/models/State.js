const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema(
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
    // Region code, e.g. 3010 = Gujarat, 3011 = Maharashtra. Unique when set; '' on older states.
    code: {
      type: String,
      trim: true,
      default: ''
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    },
    imageUrl: {
      type: String,
      default: ''
    },
    // The number of businesses is always counted live (see stateController), never stored.
    cityCount: {
      type: String,
      default: '0+'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        // Older states may still have a stored businessCount label; the live count replaces it.
        delete ret.businessCount;
        return ret;
      }
    }
  }
);

stateSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $gt: '' } } });

module.exports = mongoose.model('State', stateSchema);
