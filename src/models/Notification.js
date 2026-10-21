const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    userId: {
      type: String,
      index: true,
      default: null // null indicates broadcast to all users
    },
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    unread: {
      type: Boolean,
      default: true
    },
    time: {
      type: String,
      default: ''
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

module.exports = mongoose.model('Notification', notificationSchema);
