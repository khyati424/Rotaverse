const Faq = require('../models/Faq');
const SupportInquiry = require('../models/SupportInquiry');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateTicketId } = require('../utils/idGenerator');

/**
 * @desc    Get support FAQs
 * @route   GET /api/v1/support/faqs
 * @access  Public
 */
const getFaqs = async (req, res, next) => {
  try {
    const faqs = await Faq.find().sort({ id: 1 });
    return sendSuccess(res, faqs, 'FAQs retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit support ticket or user feedback
 * @route   POST /api/v1/support/inquiry
 * @access  Public / Optional Auth
 */
const submitInquiry = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    const errors = {};
    if (!name) errors.name = 'Name is required';
    if (!email) errors.email = 'Email is required';
    if (!subject) errors.subject = 'Subject is required';
    if (!message) errors.message = 'Message is required';

    if (Object.keys(errors).length > 0) {
      return sendError(res, 'Please provide all required fields', 400, 'VALIDATION_ERROR', errors);
    }

    const ticketId = generateTicketId();

    await SupportInquiry.create({
      ticketId,
      userId: req.user ? req.user.id : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim()
    });

    return res.status(201).json({
      success: true,
      message: `Your inquiry has been submitted. Ticket #${ticketId}`,
      ticketId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFaqs,
  submitInquiry
};
