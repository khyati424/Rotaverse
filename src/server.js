require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const { backfillOwnerEmails } = require('./utils/ownership');
const { backfillBusinessStates, backfillUserLocations } = require('./utils/location');
const { migrateFavoritesToPeople } = require('./utils/favorites');
const { ensureSuperAdmin } = require('./utils/bootstrapAdmin');

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
const startServer = async () => {
  try {
    await connectDB();
    await ensureSuperAdmin().catch((err) => console.error('[BOOTSTRAP] Super admin check failed:', err.message));
    await backfillOwnerEmails().catch((err) => console.error('[MIGRATION] Owner email backfill failed:', err.message));
    await backfillBusinessStates().catch((err) => console.error('[MIGRATION] Business state backfill failed:', err.message));
    await backfillUserLocations().catch((err) => console.error('[MIGRATION] User location backfill failed:', err.message));
    await migrateFavoritesToPeople().catch((err) => console.error('[MIGRATION] Favorites to people failed:', err.message));
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 BizFinder API Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📡 Base URL: http://localhost:${PORT}/api/v1`);
      console.log(`📂 Uploads directory: http://localhost:${PORT}/uploads/`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
