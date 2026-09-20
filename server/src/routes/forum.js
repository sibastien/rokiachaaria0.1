// src/routes/forum.js
// Production-Ready Islamic Community Forum Routes

const { Router } = require('express');
const {
  // Categories
  getCategories, createCategory, updateCategory,
  // Topics
  getPosts, getPendingPosts, createPost, getPost, updatePost, deletePost,
  // Replies
  addReply, updateReply, deleteReply, toggleLike,
  // Moderation
  togglePin, toggleLock, moderatePost, setOfficialReply,
  // Reports
  createReport, getReports, resolveReport,
  // Audit & Activity
  getModerationLogs, getUserActivity,
} = require('../controllers/forum.controller');

const { authenticate, requireRole } = require('../middleware/auth');
const {
  createPostRules,
  updatePostRules,
  replyRules,
  reportRules,
  categoryRules,
} = require('../validators/forum.validators');

const router = Router();

// ── Optional auth middleware ───────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], jwtSecret);
      req.user = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    } catch (_) {
      // Invalid token — continue as anonymous
    }
  }
  next();
}

// ── 1. Categories ─────────────────────────────────────────────────────────────
router.get( '/categories',     getCategories);
router.post('/categories',     authenticate, requireRole('ADMIN'), categoryRules, createCategory);
router.put( '/categories/:id', authenticate, requireRole('ADMIN'), updateCategory);

// ── 2. Reports (placed before parameterized /:id routes) ───────────────────────
router.post( '/reports',     authenticate, reportRules, createReport);
router.get(  '/reports',     authenticate, requireRole('MODERATOR', 'ADMIN'), getReports);
router.patch('/reports/:id', authenticate, requireRole('MODERATOR', 'ADMIN'), resolveReport);

// ── 3. Moderation Logs & User Activity ────────────────────────────────────────
router.get('/moderation-logs',      authenticate, requireRole('MODERATOR', 'ADMIN'), getModerationLogs);
router.get('/users/:id/activity',   optionalAuth, getUserActivity);

// ── 4. Moderation Queues ──────────────────────────────────────────────────────
router.get('/pending', authenticate, requireRole('RAQI', 'MODERATOR', 'ADMIN'), getPendingPosts);

// ── 5. Replies Management (specific endpoints) ────────────────────────────────
router.put(   '/replies/:replyId', authenticate, replyRules, updateReply);
router.delete('/replies/:replyId', authenticate, deleteReply);

// ── 6. Topics (CRUD & Interactions) ───────────────────────────────────────────
router.get('/',  getPosts);
router.post('/', optionalAuth, createPostRules, createPost);

router.get(   '/:id', optionalAuth, getPost);
router.put(   '/:id', authenticate, updatePostRules, updatePost);
router.delete('/:id', authenticate, deletePost);

router.post('/:id/replies', authenticate, replyRules, addReply);
router.post('/:id/like',    authenticate, toggleLike);

// ── 7. Topic Moderation (Pin, Lock, Status, Official Reply) ───────────────────
router.patch('/:id/pin',    authenticate, requireRole('MODERATOR', 'ADMIN'), togglePin);
router.patch('/:id/lock',   authenticate, requireRole('MODERATOR', 'ADMIN'), toggleLock);
router.patch('/:id/status', authenticate, requireRole('RAQI', 'MODERATOR', 'ADMIN'), moderatePost);
router.patch('/:id/reply',  authenticate, requireRole('RAQI', 'ADMIN'), setOfficialReply);

module.exports = router;
