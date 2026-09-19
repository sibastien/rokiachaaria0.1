// src/routes/audio.js
// Routes for Audio Recitations Library

const { Router } = require('express');
const {
  getAudioTracks,
  createAudioTrack,
  updateAudioTrack,
  deleteAudioTrack,
} = require('../controllers/audio.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

// Public: get audio tracks
router.get('/', getAudioTracks);

// Admin only: create, update, delete audio tracks
router.post(  '/',    authenticate, requireRole('ADMIN'), createAudioTrack);
router.put(   '/:id', authenticate, requireRole('ADMIN'), updateAudioTrack);
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteAudioTrack);

module.exports = router;
