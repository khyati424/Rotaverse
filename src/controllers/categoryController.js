const Category = require('../models/Category');
const Business = require('../models/Business');
const { sendSuccess } = require('../utils/responseHelper');

/**
 * @desc    Get all categories
 * @route   GET /api/v1/categories
 * @access  Public
 */
const getCategories = async (req, res, next) => {
  try {
    const { city } = req.query;

    const categories = await Category.find().sort({ name: 1 });

    // If city is specified, calculate real-time businessCount per category in that city
    if (city && city.toLowerCase() !== 'all') {
      const cityRegex = new RegExp(`^${city.trim()}$`, 'i');
      const enrichedCategories = await Promise.all(
        categories.map(async (cat) => {
          const count = await Business.countDocuments({
            category: new RegExp(`^${cat.name}$`, 'i'),
            city: cityRegex
          });
          const catObj = cat.toJSON();
          catObj.businessCount = `${count}+`;
          return catObj;
        })
      );
      return sendSuccess(res, enrichedCategories, 'Categories retrieved successfully');
    }

    return sendSuccess(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories
};
