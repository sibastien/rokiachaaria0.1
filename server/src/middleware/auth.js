// src/middleware/auth.js
// JWT authentication middleware.
// Attach to any route that requires a logged-in user:
//   router.get('/protected', authenticate, handler)
// Attach role guard after authenticate:
//   router.post('/admin/...', authenticate, requireRole('ADMIN'), handler)

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const prisma = require('../config/prisma');

/**
 * Verifies the Bearer token in Authorization header.
 * Sets req.user = { id, email, role } on success.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'يجب تسجيل الدخول أولاً. رمز المصادقة مفقود.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtSecret);

    // Confirm user still exists (handles deleted accounts)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'حساب المستخدم غير موجود أو تم حذفه.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'رمز المصادقة غير صالح.',
    });
  }
}

/**
 * Role guard — must be used AFTER authenticate middleware.
 * @param  {...string} roles — one or more of: 'USER', 'RAQI', 'ADMIN'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية الوصول لهذا المورد.',
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
