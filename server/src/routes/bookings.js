// src/routes/bookings.js — Full implementation (Step 3)

const { Router } = require('express');
const {
  getRaqis,
  getAvailableSlots,
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
} = require('../controllers/bookings.controller');

const { authenticate, requireRole } = require('../middleware/auth');
const { createBookingRules } = require('../validators/bookings.validators');

const router = Router();

// ── Public discovery routes (unauthenticated) ─────────────────────────────────
// Get list of certified raqis
router.get('/raqis', getRaqis);

// Available time slots for a raqi on a given date
router.get('/slots', getAvailableSlots);

// ── Protected user routes (require JWT) ───────────────────────────────────────
router.use(authenticate);

// Create a booking
router.post('/', createBookingRules, createBooking);

// My bookings list
router.get('/my', getMyBookings);

// Single booking detail (owner or admin/raqi)
router.get('/:id', getBooking);

// Cancel a booking (owner or admin)
router.patch('/:id/cancel', cancelBooking);

// ── Raqi / Admin routes ───────────────────────────────────────────────────────
// All bookings (raqi sees own; admin sees all)
router.get('/all', requireRole('RAQI', 'ADMIN'), getAllBookings);

// Update booking status + add session link
router.patch('/:id/status', requireRole('RAQI', 'ADMIN'), updateBookingStatus);

module.exports = router;
