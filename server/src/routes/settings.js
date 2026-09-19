// src/routes/settings.js
// Routes for Site Settings (CMS)

const { Router } = require('express');
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

// Public: get site settings
router.get('/', getSettings);

// Admin only: update settings
router.put('/', authenticate, requireRole('ADMIN'), updateSettings);

module.exports = router;
