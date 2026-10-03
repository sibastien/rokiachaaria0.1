// src/controllers/articles.controller.js
// Blog/Articles API — powers the مدونة الشفاء section.
//
//   GET  /api/articles           — paginated list with optional category filter
//   GET  /api/articles/:id       — single article (by ID or slug) with related articles
//   POST /api/articles           — create article (ADMIN)
//   PUT  /api/articles/:id       — update article (ADMIN)
//   DELETE /api/articles/:id     — soft-delete article (ADMIN)

const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { createError } = require('../middleware/errorHandler');

const LOCAL_ARTICLES_FILE = path.resolve(__dirname, '../../../content/articles/articles.json');

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

function getLocalArticles() {
  if (!fs.existsSync(LOCAL_ARTICLES_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(LOCAL_ARTICLES_FILE, 'utf-8'));
    return raw.map((a) => ({
      id: a.id,
      slug: a.slug || a.id,
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      categoryKey: a.category_id || a.categoryKey,
      categoryName: a.category_name || a.categoryName,
      author: a.author,
      readTime: a.read_time || a.readTime || '5 دقائق',
      coverImage: a.cover_image_url || a.coverImage || null,
      publishedAt: a.published_at ? new Date(a.published_at) : new Date(a.createdAt || Date.now()),
      faq: a.faq || [],
      tags: a.tags || [],
      metaTitle: a.meta_title || null,
      metaDescription: a.meta_description || null,
    }));
  } catch (_) {
    return [];
  }
}

// ── GET /api/articles ─────────────────────────────────────────────────────────
// Query params: ?category=sunnah&page=1&limit=6&search=العين
async function getArticles(req, res, next) {
  const page     = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit    = Math.min(50, parseInt(req.query.limit, 10) || 6);
  const skip     = (page - 1) * limit;
  const category = req.query.category;
  const search   = req.query.search ? req.query.search.trim().toLowerCase() : '';

  try {
    const where = {
      deletedAt: null,
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
          id: true, slug: true, title: true, excerpt: true,
          categoryKey: true, categoryName: true,
          author: true, readTime: true, coverImage: true, publishedAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    if (articles && articles.length > 0) {
      const categories = await prisma.article.groupBy({
        by: ['categoryKey', 'categoryName'],
        where: { deletedAt: null },
      });

      return res.json({
        success: true,
        data: articles,
        categories: categories.map((c) => ({ key: c.categoryKey, name: c.categoryName })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }
  } catch (_) {
    // If DB fails (e.g. offline), smoothly fall back to JSON storage
  }

  // Fallback to local JSON articles
  const localList = getLocalArticles();
  let filtered = localList;
  if (category && category !== 'all') {
    filtered = filtered.filter((a) => a.categoryKey === category);
  }
  if (search) {
    filtered = filtered.filter(
      (a) =>
        (a.title && a.title.toLowerCase().includes(search)) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(search)) ||
        (a.author && a.author.toLowerCase().includes(search))
    );
  }

  const total = filtered.length;
  const paged = filtered.slice(skip, skip + limit);

  // Derive categories
  const catMap = new Map();
  localList.forEach((a) => {
    if (a.categoryKey && !catMap.has(a.categoryKey)) {
      catMap.set(a.categoryKey, a.categoryName || a.categoryKey);
    }
  });
  const categories = Array.from(catMap.entries()).map(([key, name]) => ({ key, name }));

  return res.json({
    success: true,
    data: paged,
    categories,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ── GET /api/articles/:id ─────────────────────────────────────────────────────
// Accepts either article ID or slug
async function getArticle(req, res, next) {
  const identifier = req.params.id;

  let article = null;
  let allArticles = [];

  try {
    article = await prisma.article.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        deletedAt: null,
      },
    });

    if (article) {
      allArticles = await prisma.article.findMany({
        where: { deletedAt: null },
        take: 10,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true, slug: true, title: true, excerpt: true,
          categoryKey: true, categoryName: true,
          author: true, readTime: true, coverImage: true, publishedAt: true,
        },
      });
    }
  } catch (_) {
    // DB offline fallback
  }

  if (!article) {
    const local = getLocalArticles();
    article = local.find((a) => a.id === identifier || a.slug === identifier);
    allArticles = local;
  }

  if (!article) {
    return next(createError('المقال غير موجود.', 404));
  }

  // Related suggestions: Prefer same category, excluding current article
  const currentId = article.id;
  const currentSlug = article.slug;
  const sameCategory = allArticles.filter(
    (a) => a.categoryKey === article.categoryKey && a.id !== currentId && a.slug !== currentSlug
  );
  const others = allArticles.filter(
    (a) => a.categoryKey !== article.categoryKey && a.id !== currentId && a.slug !== currentSlug
  );

  const related = [...sameCategory, ...others].slice(0, 4);

  res.json({
    success: true,
    article,
    related,
  });
}

// ── POST /api/articles  (ADMIN) ───────────────────────────────────────────────
async function createArticle(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { slug, title, excerpt, content, categoryKey, categoryName, author, readTime, coverImage } = req.body;
    const finalSlug = slug ? slug.trim().toLowerCase() : undefined;

    const article = await prisma.article.create({
      data: {
        slug: finalSlug,
        title,
        excerpt,
        content,
        categoryKey,
        categoryName,
        author,
        readTime,
        coverImage: coverImage || null,
      },
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

    const existing = await prisma.article.findFirst({
      where: {
        OR: [{ id: req.params.id }, { slug: req.params.id }],
        deletedAt: null,
      },
    });
    if (!existing) return next(createError('المقال غير موجود.', 404));

    const { slug, title, excerpt, content, categoryKey, categoryName, author, readTime, coverImage } = req.body;

    const article = await prisma.article.update({
      where: { id: existing.id },
      data: {
        ...(slug         && { slug: slug.trim().toLowerCase() }),
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
    const existing = await prisma.article.findFirst({
      where: {
        OR: [{ id: req.params.id }, { slug: req.params.id }],
        deletedAt: null,
      },
    });
    if (!existing) return next(createError('المقال غير موجود.', 404));

    await prisma.article.update({
      where: { id: existing.id },
      data:  { deletedAt: new Date() },
    });

    res.json({ success: true, message: 'تم حذف المقال بنجاح.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getArticles, getArticle, createArticle, updateArticle, deleteArticle };
