// src/routes/audio.js
// Routes for Audio Recitations Library

const { Router } = require('express');
const {
  getAudioTracks,
  uploadAudioFile,
  createAudioTrack,
  updateAudioTrack,
  deleteAudioTrack,
} = require('../controllers/audio.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleAudioUpload } = require('../middleware/upload');

const router = Router();

// Public: get audio tracks
router.get('/', getAudioTracks);

// Admin only: upload standalone audio file
router.post('/upload', authenticate, requireRole('ADMIN'), handleAudioUpload, uploadAudioFile);

// Admin only: create, update, delete audio tracks (supports optional multipart file upload directly)
router.post(  '/',    authenticate, requireRole('ADMIN'), handleAudioUpload, createAudioTrack);
router.put(   '/:id', authenticate, requireRole('ADMIN'), handleAudioUpload, updateAudioTrack);
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteAudioTrack);

module.exports = router;
