// src/routes/forum.js — Full implementation (Step 5)
// Note: createPost is semi-public (anonymous allowed).
// We use an optional-auth pattern: if a token is present it's decoded,
// but its absence does not block the request.

const { Router } = require('express');
const {
  getPosts, getPendingPosts, createPost, getPost,
  addReply, toggleLike, moderatePost, setOfficialReply,
} = require('../controllers/forum.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { createPostRules, replyRules } = require('../validators/forum.validators');

const router = Router();

// ── Optional auth middleware ───────────────────────────────────────────────────
// Decodes JWT if present but does NOT reject requests without one.
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], jwtSecret);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch (_) {
      // Invalid token — continue as anonymous
    }
  }
  next();
}

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', getPosts);
router.get('/pending', authenticate, requireRole('RAQI', 'ADMIN'), getPendingPosts);
router.get('/:id', optionalAuth, getPost);

// ── Semi-public: post creation (anonymous or authenticated) ───────────────────
router.post('/', optionalAuth, createPostRules, createPost);

// ── Authenticated: replies and likes ─────────────────────────────────────────
router.post('/:id/replies', authenticate, replyRules, addReply);
router.post('/:id/like',    authenticate, toggleLike);

// ── Moderator: RAQI / ADMIN ───────────────────────────────────────────────────
router.patch('/:id/status', authenticate, requireRole('RAQI', 'ADMIN'), moderatePost);
router.patch('/:id/reply',  authenticate, requireRole('RAQI', 'ADMIN'), setOfficialReply);

module.exports = router;
