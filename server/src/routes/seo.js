// src/routes/seo.js
// Routes for Dynamic Sitemap and IndexNow Instant Indexing Protocol

const { Router } = require('express');
const {
  getSitemap,
  getIndexNowKey,
  submitIndexNow,
} = require('../controllers/seo.controller');

const router = Router();

// Sitemap
router.get('/sitemap.xml', getSitemap);

// IndexNow Key Verification Endpoint
router.get('/indexnow-key.txt', getIndexNowKey);

// IndexNow Trigger / Notification Endpoint
router.post('/indexnow', submitIndexNow);

module.exports = router;
