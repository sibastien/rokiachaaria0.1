// src/routes/articles.js — Full implementation (Step 4)

const { Router } = require('express');
const {
  getArticles, getArticle, createArticle, updateArticle, deleteArticle,
} = require('../controllers/articles.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { articleRules } = require('../validators/articles.validators');

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',    getArticles);
router.get('/:id', getArticle);

// ── Admin only ────────────────────────────────────────────────────────────────
router.post(  '/',    authenticate, requireRole('ADMIN'), articleRules, createArticle);
router.put(   '/:id', authenticate, requireRole('ADMIN'), articleRules, updateArticle);
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteArticle);

module.exports = router;
