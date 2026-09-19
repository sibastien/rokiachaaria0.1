// src/controllers/articles.controller.js
// Blog/Articles API — powers the مدونة الشفاء section.
//
//   GET  /api/articles           — paginated list with optional category filter
//   GET  /api/articles/:id       — single article
//   POST /api/articles           — create article (ADMIN)
//   PUT  /api/articles/:id       — update article (ADMIN)
//   DELETE /api/articles/:id     — soft-delete article (ADMIN)

const { validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { createError } = require('../middleware/errorHandler');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('بيانات الطلب غير صحيحة.');
    err.type = 'VALIDATION_ERROR';
    err.statusCode = 422;
    err.errors = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return err;
  }
  return null;
}

// ── GET /api/articles ─────────────────────────────────────────────────────────
// Query params: ?category=sunnah&page=1&limit=6&search=العين
async function getArticles(req, res, next) {
  try {
    const page     = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit    = Math.min(50, parseInt(req.query.limit, 10) || 6);
    const skip     = (page - 1) * limit;
    const category = req.query.category;
    const search   = req.query.search;

    const where = {
      deletedAt: null, // exclude soft-deleted
      ...(category && category !== 'all' && { categoryKey: category }),
      ...(search && {
        OR: [
          { title:   { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true, title: true, excerpt: true,
          categoryKey: true, categoryName: true,
          author: true, readTime: true, coverImage: true, publishedAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    // Build available categories list for the filter pills
    const categories = await prisma.article.groupBy({
      by: ['categoryKey', 'categoryName'],
      where: { deletedAt: null },
    });

    res.json({
      success: true,
      data: articles,
      categories: categories.map((c) => ({ key: c.categoryKey, name: c.categoryName })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/articles/:id ─────────────────────────────────────────────────────
async function getArticle(req, res, next) {
  try {
    const article = await prisma.article.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!article) return next(createError('المقال غير موجود.', 404));

    res.json({ success: true, article });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/articles  (ADMIN) ───────────────────────────────────────────────
async function createArticle(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { title, excerpt, content, categoryKey, categoryName, author, readTime, coverImage } = req.body;

    const article = await prisma.article.create({
      data: { title, excerpt, content, categoryKey, categoryName, author, readTime, coverImage: coverImage || null },
    });

    res.status(201).json({ success: true, message: 'تم نشر المقال بنجاح.', article });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/articles/:id  (ADMIN) ────────────────────────────────────────────
async function updateArticle(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const existing = await prisma.article.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return next(createError('المقال غير موجود.', 404));

    const { title, excerpt, content, categoryKey, categoryName, author, readTime, coverImage } = req.body;

    const article = await prisma.article.update({
      where: { id: req.params.id },
      data: {
        ...(title        && { title }),
        ...(excerpt      && { excerpt }),
        ...(content      && { content }),
        ...(categoryKey  && { categoryKey }),
        ...(categoryName && { categoryName }),
        ...(author       && { author }),
        ...(readTime     && { readTime }),
        ...(coverImage   !== undefined && { coverImage }),
      },
    });

    res.json({ success: true, message: 'تم تحديث المقال بنجاح.', article });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/articles/:id  (ADMIN — soft delete) ──────────────────────────
async function deleteArticle(req, res, next) {
  try {
    const existing = await prisma.article.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return next(createError('المقال غير موجود.', 404));

    await prisma.article.update({
      where: { id: req.params.id },
      data:  { deletedAt: new Date() },
    });

    res.json({ success: true, message: 'تم حذف المقال بنجاح.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getArticles, getArticle, createArticle, updateArticle, deleteArticle };
