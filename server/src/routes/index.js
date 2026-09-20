// src/routes/index.js
// Root route aggregator.
// All API modules are mounted here and registered in app.js.

const { Router } = require('express');

const router = Router();

// ── Health check (unauthenticated) ──────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'الرقية الشرعية أونلاين — API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── Feature modules (implemented in Steps 2–5) ──────────────────────────────
// Each module is a separate router file. Uncomment as you build each step.

router.use('/auth',     require('./auth'));      // Step 2
router.use('/bookings', require('./bookings'));  // Step 3
router.use('/articles', require('./articles')); // Step 4
router.use('/forum',    require('./forum'));     // Step 5
router.use('/settings', require('./settings'));  // CMS Settings
router.use('/audio',    require('./audio'));     // Audio Recitations
router.use('/quran',    require('./quran'));     // QuranJS & Ruqyah Verses API
router.use('/seo',      require('./seo'));       // Dynamic Sitemap & IndexNow API

module.exports = router;
