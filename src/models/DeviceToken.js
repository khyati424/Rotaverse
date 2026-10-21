const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    deviceToken: {
      type: String,
      required: true,
      unique: true
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'android'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
