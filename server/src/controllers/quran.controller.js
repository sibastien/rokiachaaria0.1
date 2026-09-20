// src/controllers/quran.controller.js
// Express controller for QuranJS & Quran data endpoints.

const quranService = require('../services/quran.service');

// ── GET /api/quran/ruqyah ───────────────────────────────────────────────────
async function getRuqyahVerses(req, res, next) {
  try {
    const verses = await quranService.getRuqyahVerses();
    res.json({
      success: true,
      data: verses,
      count: verses.length,
      source: '@quranjs/api + Quran.com'
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/quran/chapters ─────────────────────────────────────────────────
async function getChapters(req, res, next) {
  try {
    const language = req.query.language || 'ar';
    const chapters = await quranService.getChapters(language);
    res.json({
      success: true,
      data: chapters,
      count: chapters.length
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/quran/reciters ─────────────────────────────────────────────────
async function getReciters(req, res, next) {
  try {
    const reciters = await quranService.getReciters();
    res.json({
      success: true,
      data: reciters,
      count: reciters.length
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/quran/audio ────────────────────────────────────────────────────
// Query parameters: chapter (1-114), reciter (reciter ID, default 7 for Alafasy)
async function getChapterAudio(req, res, next) {
  try {
    const { chapter, reciter } = req.query;
    if (!chapter) {
      return res.status(400).json({
        success: false,
        message: 'رقم السورة مطلوب (من 1 إلى 114).'
      });
    }

    const audioData = await quranService.getChapterAudio(chapter, reciter || 7);
    res.json({
      success: true,
      data: audioData
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/quran/verse/:key ───────────────────────────────────────────────
async function getVerse(req, res, next) {
  try {
    const verseKey = req.params.key;
    const verse = await quranService.getVerse(verseKey);
    if (!verse) {
      return res.status(404).json({
        success: false,
        message: 'تعذر العثور على الآية المطلوبة.'
      });
    }

    res.json({
      success: true,
      data: verse
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRuqyahVerses,
  getChapters,
  getReciters,
  getChapterAudio,
  getVerse
};
