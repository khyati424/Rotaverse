const Faq = require('../../models/Faq');
const { sendSuccess, sendError } = require('../../utils/responseHelper');

/**
 * @desc    Get All FAQs
 * @route   GET /api/v1/admin/faqs
 * @access  Private (Admin)
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
 * @desc    Create a New FAQ
 * @route   POST /api/v1/admin/faqs
 * @access  Private (Admin)
 */
const createFaq = async (req, res, next) => {
  try {
    const { question, answer, id } = req.body;

    if (!question || !answer) {
      return sendError(res, 'Question and answer are required', 400, 'VALIDATION_ERROR');
    }

    let faqId = id;
    if (!faqId) {
      const lastFaq = await Faq.findOne().sort({ id: -1 });
      faqId = lastFaq && typeof lastFaq.id === 'number' ? lastFaq.id + 1 : Date.now();
    }

    const faq = await Faq.create({
      id: faqId,
      question: question.trim(),
      answer: answer.trim()
    });

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: faq
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Existing FAQ
 * @route   PUT /api/v1/admin/faqs/:id
 * @access  Private (Admin)
 */
const updateFaq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await Faq.findOne({ id });

    if (!faq) {
      return sendError(res, 'FAQ not found', 404, 'FAQ_NOT_FOUND');
    }

    const { question, answer } = req.body;
    if (question) faq.question = question.trim();
    if (answer) faq.answer = answer.trim();

    await faq.save();
    return sendSuccess(res, faq, 'FAQ updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete FAQ
 * @route   DELETE /api/v1/admin/faqs/:id
 * @access  Private (Admin)
 */
const deleteFaq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await Faq.findOne({ id });

    if (!faq) {
      return sendError(res, 'FAQ not found', 404, 'FAQ_NOT_FOUND');
    }

    await Faq.deleteOne({ id });
    return sendSuccess(res, null, 'FAQ deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq
};
