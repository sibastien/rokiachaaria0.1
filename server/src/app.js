// src/app.js
// Express application factory.
// Creates and configures the Express app with all middleware and routes.
// Kept separate from server.js so it can be imported in tests.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { corsOrigins, isDev } = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const apiRouter = require('./routes/index');

function createApp() {
  const app = express();

  // ── Security Headers ────────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));

  // ── CORS ────────────────────────────────────────────────────────────────
  // Allows your frontend (served via Live Server or any dev server) to call
  // the API. Update CORS_ORIGIN in .env for production.
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., curl, Postman)
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`CORS policy: origin ${origin} is not allowed.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── Request Parsing ─────────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Request Logging (dev only) ──────────────────────────────────────────
  if (isDev) {
    app.use(morgan('dev'));
  }

  // ── API Routes ──────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── Static Frontend Files ───────────────────────────────────────────────
  const path = require('path');
  const staticRoot = path.resolve(__dirname, '../../');
  app.use(express.static(staticRoot));

  // ── 404 Handler ─────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `المسار ${req.method} ${req.path} غير موجود.`,
    });
  });

  // ── Global Error Handler (must be last) ─────────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
