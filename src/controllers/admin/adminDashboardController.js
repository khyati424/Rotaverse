const Business = require('../../models/Business');
const User = require('../../models/User');
const City = require('../../models/City');
const Sector = require('../../models/Sector');
const Category = require('../../models/Category');
const SupportInquiry = require('../../models/SupportInquiry');
const Favorite = require('../../models/Favorite');
const { sendSuccess } = require('../../utils/responseHelper');
const { placeFilter, cityFilter, sectorFilter, withScope } = require('../../utils/access');

/**
 * @desc    Get Admin Dashboard KPI Statistics and Analytics. State, city and sector admins get the
 *          numbers for their own area; support tickets are only counted for global admins.
 * @route   GET /api/v1/admin/dashboard/stats
 * @access  Private (Admin)
 */
const getStats = async (req, res, next) => {
  try {
    const { access } = req;
    const area = placeFilter(access);
    const inArea = (filter = {}) => withScope(filter, area);
    // Tickets aren't tied to a location, so scoped admins don't see them.
    const tickets = (filter = {}) => (access.isGlobal ? SupportInquiry.countDocuments(filter) : Promise.resolve(0));
    const favorites = access.isGlobal
      ? Favorite.countDocuments()
      : User.distinct('id', area).then((ids) => Favorite.countDocuments({ userId: { $in: ids } }));

    const [
      totalBusinesses,
      activeBusinesses,
      pendingBusinesses,
      verifiedBusinesses,
      totalUsers,
      activeUsers,
      blockedUsers,
      totalCities,
      totalSectors,
      totalCategories,
      totalInquiries,
      openInquiries,
      resolvedInquiries,
      totalFavorites,
      recentBusinesses,
      recentUsers,
      recentInquiries
    ] = await Promise.all([
      Business.countDocuments(inArea()),
      Business.countDocuments(inArea({ status: 'active' })),
      Business.countDocuments(inArea({ status: 'pending' })),
      Business.countDocuments(inArea({ isVerified: true })),
      User.countDocuments(inArea()),
      User.countDocuments(inArea({ status: 'active' })),
      User.countDocuments(inArea({ status: 'blocked' })),
      City.countDocuments(cityFilter(access)),
      Sector.countDocuments(sectorFilter(access)),
      Category.countDocuments(),
      tickets(),
      tickets({ status: 'open' }),
      tickets({ status: 'resolved' }),
      favorites,
      Business.find(inArea()).sort({ createdAt: -1 }).limit(5),
      User.find(inArea()).sort({ createdAt: -1 }).limit(5),
      access.isGlobal ? SupportInquiry.find().sort({ createdAt: -1 }).limit(5) : Promise.resolve([])
    ]);

    // Breakdown businesses by category
    const categoryDistribution = await Business.aggregate([
      { $match: area },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // Breakdown businesses by city (by sector for sector admins, whose area is inside one or a few cities)
    const groupBy = access.level === 'sector' ? '$sector' : '$city';
    const cityDistribution = await Business.aggregate([
      { $match: area },
      { $group: { _id: groupBy, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    const stats = {
      summary: {
        businesses: {
          total: totalBusinesses,
          active: activeBusinesses,
          pending: pendingBusinesses,
          verified: verifiedBusinesses
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          blocked: blockedUsers
        },
        directory: {
          cities: totalCities,
          sectors: totalSectors,
          categories: totalCategories,
          favorites: totalFavorites
        },
        ...(access.isGlobal && {
          support: {
            total: totalInquiries,
            open: openInquiries,
            resolved: resolvedInquiries
          }
        })
      },
      charts: {
        byCategory: categoryDistribution.map((item) => ({ name: item._id, count: item.count })),
        [access.level === 'sector' ? 'bySector' : 'byCity']: cityDistribution.map((item) => ({ name: item._id, count: item.count }))
      },
      recent: {
        businesses: recentBusinesses,
        users: recentUsers,
        ...(access.isGlobal && { inquiries: recentInquiries })
      }
    };

    return sendSuccess(res, stats, 'Dashboard statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats
};
