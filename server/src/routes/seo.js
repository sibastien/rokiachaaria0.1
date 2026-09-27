// src/routes/seo.js
// SEO Management Routes — public (sitemap, IndexNow key) + admin CRUD

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');

const {
  getSitemap,
  getIndexNowKey,
  submitIndexNow,
  listPageMeta,
  getPageMeta,
  savePageMeta,
  listRedirects,
  createRedirect,
  toggleRedirect,
  deleteRedirect,
  getRobots,
  saveRobots,
  runAnalysis,
  getAnalysis,
} = require('../controllers/seo.controller');

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/sitemap.xml',      getSitemap);
router.get('/indexnow-key.txt', getIndexNowKey);

// ── Admin: IndexNow Trigger ───────────────────────────────────────────────────
router.post('/indexnow', authenticate, requireRole('ADMIN'), submitIndexNow);

// ── Admin: Page Meta CRUD ─────────────────────────────────────────────────────
router.get('/pages',         authenticate, requireRole('ADMIN'), listPageMeta);
router.get('/pages/:pageKey', authenticate, requireRole('ADMIN'), getPageMeta);
router.put('/pages/:pageKey', authenticate, requireRole('ADMIN'), savePageMeta);

// ── Admin: Redirects ──────────────────────────────────────────────────────────
router.get('/redirects',      authenticate, requireRole('ADMIN'), listRedirects);
router.post('/redirects',     authenticate, requireRole('ADMIN'), createRedirect);
router.patch('/redirects/:id',authenticate, requireRole('ADMIN'), toggleRedirect);
router.delete('/redirects/:id',authenticate, requireRole('ADMIN'), deleteRedirect);

// ── Admin: Robots.txt ─────────────────────────────────────────────────────────
router.get('/robots',  authenticate, requireRole('ADMIN'), getRobots);
router.put('/robots',  authenticate, requireRole('ADMIN'), saveRobots);

// ── Admin: SEO Analysis ───────────────────────────────────────────────────────
router.post('/analyze',  authenticate, requireRole('ADMIN'), runAnalysis);
router.get('/analysis',  authenticate, requireRole('ADMIN'), getAnalysis);

module.exports = router;
