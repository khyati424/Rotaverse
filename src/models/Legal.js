const mongoose = require('mongoose');

const legalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['terms', 'privacy'],
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true
    },
    lastUpdated: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
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

module.exports = mongoose.model('Legal', legalSchema);
