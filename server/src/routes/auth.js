// src/routes/auth.js
// Auth module routes — fully implemented in Step 2.
//
// Public:
//   POST /api/auth/register
//   POST /api/auth/login
//
// Protected (requires JWT):
//   GET  /api/auth/me
//   PUT  /api/auth/me
//   POST /api/auth/change-password
//
// Admin only:
//   GET   /api/auth/users
//   PATCH /api/auth/users/:id/status

const { Router } = require('express');
const {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  listUsers,
  setUserStatus,
  setUserRole,
} = require('../controllers/auth.controller');

const { authenticate, requireRole } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  updateMeRules,
  changePasswordRules,
} = require('../validators/auth.validators');

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────────
router.post('/register', registerRules, register);
router.post('/login',    loginRules,    login);

// ── Protected: any authenticated user ────────────────────────────────────────
router.get( '/me',              authenticate,                   getMe);
router.put( '/me',              authenticate, updateMeRules,    updateMe);
router.post('/change-password', authenticate, changePasswordRules, changePassword);

// ── Admin only ────────────────────────────────────────────────────────────────
router.get(  '/users',            authenticate, requireRole('ADMIN'), listUsers);
router.patch('/users/:id/status', authenticate, requireRole('ADMIN'), setUserStatus);
router.patch('/users/:id/role',   authenticate, requireRole('ADMIN'), setUserRole);

module.exports = router;
