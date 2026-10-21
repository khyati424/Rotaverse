const mongoose = require('mongoose');

const sectorSchema = new mongoose.Schema(
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
    cityId: {
      type: String,
      default: 'surat',
      index: true
    },
    businessCount: {
      type: String,
      default: '0+ Businesses'
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

module.exports = mongoose.model('Sector', sectorSchema);
