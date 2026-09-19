// src/validators/forum.validators.js
const { body } = require('express-validator');

const VALID_BADGES = ['استفسار شرعي', 'تجربة شفاء', 'نصيحة وأذكار'];

const createPostRules = [
  body('authorName')
    .optional()
    .trim()
    .isLength({ max: 80 }).withMessage('الاسم لا يتجاوز 80 حرفاً.'),

  body('title')
    .trim()
    .notEmpty().withMessage('عنوان المشاركة مطلوب.')
    .isLength({ min: 5, max: 200 }).withMessage('العنوان يجب أن يكون بين 5 و 200 حرف.'),

  body('content')
    .trim()
    .notEmpty().withMessage('نص المشاركة مطلوب.')
    .isLength({ min: 10, max: 2000 }).withMessage('النص يجب أن يكون بين 10 و 2000 حرف.'),

  body('badge')
    .optional()
    .trim()
    .isIn(VALID_BADGES).withMessage(`القسم غير صالح. الأقسام المتاحة: ${VALID_BADGES.join(' | ')}`),
];

const replyRules = [
  body('content')
    .trim()
    .notEmpty().withMessage('نص الرد مطلوب.')
    .isLength({ min: 3, max: 1000 }).withMessage('الرد يجب أن يكون بين 3 و 1000 حرف.'),
];

module.exports = { createPostRules, replyRules };
