// src/controllers/forum.controller.js
// Production-Ready Islamic Community Forum Controller
// Supports categories, topics, replies, search, pagination, pinning, locking,
// editing/deleting, user activity, reporting, and moderation audit logs.

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

function canModerate(user) {
  return user && ['MODERATOR', 'ADMIN', 'RAQI'].includes(user.role);
}

async function logModeration(moderatorId, action, targetType, targetId, reason = null, metadata = null) {
  try {
    await prisma.moderationLog.create({
      data: {
        moderatorId,
        action,
        targetType,
        targetId,
        reason,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (e) {
    console.warn('[ModerationLog] Failed to record log:', e.message);
  }
}

// ── DEFAULT CATEGORIES SEEDER ───────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  {
    slug: 'sharia-inquiries',
    name: 'استفسارات شرعية وعقائدية',
    description: 'أسئلة الرقية الشرعية والأحكام الفقهية المتعلقة بالتداوي بالقرآن والتحصين',
    icon: 'help-circle',
    orderIndex: 1
  },
  {
    slug: 'healing-experiences',
    name: 'تجارب وقصص الشفاء',
    description: 'مشاركات وتجارب الأعضاء الواقعية في الاستشفاء بكتاب الله والتخلص من الأذى',
    icon: 'heart-pulse',
    orderIndex: 2
  },
  {
    slug: 'adhkar-protection',
    name: 'أدعية وأذكار التحصين',
    description: 'الأدعية المأثورة عن النبي ﷺ وأذكار الصباح والمساء لحفظ النفس والأهل',
    icon: 'shield',
    orderIndex: 3
  },
  {
    slug: 'ruqyah-discussions',
    name: 'حوارات ونقاشات عامة',
    description: 'نقاشات هادفة حول التداوي بالقرآن والسنة وتبادل النصائح والإرشادات',
    icon: 'messages-square',
    orderIndex: 4
  }
];

async function ensureDefaultCategories() {
  try {
    const count = await prisma.forumCategory.count();
    if (count === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await prisma.forumCategory.create({ data: cat });
      }
    }
  } catch (_) {
    // If DB offline or table not ready, continue gracefully
  }
}
ensureDefaultCategories();

// ── 1. FORUM CATEGORIES ─────────────────────────────────────────────────────

// GET /api/forum/categories (Public)
async function getCategories(req, res, next) {
  try {
    const categories = await prisma.forumCategory.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            posts: { where: { status: 'APPROVED', deletedAt: null } }
          }
        }
      }
    });

    res.json({
      success: true,
      data: categories.map(c => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        orderIndex: c.orderIndex,
        postsCount: c._count.posts,
      }))
    });
  } catch (err) {
    // Fallback if table not ready
    res.json({
      success: true,
      data: DEFAULT_CATEGORIES.map((c, idx) => ({
        id: `cat-${idx + 1}`,
        ...c,
        postsCount: 0
      }))
    });
  }
}

