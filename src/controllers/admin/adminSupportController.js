const SupportInquiry = require('../../models/SupportInquiry');
const { sendSuccess, sendPaginated, sendError } = require('../../utils/responseHelper');

/**
 * @desc    Get All Support Inquiries / Tickets with Filters & Pagination
 * @route   GET /api/v1/admin/support/inquiries
 * @access  Private (Admin)
 */
const getInquiries = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status && status.toLowerCase() !== 'all') {
      filter.status = status.trim().toLowerCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { ticketId: regex },
        { name: regex },
        { email: regex },
        { subject: regex },
        { message: regex }
      ];
    }

    const total = await SupportInquiry.countDocuments(filter);
    const inquiries = await SupportInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return sendPaginated(
      res,
      inquiries,
      { total, page: pageNum, limit: limitNum, totalPages },
      'Support inquiries retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Inquiry by Ticket ID
 * @route   GET /api/v1/admin/support/inquiries/:ticketId
 * @access  Private (Admin)
 */
const getInquiryById = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const inquiry = await SupportInquiry.findOne({ ticketId });

    if (!inquiry) {
      return sendError(res, 'Inquiry ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    return sendSuccess(res, inquiry, 'Support ticket retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Inquiry Status
 * @route   PATCH /api/v1/admin/support/inquiries/:ticketId/status
 * @access  Private (Admin)
 */
const updateInquiryStatus = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'in_progress', 'resolved'].includes(status.toLowerCase())) {
      return sendError(res, 'Valid status is required: open, in_progress, resolved', 400, 'INVALID_STATUS');
    }

    const inquiry = await SupportInquiry.findOne({ ticketId });
    if (!inquiry) {
      return sendError(res, 'Inquiry ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    inquiry.status = status.toLowerCase();
    await inquiry.save();

    return sendSuccess(res, inquiry, `Ticket #${ticketId} status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Support Ticket
 * @route   DELETE /api/v1/admin/support/inquiries/:ticketId
 * @access  Private (Admin)
 */
const deleteInquiry = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const inquiry = await SupportInquiry.findOne({ ticketId });

    if (!inquiry) {
      return sendError(res, 'Inquiry ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    await SupportInquiry.deleteOne({ ticketId });
    return sendSuccess(res, null, 'Ticket deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInquiries,
  getInquiryById,
  updateInquiryStatus,
  deleteInquiry
};
