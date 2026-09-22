// src/controllers/bookings.controller.js
// Booking API — handles session reservations with double-booking prevention.
//
//   GET  /api/bookings/raqis     — list available certified raqis
//   GET  /api/bookings/slots     — available slots for a raqi on a date
//   POST /api/bookings           — create booking (authenticated users)
//   GET  /api/bookings/my        — list my bookings (authenticated)
//   GET  /api/bookings/:id       — get single booking detail
//   PATCH /api/bookings/:id/cancel  — cancel a booking
//   GET  /api/bookings/all       — all bookings (ADMIN/RAQI)
//   PATCH /api/bookings/:id/status  — update status (RAQI/ADMIN)

const { validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { createError } = require('../middleware/errorHandler');

// ── GET /api/bookings/raqis ──────────────────────────────────────────────────
// Returns list of available raqis with their profile information (public)
async function getRaqis(req, res, next) {
  try {
    const raqis = await prisma.raqiProfile.findMany({
      where: { isAvailable: true, user: { isActive: true } },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({
      success: true,
      data: raqis.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.user.name,
        bio: r.bio,
        certifications: r.certifications,
        specialties: r.specialties,
        sessionPrice: r.sessionPrice,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Session durations in minutes per service type
const SERVICE_DURATIONS = {
  'جلسة رقية فردية مباشرة':       45,
  'رقية الأطفال والتحصين المنزلي': 45,
  'استشارة تشخيصية وتوجيه':        30,
  'رقية مسجلة مخصصة':              20, // consultation only; recording is async
};

const DEFAULT_DURATION = 45; // minutes

// Working hours: 08:00 – 22:00, slots every 45 min
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR   = 22;

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

// ── GET /api/bookings/slots?raqiId=&date=YYYY-MM-DD ──────────────────────────
// Returns array of available { startTime, endTime } ISO strings for that day.
async function getAvailableSlots(req, res, next) {
  try {
    const { raqiId, date, serviceType } = req.query;

    if (!raqiId || !date) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد raqiId والتاريخ (date).',
      });
    }

    // Parse the date in UTC
    const day = new Date(date);
    if (isNaN(day)) {
      return res.status(400).json({ success: false, message: 'تنسيق التاريخ غير صحيح. استخدم YYYY-MM-DD.' });
    }

    const duration = SERVICE_DURATIONS[serviceType] || DEFAULT_DURATION;

    // Fetch all confirmed/pending bookings for this raqi on this day
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay   = new Date(date + 'T23:59:59.999Z');

    const existingBookings = await prisma.booking.findMany({
      where: {
        raqiId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true },
    });

    // Build all possible slots for the day
    const allSlots = [];
    const slotDate = new Date(date + 'T00:00:00.000Z');

    for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
      for (let m = 0; m < 60; m += duration) {
        const slotStart = new Date(slotDate);
        slotStart.setUTCHours(h, m, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + duration);

        if (slotEnd.getUTCHours() > SLOT_END_HOUR) break;
        allSlots.push({ startTime: slotStart, endTime: slotEnd });
      }
    }

    // Filter out slots that overlap with existing bookings
    const available = allSlots.filter((slot) =>
      !existingBookings.some((b) =>
        slot.startTime < b.endTime && slot.endTime > b.startTime
      )
    );

    res.json({
      success: true,
      raqiId,
      date,
      duration,
      slots: available.map((s) => ({
        startTime: s.startTime.toISOString(),
        endTime:   s.endTime.toISOString(),
        label: `${String(s.startTime.getUTCHours()).padStart(2,'0')}:${String(s.startTime.getUTCMinutes()).padStart(2,'0')}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/bookings ────────────────────────────────────────────────────────
// Create a new booking. Checks for conflicts before inserting.
async function createBooking(req, res, next) {
  try {
    const validationErr = checkValidation(req);
    if (validationErr) return next(validationErr);

    const { raqiId, serviceType, startTime, notes, whatsapp } = req.body;
    const userId = req.user.id;

    // Persist WhatsApp number to user profile if provided
    if (whatsapp) {
      await prisma.user.update({
        where: { id: userId },
        data: { phone: whatsapp.trim() },
      }).catch((err) => console.warn('[Bookings] Failed to update user phone:', err.message));
    }

    const duration = SERVICE_DURATIONS[serviceType] || DEFAULT_DURATION;
    const start = new Date(startTime);
    const end   = new Date(start.getTime() + duration * 60 * 1000);

    // Verify the raqi exists and is available
    const raqi = await prisma.raqiProfile.findUnique({ where: { id: raqiId } });
    if (!raqi) return next(createError('الراقي المحدد غير موجود.', 404));
    if (!raqi.isAvailable) {
      return res.status(409).json({
        success: false,
        message: 'هذا الراقي غير متاح حالياً للحجز. يرجى اختيار راقٍ آخر.',
      });
    }

    // Check for time conflicts (overlapping bookings for same raqi)
    const conflict = await prisma.booking.findFirst({
      where: {
        raqiId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { startTime: { lt: end } },
          { endTime:   { gt: start } },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'هذا الموعد محجوز بالفعل. يرجى اختيار وقت آخر.',
        conflict: {
          startTime: conflict.startTime,
          endTime:   conflict.endTime,
        },
      });
    }

    const bookingNotes = whatsapp
      ? (notes ? `[واتساب: ${whatsapp.trim()}] - ${notes.trim()}` : `[واتساب: ${whatsapp.trim()}]`)
      : (notes || null);

    const booking = await prisma.booking.create({
      data: {
        userId,
        raqiId,
        serviceType,
        startTime: start,
        endTime:   end,
        notes:     bookingNotes,
        status:    'PENDING',
      },
      include: {
        raqi: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'تم إرسال طلب الحجز بنجاح. سيتواصل معك الراقي لتأكيد الرابط الآمن.',
      booking,
    });
  } catch (err) {
    // P2002 = unique constraint violation (raqiId + startTime)
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'هذا الموعد محجوز بالفعل. يرجى اختيار وقت آخر.',
      });
    }
    next(err);
  }
}

// ── GET /api/bookings/my ──────────────────────────────────────────────────────
async function getMyBookings(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;
    const status = req.query.status;

    const where = {
      userId: req.user.id,
      ...(status && { status }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          raqi: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/bookings/:id ─────────────────────────────────────────────────────
async function getBooking(req, res, next) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        raqi: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    if (!booking) return next(createError('الحجز غير موجود.', 404));

    // Users can only see their own bookings; raqi/admin can see all
    if (
      req.user.role === 'USER' &&
      booking.userId !== req.user.id
    ) {
      return next(createError('ليس لديك صلاحية عرض هذا الحجز.', 403));
    }

    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/bookings/:id/cancel ───────────────────────────────────────────
async function cancelBooking(req, res, next) {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return next(createError('الحجز غير موجود.', 404));

    // Only the booking owner or admin can cancel
    if (req.user.role === 'USER' && booking.userId !== req.user.id) {
      return next(createError('ليس لديك صلاحية إلغاء هذا الحجز.', 403));
    }

    if (booking.status === 'CANCELLED') {
      return res.status(409).json({ success: false, message: 'هذا الحجز ملغى بالفعل.' });
    }
    if (booking.status === 'COMPLETED') {
      return res.status(409).json({ success: false, message: 'لا يمكن إلغاء جلسة منتهية.' });
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data:  { status: 'CANCELLED' },
    });

    res.json({ success: true, message: 'تم إلغاء الحجز بنجاح.', booking: updated });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/bookings/all  (RAQI / ADMIN) ────────────────────────────────────
async function getAllBookings(req, res, next) {
  try {
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip   = (page - 1) * limit;
    const status = req.query.status;

    // Raqi can only see their own bookings
    let where = {};
    if (req.user.role === 'RAQI') {
      const profile = await prisma.raqiProfile.findUnique({ where: { userId: req.user.id } });
      if (!profile) return next(createError('ملف الراقي غير موجود.', 404));
      where.raqiId = profile.id;
    }
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'asc' },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          raqi: { include: { user: { select: { name: true } } } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/bookings/:id/status  (RAQI / ADMIN) ───────────────────────────
async function updateBookingStatus(req, res, next) {
  try {
    const { status, sessionLink } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `الحالة غير صالحة. القيم المتاحة: ${validStatuses.join(', ')}`,
      });
    }

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return next(createError('الحجز غير موجود.', 404));

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(sessionLink && { sessionLink }),
      },
      include: {
        user: { select: { name: true, email: true } },
        raqi: { include: { user: { select: { name: true } } } },
      },
    });

    const statusMessages = {
      CONFIRMED:  'تم تأكيد الحجز وإرسال الرابط.',
      CANCELLED:  'تم إلغاء الحجز.',
      COMPLETED:  'تم إتمام الجلسة بنجاح.',
      PENDING:    'تم تحديث حالة الحجز.',
    };

    res.json({ success: true, message: statusMessages[status], booking: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRaqis,
  getAvailableSlots,
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
};
