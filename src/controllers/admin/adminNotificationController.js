const Notification = require('../../models/Notification');
const { sendSuccess, sendPaginated, sendError } = require('../../utils/responseHelper');

/**
 * @desc    Get All Notifications (Admin view)
 * @route   GET /api/v1/admin/notifications
 * @access  Private (Admin)
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const total = await Notification.countDocuments();
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return sendPaginated(
      res,
      notifications,
      { total, page: pageNum, limit: limitNum, totalPages },
      'Notifications retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Broadcast In-App Notification to All Users
 * @route   POST /api/v1/admin/notifications/broadcast
 * @access  Private (Admin)
 */
const broadcastNotification = async (req, res, next) => {
  try {
    const { title, subtitle } = req.body;

    if (!title || !subtitle) {
      return sendError(res, 'Title and subtitle are required', 400, 'VALIDATION_ERROR');
    }

    const id = `notif_${Date.now().toString().slice(-6)}`;

    const notification = await Notification.create({
      id,
      userId: null, // Broadcast to all
      title: title.trim(),
      subtitle: subtitle.trim(),
      time: 'Just now',
      unread: true,
      isRead: false
    });

    return res.status(201).json({
      success: true,
      message: 'Broadcast notification sent successfully',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Notification by ID
 * @route   DELETE /api/v1/admin/notifications/:id
 * @access  Private (Admin)
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ id });

    if (!notification) {
      return sendError(res, 'Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    await Notification.deleteOne({ id });
    return sendSuccess(res, null, 'Notification deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  broadcastNotification,
  deleteNotification
};
