// src/controllers/seo.controller.js
// SEO Management — Sitemap, IndexNow, Page Meta, Redirects, Robots, Analysis

const fs   = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const SITE_URL    = process.env.SITE_URL    || 'https://roqiaonline.com';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'c03fa41f17e04505bf775083a2169572';
const ROBOTS_PATH  = path.resolve(__dirname, '../../../robots.txt');

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  try { return new Date(date).toISOString().split('T')[0]; }
  catch (_) { return new Date().toISOString().split('T')[0]; }
}

/** Count characters visible to a search engine (strip HTML tags) */
function textLength(str) {
  if (!str) return 0;
  return str.replace(/<[^>]*>/g, '').trim().length;
}

// ─── PUBLIC: Dynamic XML Sitemap ──────────────────────────────────────────────
async function getSitemap(req, res) {
  try {
    const today = formatDate(new Date());
    const urls  = [
      { loc: `${SITE_URL}/`,        lastmod: today, changefreq: 'daily',  priority: '1.0' },
      { loc: `${SITE_URL}/articles`,lastmod: today, changefreq: 'daily',  priority: '0.8' },
      { loc: `${SITE_URL}/forum`,   lastmod: today, changefreq: 'daily',  priority: '0.8' },
      { loc: `${SITE_URL}/llms.txt`,lastmod: today, changefreq: 'weekly', priority: '0.7' },
    ];

    // Fetch dynamic articles
    try {
      const articles = await prisma.article.findMany({
        where: { deletedAt: null },
        select: { id: true, updatedAt: true, publishedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      articles.forEach((art) => urls.push({
        loc: `${SITE_URL}/articles?id=${encodeURIComponent(art.id)}`,
        lastmod: formatDate(art.updatedAt || art.publishedAt),
        changefreq: 'weekly', priority: '0.7',
      }));
    } catch (_) {
      urls.push(
        { loc: `${SITE_URL}/articles?id=1`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
        { loc: `${SITE_URL}/articles?id=2`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
      );
    }

    // Fetch approved forum posts
    try {
      const posts = await prisma.forumPost.findMany({
        where: { status: 'APPROVED', deletedAt: null },
        select: { id: true, updatedAt: true, createdAt: true },
        orderBy: { updatedAt: 'desc' }, take: 100,
      });
      posts.forEach((p) => urls.push({
        loc: `${SITE_URL}/forum?id=${encodeURIComponent(p.id)}`,
        lastmod: formatDate(p.updatedAt || p.createdAt),
        changefreq: 'weekly', priority: '0.6',
      }));
    } catch (_) {}

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach((u) => {
      xml += '  <url>\n';
      xml += `    <loc>${u.loc}</loc>\n`;
      xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += '  </url>\n';
    });
    xml += '</urlset>';

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('[Sitemap] Error:', err);
    return res.status(500).type('text/plain').send('Error generating sitemap.');
  }
}

// ─── PUBLIC: IndexNow Key ─────────────────────────────────────────────────────
function getIndexNowKey(req, res) {
  res.type('text/plain').send(INDEXNOW_KEY);
}

// ─── Reusable IndexNow ping ───────────────────────────────────────────────────
async function pingIndexNow(urlList = []) {
  if (!Array.isArray(urlList) || urlList.length === 0) {
    urlList = [`${SITE_URL}/`, `${SITE_URL}/articles`, `${SITE_URL}/forum`];
  }
  const host    = new URL(SITE_URL).hostname;
  const payload = { host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList };
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, count: urlList.length, urls: urlList };
  } catch (err) {
    return { ok: false, error: err.message, urls: urlList };
  }
}

// ─── ADMIN: Submit IndexNow ───────────────────────────────────────────────────
async function submitIndexNow(req, res) {
  try {
    const raw  = req.body.urls || req.body.urlList || [];
    const urls = Array.isArray(raw) && raw.length
      ? raw.map((u) => (u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`))
      : [`${SITE_URL}/`, `${SITE_URL}/articles`, `${SITE_URL}/forum`];
    const result = await pingIndexNow(urls);
    return res.status(200).json({ success: true, message: 'تم إرسال تنبيه IndexNow بنجاح.', submittedUrls: urls, indexNowResponse: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'تعذر إرسال تنبيه IndexNow.', error: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — PAGE META CRUD
// ═════════════════════════════════════════════════════════════════════════════

// Default page definitions (seeded on first load if DB is empty)
const DEFAULT_PAGES = [
  { pageKey: 'home',     pageUrl: `${SITE_URL}/`,         metaTitle: 'الرقية الشرعية أونلاين | سكينة وطمأنينة بين يديك' },
  { pageKey: 'articles', pageUrl: `${SITE_URL}/articles`,  metaTitle: 'مدونة الشفاء — مقالات الرقية الشرعية' },
  { pageKey: 'forum',    pageUrl: `${SITE_URL}/forum`,     metaTitle: 'منتدى السكينة — استفسارات الرقية' },
  { pageKey: 'portal',   pageUrl: `${SITE_URL}/dashboard`, metaTitle: 'بوابة المستخدم — منصة الرقية الشرعية' },
];

/** GET /api/seo/pages — list all page meta entries */
async function listPageMeta(req, res) {
  try {
    let pages = await prisma.seoPageMeta.findMany({ orderBy: { updatedAt: 'desc' } });

    // Seed defaults if empty
    if (pages.length === 0) {
      await prisma.seoPageMeta.createMany({ data: DEFAULT_PAGES, skipDuplicates: true });
      pages = await prisma.seoPageMeta.findMany({ orderBy: { updatedAt: 'desc' } });
    }

    // Also include dynamic article SEO entries
    const articles = await prisma.article.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, excerpt: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    }).catch(() => []);

    const articleMeta = await prisma.seoPageMeta.findMany({
      where: { pageKey: { startsWith: 'article:' } },
    }).catch(() => []);

    const articleMetaMap = Object.fromEntries(articleMeta.map((m) => [m.pageKey, m]));
    const dynamicArticlePages = articles.map((art) => ({
      ...(articleMetaMap[`article:${art.id}`] || {
        pageKey: `article:${art.id}`,
        pageUrl: `${SITE_URL}/articles?id=${art.id}`,
        metaTitle: art.title,
        metaDesc: art.excerpt,
        robotsIndex: true,
        robotsFollow: true,
      }),
      _articleTitle: art.title,
    }));

    return res.json({ success: true, pages, dynamicArticlePages });
  } catch (err) {
    console.error('[SEO] listPageMeta error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في جلب بيانات SEO.', error: err.message });
  }
}

/** GET /api/seo/pages/:pageKey — single page meta */
async function getPageMeta(req, res) {
  try {
    const { pageKey } = req.params;
    const meta = await prisma.seoPageMeta.findUnique({ where: { pageKey } });
    return res.json({ success: true, meta: meta || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في جلب البيانات.', error: err.message });
  }
}

/** PUT /api/seo/pages/:pageKey — upsert page meta */
async function savePageMeta(req, res) {
  try {
    const { pageKey } = req.params;
    const {
      pageUrl, metaTitle, metaDesc, keywords, canonical,
      ogTitle, ogDesc, ogImage, twitterCard,
      robotsIndex, robotsFollow, schemaJson, focusKeyword, customSlug, altText,
    } = req.body;

    const meta = await prisma.seoPageMeta.upsert({
      where: { pageKey },
      update: {
        pageUrl: pageUrl || undefined,
        metaTitle: metaTitle ?? undefined,
        metaDesc: metaDesc ?? undefined,
        keywords: keywords ?? undefined,
        canonical: canonical ?? undefined,
        ogTitle: ogTitle ?? undefined,
        ogDesc: ogDesc ?? undefined,
        ogImage: ogImage ?? undefined,
        twitterCard: twitterCard ?? undefined,
        robotsIndex: robotsIndex !== undefined ? Boolean(robotsIndex) : undefined,
        robotsFollow: robotsFollow !== undefined ? Boolean(robotsFollow) : undefined,
        schemaJson: schemaJson ?? undefined,
        focusKeyword: focusKeyword ?? undefined,
        customSlug: customSlug ?? undefined,
        altText: altText ?? undefined,
      },
      create: {
        pageKey,
        pageUrl: pageUrl || `${SITE_URL}/`,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        keywords: keywords || null,
        canonical: canonical || null,
        ogTitle: ogTitle || null,
        ogDesc: ogDesc || null,
        ogImage: ogImage || null,
        twitterCard: twitterCard || 'summary_large_image',
        robotsIndex: robotsIndex !== false,
        robotsFollow: robotsFollow !== false,
        schemaJson: schemaJson || null,
        focusKeyword: focusKeyword || null,
        customSlug: customSlug || null,
        altText: altText || null,
      },
    });

    return res.json({ success: true, message: 'تم حفظ إعدادات SEO بنجاح.', meta });
  } catch (err) {
    console.error('[SEO] savePageMeta error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ البيانات.', error: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — REDIRECTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/seo/redirects */
async function listRedirects(req, res) {
  try {
    const redirects = await prisma.seoRedirect.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, redirects });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في جلب التحويلات.', error: err.message });
  }
}

/** POST /api/seo/redirects */
async function createRedirect(req, res) {
  try {
    const { fromPath, toUrl, statusCode, note } = req.body;
    if (!fromPath || !toUrl) {
      return res.status(422).json({ success: false, message: 'fromPath و toUrl مطلوبان.' });
    }
    const redirect = await prisma.seoRedirect.create({
      data: {
        fromPath: fromPath.trim(),
        toUrl: toUrl.trim(),
        statusCode: parseInt(statusCode) || 301,
        note: note || null,
      },
    });
    return res.status(201).json({ success: true, message: 'تم إنشاء التحويل بنجاح.', redirect });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'هذا المسار موجود مسبقاً في قائمة التحويلات.' });
    }
    return res.status(500).json({ success: false, message: 'خطأ في إنشاء التحويل.', error: err.message });
  }
}

/** PATCH /api/seo/redirects/:id — toggle active */
async function toggleRedirect(req, res) {
  try {
    const redirect = await prisma.seoRedirect.findUnique({ where: { id: req.params.id } });
    if (!redirect) return res.status(404).json({ success: false, message: 'التحويل غير موجود.' });
    const updated = await prisma.seoRedirect.update({
      where: { id: req.params.id },
      data: { isActive: !redirect.isActive },
    });
    return res.json({ success: true, message: 'تم تحديث حالة التحويل.', redirect: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في التحديث.', error: err.message });
  }
}

/** DELETE /api/seo/redirects/:id */
async function deleteRedirect(req, res) {
  try {
    await prisma.seoRedirect.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'تم حذف التحويل بنجاح.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في الحذف.', error: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — ROBOTS.TXT
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/seo/robots */
function getRobots(req, res) {
  try {
    const content = fs.existsSync(ROBOTS_PATH) ? fs.readFileSync(ROBOTS_PATH, 'utf8') : '';
    return res.json({ success: true, content });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في قراءة robots.txt.', error: err.message });
  }
}

/** PUT /api/seo/robots */
function saveRobots(req, res) {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(422).json({ success: false, message: 'محتوى robots.txt مطلوب.' });
    }
    fs.writeFileSync(ROBOTS_PATH, content, 'utf8');
    return res.json({ success: true, message: 'تم حفظ robots.txt بنجاح.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في حفظ robots.txt.', error: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — SEO ANALYSIS ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function analyzePageMeta(pageKey, pageUrl, meta) {
  const issues   = [];
  let   score    = 100;

  const title  = meta?.metaTitle   || '';
  const desc   = meta?.metaDesc    || '';
  const canon  = meta?.canonical   || '';
  const ogImg  = meta?.ogImage     || '';
  const schema = meta?.schemaJson  || '';
  const focus  = meta?.focusKeyword|| '';
  const kw     = meta?.keywords    || '';

  // ── Meta Title ────────────────────────────────────────────────────────────
  if (!title) {
    issues.push({ severity: 'critical', code: 'MISSING_TITLE', label: 'عنوان الصفحة (Meta Title) مفقود' });
    score -= 20;
  } else if (textLength(title) < 30) {
    issues.push({ severity: 'warning', code: 'TITLE_TOO_SHORT', label: `عنوان الصفحة قصير جداً (${textLength(title)} حرف — الحد الأدنى 30)` });
    score -= 8;
  } else if (textLength(title) > 60) {
    issues.push({ severity: 'warning', code: 'TITLE_TOO_LONG', label: `عنوان الصفحة طويل جداً (${textLength(title)} حرف — الحد الأقصى 60)` });
    score -= 5;
  }

  // ── Meta Description ──────────────────────────────────────────────────────
  if (!desc) {
    issues.push({ severity: 'critical', code: 'MISSING_DESC', label: 'وصف الصفحة (Meta Description) مفقود' });
    score -= 15;
  } else if (textLength(desc) < 120) {
    issues.push({ severity: 'warning', code: 'DESC_TOO_SHORT', label: `الوصف قصير جداً (${textLength(desc)} حرف — الأمثل 120-160)` });
    score -= 8;
  } else if (textLength(desc) > 160) {
    issues.push({ severity: 'warning', code: 'DESC_TOO_LONG', label: `الوصف طويل جداً (${textLength(desc)} حرف — الأمثل 120-160)` });
    score -= 5;
  }

  // ── Canonical ─────────────────────────────────────────────────────────────
  if (!canon) {
    issues.push({ severity: 'warning', code: 'MISSING_CANONICAL', label: 'رابط Canonical غير محدد — قد يسبب مشاكل التكرار' });
    score -= 8;
  }

  // ── OG Image ─────────────────────────────────────────────────────────────
  if (!ogImg) {
    issues.push({ severity: 'warning', code: 'MISSING_OG_IMAGE', label: 'صورة Open Graph (og:image) مفقودة — تؤثر على معاينة الروابط في وسائل التواصل' });
    score -= 8;
  }

  // ── Keywords ─────────────────────────────────────────────────────────────
  if (!kw) {
    issues.push({ severity: 'info', code: 'MISSING_KEYWORDS', label: 'الكلمات المفتاحية (Keywords) غير محددة' });
    score -= 3;
  }

  // ── Focus Keyword in Title ────────────────────────────────────────────────
  if (focus && title && !title.toLowerCase().includes(focus.toLowerCase())) {
    issues.push({ severity: 'warning', code: 'FOCUS_KW_NOT_IN_TITLE', label: `الكلمة المفتاحية الرئيسية "${focus}" غير موجودة في عنوان الصفحة` });
    score -= 7;
  }

  // ── Focus Keyword in Description ─────────────────────────────────────────
  if (focus && desc && !desc.toLowerCase().includes(focus.toLowerCase())) {
    issues.push({ severity: 'info', code: 'FOCUS_KW_NOT_IN_DESC', label: `الكلمة المفتاحية الرئيسية "${focus}" غير موجودة في الوصف` });
    score -= 3;
  }

  // ── Structured Data ───────────────────────────────────────────────────────
  if (!schema) {
    issues.push({ severity: 'info', code: 'MISSING_SCHEMA', label: 'بيانات Schema.org المنظمة (JSON-LD) غير مضافة' });
    score -= 5;
  } else {
    try { JSON.parse(schema); }
    catch (_) {
      issues.push({ severity: 'critical', code: 'INVALID_SCHEMA_JSON', label: 'بيانات Schema.org تحتوي على JSON غير صالح' });
      score -= 10;
    }
  }

  // ── Robots ────────────────────────────────────────────────────────────────
  if (meta && meta.robotsIndex === false) {
    issues.push({ severity: 'info', code: 'NOINDEX_SET', label: 'الصفحة مضبوطة على noindex — لن تظهر في نتائج البحث' });
  }

  score = Math.max(0, Math.min(100, score));
  return { issues, score };
}

/** POST /api/seo/analyze — run analysis on all known pages + articles */
async function runAnalysis(req, res) {
  try {
    const pages = await prisma.seoPageMeta.findMany();
    const metaMap = Object.fromEntries(pages.map((p) => [p.pageKey, p]));

    // Static pages
    const staticPages = DEFAULT_PAGES.map((p) => ({
      pageKey: p.pageKey,
      pageUrl: p.pageUrl,
      pageTitle: metaMap[p.pageKey]?.metaTitle || p.metaTitle || p.pageKey,
    }));

    // Dynamic article pages
    const articles = await prisma.article.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, excerpt: true },
    }).catch(() => []);

    const allPages = [
      ...staticPages,
      ...articles.map((art) => ({
        pageKey: `article:${art.id}`,
        pageUrl: `${SITE_URL}/articles?id=${art.id}`,
        pageTitle: art.title,
        _defaultDesc: art.excerpt,
      })),
    ];

    const results = [];

    for (const page of allPages) {
      const meta = metaMap[page.pageKey] || null;

      // For articles without explicit meta, use article fields as implicit meta
      const effectiveMeta = meta || (page._defaultDesc ? {
        metaTitle: page.pageTitle,
        metaDesc: page._defaultDesc,
        canonical: page.pageUrl,
        ogImage: null, keywords: null, schemaJson: null, focusKeyword: null,
        robotsIndex: true, robotsFollow: true,
      } : null);

      const { issues, score } = analyzePageMeta(page.pageKey, page.pageUrl, effectiveMeta);

      await prisma.seoIssue.upsert({
        where: { pageKey: page.pageKey },
        update: { pageUrl: page.pageUrl, pageTitle: page.pageTitle, seoScore: score, issues: JSON.stringify(issues), scannedAt: new Date() },
        create: { pageKey: page.pageKey, pageUrl: page.pageUrl, pageTitle: page.pageTitle, seoScore: score, issues: JSON.stringify(issues) },
      });

      results.push({ pageKey: page.pageKey, pageUrl: page.pageUrl, pageTitle: page.pageTitle, seoScore: score, issues });
    }

    const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.seoScore, 0) / results.length) : 0;

    return res.json({
      success: true,
      message: `تم تحليل ${results.length} صفحة بنجاح.`,
      avgScore,
      totalPages: results.length,
      results,
    });
  } catch (err) {
    console.error('[SEO] runAnalysis error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في تشغيل التحليل.', error: err.message });
  }
}

/** GET /api/seo/analysis — return cached analysis results */
async function getAnalysis(req, res) {
  try {
    const issues = await prisma.seoIssue.findMany({ orderBy: { seoScore: 'asc' } });
    const parsed = issues.map((i) => ({ ...i, issues: JSON.parse(i.issues || '[]') }));
    const avgScore = parsed.length
      ? Math.round(parsed.reduce((s, r) => s + r.seoScore, 0) / parsed.length)
      : null;
    return res.json({ success: true, avgScore, results: parsed });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ في جلب نتائج التحليل.', error: err.message });
  }
}

// ─── exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // public
  getSitemap,
  getIndexNowKey,
  pingIndexNow,
  // admin
  submitIndexNow,
  listPageMeta,
  getPageMeta,
  savePageMeta,
  listRedirects,
  createRedirect,
  toggleRedirect,
  deleteRedirect,
  getRobots,
  saveRobots,
  runAnalysis,
  getAnalysis,
};
