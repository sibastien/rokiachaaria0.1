// src/controllers/audio.controller.js
// Audio Tracks Library API — powers the recitation player.

const prisma = require('../config/prisma');
const { createError } = require('../middleware/errorHandler');

const DEFAULT_TRACKS = [
  {
    title: "سورة الفاتحة وآية الكرسي",
    reciter: "تلاوة خاشعة مرتلة بنية الشفاء",
    duration: "04:30",
    category: "شاملة",
    src: "https://server8.mp3quran.net/afs/001.mp3",
    orderIndex: 0
  },
  {
    title: "أواخر سورة البقرة والمعوذات",
    reciter: "تلاوة هادئة لرد كيد الشيطان والتحصين",
    duration: "05:15",
    category: "سكينة ونوم",
    src: "https://server7.mp3quran.net/basit/002.mp3",
    orderIndex: 1
  },
  {
    title: "آيات إبطال السحر والعين",
    reciter: "تلاوة موجهة من سور يونس وطه والأعراف",
    duration: "06:40",
    category: "عين وحسد",
    src: "https://server12.mp3quran.net/maher/001.mp3",
    orderIndex: 2
  }
];

// ── GET /api/audio (Public) ───────────────────────────────────────────────────
async function getAudioTracks(req, res, next) {
  try {
    let tracks = await prisma.audioTrack.findMany({
      orderBy: { orderIndex: 'asc' },
    });

    // Auto-seed default tracks if empty
    if (tracks.length === 0) {
      await prisma.audioTrack.createMany({
        data: DEFAULT_TRACKS,
      });
      tracks = await prisma.audioTrack.findMany({
        orderBy: { orderIndex: 'asc' },
      });
    }

    res.json({ success: true, data: tracks });
  } catch (err) {
    // If table doesn't exist yet, return defaults gracefully
    res.json({ success: true, data: DEFAULT_TRACKS, fallback: true });
  }
}

// ── POST /api/audio (ADMIN only) ──────────────────────────────────────────────
async function createAudioTrack(req, res, next) {
  try {
    const { title, reciter, duration, category, src } = req.body;

    if (!title || !reciter) {
      return res.status(400).json({
        success: false,
        message: 'عنوان المقطع واسم القارئ مطلوبان.',
      });
    }

    const count = await prisma.audioTrack.count();

    const track = await prisma.audioTrack.create({
      data: {
        title: title.trim(),
        reciter: reciter.trim(),
        duration: duration ? duration.trim() : '05:00',
        category: category ? category.trim() : 'شاملة',
        src: src ? src.trim() : null,
        orderIndex: count,
      },
    });

    res.status(201).json({
      success: true,
      message: 'تمت إضافة المقطع الصوتي بنجاح.',
      data: track,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/audio/:id (ADMIN only) ───────────────────────────────────────────
async function updateAudioTrack(req, res, next) {
  try {
    const { id } = req.params;
    const { title, reciter, duration, category, src, orderIndex } = req.body;

    const track = await prisma.audioTrack.findUnique({ where: { id } });
    if (!track) return next(createError('المقطع الصوتي غير موجود.', 404));

    const updated = await prisma.audioTrack.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(reciter && { reciter: reciter.trim() }),
        ...(duration !== undefined && { duration: duration.trim() }),
        ...(category !== undefined && { category: category.trim() }),
        ...(src !== undefined && { src: src ? src.trim() : null }),
        ...(orderIndex !== undefined && { orderIndex: parseInt(orderIndex, 10) }),
      },
    });

    res.json({
      success: true,
      message: 'تم تحديث المقطع الصوتي بنجاح.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/audio/:id (ADMIN only) ────────────────────────────────────────
async function deleteAudioTrack(req, res, next) {
  try {
    const { id } = req.params;

    const track = await prisma.audioTrack.findUnique({ where: { id } });
    if (!track) return next(createError('المقطع الصوتي غير موجود.', 404));

    await prisma.audioTrack.delete({ where: { id } });

    res.json({
      success: true,
      message: 'تم حذف المقطع الصوتي بنجاح من قاعدة البيانات.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAudioTracks,
  createAudioTrack,
  updateAudioTrack,
  deleteAudioTrack,
};