// POST /api/forum/categories (ADMIN only)
async function createCategory(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { slug, name, description, icon, orderIndex } = req.body;

    const existing = await prisma.forumCategory.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'يوجد قسم آخر يحمل نفس المعرف (Slug).',
      });
    }

    const category = await prisma.forumCategory.create({
      data: {
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description ? description.trim() : null,
        icon: icon || 'message-square',
        orderIndex: parseInt(orderIndex, 10) || 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء قسم المنتدى بنجاح.',
      data: category,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/forum/categories/:id (ADMIN only)
async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, icon, orderIndex, isActive } = req.body;

    const category = await prisma.forumCategory.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(icon && { icon }),
        ...(orderIndex !== undefined && { orderIndex: parseInt(orderIndex, 10) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json({
      success: true,
      message: 'تم تحديث بيانات القسم بنجاح.',
      data: category,
    });
  } catch (err) {
    next(err);
  }
}

// ── 2. FORUM TOPICS (POSTS) ─────────────────────────────────────────────────

// GET /api/forum (Public approved posts with search, category, sort & pagination)
async function getPosts(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const { category, q, sort } = req.query;

    const where = {
      status: 'APPROVED',
      deletedAt: null,
    };

    // Category / Badge filter
    if (category && category !== 'ALL') {
      where.OR = [
        { categoryId: category },
        { category: { slug: category } },
        { badge: category },
      ];
    }

    // Search query
    if (q && q.trim()) {
      const search = q.trim();
      where.AND = [
        {
          OR: [
            { title:   { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
            { authorName: { contains: search, mode: 'insensitive' } },
          ]
        }
      ];
    }

    // Sorting: Pinned posts are ALWAYS surfaced at the top!
    let orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    if (sort === 'active') {
      orderBy = [{ isPinned: 'desc' }, { updatedAt: 'desc' }];
    } else if (sort === 'unanswered') {
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'popular' || sort === 'likes') {
      orderBy = [{ isPinned: 'desc' }, { likesCount: 'desc' }, { createdAt: 'desc' }];
    }

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          authorName: true,
          title: true,
          content: true,
          badge: true,
          categoryId: true,
          category: { select: { id: true, name: true, slug: true, icon: true } },
          isPinned: true,
          isLocked: true,
          viewsCount: true,
          isEdited: true,
          editedAt: true,
          officialReply: true,
          likesCount: true,
          createdAt: true,
          user: { select: { id: true, name: true, role: true } },
          _count: { select: { replies: { where: { deletedAt: null } } } },
        },
      }),
      prisma.forumPost.count({ where }),
    ]);

    res.json({
      success: true,
      data: posts.map((p) => ({
        ...p,
        repliesCount: p._count.replies,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/forum/pending (RAQI / MODERATOR / ADMIN only)
async function getPendingPosts(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const where = { status: 'PENDING', deletedAt: null };

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' }, // oldest first
        include: {
          category: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.forumPost.count({ where }),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/forum (Create Topic - guests or authenticated)
async function createPost(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { authorName, title, content, badge, categoryId } = req.body;
    const userId = req.user?.id || null;

    // Staff/Moderators/Raqis get instant approval; normal users and guests start PENDING
    const isStaff = canModerate(req.user);
    const status = isStaff ? 'APPROVED' : 'PENDING';

    let resolvedBadge = badge || 'استفسار شرعي';
    let resolvedCategoryId = null;

    if (categoryId) {
      const cat = await prisma.forumCategory.findFirst({
        where: { OR: [{ id: categoryId }, { slug: categoryId }] }
      });
      if (cat) {
        resolvedCategoryId = cat.id;
        resolvedBadge = cat.name;
      }
    }

    const post = await prisma.forumPost.create({
      data: {
        authorName: (req.user?.name || authorName || 'زائر').trim(),
        title: title.trim(),
        content: content.trim(),
        badge: resolvedBadge,
        categoryId: resolvedCategoryId,
        status,
        userId,
      },
      include: {
        category: true,
        user: { select: { id: true, name: true, role: true } }
      }
    });

    const message = status === 'APPROVED'
      ? 'تم نشر موضوعك في المنتدى مباشرة.'
      : 'تم إرسال مشاركتك للمراجعة. سيتم نشرها بعد موافقة المشرف الشرعي.';

    res.status(201).json({
      success: true,
      message,
      post,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/forum/:id (Single Topic with replies)
async function getPost(req, res, next) {
  try {
    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        category: true,
        user: { select: { id: true, name: true, role: true, createdAt: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, role: true, createdAt: true } },
          },
        },
      },
    });

    if (!post) return next(createError('الموضوع غير موجود أو تم حذفه.', 404));

    // Non-moderators can only see approved posts unless they are the author
    if (
      post.status !== 'APPROVED' &&
      (!req.user || (post.userId !== req.user.id && !canModerate(req.user)))
    ) {
      return next(createError('الموضوع قيد المراجعة ولا يمكن عرضه حالياً.', 404));
    }

    // Increment views count asynchronously (non-blocking)
    prisma.forumPost.update({
      where: { id: post.id },
      data: { viewsCount: { increment: 1 } },
    }).catch(() => {});

    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
}

// PUT /api/forum/:id (Update Topic - Author or Moderator/Admin)
async function updatePost(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود.', 404));

    const isAuthor = req.user && post.userId === req.user.id;
    const isMod = canModerate(req.user);

    if (!isAuthor && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل هذا الموضوع.',
      });
    }

    // If locked, only moderators can edit
    if (post.isLocked && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'هذا الموضوع مغلق ولا يمكن تعديله.',
      });
    }

    const { title, content, badge, categoryId } = req.body;

    const data = {
      isEdited: true,
      editedAt: new Date(),
    };
    if (title) data.title = title.trim();
    if (content) data.content = content.trim();
    if (badge) data.badge = badge.trim();
    if (categoryId) data.categoryId = categoryId;

    const updated = await prisma.forumPost.update({
      where: { id: post.id },
      data,
      include: { category: true, user: { select: { id: true, name: true, role: true } } }
    });

    if (isMod && !isAuthor) {
      await logModeration(req.user.id, 'EDIT_POST', 'POST', post.id, 'تعديل رقابي للمحتوى');
    }

    res.json({
      success: true,
      message: 'تم تحديث الموضوع بنجاح.',
      post: updated,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/forum/:id (Delete Topic - Author or Moderator/Admin)
async function deletePost(req, res, next) {
  try {
    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود.', 404));

    const isAuthor = req.user && post.userId === req.user.id;
    const isMod = canModerate(req.user);

    if (!isAuthor && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لحذف هذا الموضوع.',
      });
    }

    // Soft delete
    await prisma.forumPost.update({
      where: { id: post.id },
      data: { deletedAt: new Date() },
    });

    if (isMod && !isAuthor) {
      const reason = req.body?.reason || 'حذف رقابي لمخالفة الشروط';
      await logModeration(req.user.id, 'DELETE_POST', 'POST', post.id, reason);
    }

    res.json({
      success: true,
      message: 'تم حذف الموضوع بنجاح.',
    });
  } catch (err) {
    next(err);
  }
}

// ── 3. FORUM REPLIES ────────────────────────────────────────────────────────

// POST /api/forum/:id/replies (Add Reply - Authenticated)
async function addReply(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, status: 'APPROVED', deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود أو لم يتم اعتماده بعد.', 404));

    const isMod = canModerate(req.user);

    // If locked, normal users are blocked!
    if (post.isLocked && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'هذا الموضوع مغلق من قِبل المشرفين ولا يقبل ردوداً جديدة.',
      });
    }

    const isOfficial = ['RAQI', 'ADMIN'].includes(req.user.role);

    const reply = await prisma.forumReply.create({
      data: {
        postId:     req.params.id,
        userId:     req.user.id,
        content:    req.body.content.trim(),
        isOfficial,
      },
      include: { user: { select: { id: true, name: true, role: true, createdAt: true } } },
    });

    // Touch post updatedAt so it bumps up on active sort
    prisma.forumPost.update({
      where: { id: post.id },
      data: { updatedAt: new Date() },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'تم إضافة ردك بنجاح.',
      reply,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/forum/replies/:replyId (Update Reply - Author or Moderator/Admin)
async function updateReply(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const reply = await prisma.forumReply.findFirst({
      where: { id: req.params.replyId, deletedAt: null },
      include: { post: true }
    });
    if (!reply) return next(createError('الرد غير موجود.', 404));

    const isAuthor = req.user && reply.userId === req.user.id;
    const isMod = canModerate(req.user);

    if (!isAuthor && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل هذا الرد.',
      });
    }

    if (reply.post.isLocked && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'الموضوع مغلق ولا يمكن تعديل الردود فيه.',
      });
    }

    const updated = await prisma.forumReply.update({
      where: { id: reply.id },
      data: {
        content: req.body.content.trim(),
        isEdited: true,
        editedAt: new Date(),
      },
      include: { user: { select: { id: true, name: true, role: true } } }
    });

    if (isMod && !isAuthor) {
      await logModeration(req.user.id, 'EDIT_REPLY', 'REPLY', reply.id, 'تعديل رقابي للرد');
    }

    res.json({
      success: true,
      message: 'تم تعديل الرد بنجاح.',
      reply: updated,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/forum/replies/:replyId (Delete Reply - Author or Moderator/Admin)
async function deleteReply(req, res, next) {
  try {
    const reply = await prisma.forumReply.findFirst({
      where: { id: req.params.replyId, deletedAt: null },
    });
    if (!reply) return next(createError('الرد غير موجود.', 404));

    const isAuthor = req.user && reply.userId === req.user.id;
    const isMod = canModerate(req.user);

    if (!isAuthor && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لحذف هذا الرد.',
      });
    }

    // Soft delete
    await prisma.forumReply.update({
      where: { id: reply.id },
      data: { deletedAt: new Date() },
    });

    if (isMod && !isAuthor) {
      const reason = req.body?.reason || 'حذف رقابي للرد';
      await logModeration(req.user.id, 'DELETE_REPLY', 'REPLY', reply.id, reason);
    }

    res.json({
      success: true,
      message: 'تم حذف الرد بنجاح.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/forum/:id/like (Toggle Like - Authenticated)
async function toggleLike(req, res, next) {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { userId_postId: { userId, postId } } });
      await prisma.forumPost.update({
        where: { id: postId },
        data:  { likesCount: { decrement: 1 } },
      });
      return res.json({ success: true, liked: false, message: 'تم إلغاء الإعجاب.' });
    }

    await prisma.postLike.create({ data: { userId, postId } });
    await prisma.forumPost.update({
      where: { id: postId },
      data:  { likesCount: { increment: 1 } },
    });

    res.json({ success: true, liked: true, message: 'تم تسجيل إعجابك بالموضوع.' });
  } catch (err) {
    next(err);
  }
}

// ── 4. MODERATION ACTIONS (PIN, LOCK, STATUS, OFFICIAL REPLY) ───────────────

// PATCH /api/forum/:id/pin (MODERATOR / ADMIN only)
async function togglePin(req, res, next) {
  try {
    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود.', 404));

    const newPinned = !post.isPinned;
    const updated = await prisma.forumPost.update({
      where: { id: post.id },
      data: { isPinned: newPinned },
    });

    const action = newPinned ? 'PIN_POST' : 'UNPIN_POST';
    await logModeration(req.user.id, action, 'POST', post.id, newPinned ? 'تثبيت الموضوع في أعلى المنتدى' : 'إلغاء تثبيت الموضوع');

    res.json({
      success: true,
      message: newPinned ? 'تم تثبيت الموضوع في أعلى المنتدى.' : 'تم إلغاء تثبيت الموضوع.',
      isPinned: newPinned,
      post: updated,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/forum/:id/lock (MODERATOR / ADMIN only)
async function toggleLock(req, res, next) {
  try {
    const post = await prisma.forumPost.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!post) return next(createError('الموضوع غير موجود.', 404));

    const newLocked = !post.isLocked;
    const updated = await prisma.forumPost.update({
      where: { id: post.id },
      data: { isLocked: newLocked },
    });

    const action = newLocked ? 'LOCK_POST' : 'UNLOCK_POST';
    await logModeration(req.user.id, action, 'POST', post.id, newLocked ? 'إغلاق الموضوع ومنع الردود' : 'إعادة فتح الموضوع للردود');

    res.json({
      success: true,
      message: newLocked ? 'تم إغلاق الموضوع ومنع الردود الجديدة.' : 'تم فتح الموضوع للردود مجدداً.',
      isLocked: newLocked,
      post: updated,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/forum/:id/status (RAQI / MODERATOR / ADMIN)
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

    const action = status === 'APPROVED' ? 'APPROVE_POST' : (status === 'REJECTED' ? 'REJECT_POST' : 'PENDING_POST');
    await logModeration(req.user.id, action, 'POST', post.id, moderatorNote || `تغيير الحالة إلى ${status}`);

    const messages = {
      APPROVED: 'تم اعتماد المشاركة ونشرها في المنتدى.',
      REJECTED: 'تم رفض المشاركة.',
      PENDING:  'تمت إعادة المشاركة لقائمة المراجعة.',
    };

    res.json({ success: true, message: messages[status], post: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/forum/:id/reply (RAQI / ADMIN only)
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

    await logModeration(req.user.id, 'SET_OFFICIAL_REPLY', 'POST', post.id, 'إضافة رد شرعي رسمي معتمد');

    res.json({ success: true, message: 'تم حفظ ونشر الرد الرسمي المعتمد بنجاح.', post: updated });
  } catch (err) {
    next(err);
  }
}

// ── 5. REPORTING & COMMUNITY SAFETY ─────────────────────────────────────────

// POST /api/forum/reports (Create Report - Authenticated)
async function createReport(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { postId, replyId, reason, details } = req.body;

    if (!postId && !replyId) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد الموضوع أو الرد المُبلّغ عنه.',
      });
    }

    // Verify existence
    if (postId) {
      const p = await prisma.forumPost.findUnique({ where: { id: postId } });
      if (!p) return next(createError('الموضوع المُبلّغ عنه غير موجود.', 404));
    }
    if (replyId) {
      const r = await prisma.forumReply.findUnique({ where: { id: replyId } });
      if (!r) return next(createError('الرد المُبلّغ عنه غير موجود.', 404));
    }

    const report = await prisma.forumReport.create({
      data: {
        reporterId: req.user.id,
        postId: postId || null,
        replyId: replyId || null,
        reason: reason.trim(),
        details: details ? details.trim() : null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'تم استلام بلاغك وسيقوم المشرفون بمراجعته واتخاذ الإجراء اللازم. جزاك الله خيراً.',
      report,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/forum/reports (MODERATOR / ADMIN only)
async function getReports(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;
    const status = req.query.status || 'PENDING';

    const where = status !== 'ALL' ? { status } : {};

    const [reports, total] = await Promise.all([
      prisma.forumReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true } },
          post: { select: { id: true, title: true, content: true, authorName: true, status: true } },
          reply: { select: { id: true, content: true, user: { select: { name: true } } } },
        },
      }),
      prisma.forumReport.count({ where }),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/forum/reports/:id (MODERATOR / ADMIN only)
// Resolve or Dismiss report, optionally perform action (delete post/reply)
async function resolveReport(req, res, next) {
  try {
    const { id } = req.params;
    const { status, resolutionNote, action } = req.body;

    const validStatus = ['RESOLVED', 'DISMISSED'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'الحالة يجب أن تكون RESOLVED أو DISMISSED.',
      });
    }

    const report = await prisma.forumReport.findUnique({
      where: { id },
      include: { post: true, reply: true }
    });
    if (!report) return next(createError('البلاغ غير موجود.', 404));

    // Optional moderation action triggered directly from report resolution
    if (action === 'DELETE_CONTENT') {
      if (report.postId) {
        await prisma.forumPost.update({
          where: { id: report.postId },
          data: { deletedAt: new Date() }
        });
        await logModeration(req.user.id, 'DELETE_POST', 'POST', report.postId, `تم الحذف بناءً على بلاغ: ${report.reason}`);
      } else if (report.replyId) {
        await prisma.forumReply.update({
          where: { id: report.replyId },
          data: { deletedAt: new Date() }
        });
        await logModeration(req.user.id, 'DELETE_REPLY', 'REPLY', report.replyId, `تم الحذف بناءً على بلاغ: ${report.reason}`);
      }
    }

    const updated = await prisma.forumReport.update({
      where: { id },
      data: {
        status,
        resolutionNote: resolutionNote ? resolutionNote.trim() : null,
        resolvedById: req.user.id,
      },
    });

    await logModeration(req.user.id, `REPORT_${status}`, 'REPORT', report.id, resolutionNote || `معالجة البلاغ: ${status}`);

    res.json({
      success: true,
      message: status === 'RESOLVED' ? 'تمت معالجة البلاغ بنجاح.' : 'تم تجاهل البلاغ.',
      report: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── 6. AUDIT LOGS & USER ACTIVITY ───────────────────────────────────────────

// GET /api/forum/moderation-logs (MODERATOR / ADMIN only)
async function getModerationLogs(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.moderationLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          moderator: { select: { id: true, name: true, role: true, email: true } },
        },
      }),
      prisma.moderationLog.count(),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/forum/users/:id/activity (Public / Authenticated)
async function getUserActivity(req, res, next) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, createdAt: true },
    });
    if (!user) return next(createError('المستخدم غير موجود.', 404));

    const [postsCount, repliesCount, recentPosts] = await Promise.all([
      prisma.forumPost.count({ where: { userId: id, status: 'APPROVED', deletedAt: null } }),
      prisma.forumReply.count({ where: { userId: id, deletedAt: null } }),
      prisma.forumPost.findMany({
        where: { userId: id, status: 'APPROVED', deletedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, badge: true, likesCount: true, createdAt: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        user,
        stats: {
          postsCount,
          repliesCount,
        },
        recentPosts,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // Categories
  getCategories,
  createCategory,
  updateCategory,
  // Topics
  getPosts,
  getPendingPosts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  // Replies
  addReply,
  updateReply,
  deleteReply,
  toggleLike,
  // Moderation
  togglePin,
  toggleLock,
  moderatePost,
  setOfficialReply,
  // Reports
  createReport,
  getReports,
  resolveReport,
  // Audit & Activity
  getModerationLogs,
  getUserActivity,
};
