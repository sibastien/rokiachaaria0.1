// src/validators/auth.validators.js
// Input validation rules using express-validator.
// Each exported array is passed directly as route middleware.

const { body } = require('express-validator');

// ── Register ─────────────────────────────────────────────────────────────────
const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('الاسم مطلوب.')
    .isLength({ min: 2, max: 80 }).withMessage('الاسم يجب أن يكون بين 2 و 80 حرفاً.'),

  body('email')
    .trim()
    .notEmpty().withMessage('البريد الإلكتروني مطلوب.')
    .isEmail().withMessage('صيغة البريد الإلكتروني غير صحيحة.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('كلمة المرور مطلوبة.')
    .isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
    .matches(/[A-Z]/).withMessage('كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل.')
    .matches(/[0-9]/).withMessage('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.'),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[0-9\s\-]{7,20}$/).withMessage('رقم الهاتف غير صالح.'),
];

// ── Login ─────────────────────────────────────────────────────────────────────
const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('البريد الإلكتروني مطلوب.')
    .isEmail().withMessage('صيغة البريد الإلكتروني غير صحيحة.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('كلمة المرور مطلوبة.'),
];

// ── Update Profile ────────────────────────────────────────────────────────────
const updateMeRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('الاسم يجب أن يكون بين 2 و 80 حرفاً.'),

  body('phone')
    .optional({ nullable: true })
    .trim()
    .matches(/^\+?[0-9\s\-]{7,20}$/).withMessage('رقم الهاتف غير صالح.'),
];

// ── Change Password ───────────────────────────────────────────────────────────
const changePasswordRules = [
  body('currentPassword')
    .notEmpty().withMessage('كلمة المرور الحالية مطلوبة.'),

  body('newPassword')
    .notEmpty().withMessage('كلمة المرور الجديدة مطلوبة.')
    .isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
    .matches(/[A-Z]/).withMessage('كلمة المرور يجب أن تحتوي على حرف كبير.')
    .matches(/[0-9]/).withMessage('كلمة المرور يجب أن تحتوي على رقم.')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('كلمة المرور الجديدة يجب أن تختلف عن الحالية.');
      }
      return true;
    }),
];

module.exports = {
  registerRules,
  loginRules,
  updateMeRules,
  changePasswordRules,
};
