// src/validators/forum.validators.js
const { body } = require('express-validator');

const createPostRules = [
  body('authorName')
    .optional()
    .trim()
    .isLength({ max: 80 }).withMessage('الاسم لا يتجاوز 80 حرفاً.'),

  body('title')
    .trim()
    .notEmpty().withMessage('عنوان المشاركة مطلوب.')
    .isLength({ min: 3, max: 200 }).withMessage('العنوان يجب أن يكون بين 3 و 200 حرف.'),

  body('content')
    .trim()
    .notEmpty().withMessage('نص المشاركة مطلوب.')
    .isLength({ min: 5, max: 5000 }).withMessage('النص يجب أن يكون بين 5 و 5000 حرف.'),

  body('badge')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('categoryId')
    .optional({ checkFalsy: true })
    .trim(),
];

const updatePostRules = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('العنوان يجب أن يكون بين 3 و 200 حرف.'),

  body('content')
    .optional()
    .trim()
    .isLength({ min: 5, max: 5000 }).withMessage('النص يجب أن يكون بين 5 و 5000 حرف.'),

  body('badge')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('categoryId')
    .optional({ checkFalsy: true })
    .trim(),
];

const replyRules = [
  body('content')
    .trim()
    .notEmpty().withMessage('نص الرد مطلوب.')
    .isLength({ min: 2, max: 2000 }).withMessage('الرد يجب أن يكون بين حرفين و 2000 حرف.'),
];

const reportRules = [
  body('reason')
    .trim()
    .notEmpty().withMessage('يرجى تحديد سبب البلاغ.')
    .isLength({ max: 150 }).withMessage('السبب لا يتجاوز 150 حرفاً.'),

  body('details')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('التفاصيل لا تتجاوز 1000 حرف.'),
];

const categoryRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('اسم القسم مطلوب.')
    .isLength({ min: 3, max: 100 }).withMessage('الاسم بين 3 و 100 حرف.'),

  body('slug')
    .trim()
    .notEmpty().withMessage('معرف القسم (Slug) مطلوب.')
    .matches(/^[a-z0-9-]+$/i).withMessage('المعرف يجب أن يحتوي على أحرف وأرقام وشرطات فقط.'),
];

module.exports = {
  createPostRules,
  updatePostRules,
  replyRules,
  reportRules,
  categoryRules,
};
