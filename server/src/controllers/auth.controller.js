// src/controllers/auth.controller.js
// Handles all authentication logic:
//   POST /api/auth/register  — create a new USER account
//   POST /api/auth/login     — authenticate and return JWT
//   GET  /api/auth/me        — return current user profile (protected)
//   POST /api/auth/logout    — client-side token drop (stateless JWT)

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const prisma = require('../config/prisma');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { createError } = require('../middleware/errorHandler');

// ── Helper: sign a JWT for a given user ──────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

// ── Helper: build a safe user object (never expose passwordHash) ─────────────
function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── Helper: validate express-validator results ───────────────────────────────
function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('بيانات الطلب غير صحيحة.');
    err.type = 'VALIDATION_ERROR';
    err.statusCode = 422;
    err.errors = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return err;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { name, email, password, phone } = req.body;

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استخدام بريد آخر.',
      });
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone || null,
        role: 'USER',
      },
    });

    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء حسابك بنجاح. أهلاً وسهلاً بك.',
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { email, password } = req.body;

    // Find user — include passwordHash for comparison
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Use constant-time comparison regardless of whether user exists
    // to prevent user-enumeration timing attacks
    const passwordMatch = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2a$12$invalidhashpadding000000000000000000000000000000000000');

    if (!user || !passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'تم تعليق هذا الحساب. يرجى التواصل مع الإدارة.',
      });
    }

    const token = signToken(user);

    res.json({
      success: true,
      message: `مرحباً بعودتك، ${user.name}!`,
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (requires authenticate middleware)
// ────────────────────────────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        raqiProfile: {
          select: {
            id: true,
            bio: true,
            certifications: true,
            specialties: true,
            isAvailable: true,
            sessionPrice: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!user) return next(createError('المستخدم غير موجود.', 404));

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/me  (requires authenticate middleware)
// Update own profile (name, phone)
// ────────────────────────────────────────────────────────────────────────────
async function updateMe(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true, name: true, email: true, phone: true, role: true, createdAt: true,
      },
    });

    res.json({ success: true, message: 'تم تحديث ملفك الشخصي بنجاح.', user });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password  (requires authenticate middleware)
// ────────────────────────────────────────────────────────────────────────────
async function changePassword(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مجدداً.' });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/users  (ADMIN only)
// List all users with pagination
// ────────────────────────────────────────────────────────────────────────────
async function listUsers(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;
    const role  = req.query.role; // optional filter

    const where = role ? { role } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true,
          role: true, isActive: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/users/:id/status  (ADMIN only)
// Activate or suspend a user account
// ────────────────────────────────────────────────────────────────────────────
async function setUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'قيمة isActive يجب أن تكون true أو false.',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });

    res.json({
      success: true,
      message: isActive ? `تم تفعيل حساب ${user.name}.` : `تم تعليق حساب ${user.name}.`,
      user,
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/users/:id/role  (ADMIN only)
// Change a user's role (USER, MODERATOR, RAQI, ADMIN)
// ────────────────────────────────────────────────────────────────────────────
async function setUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['USER', 'MODERATOR', 'RAQI', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `الدور غير صالح. الأدوار المتاحة: ${validRoles.join(', ')}`,
      });
    }

    // Prevent self-demotion from admin to avoid locking out the last admin
    if (req.user.id === id && role !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك تغيير رتبة حسابك الإداري الخاص.',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    const roleNames = {
      ADMIN: 'مدير عام',
      MODERATOR: 'مشرف منتدى',
      RAQI: 'راقٍ معتمد',
      USER: 'مستخدم عادي'
    };

    res.json({
      success: true,
      message: `تم تغيير رتبة ${user.name} إلى ${roleNames[role] || role}.`,
      user,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  listUsers,
  setUserStatus,
  setUserRole,
};
