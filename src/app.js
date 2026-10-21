const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

// Security headers with cross-origin resource sharing allowed for media files
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Enable CORS for Flutter mobile apps and web clients
app.use(cors());

// HTTP request logger in development
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded media files publicly
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root landing endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to BizFinder / Businessmen Backend API (v1.0)',
    documentation: '/api/v1/health',
    version: '1.0.0'
  });
});

// Mount all API routes under /api/v1
app.use('/api/v1', routes);

// 404 & Global Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
