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

  // ── SEO & Search Engine Discovery ─────────────────────────────────────────
  const { getSitemap, getIndexNowKey } = require('./controllers/seo.controller');
  app.get('/sitemap.xml', getSitemap);
  app.get('/c03fa41f17e04505bf775083a2169572.txt', getIndexNowKey);

  // ── Clean Frontend Application Routes ──────────────────────────────────
  const path = require('path');
  const staticRoot = path.resolve(__dirname, '../../');

  // Legacy .html 301 redirects to clean URLs
  app.get('/index.html', (req, res) => res.redirect(301, '/'));
  app.get('/portal.html', (req, res) => res.redirect(301, '/dashboard'));
  app.get('/admin.html', (req, res) => res.redirect(301, '/admin'));

  // Clean Public & Member Routes
  app.get('/', (req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });

  app.get(['/login', '/register'], (req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });

  app.get(['/dashboard', '/portal', '/forum', '/articles', '/profile'], (req, res) => {
    res.sendFile(path.join(staticRoot, 'portal.html'));
  });

  app.get(['/admin', '/management'], (req, res) => {
    res.sendFile(path.join(staticRoot, 'admin.html'));
  });

  // ── Uploaded Media Assets (Audio & Attachments) ──────────────────────────
  const uploadsDir = path.join(staticRoot, 'uploads');
  app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res) => {
      res.set('Accept-Ranges', 'bytes');
    }
  }));

  // ── Static Frontend Assets ───────────────────────────────────────────────
  app.use(express.static(staticRoot));

  // ── 404 Handler ─────────────────────────────────────────────────────────
  app.use((req, res) => {
    // Return JSON 404 for API requests, redirect or 404 for web requests
    if (req.path.startsWith('/api')) {
      return res.status(404).json({
        success: false,
        message: `المسار ${req.method} ${req.path} غير موجود.`,
      });
    }
    // Fallback: send index.html or 404
    res.status(404).sendFile(path.join(staticRoot, 'index.html'));
  });

  // ── Global Error Handler (must be last) ─────────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
