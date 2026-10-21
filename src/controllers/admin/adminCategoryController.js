const Category = require('../../models/Category');
const Business = require('../../models/Business');
const { sendSuccess, sendError } = require('../../utils/responseHelper');

/**
 * @desc    Get All Categories with Actual Business Counts
 * @route   GET /api/v1/admin/categories
 * @access  Private (Admin)
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    const enriched = await Promise.all(
      categories.map(async (cat) => {
        const count = await Business.countDocuments({
          category: new RegExp(`^${cat.name}$`, 'i')
        });
        const c = cat.toJSON();
        c.actualBusinessCount = count;
        return c;
      })
    );

    return sendSuccess(res, enriched, 'Categories retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Category Details
 * @route   GET /api/v1/admin/categories/:id
 * @access  Private (Admin)
 */
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ id });

    if (!category) {
      return sendError(res, 'Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    const count = await Business.countDocuments({
      category: new RegExp(`^${category.name}$`, 'i')
    });
    const c = category.toJSON();
    c.actualBusinessCount = count;

    return sendSuccess(res, c, 'Category details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a New Category
 * @route   POST /api/v1/admin/categories
 * @access  Private (Admin)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, subtitle = '', imageUrl = '', iconUrl = '', colorHex = '#3B82F6', id } = req.body;

    if (!name) {
      return sendError(res, 'Category name is required', 400, 'VALIDATION_ERROR');
    }

    const categoryId = id ? id.toLowerCase().trim() : name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const existing = await Category.findOne({ id: categoryId });
    if (existing) {
      return sendError(res, 'A category with this ID or name already exists', 400, 'DUPLICATE_CATEGORY');
    }

    const finalImage = imageUrl || iconUrl || 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png';

    const category = await Category.create({
      id: categoryId,
      name: name.trim(),
      subtitle: subtitle.trim(),
      imageUrl: finalImage,
      iconUrl: finalImage,
      colorHex: colorHex.trim(),
      businessCount: '0+',
      countText: '0+ Listings'
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Existing Category
 * @route   PUT /api/v1/admin/categories/:id
 * @access  Private (Admin)
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ id });

    if (!category) {
      return sendError(res, 'Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    const { name, subtitle, imageUrl, iconUrl, colorHex, businessCount, countText } = req.body;

    if (name) category.name = name.trim();
    if (subtitle !== undefined) category.subtitle = subtitle.trim();
    if (imageUrl) {
      category.imageUrl = imageUrl.trim();
      category.iconUrl = imageUrl.trim();
    } else if (iconUrl) {
      category.iconUrl = iconUrl.trim();
      category.imageUrl = iconUrl.trim();
    }
    if (colorHex) category.colorHex = colorHex.trim();
    if (businessCount !== undefined) category.businessCount = businessCount;
    if (countText !== undefined) category.countText = countText;

    await category.save();
    return sendSuccess(res, category, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Category
 * @route   DELETE /api/v1/admin/categories/:id
 * @access  Private (Admin)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ id });

    if (!category) {
      return sendError(res, 'Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    await Category.deleteOne({ id });
    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
