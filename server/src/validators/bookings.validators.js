// src/validators/bookings.validators.js
const { body } = require('express-validator');

const SERVICE_TYPES = [
  'جلسة رقية فردية مباشرة',
  'رقية الأطفال والتحصين المنزلي',
  'استشارة تشخيصية وتوجيه',
  'رقية مسجلة مخصصة',
];

const createBookingRules = [
  body('raqiId')
    .trim()
    .notEmpty().withMessage('يجب اختيار الراقي (raqiId).'),

  body('serviceType')
    .trim()
    .notEmpty().withMessage('يجب تحديد نوع الخدمة.')
    .isIn(SERVICE_TYPES).withMessage(`نوع الخدمة غير صالح. الأنواع المتاحة: ${SERVICE_TYPES.join(' | ')}`),

  body('startTime')
    .notEmpty().withMessage('وقت بدء الجلسة مطلوب.')
    .isISO8601().withMessage('تنسيق وقت البدء غير صحيح. استخدم ISO 8601.')
    .custom((value) => {
      const start = new Date(value);
      if (start <= new Date()) {
        throw new Error('لا يمكن الحجز في وقت ماضٍ. يرجى اختيار موعد مستقبلي.');
      }
      return true;
    }),

  body('whatsapp')
    .trim()
    .notEmpty().withMessage('رقم الواتساب مطلوب لإتمام الحجز والتواصل.')
    .matches(/^[+0-9\s\-()]{7,25}$/).withMessage('يرجى إدخال رقم واتساب صحيح يتضمن رمز الدولة أو رقماً هاتفياً صالحاً.'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('الملاحظات لا يجب أن تتجاوز 500 حرف.'),
];

module.exports = { createBookingRules };
