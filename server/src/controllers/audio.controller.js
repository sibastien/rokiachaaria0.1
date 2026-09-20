// src/controllers/audio.controller.js
// Audio Tracks Library API — powers the recitation player.

const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { createError } = require('../middleware/errorHandler');
const { audioUploadDir } = require('../middleware/upload');

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
    const tracks = await prisma.audioTrack.findMany({
      orderBy: { orderIndex: 'asc' },
    });

    res.json({ success: true, data: tracks });
  } catch (err) {
    // If table doesn't exist yet or connection issue, return empty array gracefully
    res.json({ success: true, data: [], fallback: true });
  }
}

// ── POST /api/audio/upload (ADMIN only) ───────────────────────────────────────
async function uploadAudioFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد ملف صوتي لرفعه.',
      });
    }

    const fileUrl = `/uploads/audio/${req.file.filename}`;

    res.json({
      success: true,
      message: 'تم رفع الملف الصوتي بنجاح.',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (err) {
    next(err);
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

    let finalSrc = src ? src.trim() : null;
    if (req.file) {
      finalSrc = `/uploads/audio/${req.file.filename}`;
    }

    const count = await prisma.audioTrack.count();

    const track = await prisma.audioTrack.create({
      data: {
        title: title.trim(),
        reciter: reciter.trim(),
        duration: duration ? duration.trim() : '05:00',
        category: category ? category.trim() : 'شاملة',
        src: finalSrc,
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

    let finalSrc = src !== undefined ? (src ? src.trim() : null) : undefined;
    if (req.file) {
      finalSrc = `/uploads/audio/${req.file.filename}`;
      // Clean up previous file if it was a local upload
      if (track.src && track.src.startsWith('/uploads/audio/')) {
        const oldFilename = track.src.replace('/uploads/audio/', '');
        const oldFilePath = path.join(audioUploadDir, oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlink(oldFilePath, () => {});
        }
      }
    }

    const updated = await prisma.audioTrack.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(reciter && { reciter: reciter.trim() }),
        ...(duration !== undefined && { duration: duration.trim() }),
        ...(category !== undefined && { category: category.trim() }),
        ...(finalSrc !== undefined && { src: finalSrc }),
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

    let track = await prisma.audioTrack.findUnique({ where: { id } }).catch(() => null);

    // If not found by cuid, try finding by orderIndex if id is a number
    if (!track && !isNaN(Number(id))) {
      track = await prisma.audioTrack.findFirst({
        where: { orderIndex: parseInt(id, 10) - 1 }
      });
    }

    if (!track) {
      // If already deleted or not in DB, still return success so client state is synced
      return res.json({
        success: true,
        message: 'تم حذف المقطع الصوتي بنجاح.',
      });
    }

    // If it was a local uploaded audio file, delete it from disk
    if (track.src && track.src.startsWith('/uploads/audio/')) {
      const filename = track.src.replace('/uploads/audio/', '');
      const filePath = path.join(audioUploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }

    await prisma.audioTrack.delete({ where: { id: track.id } });

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
  uploadAudioFile,
  createAudioTrack,
  updateAudioTrack,
  deleteAudioTrack,
};
