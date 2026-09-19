// src/middleware/errorHandler.js
// Central error handling middleware — must be registered LAST in app.js.
// Catches both operational errors (thrown by routes) and unexpected crashes.

const { isDev } = require('../config/env');

/**
 * Standard error response shape:
 * { success: false, message: string, errors?: array, stack?: string }
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Prisma-specific errors
  if (err.code === 'P2002') {
    // Unique constraint violation (e.g., duplicate email or booking slot)
    const field = err.meta?.target?.join(', ') || 'حقل';
    return res.status(409).json({
      success: false,
      message: `هذا ${field} مستخدم بالفعل. يرجى اختيار قيمة أخرى.`,
    });
  }

  if (err.code === 'P2025') {
    // Record not found
    return res.status(404).json({
      success: false,
      message: 'العنصر المطلوب غير موجود.',
    });
  }

  // Validation errors from express-validator (array format)
  if (err.type === 'VALIDATION_ERROR') {
    return res.status(422).json({
      success: false,
      message: 'بيانات الطلب غير صحيحة.',
      errors: err.errors,
    });
  }

  // Generic HTTP errors with a status code
  const statusCode = err.statusCode || err.status || 500;
  const message =
    statusCode < 500
      ? err.message
      : isDev
        ? err.message
        : 'حدث خطأ داخلي في الخادم. يرجى المحاولة لاحقاً.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack: err.stack }),
  });
}

/** Convenience: create an operational error with a status code. */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, createError };
