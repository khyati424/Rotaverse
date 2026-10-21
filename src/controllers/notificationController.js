const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * @desc    Get user notifications with unread count
 * @route   GET /api/v1/notifications
 * @access  Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    // Filter by specific user or broadcast (userId is null)
    const filter = {
      $or: [{ userId: req.user.id }, { userId: null }]
    };

    const unreadCount = await Notification.countDocuments({
      ...filter,
      isRead: false
    });

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark notifications as read
 * @route   PATCH /api/v1/notifications/mark-read
 * @access  Private
 */
const markRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;

    const baseFilter = {
      $or: [{ userId: req.user.id }, { userId: null }]
    };

    if (
      !notificationIds ||
      notificationIds === 'all' ||
      (Array.isArray(notificationIds) && notificationIds.includes('all'))
    ) {
      await Notification.updateMany(baseFilter, { isRead: true });
    } else if (Array.isArray(notificationIds)) {
      await Notification.updateMany(
        { ...baseFilter, id: { $in: notificationIds } },
        { isRead: true }
      );
    }

    const unreadCount = await Notification.countDocuments({
      ...baseFilter,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register device FCM push notification token
 * @route   POST /api/v1/notifications/device-token
 * @access  Private
 */
const registerDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken, platform = 'android' } = req.body;

    if (!deviceToken) {
      return sendError(res, 'deviceToken is required', 400, 'VALIDATION_ERROR', {
        deviceToken: 'deviceToken is required'
      });
    }

    await DeviceToken.findOneAndUpdate(
      { deviceToken },
      {
        userId: req.user.id,
        platform: platform.toLowerCase(),
        updatedAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );

    return sendSuccess(res, null, 'Device token updated');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markRead,
  registerDeviceToken
};
