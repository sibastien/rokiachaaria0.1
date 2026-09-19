// src/validators/articles.validators.js
const { body } = require('express-validator');

const VALID_CATEGORIES = ['sunnah', 'hasad', 'adhkar'];

const articleRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('عنوان المقال مطلوب.')
    .isLength({ max: 200 }).withMessage('العنوان لا يتجاوز 200 حرف.'),

  body('excerpt')
    .trim()
    .notEmpty().withMessage('الملخص مطلوب.')
    .isLength({ max: 500 }).withMessage('الملخص لا يتجاوز 500 حرف.'),

  body('content')
    .trim()
    .notEmpty().withMessage('محتوى المقال مطلوب.'),

  body('categoryKey')
    .trim()
    .notEmpty().withMessage('تصنيف المقال مطلوب.')
    .isIn(VALID_CATEGORIES).withMessage(`التصنيف غير صالح. الأنواع المتاحة: ${VALID_CATEGORIES.join(', ')}`),

  body('categoryName')
    .trim()
    .notEmpty().withMessage('اسم التصنيف بالعربية مطلوب.'),

  body('author')
    .trim()
    .notEmpty().withMessage('اسم الكاتب مطلوب.'),

  body('readTime')
    .trim()
    .notEmpty().withMessage('وقت القراءة مطلوب (مثال: 4 دقائق).'),

  body('coverImage')
    .optional()
    .trim()
    .isURL().withMessage('رابط صورة الغلاف غير صالح.'),
];

module.exports = { articleRules };
