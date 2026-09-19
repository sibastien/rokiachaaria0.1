// src/controllers/settings.controller.js
// Site Settings CMS API — controls global frontend texts and policies.

const prisma = require('../config/prisma');

const DEFAULT_SETTINGS = {
  id: 'default',
  bannerActive: true,
  bannerText: 'جميع الرقاة لدينا معتمدون ومجازون في قراءة القرآن الكريم والسنة النبوية الصحيحة بلا بدع',
  heroTitle: 'منصة الرقية الشرعية المعتمدة أونلاين',
  heroSubtitle: 'تواصل مباشرة بالصوت والصورة مع نخبة من الرقاة والمشايخ المعتمدين والمجازين شرعياً في سرية وأمان تام',
  whatsapp: '+966500000000',
  supportEmail: 'support@roqia.com',
  sessionDuration: 45,
  bookingNotice: 'يجب تواجد محرم للنساء أثناء الجلسة المرئية',
};

// ── GET /api/settings (Public) ────────────────────────────────────────────────
async function getSettings(req, res, next) {
  try {
    let settings = await prisma.siteSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.siteSetting.create({
        data: DEFAULT_SETTINGS,
      });
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    // If table doesn't exist yet, return defaults gracefully
    res.json({ success: true, data: DEFAULT_SETTINGS, fallback: true });
  }
}

// ── PUT /api/settings (ADMIN only) ───────────────────────────────────────────
async function updateSettings(req, res, next) {
  try {
    const {
      bannerActive,
      bannerText,
      heroTitle,
      heroSubtitle,
      whatsapp,
      supportEmail,
      sessionDuration,
      bookingNotice,
    } = req.body;

    const updated = await prisma.siteSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(bannerActive !== undefined && { bannerActive: Boolean(bannerActive) }),
        ...(bannerText !== undefined && { bannerText: String(bannerText).trim() }),
        ...(heroTitle !== undefined && { heroTitle: String(heroTitle).trim() }),
        ...(heroSubtitle !== undefined && { heroSubtitle: String(heroSubtitle).trim() }),
        ...(whatsapp !== undefined && { whatsapp: String(whatsapp).trim() }),
        ...(supportEmail !== undefined && { supportEmail: String(supportEmail).trim() }),
        ...(sessionDuration !== undefined && { sessionDuration: parseInt(sessionDuration, 10) || 45 }),
        ...(bookingNotice !== undefined && { bookingNotice: String(bookingNotice).trim() }),
      },
      create: {
        id: 'default',
        bannerActive: bannerActive !== undefined ? Boolean(bannerActive) : DEFAULT_SETTINGS.bannerActive,
        bannerText: bannerText ? String(bannerText).trim() : DEFAULT_SETTINGS.bannerText,
        heroTitle: heroTitle ? String(heroTitle).trim() : DEFAULT_SETTINGS.heroTitle,
        heroSubtitle: heroSubtitle ? String(heroSubtitle).trim() : DEFAULT_SETTINGS.heroSubtitle,
        whatsapp: whatsapp ? String(whatsapp).trim() : DEFAULT_SETTINGS.whatsapp,
        supportEmail: supportEmail ? String(supportEmail).trim() : DEFAULT_SETTINGS.supportEmail,
        sessionDuration: parseInt(sessionDuration, 10) || 45,
        bookingNotice: bookingNotice ? String(bookingNotice).trim() : DEFAULT_SETTINGS.bookingNotice,
      },
    });

    res.json({
      success: true,
      message: 'تم تحديث إعدادات ونصوص الموقع بنجاح في قاعدة البيانات.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
};
