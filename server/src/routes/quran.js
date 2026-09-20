// src/routes/quran.js
// Routes for Quran data, Ruqyah verses, translations, and verified recitations.

const { Router } = require('express');
const {
  getRuqyahVerses,
  getChapters,
  getReciters,
  getChapterAudio,
  getVerse
} = require('../controllers/quran.controller');

const router = Router();

// Public: get authentic Ruqyah verses collection
router.get('/ruqyah', getRuqyahVerses);

// Public: get all 114 Quran chapters
router.get('/chapters', getChapters);

// Public: get verified reciters for Ruqyah & recitation
router.get('/reciters', getReciters);

// Public: get streaming audio for a chapter and reciter
router.get('/audio', getChapterAudio);

// Public: get specific verse text and translation by key (e.g. 2:255)
router.get('/verse/:key', getVerse);

module.exports = router;
