// src/controllers/forum.controller.js
// Forum API — powers the منتدى مجتمع السكينة section.
//
//   GET  /api/forum/posts              — paginated approved posts (public)
//   POST /api/forum/posts              — create post (anonymous or auth)
//   GET  /api/forum/posts/:id          — single post with replies
//   POST /api/forum/posts/:id/replies  — add reply (authenticated)
//   POST /api/forum/posts/:id/like     — toggle like (authenticated)
//   PATCH /api/forum/posts/:id/status  — moderate (RAQI/ADMIN)
//   PATCH /api/forum/posts/:id/reply   — add official reply (RAQI/ADMIN)
//   GET   /api/forum/posts/pending     — pending posts queue (RAQI/ADMIN)

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

// ── GET /api/forum/posts ──────────────────────────────────────────────────────
async function getPosts(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    // Public endpoint shows only APPROVED posts
    const where = { status: 'APPROVED', deletedAt: null };

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, authorName: true, title: true, content: true,
          badge: true, officialReply: true, likesCount: true,
          createdAt: true,
          _count: { select: { replies: true } },
        },
      }),
      prisma.forumPost.count({ where }),
    ]);

    res.json({
      success: true,
      data: posts.map((p) => ({ ...p, repliesCount: p._count.replies })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/forum/posts/pending  (RAQI / ADMIN) ─────────────────────────────
async function getPendingPosts(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const where = { status: 'PENDING', deletedAt: null };

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'asc' }, // oldest first for moderation queue
        select: {
          id: true, authorName: true, title: true, content: true,
          badge: true, createdAt: true,
        },
      }),
      prisma.forumPost.count({ where }),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/forum/posts ─────────────────────────────────────────────────────
// Anyone can post — authenticated users get userId attached; guests use authorName only.
async function createPost(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { authorName, title, content, badge } = req.body;
    const userId = req.user?.id || null; // req.user set by optional auth

    const post = await prisma.forumPost.create({
      data: {
        authorName: authorName || req.user?.name || 'مجهول',
        title,
        content,
        badge: badge || 'استفسار شرعي',
        status: 'PENDING', // always starts pending for moderation
        userId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'تم إرسال مشاركتك للمراجعة. سيتم نشرها بعد موافقة المشرف.',
      post,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/forum/posts/:id ──────────────────────────────────────────────────
async function getPost(req, res, next) {
  try {
    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { name: true, role: true } },
          },
        },
      },
    });

    if (!post) return next(createError('الموضوع غير موجود.', 404));

    // Non-moderators can only see approved posts
    if (
      post.status !== 'APPROVED' &&
      (!req.user || (req.user.role !== 'RAQI' && req.user.role !== 'ADMIN'))
    ) {
      return next(createError('الموضوع غير متاح حالياً.', 404));
    }

    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/forum/posts/:id/replies ────────────────────────────────────────
async function addReply(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, status: 'APPROVED', deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود أو لم يتم اعتماده بعد.', 404));

    const isOfficial = ['RAQI', 'ADMIN'].includes(req.user.role);

    const reply = await prisma.forumReply.create({
      data: {
        postId:     req.params.id,
        userId:     req.user.id,
        content:    req.body.content,
        isOfficial,
      },
      include: { user: { select: { name: true, role: true } } },
    });

    res.status(201).json({ success: true, message: 'تم إضافة ردك بنجاح.', reply });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/forum/posts/:id/like ───────────────────────────────────────────
// Toggle like — idempotent (like/unlike)
async function toggleLike(req, res, next) {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      // Unlike
      await prisma.postLike.delete({ where: { userId_postId: { userId, postId } } });
      await prisma.forumPost.update({
        where: { id: postId },
        data:  { likesCount: { decrement: 1 } },
      });
      return res.json({ success: true, liked: false, message: 'تم إلغاء الإعجاب.' });
    }

    // Like
    await prisma.postLike.create({ data: { userId, postId } });
    await prisma.forumPost.update({
      where: { id: postId },
      data:  { likesCount: { increment: 1 } },
    });

    res.json({ success: true, liked: true, message: 'تم تسجيل إعجابك.' });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/forum/posts/:id/status  (RAQI/ADMIN) ──────────────────────────
async function moderatePost(req, res, next) {
  try {
    const { status, moderatorNote } = req.body;
    const valid = ['APPROVED', 'REJECTED', 'PENDING'];

    if (!valid.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `الحالة غير صالحة. القيم المتاحة: ${valid.join(', ')}`,
      });
    }

    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود.', 404));

    const updated = await prisma.forumPost.update({
      where: { id: req.params.id },
      data:  { status, ...(moderatorNote && { moderatorNote }) },
    });

    const messages = {
      APPROVED: 'تم اعتماد المشاركة ونشرها في المنتدى.',
      REJECTED: 'تم رفض المشاركة.',
      PENDING:  'تم إعادة المشاركة لقائمة المراجعة.',
    };

    res.json({ success: true, message: messages[status], post: updated });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/forum/posts/:id/reply  (RAQI/ADMIN) ───────────────────────────
// Adds or updates the pinned official reply shown on the post card
async function setOfficialReply(req, res, next) {
  try {
    const { officialReply } = req.body;

    if (!officialReply?.trim()) {
      return res.status(400).json({ success: false, message: 'نص الرد الرسمي مطلوب.' });
    }

    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود.', 404));

    const updated = await prisma.forumPost.update({
      where: { id: req.params.id },
      data:  { officialReply: officialReply.trim() },
    });

    res.json({ success: true, message: 'تم حفظ الرد الرسمي بنجاح.', post: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPosts, getPendingPosts, createPost, getPost,
  addReply, toggleLike, moderatePost, setOfficialReply,
};
